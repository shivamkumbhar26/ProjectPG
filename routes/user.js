// ============================================================
//  routes/user.js
//  User utility routes.
//
//  Add to server.js:
//    const userRoutes = require('./routes/user')
//    app.use('/', userRoutes)
// ============================================================

const express = require('express')
const router  = express.Router()
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')

const pool   = require('../db/pool')
const result = require('../utils/result')
const s3     = require('../utils/s3')
const { checkUser } = require('../middlewares/role')

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
})


// ============================================================
//  GET IDENTITY PROOF UPLOAD URL
//  POST /user/get-upload-url
//  Role: user
//  Body: { fileType, fileSize }
//
//  User calls this before sending booking request.
//  Returns uploadUrl + fileKey.
//  User uploads file to uploadUrl, then sends fileKey
//  as identity_proof_url in POST /booking/request.
// ============================================================
router.post('/user/get-upload-url', checkUser, async (req, res) => {

    const { fileType, fileSize } = req.body
    const userId                 = req.user.userId

    if (!fileType || !fileSize) {
        return res.send(result.createResult("fileType and fileSize are required"))
    }

    // Validate file type and size
    const validation = s3.validateFile(fileType, fileSize)
    if (!validation.valid) {
        return res.send(result.createResult(validation.message))
    }

    // Generate unique file key
    const fileKey = s3.generateFileKey('identity-proofs', userId, 'proof', fileType)

    try {
        const { uploadUrl } = await s3.getUploadUrl(fileKey, fileType)
        return res.send(result.createResult(null, {
            uploadUrl,
            fileKey,
            message: "Upload your identity proof to uploadUrl, then use fileKey in booking request"
        }))
    } catch (err) {
        return res.send(result.createResult("Failed to generate upload URL"))
    }
})


module.exports = router