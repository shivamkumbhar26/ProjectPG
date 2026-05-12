// ============================================================
//  routes/pg.js
//  PG listing creation and management by owner.
//
//  Flow:
//    1. Create PG basic details
//    2. Upload PG images
//    3. Add room categories
//    4. Add individual rooms per category
//    5. Submit PG for verification
// ============================================================

const express = require('express')
const router  = express.Router()
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')

const pool   = require('../db/pool')
const result = require('../utils/result')
const s3     = require('../utils/s3')
const { checkOwner } = require('../middlewares/role')

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
})


// ============================================================
//  HELPER — get owner id from user id
//  Also checks owner is APPROVED
// ============================================================
function getApprovedOwner(userId, callback) {
    const sql = `
        SELECT id, verification_status
        FROM owners
        WHERE user_id = ?
    `
    pool.query(sql, [userId], (err, data) => {
        if (err)              return callback("Database error, try later")
        if (data.length === 0) return callback("Owner profile not found")
        if (data[0].verification_status !== 'APPROVED')
            return callback("Your profile is not verified yet. Wait for admin approval.")
        return callback(null, data[0].id)
    })
}


// ============================================================
//  HELPER — verify PG belongs to this owner
// ============================================================
function verifyPgOwner(pgId, ownerId, callback) {
    const sql = 'SELECT id, verification_status FROM pgs WHERE id = ? AND owner_id = ?'
    pool.query(sql, [pgId, ownerId], (err, data) => {
        if (err)               return callback("Database error, try later")
        if (data.length === 0) return callback("PG not found")
        return callback(null, data[0])
    })
}


// ============================================================
//  1. CREATE PG BASIC DETAILS
//  POST /owner/pg/create
//  Role: owner (must be APPROVED)
//  Body: {
//    title, description, address_line, area, city,
//    district, pincode, latitude, longitude,
//    gender_allowed, food_included,
//    notice_period_days, amenities
//  }
// ============================================================
router.post('/owner/pg/create', checkOwner, (req, res) => {

    const userId = req.user.userId
    const {
        title, description, address_line, area, city,
        district, pincode, latitude, longitude,
        gender_allowed, food_included,
        notice_period_days, amenities
    } = req.body

    // Basic validation
    if (!title || !address_line || !area || !city || !district || !pincode || !gender_allowed) {
        return res.send(result.createResult("title, address_line, area, city, district, pincode and gender_allowed are required"))
    }

    if (!['male', 'female', 'any'].includes(gender_allowed)) {
        return res.send(result.createResult("gender_allowed must be male, female or any"))
    }

    // Check owner is approved
    getApprovedOwner(userId, (err, ownerId) => {
        if (err) return res.send(result.createResult(err))

        const insertSql = `
            INSERT INTO pgs (
                owner_id, title, description, address_line,
                area, city, district, pincode,
                latitude, longitude, gender_allowed,
                food_included, notice_period_days, amenities
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `

        pool.query(insertSql, [
            ownerId, title, description || null, address_line,
            area, city, district, pincode,
            latitude || null, longitude || null, gender_allowed,
            food_included ? 1 : 0,
            notice_period_days || 30,
            JSON.stringify(amenities || [])
        ], (err, data) => {
            if (err) {
                return res.send(result.createResult("Failed to create PG"))
            }
            return res.send(result.createResult(null, {
                message: "PG created successfully. Now upload images and add room categories.",
                pgId: data.insertId
            }))
        })
    })
})


// ============================================================
//  2a. GET PG IMAGE UPLOAD URL
//  POST /owner/pg/:pgId/get-image-upload-url
//  Role: owner
//  Body: { fileType, fileSize, label }
//
//  label examples: "entrance", "mess", "parking", "washroom"
// ============================================================
router.post('/owner/pg/:pgId/get-image-upload-url', checkOwner, async (req, res) => {

    const { pgId }              = req.params
    const { fileType, fileSize, label } = req.body
    const userId                = req.user.userId

    if (!fileType || !fileSize) {
        return res.send(result.createResult("fileType and fileSize are required"))
    }

    const validation = s3.validateFile(fileType, fileSize)
    if (!validation.valid) {
        return res.send(result.createResult(validation.message))
    }

    getApprovedOwner(userId, async (err, ownerId) => {
        if (err) return res.send(result.createResult(err))

        verifyPgOwner(pgId, ownerId, async (err) => {
            if (err) return res.send(result.createResult(err))

            const fileKey = s3.generateFileKey('pg-images', pgId, label || 'pg', fileType)

            try {
                const { uploadUrl } = await s3.getUploadUrl(fileKey, fileType)
                return res.send(result.createResult(null, { uploadUrl, fileKey }))
            } catch (err) {
                return res.send(result.createResult("Failed to generate upload URL"))
            }
        })
    })
})


// ============================================================
//  2b. SIMULATE PG IMAGE UPLOAD (SIMULATION ONLY)
//  POST /simulate-upload/:fileKey
//  Already registered in owner.js — reused here
// ============================================================


// ============================================================
//  2c. SAVE PG IMAGE
//  POST /owner/pg/:pgId/save-image
//  Role: owner
//  Body: { fileKey, label, isCover }
// ============================================================
router.post('/owner/pg/:pgId/save-image', checkOwner, (req, res) => {

    const { pgId }               = req.params
    const { fileKey, label, isCover } = req.body
    const userId                 = req.user.userId

    if (!fileKey) {
        return res.send(result.createResult("fileKey is required"))
    }

    getApprovedOwner(userId, (err, ownerId) => {
        if (err) return res.send(result.createResult(err))

        verifyPgOwner(pgId, ownerId, (err) => {
            if (err) return res.send(result.createResult(err))

            const insertSql = `
                INSERT INTO pg_images (pg_id, image_url, label, is_cover)
                VALUES (?,?,?,?)
            `
            pool.query(insertSql, [pgId, fileKey, label || null, isCover ? 1 : 0], (err) => {
                if (err) {
                    return res.send(result.createResult("Failed to save image"))
                }
                return res.send(result.createResult(null, {
                    message: "PG image saved successfully"
                }))
            })
        })
    })
})


// ============================================================
//  3. ADD ROOM CATEGORY
//  POST /owner/pg/:pgId/room-category
//  Role: owner
//  Body: {
//    category_name, capacity, total_units,
//    price_per_month, deposit_amount, description
//  }
// ============================================================
router.post('/owner/pg/:pgId/room-category', checkOwner, (req, res) => {

    const { pgId } = req.params
    const {
        category_name, capacity, total_units,
        price_per_month, deposit_amount, description
    } = req.body
    const userId = req.user.userId

    if (!category_name || !capacity || !total_units || !price_per_month) {
        return res.send(result.createResult("category_name, capacity, total_units and price_per_month are required"))
    }

    if (capacity < 1 || total_units < 1) {
        return res.send(result.createResult("capacity and total_units must be at least 1"))
    }

    const total_slots = capacity * total_units

    getApprovedOwner(userId, (err, ownerId) => {
        if (err) return res.send(result.createResult(err))

        verifyPgOwner(pgId, ownerId, (err) => {
            if (err) return res.send(result.createResult(err))

            const insertSql = `
                INSERT INTO room_categories (
                    pg_id, category_name, capacity,
                    total_units, total_slots,
                    price_per_month, deposit_amount, description
                ) VALUES (?,?,?,?,?,?,?,?)
            `

            pool.query(insertSql, [
                pgId, category_name, capacity,
                total_units, total_slots,
                price_per_month, deposit_amount || 0,
                description || null
            ], (err, data) => {
                if (err) {
                    return res.send(result.createResult("Failed to add room category"))
                }
                return res.send(result.createResult(null, {
                    message: `Room category added. Now add ${total_units} individual rooms for this category.`,
                    roomCategoryId: data.insertId,
                    totalUnitsRequired: total_units
                }))
            })
        })
    })
})


// ============================================================
//  3b. SAVE ROOM CATEGORY IMAGE
//  POST /owner/room-category/:categoryId/save-image
//  Role: owner
//  Body: { fileKey, isCover }
// ============================================================
router.post('/owner/room-category/:categoryId/save-image', checkOwner, (req, res) => {

    const { categoryId }     = req.params
    const { fileKey, isCover } = req.body
    const userId             = req.user.userId

    if (!fileKey) {
        return res.send(result.createResult("fileKey is required"))
    }

    // Verify category belongs to this owner's PG
    const checkSql = `
        SELECT rc.id FROM room_categories rc
        JOIN pgs p ON p.id = rc.pg_id
        JOIN owners o ON o.id = p.owner_id
        WHERE rc.id = ? AND o.user_id = ?
    `
    pool.query(checkSql, [categoryId, userId], (err, data) => {
        if (err)               return res.send(result.createResult("Database error, try later"))
        if (data.length === 0) return res.send(result.createResult("Room category not found"))

        const insertSql = `
            INSERT INTO room_category_images (room_category_id, image_url, is_cover)
            VALUES (?,?,?)
        `
        pool.query(insertSql, [categoryId, fileKey, isCover ? 1 : 0], (err) => {
            if (err) return res.send(result.createResult("Failed to save image"))
            return res.send(result.createResult(null, {
                message: "Room category image saved"
            }))
        })
    })
})


// ============================================================
//  4. ADD INDIVIDUAL ROOM
//  POST /owner/pg/:pgId/room
//  Role: owner
//  Body: { room_category_id, room_number, floor, notes }
//
//  After every insert, auto-checks if all rooms are entered
//  for that category and sets rooms_entered = TRUE.
// ============================================================
router.post('/owner/pg/:pgId/room', checkOwner, (req, res) => {

    const { pgId } = req.params
    const { room_category_id, room_number, floor, notes } = req.body
    const userId = req.user.userId

    if (!room_category_id || !room_number) {
        return res.send(result.createResult("room_category_id and room_number are required"))
    }

    getApprovedOwner(userId, (err, ownerId) => {
        if (err) return res.send(result.createResult(err))

        verifyPgOwner(pgId, ownerId, (err) => {
            if (err) return res.send(result.createResult(err))

            // Verify room category belongs to this PG
            const checkCatSql = `
                SELECT id, total_units FROM room_categories
                WHERE id = ? AND pg_id = ?
            `
            pool.query(checkCatSql, [room_category_id, pgId], (err, catData) => {
                if (err)               return res.send(result.createResult("Database error, try later"))
                if (catData.length === 0) return res.send(result.createResult("Room category not found for this PG"))

                const totalUnits = catData[0].total_units

                // Insert room
                const insertSql = `
                    INSERT INTO rooms (pg_id, room_category_id, room_number, floor, notes)
                    VALUES (?,?,?,?,?)
                `
                pool.query(insertSql, [
                    pgId, room_category_id, room_number,
                    floor || null, notes || null
                ], (err, data) => {
                    if (err) {
                        // Duplicate room number error
                        if (err.code === 'ER_DUP_ENTRY') {
                            return res.send(result.createResult("Room number already exists in this PG"))
                        }
                        return res.send(result.createResult("Failed to add room"))
                    }

                    const newRoomId = data.insertId

                    // Auto-check: count rooms for this category
                    const countSql = `
                        SELECT COUNT(*) AS roomCount
                        FROM rooms
                        WHERE room_category_id = ? AND pg_id = ?
                    `
                    pool.query(countSql, [room_category_id, pgId], (err, countData) => {
                        if (err) {
                            // Room is added, just skip the auto-check
                            return res.send(result.createResult(null, {
                                message: "Room added successfully",
                                roomId: newRoomId
                            }))
                        }

                        const roomCount = countData[0].roomCount

                        if (roomCount >= totalUnits) {
                            // All rooms entered — set rooms_entered = TRUE
                            const updateCatSql = `
                                UPDATE room_categories
                                SET rooms_entered = 1
                                WHERE id = ?
                            `
                            pool.query(updateCatSql, [room_category_id], (err) => {
                                return res.send(result.createResult(null, {
                                    message: `Room added. All ${totalUnits} rooms entered for this category.`,
                                    roomId: newRoomId,
                                    allRoomsEntered: true
                                }))
                            })
                        } else {
                            return res.send(result.createResult(null, {
                                message: `Room added. ${totalUnits - roomCount} more room(s) needed for this category.`,
                                roomId: newRoomId,
                                allRoomsEntered: false,
                                remaining: totalUnits - roomCount
                            }))
                        }
                    })
                })
            })
        })
    })
})


// ============================================================
//  5. SUBMIT PG FOR VERIFICATION
//  POST /owner/pg/:pgId/submit
//  Role: owner
//
//  Checks:
//    - PG has at least one image
//    - PG has at least one room category
//    - All room categories have rooms_entered = TRUE
//  Then sets verification_status = 'PENDING_VERIFICATION'
// ============================================================
router.post('/owner/pg/:pgId/submit', checkOwner, (req, res) => {

    const { pgId } = req.params
    const userId   = req.user.userId

    getApprovedOwner(userId, (err, ownerId) => {
        if (err) return res.send(result.createResult(err))

        verifyPgOwner(pgId, ownerId, (err, pg) => {
            if (err) return res.send(result.createResult(err))

            if (pg.verification_status !== 'PENDING_VERIFICATION' &&
                pg.verification_status !== 'REJECTED') {
                return res.send(result.createResult("PG is already submitted or approved"))
            }

            // Check 1 — at least one PG image
            const imgCheckSql = 'SELECT COUNT(*) AS cnt FROM pg_images WHERE pg_id = ?'
            pool.query(imgCheckSql, [pgId], (err, imgData) => {
                if (err) return res.send(result.createResult("Database error, try later"))

                if (imgData[0].cnt === 0) {
                    return res.send(result.createResult("Please upload at least one PG image before submitting"))
                }

                // Check 2 — at least one room category
                const catCheckSql = `
                    SELECT COUNT(*) AS cnt FROM room_categories
                    WHERE pg_id = ? AND is_active = 1
                `
                pool.query(catCheckSql, [pgId], (err, catData) => {
                    if (err) return res.send(result.createResult("Database error, try later"))

                    if (catData[0].cnt === 0) {
                        return res.send(result.createResult("Please add at least one room category before submitting"))
                    }

                    // Check 3 — all room categories have rooms_entered = TRUE
                    const roomsCheckSql = `
                        SELECT COUNT(*) AS cnt FROM room_categories
                        WHERE pg_id = ? AND is_active = 1 AND rooms_entered = 0
                    `
                    pool.query(roomsCheckSql, [pgId], (err, roomsData) => {
                        if (err) return res.send(result.createResult("Database error, try later"))

                        if (roomsData[0].cnt > 0) {
                            return res.send(result.createResult(
                                `${roomsData[0].cnt} room category(s) still need all rooms to be entered`
                            ))
                        }

                        // All checks passed — submit for verification
                        const submitSql = `
                            UPDATE pgs
                            SET verification_status = 'PENDING_VERIFICATION',
                                updated_at = NOW()
                            WHERE id = ?
                        `
                        pool.query(submitSql, [pgId], (err) => {
                            if (err) return res.send(result.createResult("Failed to submit PG"))

                            return res.send(result.createResult(null, {
                                message: "PG submitted for verification. Admin will review shortly."
                            }))
                        })
                    })
                })
            })
        })
    })
})


// ============================================================
//  GET MY PGS
//  GET /owner/my-pgs
//  Role: owner
//
//  Owner sees all their PGs with current status.
// ============================================================
router.get('/owner/my-pgs', checkOwner, (req, res) => {

    const userId = req.user.userId

    const sql = `
        SELECT
            p.id, p.title, p.area, p.city,
            p.gender_allowed, p.food_included,
            p.verification_status, p.is_active,
            p.created_at,
            COUNT(DISTINCT rc.id) AS roomCategoryCount,
            COUNT(DISTINCT r.id)  AS totalRooms
        FROM pgs p
        JOIN owners o ON o.id = p.owner_id
        LEFT JOIN room_categories rc ON rc.pg_id = p.id AND rc.is_active = 1
        LEFT JOIN rooms r ON r.pg_id = p.id AND r.is_active = 1
        WHERE o.user_id = ?
        GROUP BY p.id
        ORDER BY p.created_at DESC
    `

    pool.query(sql, [userId], (err, data) => {
        if (err) return res.send(result.createResult("Database error, try later"))
        return res.send(result.createResult(null, data))
    })
})


// ============================================================
//  GET ONE PG FULL DETAIL
//  GET /owner/pg/:pgId
//  Role: owner
// ============================================================
router.get('/owner/pg/:pgId', checkOwner, (req, res) => {

    const { pgId } = req.params
    const userId   = req.user.userId

    getApprovedOwner(userId, (err, ownerId) => {
        if (err) return res.send(result.createResult(err))

        // Get PG details
        const pgSql = 'SELECT * FROM pgs WHERE id = ? AND owner_id = ?'
        pool.query(pgSql, [pgId, ownerId], (err, pgData) => {
            if (err)               return res.send(result.createResult("Database error, try later"))
            if (pgData.length === 0) return res.send(result.createResult("PG not found"))

            const pg = pgData[0]

            // Get PG images
            const imgSql = 'SELECT id, image_url, label, is_cover FROM pg_images WHERE pg_id = ?'
            pool.query(imgSql, [pgId], async (err, images) => {
                if (err) return res.send(result.createResult("Database error, try later"))

                // Get room categories
                const catSql = `
                    SELECT id, category_name, capacity, total_units,
                           total_slots, rooms_entered, price_per_month,
                           deposit_amount, description, is_active
                    FROM room_categories WHERE pg_id = ?
                `
                pool.query(catSql, [pgId], (err, categories) => {
                    if (err) return res.send(result.createResult("Database error, try later"))

                    // Get rooms
                    const roomsSql = `
                        SELECT id, room_category_id, room_number,
                               floor, occupied_slots, is_active, notes
                        FROM rooms WHERE pg_id = ?
                    `
                    pool.query(roomsSql, [pgId], async (err, rooms) => {
                        if (err) return res.send(result.createResult("Database error, try later"))

                        // Generate view URLs for images
                        const imagesWithUrls = await Promise.all(
                            images.map(async (img) => ({
                                ...img,
                                viewUrl: await s3.getViewUrl(img.image_url)
                            }))
                        )

                        // Group rooms under their category
                        const categoriesWithRooms = categories.map((cat) => ({
                            ...cat,
                            rooms: rooms.filter((r) => r.room_category_id === cat.id)
                        }))

                        return res.send(result.createResult(null, {
                            ...pg,
                            images: imagesWithUrls,
                            roomCategories: categoriesWithRooms
                        }))
                    })
                })
            })
        })
    })
})


module.exports = router