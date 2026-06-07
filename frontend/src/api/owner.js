// owner api's 

import api from './axios'

// ── Documents ────────────────────────────────────────────────
export const getDocumentUploadUrl = (data) =>
    api.post('/owner/get-upload-url', data)

export const saveDocument = (data) =>
    api.post('/owner/save-document', data)

export const getMyDocuments = () =>
    api.get('/owner/my-documents')

export const deleteDocument = (documentId) =>
    api.delete(`/owner/document/${documentId}`)

// ── PG ───────────────────────────────────────────────────────
export const createPg = (data) =>
    api.post('/owner/pg/create', data)

export const getMyPgs = () =>
    api.get('/owner/my-pgs')

export const getMyPgDetail = (pgId) =>
    api.get(`/owner/pg/${pgId}`)

export const getPgImageUploadUrl = (pgId, data) =>
    api.post(`/owner/pg/${pgId}/get-image-upload-url`, data)

export const savePgImage = (pgId, data) =>
    api.post(`/owner/pg/${pgId}/save-image`, data)

export const addRoomCategory = (pgId, data) =>
    api.post(`/owner/pg/${pgId}/room-category`, data)

export const getRoomCategoryImageUploadUrl = (categoryId, data) =>
    api.post(`/owner/room-category/${categoryId}/get-image-upload-url`, data)

export const addRoom = (pgId, data) =>
    api.post(`/owner/pg/${pgId}/room`, data)

export const submitPg = (pgId) =>
    api.post(`/owner/pg/${pgId}/submit`)

export const resubmitPg = (pgId) =>
    api.post(`/owner/pg/${pgId}/resubmit`)

// ── Bookings ─────────────────────────────────────────────────
export const getOwnerBookings = (status) =>
    api.get('/owner/bookings', { params: status ? { status } : {} })

export const approveBooking = (bookingId) =>
    api.post(`/owner/booking/${bookingId}/approve`)

export const rejectBooking = (bookingId, data) =>
    api.post(`/owner/booking/${bookingId}/reject`, data)

export const assignRoom = (bookingId, data) =>
    api.post(`/owner/booking/${bookingId}/assign-room`, data)