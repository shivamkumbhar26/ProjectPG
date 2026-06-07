import api from './axios'

export const registerUser = (data) =>
    api.post('/auth/register', data)

export const verifyOtp = (data) =>
    api.post('/verify-otp', data)

export const resendOtp = (data) =>
    api.post('/auth/resend-otp', data)

export const loginUser = (data) =>
    api.post('/auth/login', data)

export const changePassword = (data) =>
    api.patch('/auth/change-password', data)