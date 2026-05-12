// ============================================================
//  utils/s3.js
//  S3 file storage utility.
//
//  CURRENT MODE: Simulated (files saved locally in /uploads folder)
//
//  TO SWITCH TO REAL AWS LATER:
//  1. Run: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
//  2. Add to .env:
//       AWS_ACCESS_KEY_ID=your_key
//       AWS_SECRET_ACCESS_KEY=your_secret
//       AWS_REGION=ap-south-1
//       AWS_BUCKET_NAME=your_bucket_name
//  3. Replace the SIMULATED SECTION below with REAL AWS SECTION
//  4. Nothing else changes anywhere in the project
// ============================================================

const path = require('path')
const fs   = require('fs')

// ── Allowed file types and max size ─────────────────────────
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_SIZE_BYTES = 5 * 1024 * 1024   // 5 MB

// ── Local uploads folder (only used in simulation mode) ─────
const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads')

if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true })
}


// ============================================================
//  generateFileKey
//  Creates a unique file path string.
//  This is what gets stored in MySQL — never changes.
//
//  Example output:
//    "documents/owner_5_aadhaar_1716201234567.pdf"
//    "pg-images/pg_12_entrance_1716201234567.jpg"
// ============================================================
function generateFileKey(folder, id, label, mimeType) {
    const ext       = mimeType === 'application/pdf' ? 'pdf'
                    : mimeType === 'image/png'        ? 'png'
                    : 'jpg'
    const timestamp = Date.now()
    return `${folder}/${label}_${id}_${timestamp}.${ext}`
}


// ============================================================
//  validateFile
//  Call this before generating any upload URL.
//  Returns { valid: true } or { valid: false, message: "..." }
// ============================================================
function validateFile(mimeType, sizeBytes) {
    if (!ALLOWED_TYPES.includes(mimeType)) {
        return { valid: false, message: 'Invalid file type. Only JPEG, PNG, PDF allowed.' }
    }
    if (sizeBytes > MAX_SIZE_BYTES) {
        return { valid: false, message: 'File too large. Maximum size is 5MB.' }
    }
    return { valid: true }
}


// ============================================================
//  SIMULATED SECTION
//  Mimics S3 behavior using local filesystem.
//  Replace this entire section with REAL AWS SECTION later.
// ============================================================

// getUploadUrl — returns a fake presigned upload URL
// In real S3 this URL is used by frontend to PUT the file directly.
// In simulation, frontend will POST file to our own endpoint instead.
function getUploadUrl(fileKey, mimeType) {
    return Promise.resolve({
        uploadUrl: `http://localhost:${process.env.PORT || 3000}/simulate-upload/${encodeURIComponent(fileKey)}`,
        fileKey
    })
}

// getViewUrl — returns a fake presigned view URL
// In real S3 this expires after 1 hour.
// In simulation it just points to our local static file server.
function getViewUrl(fileKey) {
    return Promise.resolve(
        `http://localhost:${process.env.PORT || 3000}/uploads/${encodeURIComponent(fileKey)}`
    )
}

// deleteFile — removes file from local uploads folder
function deleteFile(fileKey) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(LOCAL_UPLOAD_DIR, fileKey)
        fs.unlink(filePath, (err) => {
            if (err && err.code !== 'ENOENT') return reject(err)
            resolve()
        })
    })
}


// ============================================================
//  REAL AWS SECTION (commented out — uncomment when ready)
//
//  const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3')
//  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
//  const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
//
//  const s3 = new S3Client({
//      region: process.env.AWS_REGION,
//      credentials: {
//          accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
//          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
//      }
//  })
//
//  function getUploadUrl(fileKey, mimeType) {
//      const command = new PutObjectCommand({
//          Bucket:      process.env.AWS_BUCKET_NAME,
//          Key:         fileKey,
//          ContentType: mimeType
//      })
//      return getSignedUrl(s3, command, { expiresIn: 300 })  // 5 minutes
//          .then(uploadUrl => ({ uploadUrl, fileKey }))
//  }
//
//  function getViewUrl(fileKey) {
//      const command = new GetObjectCommand({
//          Bucket: process.env.AWS_BUCKET_NAME,
//          Key:    fileKey
//      })
//      return getSignedUrl(s3, command, { expiresIn: 3600 })  // 1 hour
//  }
//
//  function deleteFile(fileKey) {
//      const command = new DeleteObjectCommand({
//          Bucket: process.env.AWS_BUCKET_NAME,
//          Key:    fileKey
//      })
//      return s3.send(command)
//  }
// ============================================================


module.exports = { generateFileKey, validateFile, getUploadUrl, getViewUrl, deleteFile }