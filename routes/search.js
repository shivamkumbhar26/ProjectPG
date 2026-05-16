// ============================================================
//  routes/search.js
//  Public routes — no login required.
//  Users search and view approved PGs.
//
//  Add to server.js:
//    const searchRoutes = require('./routes/search')
//    app.use('/', searchRoutes)
//
//  Also add these to auth.js whitelist:
//    '/pgs'
//    '/pgs/:pgId'  → use startsWith check for dynamic routes
// ============================================================

const express = require('express')
const router  = express.Router()

const pool   = require('../db/pool')
const result = require('../utils/result')
const s3     = require('../utils/s3')


// ============================================================
//  SEARCH PGS
//  GET /pgs
//  Public — no auth needed
//
//  Query params (all optional):
//    city, area, district
//    gender_allowed     → male | female | any
//    food_included      → 1 | 0
//    min_price          → minimum price per month
//    max_price          → maximum price per month
//    amenities          → comma separated e.g. "wifi,ac,parking"
//
//  Example:
//    GET /pgs?city=Sangli&gender_allowed=female&max_price=6000
// ============================================================
router.get('/pgs', (req, res) => {

    const {
        city,
        area,
        district,
        gender_allowed,
        food_included,
        min_price,
        max_price,
        amenities
    } = req.query

    // Base query — only APPROVED and active PGs
    let sql = `
        SELECT DISTINCT
            p.id,
            p.title,
            p.address_line,
            p.area,
            p.city,
            p.district,
            p.gender_allowed,
            p.food_included,
            p.amenities,
            p.notice_period_days,
            MIN(rc.price_per_month)  AS min_price,
            MAX(rc.price_per_month)  AS max_price,
            COUNT(DISTINCT rc.id)    AS roomCategoryCount,
            COALESCE(
                SUM(rc.total_slots) - SUM(r_occ.occupied_total), 0
            )                        AS totalAvailableSlots,
            COALESCE(AVG(rv.rating), 0) AS avgRating,
            COUNT(DISTINCT rv.id)       AS reviewCount
        FROM pgs p
        LEFT JOIN room_categories rc  ON rc.pg_id   = p.id  AND rc.is_active = 1
        LEFT JOIN (
            SELECT room_category_id, SUM(occupied_slots) AS occupied_total
            FROM rooms
            WHERE is_active = 1
            GROUP BY room_category_id
        ) r_occ                       ON r_occ.room_category_id = rc.id
        LEFT JOIN reviews rv          ON rv.pg_id   = p.id  AND rv.is_visible = 1
        WHERE p.verification_status   = 'APPROVED'
          AND p.is_active             = 1
    `

    const params = []

    // Apply filters dynamically
    if (city) {
        sql += ' AND p.city = ?'
        params.push(city)
    }

    if (area) {
        sql += ' AND p.area = ?'
        params.push(area)
    }

    if (district) {
        sql += ' AND p.district = ?'
        params.push(district)
    }

    if (gender_allowed && ['male', 'female', 'any'].includes(gender_allowed)) {
        sql += ' AND p.gender_allowed IN (?, "any")'
        params.push(gender_allowed)
    }

    if (food_included !== undefined) {
        sql += ' AND p.food_included = ?'
        params.push(food_included === '1' ? 1 : 0)
    }

    if (min_price) {
        sql += ' AND rc.price_per_month >= ?'
        params.push(parseFloat(min_price))
    }

    if (max_price) {
        sql += ' AND rc.price_per_month <= ?'
        params.push(parseFloat(max_price))
    }

    // Amenities filter — check each requested amenity exists in JSON array
    if (amenities) {
        const amenityList = amenities.split(',').map(a => a.trim()).filter(Boolean)
        amenityList.forEach(amenity => {
            sql += ` AND JSON_CONTAINS(p.amenities, ?)`
            params.push(JSON.stringify(amenity))
        })
    }

    sql += ' GROUP BY p.id ORDER BY avgRating DESC, p.created_at DESC'

    pool.query(sql, params, async (err, pgs) => {
        if (err) {
            return res.send(result.createResult("Database error, try later"))
        }

        if (pgs.length === 0) {
            return res.send(result.createResult(null, []))
        }

        // Get cover image for each PG
        const pgIds = pgs.map(p => p.id)

        const coverImgSql = `
            SELECT pg_id, image_url
            FROM pg_images
            WHERE pg_id IN (?) AND is_cover = 1
        `

        pool.query(coverImgSql, [pgIds], async (err, coverImages) => {
            if (err) {
                return res.send(result.createResult("Database error, try later"))
            }

            // Generate view URL for each cover image
            const coverMap = {}
            await Promise.all(
                coverImages.map(async (img) => {
                    coverMap[img.pg_id] = await s3.getViewUrl(img.image_url)
                })
            )

            // Attach cover image to each PG
            const pgsWithCover = pgs.map(pg => ({
                ...pg,
                amenities:
                    typeof pg.amenities === 'string'
                        ? JSON.parse(pg.amenities)
                        : (pg.amenities || []),
                coverImage: coverMap[pg.id] || null
            }))

            return res.send(result.createResult(null, pgsWithCover))
        })
    })
})


// ============================================================
//  VIEW ONE PG FULL DETAIL
//  GET /pgs/:pgId
//  Public — no auth needed
//
//  Returns full PG info with:
//    - All images
//    - All room categories with available slots
//    - Room category images
//    - Reviews with ratings
// ============================================================
router.get('/pgs/:pgId', (req, res) => {

    const { pgId } = req.params

    // Get PG details
    const pgSql = `
        SELECT
            p.id, p.title, p.description,
            p.address_line, p.area, p.city,
            p.district, p.pincode,
            p.latitude, p.longitude,
            p.gender_allowed, p.food_included,
            p.notice_period_days, p.amenities,
            u.name  AS ownerName,
            u.phone AS ownerPhone,
            COALESCE(AVG(rv.rating), 0)  AS avgRating,
            COUNT(DISTINCT rv.id)        AS reviewCount
        FROM pgs p
        JOIN owners o       ON o.id = p.owner_id
        JOIN users u        ON u.id = o.user_id
        LEFT JOIN reviews rv ON rv.pg_id = p.id AND rv.is_visible = 1
        WHERE p.id                  = ?
          AND p.verification_status = 'APPROVED'
          AND p.is_active           = 1
        GROUP BY p.id
    `

    pool.query(pgSql, [pgId], (err, pgData) => {
        if (err)                 return res.send(result.createResult("Database error, try later"))
        if (pgData.length === 0) return res.send(result.createResult("PG not found"))

        const pg = pgData[0]
        pg.amenities =  typeof pg.amenities === 'string'
                        ? JSON.parse(pg.amenities)
                        : (pg.amenities || []) ;

        // Get all PG images
        const imgSql = `
            SELECT id, image_url, label, is_cover
            FROM pg_images
            WHERE pg_id = ?
            ORDER BY is_cover DESC
        `

        pool.query(imgSql, [pgId], async (err, images) => {
            if (err) return res.send(result.createResult("Database error, try later"))

            // Get room categories with available slots
            const catSql = `
                SELECT
                    rc.id,
                    rc.category_name,
                    rc.capacity,
                    rc.total_units,
                    rc.total_slots,
                    rc.price_per_month,
                    rc.deposit_amount,
                    rc.description,
                    rc.total_slots - COALESCE(SUM(r.occupied_slots), 0) AS available_slots
                FROM room_categories rc
                LEFT JOIN rooms r ON r.room_category_id = rc.id AND r.is_active = 1
                WHERE rc.pg_id    = ?
                  AND rc.is_active = 1
                GROUP BY rc.id
                ORDER BY rc.price_per_month ASC
            `

            pool.query(catSql, [pgId], (err, categories) => {
                if (err) return res.send(result.createResult("Database error, try later"))

                const catIds = categories.map(c => c.id)

                // Get room category images
                const fetchCatImages = (callback) => {
                    if (catIds.length === 0) return callback(null, [])
                    const catImgSql = `
                        SELECT id, room_category_id, image_url, is_cover
                        FROM room_category_images
                        WHERE room_category_id IN (?)
                        ORDER BY is_cover DESC
                    `
                    pool.query(catImgSql, [catIds], callback)
                }

                fetchCatImages((err, catImages) => {
                    if (err) return res.send(result.createResult("Database error, try later"))

                    // Get recent reviews
                    const reviewSql = `
                        SELECT
                            rv.id, rv.rating, rv.comment, rv.created_at,
                            u.name AS reviewerName
                        FROM reviews rv
                        JOIN users u ON u.id = rv.user_id
                        WHERE rv.pg_id      = ?
                          AND rv.is_visible = 1
                        ORDER BY rv.created_at DESC
                        LIMIT 10
                    `

                    pool.query(reviewSql, [pgId], async (err, reviews) => {
                        if (err) return res.send(result.createResult("Database error, try later"))

                        // Generate view URLs for PG images
                        const imagesWithUrls = await Promise.all(
                            images.map(async (img) => ({
                                id:       img.id,
                                label:    img.label,
                                isCover:  img.is_cover,
                                viewUrl:  await s3.getViewUrl(img.image_url)
                            }))
                        )

                        // Generate view URLs for room category images
                        const catImagesWithUrls = await Promise.all(
                            catImages.map(async (img) => ({
                                id:             img.id,
                                roomCategoryId: img.room_category_id,
                                isCover:        img.is_cover,
                                viewUrl:        await s3.getViewUrl(img.image_url)
                            }))
                        )

                        // Attach images to their room category
                        const categoriesWithImages = categories.map(cat => ({
                            ...cat,
                            availableSlots: cat.available_slots,
                            isFull:         cat.available_slots <= 0,
                            images:         catImagesWithUrls.filter(
                                                i => i.roomCategoryId === cat.id
                                            )
                        }))

                        return res.send(result.createResult(null, {
                            ...pg,
                            images:         imagesWithUrls,
                            roomCategories: categoriesWithImages,
                            reviews
                        }))
                    })
                })
            })
        })
    })
})


module.exports = router