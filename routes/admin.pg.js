// ============================================================
//  routes/admin.pg.js
//  PG verification workflow.
//
//  Sub admin  → reviews PG details, sends to super admin
//  Super admin → final approve or reject
//
//  Add to server.js:
//    const adminPgRoutes = require('./routes/admin.pg')
//    app.use('/', adminPgRoutes)
// ============================================================

const express = require('express')
const router  = express.Router()

const pool   = require('../db/pool')
const result = require('../utils/result')
const s3     = require('../utils/s3')
const { checkSubAdmin, checkAdmin, checkOwner } = require('../middlewares/role')


// ============================================================
//  GET ALL PENDING PGS
//  GET /admin/pending-pgs
//  Role: sub_admin, super_admin
//
//  Sub admin opens this list to find PGs waiting for review.
// ============================================================
router.get('/admin/pending-pgs', checkSubAdmin, (req, res) => {

    const sql = `
        SELECT
            p.id            AS pgId,
            p.title,
            p.area,
            p.city,
            p.district,
            p.gender_allowed,
            p.food_included,
            p.verification_status,
            p.created_at,
            u.name          AS ownerName,
            u.email         AS ownerEmail,
            u.phone         AS ownerPhone,
            COUNT(DISTINCT rc.id) AS roomCategoryCount,
            COUNT(DISTINCT r.id)  AS totalRooms
        FROM pgs p
        JOIN owners o         ON o.id  = p.owner_id
        JOIN users u          ON u.id  = o.user_id
        LEFT JOIN room_categories rc ON rc.pg_id = p.id
        LEFT JOIN rooms r     ON r.pg_id = p.id
        WHERE p.verification_status = 'PENDING_VERIFICATION'
        GROUP BY p.id
        ORDER BY p.created_at ASC
    `

    pool.query(sql, (err, data) => {
        if (err) return res.send(result.createResult("Database error, try later"))
        return res.send(result.createResult(null, data))
    })
})


// ============================================================
//  GET FULL PG DETAIL FOR REVIEW
//  GET /admin/pg/:pgId
//  Role: sub_admin, super_admin
//
//  Sub admin views everything — PG info, images,
//  room categories, individual rooms — before deciding.
// ============================================================
router.get('/admin/pg/:pgId', checkSubAdmin, (req, res) => {

    const { pgId } = req.params

    // Get PG details with owner info
    const pgSql = `
        SELECT
            p.*,
            u.name      AS ownerName,
            u.email     AS ownerEmail,
            u.phone     AS ownerPhone,
            reviewer.name AS reviewedByName
        FROM pgs p
        JOIN owners o       ON o.id  = p.owner_id
        JOIN users u        ON u.id  = o.user_id
        LEFT JOIN users reviewer ON reviewer.id = p.reviewed_by
        WHERE p.id = ?
    `

    pool.query(pgSql, [pgId], (err, pgData) => {
        if (err)                return res.send(result.createResult("Database error, try later"))
        if (pgData.length === 0) return res.send(result.createResult("PG not found"))

        const pg = pgData[0]

        // Get PG images with view URLs
        const imgSql = 'SELECT id, image_url, label, is_cover FROM pg_images WHERE pg_id = ?'
        pool.query(imgSql, [pgId], async (err, images) => {
            if (err) return res.send(result.createResult("Database error, try later"))

            // Get room categories
            const catSql = `
                SELECT id, category_name, capacity, total_units,
                       total_slots, rooms_entered,
                       price_per_month, deposit_amount, description
                FROM room_categories
                WHERE pg_id = ? AND is_active = 1
            `
            pool.query(catSql, [pgId], (err, categories) => {
                if (err) return res.send(result.createResult("Database error, try later"))

                // Get room category images
                const catIds = categories.map(c => c.id)

                if (catIds.length === 0) {
                    return buildAndSendResponse(pg, images, categories, [], res)
                }

                const catImgSql = `
                    SELECT id, room_category_id, image_url, is_cover
                    FROM room_category_images
                    WHERE room_category_id IN (?)
                `
                pool.query(catImgSql, [catIds], (err, catImages) => {
                    if (err) return res.send(result.createResult("Database error, try later"))

                    // Get individual rooms
                    const roomsSql = `
                        SELECT id, room_category_id, room_number,
                               floor, occupied_slots, notes
                        FROM rooms
                        WHERE pg_id = ? AND is_active = 1
                        ORDER BY room_number ASC
                    `
                    pool.query(roomsSql, [pgId], async (err, rooms) => {
                        if (err) return res.send(result.createResult("Database error, try later"))

                        // Generate view URLs for PG images
                        const imagesWithUrls = await Promise.all(
                            images.map(async (img) => ({
                                ...img,
                                viewUrl: await s3.getViewUrl(img.image_url)
                            }))
                        )

                        // Generate view URLs for room category images
                        const catImagesWithUrls = await Promise.all(
                            catImages.map(async (img) => ({
                                ...img,
                                viewUrl: await s3.getViewUrl(img.image_url)
                            }))
                        )

                        // Group rooms and images under their category
                        const categoriesWithData = categories.map((cat) => ({
                            ...cat,
                            images: catImagesWithUrls.filter(i => i.room_category_id === cat.id),
                            rooms:  rooms.filter(r => r.room_category_id === cat.id)
                        }))

                        return res.send(result.createResult(null, {
                            ...pg,
                            images: imagesWithUrls,
                            roomCategories: categoriesWithData
                        }))
                    })
                })
            })
        })
    })
})


// ============================================================
//  REVIEW PG (Sub admin action)
//  POST /admin/pg/:pgId/review
//  Role: sub_admin, super_admin
//  Body: { note }
//
//  Sub admin reviewed everything and sends to super admin
//  with a note summarizing their findings.
// ============================================================
router.post('/admin/pg/:pgId/review', checkSubAdmin, (req, res) => {

    const { pgId }   = req.params
    const { note }   = req.body
    const subAdminId = req.user.userId

    if (!note) {
        return res.send(result.createResult("Review note is required"))
    }

    // Check PG exists and is PENDING_VERIFICATION
    const checkSql = 'SELECT id, verification_status FROM pgs WHERE id = ?'
    pool.query(checkSql, [pgId], (err, data) => {
        if (err)                return res.send(result.createResult("Database error, try later"))
        if (data.length === 0)  return res.send(result.createResult("PG not found"))

        if (data[0].verification_status !== 'PENDING_VERIFICATION') {
            return res.send(result.createResult("PG is not in PENDING_VERIFICATION state"))
        }

        const updateSql = `
            UPDATE pgs
            SET
                verification_status = 'UNDER_REVIEW',
                reviewed_by         = ?,
                reviewed_at         = NOW(),
                review_note         = ?
            WHERE id = ?
        `

        pool.query(updateSql, [subAdminId, note, pgId], (err) => {
            if (err) return res.send(result.createResult("Failed to update PG status"))

            return res.send(result.createResult(null, {
                message: "PG reviewed successfully. Sent to super admin for final approval."
            }))
        })
    })
})


// ============================================================
//  GET ALL UNDER REVIEW PGS (Super admin action)
//  GET /admin/review-pgs
//  Role: super_admin only
//
//  Super admin sees all PGs reviewed by sub admin
//  and waiting for final approval.
// ============================================================
router.get('/admin/review-pgs', checkAdmin, (req, res) => {

    const sql = `
        SELECT
            p.id            AS pgId,
            p.title,
            p.area,
            p.city,
            p.district,
            p.gender_allowed,
            p.verification_status,
            p.review_note   AS subAdminNote,
            p.reviewed_at,
            p.created_at,
            u.name          AS ownerName,
            u.email         AS ownerEmail,
            u.phone         AS ownerPhone,
            reviewer.name   AS reviewedByName
        FROM pgs p
        JOIN owners o           ON o.id         = p.owner_id
        JOIN users u            ON u.id         = o.user_id
        LEFT JOIN users reviewer ON reviewer.id = p.reviewed_by
        WHERE p.verification_status = 'UNDER_REVIEW'
        ORDER BY p.reviewed_at ASC
    `

    pool.query(sql, (err, data) => {
        if (err) return res.send(result.createResult("Database error, try later"))
        return res.send(result.createResult(null, data))
    })
})


// ============================================================
//  APPROVE PG (Super admin action)
//  POST /admin/pg/:pgId/approve
//  Role: super_admin only
//
//  PG becomes publicly visible after this.
// ============================================================
router.post('/admin/pg/:pgId/approve', checkAdmin, (req, res) => {

    const { pgId }     = req.params
    const superAdminId = req.user.userId

    const checkSql = 'SELECT id, verification_status FROM pgs WHERE id = ?'
    pool.query(checkSql, [pgId], (err, data) => {
        if (err)               return res.send(result.createResult("Database error, try later"))
        if (data.length === 0) return res.send(result.createResult("PG not found"))

        if (data[0].verification_status !== 'UNDER_REVIEW') {
            return res.send(result.createResult("PG is not in UNDER_REVIEW state"))
        }

        const approveSql = `
            UPDATE pgs
            SET
                verification_status = 'APPROVED',
                approved_by         = ?,
                approved_at         = NOW(),
                rejection_reason    = NULL
            WHERE id = ?
        `

        pool.query(approveSql, [superAdminId, pgId], (err) => {
            if (err) return res.send(result.createResult("Failed to approve PG"))

            return res.send(result.createResult(null, {
                message: "PG approved successfully. It is now publicly visible."
            }))
        })
    })
})


// ============================================================
//  REJECT PG (Super admin action)
//  POST /admin/pg/:pgId/reject
//  Role: super_admin only
//  Body: { reason }
//
//  Owner can fix issues and resubmit.
// ============================================================
router.post('/admin/pg/:pgId/reject', checkAdmin, (req, res) => {

    const { pgId }     = req.params
    const { reason }   = req.body
    const superAdminId = req.user.userId

    if (!reason) {
        return res.send(result.createResult("Rejection reason is required"))
    }

    const checkSql = 'SELECT id, verification_status FROM pgs WHERE id = ?'
    pool.query(checkSql, [pgId], (err, data) => {
        if (err)               return res.send(result.createResult("Database error, try later"))
        if (data.length === 0) return res.send(result.createResult("PG not found"))

        if (data[0].verification_status !== 'UNDER_REVIEW') {
            return res.send(result.createResult("PG is not in UNDER_REVIEW state"))
        }

        const rejectSql = `
            UPDATE pgs
            SET
                verification_status = 'REJECTED',
                approved_by         = ?,
                approved_at         = NOW(),
                rejection_reason    = ?
            WHERE id = ?
        `

        pool.query(rejectSql, [superAdminId, reason, pgId], (err) => {
            if (err) return res.send(result.createResult("Failed to reject PG"))

            return res.send(result.createResult(null, {
                message: "PG rejected. Owner will be notified with the reason."
            }))
        })
    })
})


// ============================================================
//  RESUBMIT PG (Owner action)
//  POST /owner/pg/:pgId/resubmit
//  Role: owner
//
//  After rejection, owner fixes issues and resubmits.
//  Resets all review fields and goes back to PENDING_VERIFICATION.
// ============================================================
router.post('/owner/pg/:pgId/resubmit', checkOwner, (req, res) => {

    const { pgId } = req.params
    const userId   = req.user.userId

    // Verify PG belongs to this owner
    const checkSql = `
        SELECT p.id, p.verification_status
        FROM pgs p
        JOIN owners o ON o.id = p.owner_id
        WHERE p.id = ? AND o.user_id = ?
    `

    pool.query(checkSql, [pgId, userId], (err, data) => {
        if (err)               return res.send(result.createResult("Database error, try later"))
        if (data.length === 0) return res.send(result.createResult("PG not found"))

        if (data[0].verification_status !== 'REJECTED') {
            return res.send(result.createResult("Only rejected PGs can be resubmitted"))
        }

        const resubmitSql = `
            UPDATE pgs
            SET
                verification_status = 'PENDING_VERIFICATION',
                reviewed_by         = NULL,
                reviewed_at         = NULL,
                review_note         = NULL,
                approved_by         = NULL,
                approved_at         = NULL,
                rejection_reason    = NULL,
                updated_at          = NOW()
            WHERE id = ?
        `

        pool.query(resubmitSql, [pgId], (err) => {
            if (err) return res.send(result.createResult("Failed to resubmit PG"))

            return res.send(result.createResult(null, {
                message: "PG resubmitted successfully. Admin will review again."
            }))
        })
    })
})


module.exports = router