const path = require('path')

const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_SIZE_BYTES = 5 * 1024 * 1024

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
})

function generateFileKey(folder, id, label, mimeType) {
    const ext       = mimeType === 'application/pdf' ? 'pdf'
                    : mimeType === 'image/png'        ? 'png'
                    : 'jpg'
    const timestamp = Date.now()
    return `${folder}/${label}_${id}_${timestamp}.${ext}`
}

function validateFile(mimeType, sizeBytes) {
    if (!ALLOWED_TYPES.includes(mimeType)) {
        return { valid: false, message: 'Invalid file type. Only JPEG, PNG, PDF allowed.' }
    }
    if (sizeBytes > MAX_SIZE_BYTES) {
        return { valid: false, message: 'File too large. Maximum size is 5MB.' }
    }
    return { valid: true }
}

function getUploadUrl(fileKey, mimeType) {
    const command = new PutObjectCommand({
        Bucket:      process.env.AWS_BUCKET_NAME,
        Key:         fileKey,
        ContentType: mimeType
    })
    return getSignedUrl(s3, command, { expiresIn: 300 })
        .then(uploadUrl => ({ uploadUrl, fileKey }))
}

function getViewUrl(fileKey) {
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key:    fileKey
    })
    return getSignedUrl(s3, command, { expiresIn: 3600 })
}

function deleteFile(fileKey) {
    const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key:    fileKey
    })
    return s3.send(command)
}

module.exports = { generateFileKey, validateFile, getUploadUrl, getViewUrl, deleteFile }