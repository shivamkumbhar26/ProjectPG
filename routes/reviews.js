// ============================================================
//  routes/reviews.js
//  Reviews and reports.
//
//  Add to server.js:
//    const reviewRoutes = require('./routes/reviews')
//    app.use('/', reviewRoutes)
//
//  Also add to auth.js whitelist:
//    req.url.startsWith('/review/')  for GET review routes
// ============================================================

const express = require('express')
const router  = express.Router()

const pool   = require('../db/pool')
const result = require('../utils/result')
const { checkUser, checkAdmin, checkSubAdmin } = require('../middlewares/role')


// ============================================================
//  SUBMIT REVIEW
//  POST /review/:pgId
//  Role: user
//  Body: { bookingId, rating, comment }
//
//  Rules:
//    - User must have a CONFIRMED booking for this PG
//    - check_in_date must have already passed
//    - One review per booking (DB unique constraint handles this)
// ============================================================
router.post('/review/:pgId', checkUser, (req, res) => {

    const { pgId }                    = req.params
    const { bookingId, rating, comment } = req.body
    const userId                      = req.user.userId

    if (!bookingId || !rating) {
        return res.send(result.createResult("bookingId and rating are required"))
    }

    if (rating < 1 || rating > 5) {
        return res.send(result.createResult("Rating must be between 1 and 5"))
    }

    // Verify booking belongs to user, is for this PG, is CONFIRMED,
    // and check_in_date has passed
    const checkSql = `
        SELECT b.id, b.check_in_date, b.status
        FROM bookings b
        JOIN room_categories rc ON rc.id = b.room_category_id
        JOIN pgs p              ON p.id  = rc.pg_id
        WHERE b.id         = ?
          AND b.user_id    = ?
          AND p.id         = ?
          AND b.status     = 'CONFIRMED'
    `

    pool.query(checkSql, [bookingId, userId, pgId], (err, data) => {

        if (err)               return res.send(result.createResult("Database error, try later"))
        if (data.length === 0) return res.send(result.createResult("No confirmed booking found for this PG"))

        const booking = data[0]

        // Check check_in_date has passed
        if (new Date(booking.check_in_date) > new Date()) {
            return res.send(result.createResult("You can only review after your check-in date"))
        }

        // Insert review — DB unique constraint prevents duplicate per booking
        const insertSql = `
            INSERT INTO reviews (user_id, pg_id, booking_id, rating, comment)
            VALUES (?, ?, ?, ?, ?)
        `

        pool.query(insertSql, [userId, pgId, bookingId, rating, comment || null], (err) => {

            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.send(result.createResult("You have already reviewed this booking"))
                }
                return res.send(result.createResult("Failed to submit review"))
            }

            return res.send(result.createResult(null, {
                message: "Review submitted successfully"
            }))
        })
    })
})


// ============================================================
//  GET REVIEWS FOR A PG
//  GET /review/:pgId
//  Public — no auth needed
// ============================================================
router.get('/review/:pgId', (req, res) => {

    const { pgId } = req.params

    const sql = `
        SELECT
            rv.id, rv.rating, rv.comment, rv.created_at,
            u.name AS reviewerName
        FROM reviews rv
        JOIN users u ON u.id = rv.user_id
        WHERE rv.pg_id      = ?
          AND rv.is_visible  = 1
        ORDER BY rv.created_at DESC
    `

    pool.query(sql, [pgId], (err, data) => {
        if (err) return res.send(result.createResult("Database error, try later"))
        return res.send(result.createResult(null, data))
    })
})


// ============================================================
//  DELETE MY REVIEW
//  DELETE /review/:reviewId
//  Role: user
//
//  User can delete their own review only.
// ============================================================
router.delete('/review/:reviewId', checkUser, (req, res) => {

    const { reviewId } = req.params
    const userId       = req.user.userId

    // Verify review belongs to this user
    const checkSql = 'SELECT id FROM reviews WHERE id = ? AND user_id = ?'
    pool.query(checkSql, [reviewId, userId], (err, data) => {

        if (err)               return res.send(result.createResult("Database error, try later"))
        if (data.length === 0) return res.send(result.createResult("Review not found"))

        const deleteSql = 'DELETE FROM reviews WHERE id = ?'
        pool.query(deleteSql, [reviewId], (err) => {
            if (err) return res.send(result.createResult("Failed to delete review"))
            return res.send(result.createResult(null, {
                message: "Review deleted successfully"
            }))
        })
    })
})


// ============================================================
//  HIDE REVIEW (Admin action)
//  PATCH /admin/review/:reviewId/hide
//  Role: sub_admin, super_admin
//
//  Admin can hide inappropriate reviews without deleting them.
// ============================================================
router.patch('/admin/review/:reviewId/hide', checkSubAdmin, (req, res) => {

    const { reviewId } = req.params

    const hideSql = 'UPDATE reviews SET is_visible = 0 WHERE id = ?'
    pool.query(hideSql, [reviewId], (err, data) => {
        if (err)                    return res.send(result.createResult("Database error, try later"))
        if (data.affectedRows === 0) return res.send(result.createResult("Review not found"))
        return res.send(result.createResult(null, { message: "Review hidden successfully" }))
    })
})


// ============================================================
//  REPORT A PG
//  POST /report/:pgId
//  Role: user
//  Body: { reason, description }
//
//  reason options:
//    fake_listing | wrong_info | safety_concern | fraud | other
// ============================================================
router.post('/report/:pgId', checkUser, (req, res) => {

    const { pgId }              = req.params
    const { reason, description } = req.body
    const userId                = req.user.userId

    if (!reason) {
        return res.send(result.createResult("reason is required"))
    }

    const allowedReasons = ['fake_listing', 'wrong_info', 'safety_concern', 'fraud', 'other']
    if (!allowedReasons.includes(reason)) {
        return res.send(result.createResult("Invalid reason"))
    }

    // Check PG exists and is approved
    const checkPgSql = `
        SELECT id FROM pgs
        WHERE id = ? AND verification_status = 'APPROVED'
    `
    pool.query(checkPgSql, [pgId], (err, data) => {

        if (err)               return res.send(result.createResult("Database error, try later"))
        if (data.length === 0) return res.send(result.createResult("PG not found"))

        const insertSql = `
            INSERT INTO reports (reporter_id, pg_id, reason, description)
            VALUES (?, ?, ?, ?)
        `

        pool.query(insertSql, [userId, pgId, reason, description || null], (err) => {
            if (err) return res.send(result.createResult("Failed to submit report"))
            return res.send(result.createResult(null, {
                message: "Report submitted. Admin will review it."
            }))
        })
    })
})


// ============================================================
//  GET ALL REPORTS (Admin)
//  GET /admin/reports
//  Role: sub_admin, super_admin
//  Query: status (optional) → OPEN | REVIEWED | RESOLVED | DISMISSED
// ============================================================
router.get('/admin/reports', checkSubAdmin, (req, res) => {

    const { status } = req.query
    const validStatuses = ['OPEN', 'REVIEWED', 'RESOLVED', 'DISMISSED']

    let sql = `
        SELECT
            r.id, r.reason, r.description, r.status,
            r.created_at, r.updated_at,
            u.name  AS reporterName,
            u.email AS reporterEmail,
            p.title AS pgTitle,
            p.city,
            p.area
        FROM reports r
        JOIN users u ON u.id = r.reporter_id
        JOIN pgs p   ON p.id = r.pg_id
    `

    const params = []

    if (status && validStatuses.includes(status)) {
        sql += ' WHERE r.status = ?'
        params.push(status)
    }

    sql += ' ORDER BY r.created_at DESC'

    pool.query(sql, params, (err, data) => {
        if (err) return res.send(result.createResult("Database error, try later"))
        return res.send(result.createResult(null, data))
    })
})


// ============================================================
//  UPDATE REPORT STATUS (Admin)
//  PATCH /admin/report/:reportId/status
//  Role: sub_admin, super_admin
//  Body: { status }
//  status: REVIEWED | RESOLVED | DISMISSED
// ============================================================
router.patch('/admin/report/:reportId/status', checkSubAdmin, (req, res) => {

    const { reportId }  = req.params
    const { status }    = req.body
    const adminId       = req.user.userId

    const allowedStatuses = ['REVIEWED', 'RESOLVED', 'DISMISSED']
    if (!status || !allowedStatuses.includes(status)) {
        return res.send(result.createResult("status must be REVIEWED, RESOLVED or DISMISSED"))
    }

    const updateSql = `
        UPDATE reports
        SET status      = ?,
            reviewed_by = ?,
            updated_at  = NOW()
        WHERE id = ?
    `

    pool.query(updateSql, [status, adminId, reportId], (err, data) => {
        if (err)                    return res.send(result.createResult("Database error, try later"))
        if (data.affectedRows === 0) return res.send(result.createResult("Report not found"))
        return res.send(result.createResult(null, {
            message: `Report marked as ${status}`
        }))
    })
})


module.exports = router