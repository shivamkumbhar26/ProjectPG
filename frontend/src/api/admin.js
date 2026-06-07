// admin api's calls.

import api from './axios'

// ── Owner verification ────────────────────────────────────────
export const getPendingOwners = () =>
    api.get('/admin/pending-owners')

export const getOwnerDetail = (ownerId) =>
    api.get(`/admin/owner/${ownerId}`)

export const reviewOwner = (ownerId, data) =>
    api.post(`/admin/owner/${ownerId}/review`, data)

export const getUnderReviewOwners = () =>
    api.get('/admin/review-owners')

export const approveOwner = (ownerId) =>
    api.post(`/admin/owner/${ownerId}/approve`)

export const rejectOwner = (ownerId, data) =>
    api.post(`/admin/owner/${ownerId}/reject`, data)

// ── PG verification ───────────────────────────────────────────
export const getPendingPgs = () =>
    api.get('/admin/pending-pgs')

export const getPgDetailAdmin = (pgId) =>
    api.get(`/admin/pg/${pgId}`)

export const reviewPg = (pgId, data) =>
    api.post(`/admin/pg/${pgId}/review`, data)

export const getUnderReviewPgs = () =>
    api.get('/admin/review-pgs')

export const approvePg = (pgId) =>
    api.post(`/admin/pg/${pgId}/approve`)

export const rejectPg = (pgId, data) =>
    api.post(`/admin/pg/${pgId}/reject`, data)

// ── Sub admin management ──────────────────────────────────────
export const createSubAdmin = (data) =>
    api.post('/admin/sub-admin/create', data)

export const getSubAdmins = () =>
    api.get('/admin/sub-admins')

export const deactivateSubAdmin = (userId) =>
    api.patch(`/admin/sub-admin/${userId}/deactivate`)

export const reactivateSubAdmin = (userId) =>
    api.patch(`/admin/sub-admin/${userId}/reactivate`)

// ── Reports ───────────────────────────────────────────────────
export const getReports = (status) =>
    api.get('/admin/reports', { params: status ? { status } : {} })

export const updateReportStatus = (reportId, data) =>
    api.patch(`/admin/report/${reportId}/status`, data)