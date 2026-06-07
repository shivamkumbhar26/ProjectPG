// booking api's 

import api from './axios'

export const getIdentityProofUploadUrl = (data) =>
    api.post('/user/get-upload-url', data)

export const requestBooking = (data) =>
    api.post('/booking/request', data)

export const getMyBookings = () =>
    api.get('/booking/my-bookings')

export const getBookingDetail = (bookingId) =>
    api.get(`/booking/${bookingId}`)

export const payBooking = (bookingId) =>
    api.post(`/booking/${bookingId}/pay`)

export const cancelBooking = (bookingId, data) =>
    api.post(`/booking/${bookingId}/cancel`, data)

export const submitReview = (pgId, data) =>
    api.post(`/review/${pgId}`, data)