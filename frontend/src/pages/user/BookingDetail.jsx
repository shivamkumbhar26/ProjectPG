// src/pages/user/BookingDetail.jsx

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getBookingDetail, payBooking, cancelBooking, submitReview } from '../../api/booking'
import Spinner from '../../components/Spinner'

const STATUS_STYLES = {
    PENDING:          'bg-yellow-100 text-yellow-700',
    AWAITING_PAYMENT: 'bg-orange-100 text-orange-700',
    CONFIRMED:        'bg-green-100 text-green-700',
    REJECTED:         'bg-red-100 text-red-600',
    EXPIRED:          'bg-gray-100 text-gray-500',
    CANCELLED:        'bg-gray-100 text-gray-500'
}

export default function BookingDetail() {

    const { bookingId } = useParams()
    const navigate      = useNavigate()

    const [booking, setBooking] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState('')
    const [msg,     setMsg]     = useState('')

    // Review form
    const [showReview, setShowReview] = useState(false)
    const [review,     setReview]     = useState({ rating: 5, comment: '' })
    const [reviewLoad, setReviewLoad] = useState(false)

    useEffect(() => {
        fetchBooking()
    }, [bookingId])

    async function fetchBooking() {
        try {
            const res  = await getBookingDetail(bookingId)
            const data = res.data
            if (data.status === 'error') {
                setError(data.data)
                return
            }
            setBooking(data.data)
        } catch {
            setError('Failed to load booking.')
        } finally {
            setLoading(false)
        }
    }

    async function handlePay() {
        setMsg('')
        try {
            const res  = await payBooking(bookingId)
            const data = res.data
            if (data.status === 'error') {
                setError(data.data)
                return
            }
            setMsg(data.data.message)
            fetchBooking()
        } catch {
            setError('Payment failed. Try again.')
        }
    }

    async function handleCancel() {
        if (!window.confirm('Are you sure you want to cancel this booking?')) return
        setMsg('')
        try {
            const res  = await cancelBooking(bookingId, { reason: 'Cancelled by user' })
            const data = res.data
            if (data.status === 'error') {
                setError(data.data)
                return
            }
            setMsg(data.data.message)
            fetchBooking()
        } catch {
            setError('Cancellation failed. Try again.')
        }
    }

    async function handleReview(e) {
        e.preventDefault()
        setReviewLoad(true)
        try {
            const res  = await submitReview(booking.pg_id || booking.pgId, {
                bookingId: parseInt(bookingId),
                rating:    review.rating,
                comment:   review.comment
            })
            const data = res.data
            if (data.status === 'error') {
                setError(data.data)
                return
            }
            setMsg('Review submitted!')
            setShowReview(false)
        } catch {
            setError('Failed to submit review.')
        } finally {
            setReviewLoad(false)
        }
    }

    if (loading) return <Spinner />
    if (error && !booking) return <div className="text-red-500 text-center py-10">{error}</div>
    if (!booking) return null

    const isPastCheckIn = new Date(booking.check_in_date) < new Date()

    return (
        <div className="max-w-xl mx-auto">

            <button
                onClick={() => navigate('/bookings')}
                className="text-blue-600 text-sm mb-4 hover:underline flex items-center gap-1"
            >
                ← Back to Bookings
            </button>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

                {/* Status badge */}
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-xl font-bold text-gray-800">Booking #{booking.id}</h1>
                    <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_STYLES[booking.status]}`}>
                        {booking.status.replace('_', ' ')}
                    </span>
                </div>

                {msg && (
                    <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 mb-4">
                        {msg}
                    </div>
                )}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
                        {error}
                    </div>
                )}

                {/* PG Info */}
                <Section title="PG Details">
                    <Row label="PG"           value={booking.pgTitle} />
                    <Row label="Address"      value={`${booking.address_line}, ${booking.area}, ${booking.city}`} />
                    <Row label="Room Type"    value={booking.category_name} />
                    {booking.room_number && (
                        <Row label="Room No." value={`${booking.room_number}${booking.floor ? ` (${booking.floor} floor)` : ''}`} />
                    )}
                </Section>

                {/* Stay Info */}
                <Section title="Stay Details">
                    <Row label="Check-in"     value={new Date(booking.check_in_date).toLocaleDateString()} />
                    {booking.duration_months && (
                        <Row label="Duration" value={`${booking.duration_months} month(s)`} />
                    )}
                    <Row label="Rent"         value={`₹${Number(booking.price_per_month).toLocaleString()}/month`} />
                    {booking.deposit_amount > 0 && (
                        <Row label="Deposit"  value={`₹${Number(booking.deposit_amount).toLocaleString()}`} />
                    )}
                </Section>

                {/* Owner Info */}
                <Section title="Owner Details">
                    <Row label="Name"  value={booking.ownerName} />
                    <Row label="Phone" value={booking.ownerPhone} />
                </Section>

                {/* Payment deadline */}
                {booking.status === 'AWAITING_PAYMENT' && booking.payment_deadline && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                        <p className="text-orange-700 text-sm font-medium">⏰ Payment Deadline</p>
                        <p className="text-orange-600 text-sm mt-1">
                            {new Date(booking.payment_deadline).toLocaleString()}
                        </p>
                        <p className="text-orange-500 text-xs mt-1">
                            Pay before the deadline or your booking will be cancelled automatically.
                        </p>
                    </div>
                )}

                {/* Rejection reason */}
                {booking.status === 'REJECTED' && booking.rejection_reason && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                        <p className="text-red-700 text-sm font-medium">Rejection Reason</p>
                        <p className="text-red-600 text-sm mt-1">{booking.rejection_reason}</p>
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-col gap-3 mt-4">

                    {/* Pay button */}
                    {booking.status === 'AWAITING_PAYMENT' && (
                        <button
                            onClick={handlePay}
                            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-xl text-sm"
                        >
                            💳 Pay Now (₹{(Number(booking.price_per_month) + Number(booking.deposit_amount)).toLocaleString()})
                        </button>
                    )}

                    {/* Cancel button */}
                    {['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED'].includes(booking.status) && (
                        <button
                            onClick={handleCancel}
                            className="border border-red-300 text-red-600 hover:bg-red-50 font-medium py-2.5 rounded-xl text-sm"
                        >
                            Cancel Booking
                        </button>
                    )}

                    {/* Review button */}
                    {booking.status === 'CONFIRMED' && isPastCheckIn && (
                        <button
                            onClick={() => setShowReview(true)}
                            className="border border-blue-300 text-blue-600 hover:bg-blue-50 font-medium py-2.5 rounded-xl text-sm"
                        >
                            ⭐ Write a Review
                        </button>
                    )}

                </div>
            </div>

            {/* Review modal */}
            {showReview && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-800">Write a Review</h3>
                            <button onClick={() => setShowReview(false)} className="text-gray-400 text-xl">✕</button>
                        </div>

                        <form onSubmit={handleReview} className="flex flex-col gap-4">

                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-2">Rating</label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setReview({ ...review, rating: star })}
                                            className={`text-2xl ${star <= review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                                        >
                                            ⭐
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1">Comment (optional)</label>
                                <textarea
                                    value={review.comment}
                                    onChange={(e) => setReview({ ...review, comment: e.target.value })}
                                    rows={3}
                                    placeholder="Share your experience..."
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={reviewLoad}
                                className="bg-blue-600 text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60"
                            >
                                {reviewLoad ? 'Submitting...' : 'Submit Review'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

        </div>
    )
}

function Section({ title, children }) {
    return (
        <div className="mb-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</h2>
            <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2">
                {children}
            </div>
        </div>
    )
}

function Row({ label, value }) {
    return (
        <div className="flex items-start justify-between gap-4">
            <span className="text-xs text-gray-500 whitespace-nowrap">{label}</span>
            <span className="text-xs font-medium text-gray-800 text-right">{value}</span>
        </div>
    )
}