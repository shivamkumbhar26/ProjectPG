// ============================================================
//  routes/subadmin.js
//  Super admin creates and manages sub admins.
//
//  Add to server.js:
//    const subAdminRoutes = require('./routes/subadmin')
//    app.use('/', subAdminRoutes)
// ============================================================

const express = require('express')
const router  = express.Router()
const bcrypt  = require('bcrypt')

const pool   = require('../db/pool')
const result = require('../utils/result')
const { checkAdmin } = require('../middlewares/role')


// ============================================================
//  CREATE SUB ADMIN
//  POST /admin/sub-admin/create
//  Role: super_admin only
//  Body: { name, email, phone, notes }
//
//  Super admin creates sub admin with a temp password.
//  Temp password is returned in response — share with sub admin.
//  Sub admin should change it after first login.
// ============================================================
router.post('/admin/sub-admin/create', checkAdmin, (req, res) => {

    const { name, email, phone, notes } = req.body
    const superAdminId = req.user.userId

    if (!name || !email || !phone) {
        return res.send(result.createResult("name, email and phone are required"))
    }

    // Check if email or phone already exists
    const checkSql = 'SELECT id FROM users WHERE email = ? OR phone = ?'
    pool.query(checkSql, [email, phone], (err, data) => {

        if (err) return res.send(result.createResult("Database error, try later"))
        if (data.length > 0) {
            return res.send(result.createResult("Email or phone already registered"))
        }

        // Generate temp password
        const tempPassword   = 'SubAdmin@' + Math.floor(1000 + Math.random() * 9000)
        const hashedPassword = bcrypt.hashSync(tempPassword, 10)

        // Insert into users
        const insertUserSql = `
            INSERT INTO users (name, email, phone, password_hash, role, is_phone_verified, is_email_verified, is_active)
            VALUES (?, ?, ?, ?, 'sub_admin', 1, 1, 1)
        `

        pool.query(insertUserSql, [name, email, phone, hashedPassword], (err, data) => {

            if (err) return res.send(result.createResult("Failed to create sub admin"))

            const newUserId = data.insertId

            // Insert into sub_admin_profiles
            const insertProfileSql = `
                INSERT INTO sub_admin_profiles (user_id, created_by, notes)
                VALUES (?, ?, ?)
            `

            pool.query(insertProfileSql, [newUserId, superAdminId, notes || null], (err) => {

                if (err) return res.send(result.createResult("Failed to create sub admin profile"))

                return res.send(result.createResult(null, {
                    message:      "Sub admin created successfully",
                    userId:       newUserId,
                    email,
                    tempPassword,
                    note:         "Share these credentials with the sub admin. They should change password after first login."
                }))
            })
        })
    })
})


// ============================================================
//  GET ALL SUB ADMINS
//  GET /admin/sub-admins
//  Role: super_admin only
// ============================================================
router.get('/admin/sub-admins', checkAdmin, (req, res) => {

    const sql = `
        SELECT
            u.id, u.name, u.email, u.phone,
            u.is_active, u.created_at,
            s.notes,
            s.created_at AS addedAt
        FROM users u
        JOIN sub_admin_profiles s ON s.user_id = u.id
        WHERE u.role = 'sub_admin'
        ORDER BY u.created_at DESC
    `

    pool.query(sql, (err, data) => {
        if (err) return res.send(result.createResult("Database error, try later"))
        return res.send(result.createResult(null, data))
    })
})


// ============================================================
//  DEACTIVATE SUB ADMIN
//  PATCH /admin/sub-admin/:userId/deactivate
//  Role: super_admin only
//
//  Deactivated sub admin cannot login anymore.
//  Their JWT will still work until expiry — acceptable for now.
// ============================================================
router.patch('/admin/sub-admin/:userId/deactivate', checkAdmin, (req, res) => {

    const { userId } = req.params

    // Make sure target is actually a sub_admin
    const checkSql = 'SELECT id, role FROM users WHERE id = ?'
    pool.query(checkSql, [userId], (err, data) => {

        if (err)               return res.send(result.createResult("Database error, try later"))
        if (data.length === 0) return res.send(result.createResult("User not found"))
        if (data[0].role !== 'sub_admin') {
            return res.send(result.createResult("Target user is not a sub admin"))
        }

        const deactivateSql = 'UPDATE users SET is_active = 0 WHERE id = ?'
        pool.query(deactivateSql, [userId], (err) => {
            if (err) return res.send(result.createResult("Failed to deactivate sub admin"))
            return res.send(result.createResult(null, {
                message: "Sub admin deactivated successfully"
            }))
        })
    })
})


// ============================================================
//  REACTIVATE SUB ADMIN
//  PATCH /admin/sub-admin/:userId/reactivate
//  Role: super_admin only
// ============================================================
router.patch('/admin/sub-admin/:userId/reactivate', checkAdmin, (req, res) => {

    const { userId } = req.params

    const checkSql = 'SELECT id, role FROM users WHERE id = ?'
    pool.query(checkSql, [userId], (err, data) => {

        if (err)               return res.send(result.createResult("Database error, try later"))
        if (data.length === 0) return res.send(result.createResult("User not found"))
        if (data[0].role !== 'sub_admin') {
            return res.send(result.createResult("Target user is not a sub admin"))
        }

        const reactivateSql = 'UPDATE users SET is_active = 1 WHERE id = ?'
        pool.query(reactivateSql, [userId], (err) => {
            if (err) return res.send(result.createResult("Failed to reactivate sub admin"))
            return res.send(result.createResult(null, {
                message: "Sub admin reactivated successfully"
            }))
        })
    })
})


// ============================================================
//  CHANGE PASSWORD
//  PATCH /auth/change-password
//  Role: any logged in user
//  Body: { currentPassword, newPassword }
//
//  Sub admins use this after first login to change temp password.
//  Any user can use this too.
// ============================================================
router.patch('/auth/change-password', (req, res) => {

    const { currentPassword, newPassword } = req.body
    const userId = req.user.userId

    if (!currentPassword || !newPassword) {
        return res.send(result.createResult("currentPassword and newPassword are required"))
    }

    if (newPassword.length < 8) {
        return res.send(result.createResult("New password must be at least 8 characters"))
    }

    // Get current password hash
    const getSql = 'SELECT password_hash FROM users WHERE id = ?'
    pool.query(getSql, [userId], async (err, data) => {

        if (err)               return res.send(result.createResult("Database error, try later"))
        if (data.length === 0) return res.send(result.createResult("User not found"))

        const isMatch = await bcrypt.compare(currentPassword, data[0].password_hash)
        if (!isMatch) {
            return res.send(result.createResult("Current password is incorrect"))
        }

        const newHash      = bcrypt.hashSync(newPassword, 10)
        const updateSql    = 'UPDATE users SET password_hash = ? WHERE id = ?'
        pool.query(updateSql, [newHash, userId], (err) => {
            if (err) return res.send(result.createResult("Failed to change password"))
            return res.send(result.createResult(null, {
                message: "Password changed successfully"
            }))
        })
    })
})


module.exports = router