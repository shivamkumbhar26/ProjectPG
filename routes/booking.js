// ============================================================
//  routes/booking.js
//  Complete booking lifecycle.
//
//  Status flow:
//    PENDING          → user submitted, waiting for owner
//    AWAITING_PAYMENT → owner approved, user has 24hrs to pay
//    CONFIRMED        → payment done
//    REJECTED         → owner rejected
//    EXPIRED          → user did not pay in 24hrs (cron handles this)
//    CANCELLED        → cancelled after confirmation
//
//  Add to server.js:
//    const bookingRoutes = require('./routes/booking')
//    app.use('/', bookingRoutes)
// ============================================================

const express = require('express')
const router  = express.Router()
const s3      = require('../utils/s3')

const pool   = require('../db/pool')
const result = require('../utils/result')
const { checkOwner, checkUser } = require('../middlewares/role')


// ============================================================
//  HELPER — get booking with ownership check for user
// ============================================================
function getUserBooking(bookingId, userId, callback) {
    const sql = `
        SELECT * FROM bookings
        WHERE id = ? AND user_id = ?
    `
    pool.query(sql, [bookingId, userId], (err, data) => {
        if (err)               return callback("Database error, try later")
        if (data.length === 0) return callback("Booking not found")
        return callback(null, data[0])
    })
}


// ============================================================
//  HELPER — get booking with ownership check for owner
// ============================================================
function getOwnerBooking(bookingId, ownerId, callback) {
    const sql = `
        SELECT b.* FROM bookings b
        JOIN room_categories rc ON rc.id  = b.room_category_id
        JOIN pgs p              ON p.id   = rc.pg_id
        WHERE b.id = ? AND p.owner_id = ?
    `
    pool.query(sql, [bookingId, ownerId], (err, data) => {
        if (err)               return callback("Database error, try later")
        if (data.length === 0) return callback("Booking not found")
        return callback(null, data[0])
    })
}


// ============================================================
//  HELPER — get owner id and verify approved
// ============================================================
function getApprovedOwner(userId, callback) {
    const sql = `
        SELECT id, verification_status FROM owners WHERE user_id = ?
    `
    pool.query(sql, [userId], (err, data) => {
        if (err)               return callback("Database error, try later")
        if (data.length === 0) return callback("Owner profile not found")
        if (data[0].verification_status !== 'APPROVED')
            return callback("Owner profile is not verified")
        return callback(null, data[0].id)
    })
}


// ============================================================
//  REQUEST BOOKING
//  POST /booking/request
//  Role: user
//  Body: {
//    room_category_id,
//    check_in_date,
//    duration_months,
//    identity_proof_type,
//    identity_proof_url    ← fileKey from S3 upload
//  }
//
//  Does NOT decrement slots yet.
//  Slots only decrement after payment is confirmed.
// ============================================================
router.post('/booking/request', checkUser, (req, res) => {

    const userId = req.user.userId
    const {
        room_category_id,
        check_in_date,
        duration_months,
        identity_proof_type,
        identity_proof_url
    } = req.body

    if (!room_category_id || !check_in_date) {
        return res.send(result.createResult("room_category_id and check_in_date are required"))
    }

    if (!identity_proof_type || !identity_proof_url) {
        return res.send(result.createResult("Identity proof is required for booking"))
    }

    const allowedProofTypes = ['aadhaar', 'college_id', 'employee_id', 'passport', 'other']
    if (!allowedProofTypes.includes(identity_proof_type)) {
        return res.send(result.createResult("Invalid identity proof type"))
    }

    // Step 1 — check room category exists, is active, and belongs to approved PG
    const catSql = `
        SELECT rc.id, rc.price_per_month, rc.deposit_amount,
               rc.total_slots, rc.pg_id,
               p.verification_status AS pgStatus
        FROM room_categories rc
        JOIN pgs p ON p.id = rc.pg_id
        WHERE rc.id = ? AND rc.is_active = 1
    `

    pool.query(catSql, [room_category_id], (err, catData) => {
        if (err)                  return res.send(result.createResult("Database error, try later"))
        if (catData.length === 0) return res.send(result.createResult("Room category not found"))

        const cat = catData[0]

        if (cat.pgStatus !== 'APPROVED') {
            return res.send(result.createResult("This PG is not available for booking"))
        }

        // Step 2 — check available slots (compute from rooms)
        const slotsSql = `
            SELECT rc.total_slots - COALESCE(SUM(r.occupied_slots), 0) AS available_slots
            FROM room_categories rc
            LEFT JOIN rooms r ON r.room_category_id = rc.id AND r.is_active = 1
            WHERE rc.id = ?
            GROUP BY rc.id
        `

        pool.query(slotsSql, [room_category_id], (err, slotsData) => {
            if (err) return res.send(result.createResult("Database error, try later"))

            const availableSlots = slotsData[0]?.available_slots ?? 0

            if (availableSlots <= 0) {
                return res.send(result.createResult("No slots available in this room category"))
            }

            // Step 3 — check user doesn't already have an active booking for this category
            const existingBookingSql = `
                SELECT id FROM bookings
                WHERE user_id = ? AND room_category_id = ?
                  AND status IN ('PENDING', 'AWAITING_PAYMENT', 'CONFIRMED')
            `

            pool.query(existingBookingSql, [userId, room_category_id], (err, existing) => {
                if (err) return res.send(result.createResult("Database error, try later"))

                if (existing.length > 0) {
                    return res.send(result.createResult("You already have an active booking for this room category"))
                }

                // Step 4 — insert booking with PENDING status
                // Price is snapshotted at booking time
                const insertSql = `
                    INSERT INTO bookings (
                        user_id, room_category_id,
                        check_in_date, duration_months,
                        identity_proof_type, identity_proof_url,
                        status, price_per_month, deposit_amount
                    ) VALUES (?,?,?,?,?,?,?,?,?)
                `

                pool.query(insertSql, [
                    userId, room_category_id,
                    check_in_date, duration_months || null,
                    identity_proof_type, identity_proof_url,
                    'PENDING', cat.price_per_month, cat.deposit_amount
                ], (err, data) => {
                    if (err) return res.send(result.createResult("Failed to create booking"))

                    return res.send(result.createResult(null, {
                        message: "Booking request sent. Waiting for owner approval.",
                        bookingId: data.insertId
                    }))
                })
            })
        })
    })
})


// ============================================================
//  GET MY BOOKINGS (User)
//  GET /booking/my-bookings
//  Role: user
// ============================================================
router.get('/booking/my-bookings', checkUser, (req, res) => {

    const userId = req.user.userId

    const sql = `
        SELECT
            b.id, b.status, b.check_in_date, b.duration_months,
            b.price_per_month, b.deposit_amount,
            b.payment_deadline, b.approved_at, b.paid_at,
            b.room_assigned_at, b.created_at,
            p.title    AS pgTitle,
            p.area,
            p.city,
            rc.category_name,
            rc.capacity,
            r.room_number,
            r.floor
        FROM bookings b
        JOIN room_categories rc ON rc.id  = b.room_category_id
        JOIN pgs p              ON p.id   = rc.pg_id
        LEFT JOIN rooms r       ON r.id   = b.room_id
        WHERE b.user_id = ?
        ORDER BY b.created_at DESC
    `

    pool.query(sql, [userId], (err, data) => {
        if (err) return res.send(result.createResult("Database error, try later"))
        return res.send(result.createResult(null, data))
    })
})


// ============================================================
//  GET ONE BOOKING DETAIL (User)
//  GET /booking/:bookingId
//  Role: user
// ============================================================
router.get('/booking/:bookingId', checkUser, (req, res) => {

    const { bookingId } = req.params
    const userId        = req.user.userId

    const sql = `
        SELECT
            b.*,
            p.title    AS pgTitle,
            p.address_line,
            p.area, p.city, p.district,
            p.owner_id,
            u.name     AS ownerName,
            u.phone    AS ownerPhone,
            rc.category_name,
            rc.capacity,
            r.room_number,
            r.floor
        FROM bookings b
        JOIN room_categories rc ON rc.id  = b.room_category_id
        JOIN pgs p              ON p.id   = rc.pg_id
        JOIN owners o           ON o.id   = p.owner_id
        JOIN users u            ON u.id   = o.user_id
        LEFT JOIN rooms r       ON r.id   = b.room_id
        WHERE b.id = ? AND b.user_id = ?
    `

    pool.query(sql, [bookingId, userId], (err, data) => {
        if (err)               return res.send(result.createResult("Database error, try later"))
        if (data.length === 0) return res.send(result.createResult("Booking not found"))
        return res.send(result.createResult(null, data[0]))
    })
})


// ============================================================
//  GET ALL BOOKINGS (Owner)
//  GET /owner/bookings
//  Role: owner
//  Query params: status (optional filter)
//  e.g. GET /owner/bookings?status=PENDING
// ============================================================
router.get('/owner/bookings', checkOwner, (req, res) => {

    const userId       = req.user.userId
    const { status }   = req.query

    const validStatuses = ['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED']

    getApprovedOwner(userId, (err, ownerId) => {
        if (err) return res.send(result.createResult(err))

        let sql = `
            SELECT
                b.id, b.status, b.check_in_date, b.duration_months,
                b.price_per_month, b.deposit_amount,
                b.payment_deadline, b.approved_at, b.paid_at,
                b.room_assigned_at, b.created_at,
                b.identity_proof_type,
                b.identity_proof_url,
                u.name     AS userName,
                u.phone    AS userPhone,
                u.email    AS userEmail,
                p.title    AS pgTitle,
                rc.category_name,
                r.room_number,
                r.floor
            FROM bookings b
            JOIN users u            ON u.id   = b.user_id
            JOIN room_categories rc ON rc.id  = b.room_category_id
            JOIN pgs p              ON p.id   = rc.pg_id
            LEFT JOIN rooms r       ON r.id   = b.room_id
            WHERE p.owner_id = ?
        `

        const params = [ownerId]

        if (status && validStatuses.includes(status)) {
            sql += ' AND b.status = ?'
            params.push(status)
        }

        sql += ' ORDER BY b.created_at DESC'

        pool.query(sql, params, async (err, data) => {
            if (err) return res.send(result.createResult("Database error, try later"))

            // Generate fresh viewUrl for each booking's identity proof
            const bookingsWithProof = await Promise.all(
                data.map(async (booking) => ({
                    ...booking,
                    identityProofViewUrl: booking.identity_proof_url
                        ? await s3.getViewUrl(booking.identity_proof_url)
                        : null
                }))
            )

            return res.send(result.createResult(null, bookingsWithProof))
        })
    })
})


// ============================================================
//  APPROVE BOOKING (Owner)
//  POST /owner/booking/:bookingId/approve
//  Role: owner
//
//  Sets status to AWAITING_PAYMENT.
//  Starts 24hr payment timer (payment_deadline = NOW + 24hrs).
//  Does NOT decrement slots yet — only after payment.
// ============================================================
router.post('/owner/booking/:bookingId/approve', checkOwner, (req, res) => {

    const { bookingId } = req.params
    const userId        = req.user.userId

    getApprovedOwner(userId, (err, ownerId) => {
        if (err) return res.send(result.createResult(err))

        getOwnerBooking(bookingId, ownerId, (err, booking) => {
            if (err) return res.send(result.createResult(err))

            if (booking.status !== 'PENDING') {
                return res.send(result.createResult("Only PENDING bookings can be approved"))
            }

            // Set payment deadline to 24 hours from now
            const paymentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000)

            const approveSql = `
                UPDATE bookings
                SET
                    status           = 'AWAITING_PAYMENT',
                    approved_at      = NOW(),
                    payment_deadline = ?
                WHERE id = ?
            `

            pool.query(approveSql, [paymentDeadline, bookingId], (err) => {
                if (err) return res.send(result.createResult("Failed to approve booking"))

                return res.send(result.createResult(null, {
                    message: "Booking approved. User has 24 hours to complete payment.",
                    paymentDeadline
                }))
            })
        })
    })
})


// ============================================================
//  REJECT BOOKING (Owner)
//  POST /owner/booking/:bookingId/reject
//  Role: owner
//  Body: { reason }
// ============================================================
router.post('/owner/booking/:bookingId/reject', checkOwner, (req, res) => {

    const { bookingId } = req.params
    const { reason }    = req.body
    const userId        = req.user.userId

    if (!reason) {
        return res.send(result.createResult("Rejection reason is required"))
    }

    getApprovedOwner(userId, (err, ownerId) => {
        if (err) return res.send(result.createResult(err))

        getOwnerBooking(bookingId, ownerId, (err, booking) => {
            if (err) return res.send(result.createResult(err))

            if (booking.status !== 'PENDING') {
                return res.send(result.createResult("Only PENDING bookings can be rejected"))
            }

            const rejectSql = `
                UPDATE bookings
                SET
                    status           = 'REJECTED',
                    rejected_at      = NOW(),
                    rejection_reason = ?
                WHERE id = ?
            `

            pool.query(rejectSql, [reason, bookingId], (err) => {
                if (err) return res.send(result.createResult("Failed to reject booking"))

                return res.send(result.createResult(null, {
                    message: "Booking rejected successfully."
                }))
            })
        })
    })
})


// ============================================================
//  PAY FOR BOOKING (User — Phase 1 manual)
//  POST /booking/:bookingId/pay
//  Role: user
//
//  User manually marks payment as done.
//  Phase 2: replace this with Razorpay webhook.
//
//  On payment:
//    1. Insert payment record
//    2. Update booking status to CONFIRMED
//    3. Atomically decrement occupied_slots in rooms table
//       — picks the room with least occupied slots in category
//       — this is the atomic part that prevents double booking
// ============================================================
router.post('/booking/:bookingId/pay', checkUser, (req, res) => {

    const { bookingId } = req.params
    const userId        = req.user.userId

    getUserBooking(bookingId, userId, (err, booking) => {
        if (err) return res.send(result.createResult(err))

        if (booking.status !== 'AWAITING_PAYMENT') {
            return res.send(result.createResult("Booking is not in AWAITING_PAYMENT state"))
        }

        // Check payment deadline not expired
        if (new Date(booking.payment_deadline) < new Date()) {
            return res.send(result.createResult("Payment deadline has passed. Booking expired."))
        }

        // Step 1 — insert payment record
        const insertPaymentSql = `
            INSERT INTO payments (booking_id, user_id, amount, payment_type, status, paid_at)
            VALUES (?, ?, ?, 'both', 'SUCCESS', NOW())
        `

        const totalAmount = parseFloat(booking.price_per_month) + parseFloat(booking.deposit_amount)

        pool.query(insertPaymentSql, [bookingId, userId, totalAmount], (err) => {
            if (err) return res.send(result.createResult("Failed to record payment"))

            // Step 2 — update booking status to CONFIRMED
            const confirmSql = `
                UPDATE bookings
                SET status  = 'CONFIRMED',
                    paid_at = NOW()
                WHERE id = ?
            `

            pool.query(confirmSql, [bookingId], (err) => {
                if (err) return res.send(result.createResult("Failed to confirm booking"))

                // Step 3 — atomically decrement occupied_slots
                // Picks the room with least occupied slots in this category
                // that still has free beds
                const decrementSql = `
                    UPDATE rooms
                    SET occupied_slots = occupied_slots + 1
                    WHERE id = (
                        SELECT id FROM (
                            SELECT r.id
                            FROM rooms r
                            JOIN room_categories rc ON rc.id = r.room_category_id
                            WHERE r.room_category_id = ?
                              AND r.is_active = 1
                              AND r.occupied_slots < rc.capacity
                            ORDER BY r.occupied_slots DESC
                            LIMIT 1
                        ) AS sub
                    )
                `

                pool.query(decrementSql, [booking.room_category_id], (err, decrementData) => {
                    if (err || decrementData.affectedRows === 0) {
                        // Slot was taken between booking and payment (race condition)
                        // Rare but handle it gracefully
                        return res.send(result.createResult(
                            "No slots available anymore. Please contact support."
                        ))
                    }

                    return res.send(result.createResult(null, {
                        message: "Payment confirmed. Booking is confirmed. Owner will assign your room shortly."
                    }))
                })
            })
        })
    })
})


// ============================================================
//  ASSIGN ROOM (Owner)
//  POST /owner/booking/:bookingId/assign-room
//  Role: owner
//  Body: { roomId }
//
//  Owner manually assigns a specific room to a confirmed booking.
//  roomId must belong to same PG and same room category.
//  Room must have free beds.
// ============================================================
router.post('/owner/booking/:bookingId/assign-room', checkOwner, (req, res) => {

    const { bookingId } = req.params
    const { roomId }    = req.body
    const userId        = req.user.userId

    if (!roomId) {
        return res.send(result.createResult("roomId is required"))
    }

    getApprovedOwner(userId, (err, ownerId) => {
        if (err) return res.send(result.createResult(err))

        getOwnerBooking(bookingId, ownerId, (err, booking) => {
            if (err) return res.send(result.createResult(err))

            if (booking.status !== 'CONFIRMED') {
                return res.send(result.createResult("Room can only be assigned to CONFIRMED bookings"))
            }

            if (booking.room_id) {
                return res.send(result.createResult("Room is already assigned to this booking"))
            }

            // Verify room belongs to same category and has capacity
            const roomCheckSql = `
                SELECT r.id, r.occupied_slots, rc.capacity
                FROM rooms r
                JOIN room_categories rc ON rc.id = r.room_category_id
                WHERE r.id = ?
                  AND r.room_category_id = ?
                  AND r.is_active = 1
            `

            pool.query(roomCheckSql, [roomId, booking.room_category_id], (err, roomData) => {
                if (err)                  return res.send(result.createResult("Database error, try later"))
                if (roomData.length === 0) return res.send(result.createResult("Room not found for this category"))

                const room = roomData[0]

                if (room.occupied_slots >= room.capacity) {
                    return res.send(result.createResult("This room is already full"))
                }

                // Assign room to booking
                const assignSql = `
                    UPDATE bookings
                    SET room_id          = ?,
                        room_assigned_at = NOW()
                    WHERE id = ?
                `

                pool.query(assignSql, [roomId, bookingId], (err) => {
                    if (err) return res.send(result.createResult("Failed to assign room"))

                    return res.send(result.createResult(null, {
                        message: "Room assigned successfully."
                    }))
                })
            })
        })
    })
})


// ============================================================
//  CANCEL BOOKING (User)
//  POST /booking/:bookingId/cancel
//  Role: user
//  Body: { reason }
//
//  If booking is CONFIRMED → restore occupied_slots in rooms
//  If booking is PENDING or AWAITING_PAYMENT → just cancel
// ============================================================
router.post('/booking/:bookingId/cancel', checkUser, (req, res) => {

    const { bookingId } = req.params
    const { reason }    = req.body
    const userId        = req.user.userId

    getUserBooking(bookingId, userId, (err, booking) => {
        if (err) return res.send(result.createResult(err))

        const cancellableStatuses = ['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED']
        if (!cancellableStatuses.includes(booking.status)) {
            return res.send(result.createResult("This booking cannot be cancelled"))
        }

        // Cancel the booking
        const cancelSql = `
            UPDATE bookings
            SET status              = 'CANCELLED',
                cancelled_at        = NOW(),
                cancellation_reason = ?
            WHERE id = ?
        `

        pool.query(cancelSql, [reason || null, bookingId], (err) => {
            if (err) return res.send(result.createResult("Failed to cancel booking"))

            // If was CONFIRMED → restore occupied_slots
            if (booking.status === 'CONFIRMED' && booking.room_id) {
                const restoreSql = `
                    UPDATE rooms
                    SET occupied_slots = occupied_slots - 1
                    WHERE id = ? AND occupied_slots > 0
                `
                pool.query(restoreSql, [booking.room_id], (err) => {
                    // Even if restore fails, booking is already cancelled
                    return res.send(result.createResult(null, {
                        message: "Booking cancelled. Refund will be processed if applicable."
                    }))
                })
            } else {
                return res.send(result.createResult(null, {
                    message: "Booking cancelled successfully."
                }))
            }
        })
    })
})


module.exports = router