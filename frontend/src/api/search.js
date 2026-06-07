import api from './axios'

// params = { city, area, gender_allowed, food_included, min_price, max_price, amenities }
export const searchPgs = (params) =>
    api.get('/pgs', { params })

export const getPgDetail = (pgId) =>
    api.get(`/pgs/${pgId}`)

export const getPgReviews = (pgId) =>
    api.get(`/review/${pgId}`)