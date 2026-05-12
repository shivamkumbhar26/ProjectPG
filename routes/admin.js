// ============================================================
//  routes/admin.js
//  Admin routes for owner verification workflow.
//
//  Sub admin  - reviews documents, sets UNDER_REVIEW
//  Super admin - final approve or reject
// ============================================================

const express = require('express')
const router  = express.Router()

const pool   = require('../db/pool')
const result = require('../utils/result')
const s3     = require('../utils/s3')
const { checkSubAdmin, checkAdmin } = require('../middlewares/role')


// ============================================================
//  GET ALL PENDING OWNERS
//  GET /admin/pending-owners
//  Role: sub_admin, super_admin
//
//  Sub admin opens this list to find owners waiting for review.
// ============================================================
router.get('/admin/pending-owners', checkSubAdmin, (req, res) => {

    const sql = `
        SELECT
            o.id          AS ownerId,
            o.verification_status,
            o.created_at,
            u.name,
            u.email,
            u.phone
        FROM owners o
        JOIN users u ON u.id = o.user_id
        WHERE o.verification_status = 'PENDING'
        ORDER BY o.created_at ASC
    `

    pool.query(sql, (err, data) => {
        if (err) {
            return res.send(result.createResult("Database error, try later"))
        }
        return res.send(result.createResult(null, data))
    })
})


// ============================================================
//  GET OWNER FULL PROFILE
//  GET /admin/owner/:ownerId
//  Role: sub_admin, super_admin
//
//  Sub admin opens a specific owner to review their details
//  and documents before making a decision.
// ============================================================
router.get('/admin/owner/:ownerId', checkSubAdmin, (req, res) => {

    const { ownerId } = req.params

    // Get owner basic info
    const ownerSql = `
        SELECT
            o.id          AS ownerId,
            o.verification_status,
            o.reviewed_by,
            o.reviewed_at,
            o.approved_by,
            o.approved_at,
            o.rejection_reason,
            o.created_at,
            u.name,
            u.email,
            u.phone
        FROM owners o
        JOIN users u ON u.id = o.user_id
        WHERE o.id = ?
    `

    pool.query(ownerSql, [ownerId], async (err, data) => {
        if (err) {
            return res.send(result.createResult("Database error, try later"))
        }
        if (data.length === 0) {
            return res.send(result.createResult("Owner not found"))
        }

        const owner = data[0]

        // Get owner documents with fresh view URLs
        const docSql = `
            SELECT id, doc_type, doc_url, verified, uploaded_at
            FROM owner_documents
            WHERE owner_id = ?
        `

        pool.query(docSql, [ownerId], async (err, docs) => {
            if (err) {
                return res.send(result.createResult("Database error, try later"))
            }

            try {
                const documents = await Promise.all(
                    docs.map(async (doc) => ({
                        id:         doc.id,
                        docType:    doc.doc_type,
                        verified:   doc.verified,
                        uploadedAt: doc.uploaded_at,
                        viewUrl:    await s3.getViewUrl(doc.doc_url)
                    }))
                )

                return res.send(result.createResult(null, {
                    ...owner,
                    documents
                }))
            } catch (err) {
                return res.send(result.createResult("Failed to generate document URLs"))
            }
        })
    })
})


// ============================================================
//  REVIEW OWNER (Sub admin action)
//  POST /admin/owner/:ownerId/review
//  Role: sub_admin, super_admin
//  Body: { note }
//
//  Sub admin marks all documents as verified and moves
//  owner status to UNDER_REVIEW with a note for super admin.
// ============================================================
router.post('/admin/owner/:ownerId/review', checkSubAdmin, (req, res) => {

    const { ownerId } = req.params
    const { note }    = req.body
    const subAdminId  = req.user.userId

    if (!note) {
        return res.send(result.createResult("Review note is required"))
    }

    // Step 1 — check owner exists and is still PENDING
    const checkSql = 'SELECT id, verification_status FROM owners WHERE id = ?'
    pool.query(checkSql, [ownerId], (err, data) => {

        if (err) {
            return res.send(result.createResult("Database error, try later"))
        }
        if (data.length === 0) {
            return res.send(result.createResult("Owner not found"))
        }
        if (data[0].verification_status !== 'PENDING') {
            return res.send(result.createResult("Owner is not in PENDING state"))
        }

        // Step 2 — mark all documents as verified
        const verifyDocsSql = 'UPDATE owner_documents SET verified = 1 WHERE owner_id = ?'
        pool.query(verifyDocsSql, [ownerId], (err) => {

            if (err) {
                return res.send(result.createResult("Failed to verify documents"))
            }

            // Step 3 — update owner status to UNDER_REVIEW
            const updateOwnerSql = `
                UPDATE owners
                SET
                    verification_status = 'UNDER_REVIEW',
                    reviewed_by         = ?,
                    reviewed_at         = NOW(),
                    rejection_reason    = ?
                WHERE id = ?
            `

            pool.query(updateOwnerSql, [subAdminId, note, ownerId], (err) => {

                if (err) {
                    return res.send(result.createResult("Failed to update owner status"))
                }

                return res.send(result.createResult(null, {
                    message: "Owner reviewed successfully. Sent to super admin for final approval."
                }))
            })
        })
    })
})


// ============================================================
//  GET ALL UNDER REVIEW OWNERS (Super admin action)
//  GET /admin/review-owners
//  Role: super_admin only
//
//  Super admin sees all owners that sub admin has reviewed
//  and sent for final approval.
// ============================================================
router.get('/admin/review-owners', checkAdmin, (req, res) => {

    const sql = `
        SELECT
            o.id              AS ownerId,
            o.verification_status,
            o.rejection_reason AS subAdminNote,
            o.reviewed_at,
            o.created_at,
            u.name,
            u.email,
            u.phone,
            reviewer.name     AS reviewedByName
        FROM owners o
        JOIN users u        ON u.id        = o.user_id
        LEFT JOIN users reviewer ON reviewer.id = o.reviewed_by
        WHERE o.verification_status = 'UNDER_REVIEW'
        ORDER BY o.reviewed_at ASC
    `

    pool.query(sql, (err, data) => {
        if (err) {
            return res.send(result.createResult("Database error, try later"))
        }
        return res.send(result.createResult(null, data))
    })
})


// ============================================================
//  APPROVE OWNER (Super admin action)
//  POST /admin/owner/:ownerId/approve
//  Role: super_admin only
//
//  Super admin gives final approval.
//  Owner can now create PG listings.
// ============================================================
router.post('/admin/owner/:ownerId/approve', checkAdmin, (req, res) => {

    const { ownerId }  = req.params
    const superAdminId = req.user.userId

    // Check owner is in UNDER_REVIEW state
    const checkSql = 'SELECT id, verification_status FROM owners WHERE id = ?'
    pool.query(checkSql, [ownerId], (err, data) => {

        if (err) {
            return res.send(result.createResult("Database error, try later"))
        }
        if (data.length === 0) {
            return res.send(result.createResult("Owner not found"))
        }
        if (data[0].verification_status !== 'UNDER_REVIEW') {
            return res.send(result.createResult("Owner is not in UNDER_REVIEW state"))
        }

        const approveSql = `
            UPDATE owners
            SET
                verification_status = 'APPROVED',
                approved_by         = ?,
                approved_at         = NOW()
            WHERE id = ?
        `

        pool.query(approveSql, [superAdminId, ownerId], (err) => {
            if (err) {
                return res.send(result.createResult("Failed to approve owner"))
            }
            return res.send(result.createResult(null, {
                message: "Owner approved successfully. They can now create PG listings."
            }))
        })
    })
})


// ============================================================
//  REJECT OWNER (Super admin action)
//  POST /admin/owner/:ownerId/reject
//  Role: super_admin only
//  Body: { reason }
//
//  Super admin rejects owner with a reason.
//  Owner is notified and can re-submit after fixing issues.
// ============================================================
router.post('/admin/owner/:ownerId/reject', checkAdmin, (req, res) => {

    const { ownerId }  = req.params
    const { reason }   = req.body
    const superAdminId = req.user.userId

    if (!reason) {
        return res.send(result.createResult("Rejection reason is required"))
    }

    // Check owner is in UNDER_REVIEW state
    const checkSql = 'SELECT id, verification_status FROM owners WHERE id = ?'
    pool.query(checkSql, [ownerId], (err, data) => {

        if (err) {
            return res.send(result.createResult("Database error, try later"))
        }
        if (data.length === 0) {
            return res.send(result.createResult("Owner not found"))
        }
        if (data[0].verification_status !== 'UNDER_REVIEW') {
            return res.send(result.createResult("Owner is not in UNDER_REVIEW state"))
        }

        const rejectSql = `
            UPDATE owners
            SET
                verification_status = 'REJECTED',
                approved_by         = ?,
                approved_at         = NOW(),
                rejection_reason    = ?
            WHERE id = ?
        `

        pool.query(rejectSql, [superAdminId, reason, ownerId], (err) => {
            if (err) {
                return res.send(result.createResult("Failed to reject owner"))
            }
            return res.send(result.createResult(null, {
                message: "Owner rejected. They will be notified with the reason."
            }))
        })
    })
})


// ============================================================
//  RESUBMIT OWNER FOR REVIEW
//  POST /admin/owner/:ownerId/resubmit
//  Role: owner only (called from owner side)
//
//  If owner was REJECTED, they fix their documents and
//  resubmit. Status goes back to PENDING.
// ============================================================
router.post('/owner/resubmit', (req, res) => {

    const userId = req.user.userId

    // Get owner id
    const getOwnerSql = `
        SELECT id, verification_status FROM owners WHERE user_id = ?
    `
    pool.query(getOwnerSql, [userId], (err, data) => {

        if (err) {
            return res.send(result.createResult("Database error, try later"))
        }
        if (data.length === 0) {
            return res.send(result.createResult("Owner profile not found"))
        }
        if (data[0].verification_status !== 'REJECTED') {
            return res.send(result.createResult("Only rejected owners can resubmit"))
        }

        const resubmitSql = `
            UPDATE owners
            SET
                verification_status = 'PENDING',
                reviewed_by         = NULL,
                reviewed_at         = NULL,
                approved_by         = NULL,
                approved_at         = NULL,
                rejection_reason    = NULL
            WHERE id = ?
        `

        pool.query(resubmitSql, [data[0].id], (err) => {
            if (err) {
                return res.send(result.createResult("Failed to resubmit"))
            }
            return res.send(result.createResult(null, {
                message: "Resubmitted successfully. Admin will review again."
            }))
        })
    })
})


module.exports = router