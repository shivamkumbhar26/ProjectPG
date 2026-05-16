// ============================================================
//  routes/owner.js
//  All owner-related routes.
//  Protected by auth middleware (applied in server.js).
//  Each route additionally protected by checkOwner role middleware.
// ============================================================

const express   = require('express')
const router    = express.Router()
const path      = require('path')
const fs        = require('fs')
const multer    = require('multer')

const pool      = require('../db/pool')
const result    = require('../utils/result')
const s3        = require('../utils/s3')
const { checkOwner } = require('../middlewares/role')

// ── Multer setup (only used in simulation mode) ─────────────
// Multer handles file reading from request in simulation.
// In real S3 flow, frontend uploads directly — multer not needed.
const upload = multer({
    storage: multer.memoryStorage(),   // keep file in memory as buffer
    limits: { fileSize: 5 * 1024 * 1024 }  // 5MB limit
})

const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads')


// ============================================================
//  GET UPLOAD URL
//  POST /owner/get-upload-url
//  Body: { docType, fileType, fileSize }
//
//  Step 1 of document upload flow.
//  Frontend asks backend for permission to upload.
//  Backend validates and returns uploadUrl + fileKey.
//
//  docType examples : "aadhaar", "pan", "property_deed"
//  fileType examples: "image/jpeg", "image/png", "application/pdf"
//  fileSize         : size in bytes
// ============================================================
router.post('/owner/get-upload-url', checkOwner, async (req, res) => {

    const { docType, fileType, fileSize } = req.body
    const ownerId = req.user.userId

    if (!docType || !fileType || !fileSize) {
        return res.send(result.createResult("docType, fileType and fileSize are required"))
    }

    const allowedDocTypes = ['aadhaar', 'pan', 'property_deed', 'noc', 'other']
    if (!allowedDocTypes.includes(docType)) {
        return res.send(result.createResult("Invalid document type"))
    }

    // Validate file type and size
    const validation = s3.validateFile(fileType, fileSize)
    if (!validation.valid) {
        return res.send(result.createResult(validation.message))
    }

    // Generate unique file key
    const fileKey = s3.generateFileKey('documents', ownerId, docType, fileType)

    try {
        const { uploadUrl } = await s3.getUploadUrl(fileKey, fileType)
        return res.send(result.createResult(null, {
            uploadUrl,
            fileKey,
            message: "Upload URL generated. Use this URL to upload your file directly."
        }))
    } catch (err) {
        return res.send(result.createResult("Failed to generate upload URL"))
    }
})


// ============================================================
//  SIMULATE UPLOAD (SIMULATION MODE ONLY)
//  POST /simulate-upload/:fileKey
//
//  In real S3, frontend uploads directly to S3 using uploadUrl.
//  In simulation, frontend sends file to this endpoint instead.
//
//  WILL REMOVE THIS ROUTE when switching to real AWS.
// ============================================================
router.post('/simulate-upload/:fileKey', upload.single('file'), (req, res) => {

    if (!req.file) {
        return res.send(result.createResult("No file received"))
    }

    const fileKey = decodeURIComponent(req.params.fileKey)

    // Create subfolder if needed (e.g. uploads/documents/)
    const fullPath = path.join(LOCAL_UPLOAD_DIR, fileKey)
    const dir      = path.dirname(fullPath)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }

    // Save buffer to local file
    fs.writeFile(fullPath, req.file.buffer, (err) => {
        if (err) {
            return res.send(result.createResult("Failed to save file locally"))
        }
        return res.send(result.createResult(null, {
            message: "File uploaded successfully (simulation)",
            fileKey
        }))
    })
})


// ============================================================
//  SAVE DOCUMENT
//  POST /owner/save-document
//  Body: { fileKey, docType }
//
//  Step 2 of document upload flow.
//  Called by frontend AFTER file is successfully uploaded to S3.
//  Backend saves the fileKey in MySQL owner_documents table.
// ============================================================
router.post('/owner/save-document', checkOwner, (req, res) => {

    const { fileKey, docType } = req.body
    const userId = req.user.userId

    if (!fileKey || !docType) {
        return res.send(result.createResult("fileKey and docType are required"))
    }

    // Get owner id from owners table using user id
    const getOwnerSql = 'SELECT id FROM owners WHERE user_id = ?'
    pool.query(getOwnerSql, [userId], (err, data) => {

        if (err) {
            return res.send(result.createResult("Database error, try later"))
        }
        if (data.length === 0) {
            return res.send(result.createResult("Owner profile not found"))
        }

        const ownerId = data[0].id

        // Save fileKey in owner_documents
        const insertSql = 'INSERT INTO owner_documents (owner_id, doc_type, doc_url) VALUES (?,?,?)'
        pool.query(insertSql, [ownerId, docType, fileKey], (err) => {

            if (err) {
                return res.send(result.createResult("Failed to save document record"))
            }

            return res.send(result.createResult(null, {
                message: "Document saved successfully"
            }))
        })
    })
})


// ============================================================
//  GET MY DOCUMENTS
//  GET /owner/my-documents
//
//  Owner views their own uploaded documents.
//  Returns fresh view URLs for each document.
// ============================================================
router.get('/owner/my-documents', checkOwner, async (req, res) => {

    const userId = req.user.userId

    const sql = `
        SELECT od.id, od.doc_type, od.doc_url, od.verified, od.uploaded_at
        FROM owner_documents od
        JOIN owners o ON o.id = od.owner_id
        WHERE o.user_id = ?
        ORDER BY od.uploaded_at DESC
    `

    pool.query(sql, [userId], async (err, data) => {

        if (err) {
            return res.send(result.createResult("Database error, try later"))
        }

        // Generate fresh view URL for each document
        try {
            const documents = await Promise.all(
                data.map(async (doc) => ({
                    id:         doc.id,
                    docType:    doc.doc_type,
                    verified:   doc.verified,
                    uploadedAt: doc.uploaded_at,
                    viewUrl:    await s3.getViewUrl(doc.doc_url)  // fresh URL each time
                }))
            )
            return res.send(result.createResult(null, documents))
        } catch (err) {
            return res.send(result.createResult("Failed to generate view URLs"))
        }
    })
})


// ============================================================
//  GET OWNER DOCUMENTS (for sub admin / super admin)
//  GET /owner/documents/:ownerId
//
//  Sub admin views a specific owner's documents during verification.
//  Returns fresh view URLs for each document.
// ============================================================
router.get('/owner/documents/:ownerId', async (req, res) => {

    const { ownerId } = req.params
    const role = req.user.role

    // Only sub_admin and super_admin can view others' documents
    if (!['sub_admin', 'super_admin'].includes(role)) {
        return res.send(result.createResult("Unauthorized access"))
    }

    const sql = `
        SELECT od.id, od.doc_type, od.doc_url, od.verified, od.uploaded_at
        FROM owner_documents od
        WHERE od.owner_id = ?
        ORDER BY od.uploaded_at DESC
    `

    pool.query(sql, [ownerId], async (err, data) => {

        if (err) {
            return res.send(result.createResult("Database error, try later"))
        }
        if (data.length === 0) {
            return res.send(result.createResult(null, []))
        }

        try {
            const documents = await Promise.all(
                data.map(async (doc) => ({
                    id:         doc.id,
                    docType:    doc.doc_type,
                    verified:   doc.verified,
                    uploadedAt: doc.uploaded_at,
                    viewUrl:    await s3.getViewUrl(doc.doc_url)
                }))
            )
            return res.send(result.createResult(null, documents))
        } catch (err) {
            return res.send(result.createResult("Failed to generate view URLs"))
        }
    })
})


// ============================================================
//  DELETE DOCUMENT
//  DELETE /owner/document/:documentId
//
//  Owner deletes one of their uploaded documents.
//  Removes from S3 and from MySQL.
// ============================================================
router.delete('/owner/document/:documentId', checkOwner, async (req, res) => {

    const { documentId } = req.params
    const userId = req.user.userId

    // Verify this document belongs to this owner
    const sql = `
        SELECT od.id, od.doc_url
        FROM owner_documents od
        JOIN owners o ON o.id = od.owner_id
        WHERE od.id = ? AND o.user_id = ?
    `
    pool.query(sql, [documentId, userId], async (err, data) => {

        if (err) {
            return res.send(result.createResult("Database error, try later"))
        }
        if (data.length === 0) {
            return res.send(result.createResult("Document not found"))
        }

        const fileKey = data[0].doc_url

        // Delete from S3 (or local in simulation)
        try {
            await s3.deleteFile(fileKey)
        } catch (err) {
            return res.send(result.createResult("Failed to delete file"))
        }

        // Delete from MySQL
        const deleteSql = 'DELETE FROM owner_documents WHERE id = ?'
        pool.query(deleteSql, [documentId], (err) => {
            if (err) {
                return res.send(result.createResult("Failed to delete document record"))
            }
            return res.send(result.createResult(null, {
                message: "Document deleted successfully"
            }))
        })
    })
})


module.exports = router