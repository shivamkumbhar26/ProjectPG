// src/pages/user/MyBookings.jsx

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getMyBookings } from '../../api/booking'
import Spinner from '../../components/Spinner'

const STATUS_STYLES = {
    PENDING:          'bg-yellow-100 text-yellow-700',
    AWAITING_PAYMENT: 'bg-orange-100 text-orange-700',
    CONFIRMED:        'bg-green-100 text-green-700',
    REJECTED:         'bg-red-100 text-red-600',
    EXPIRED:          'bg-gray-100 text-gray-500',
    CANCELLED:        'bg-gray-100 text-gray-500'
}

export default function MyBookings() {

    const [bookings, setBookings] = useState([])
    const [loading,  setLoading]  = useState(true)
    const [error,    setError]    = useState('')

    useEffect(() => {
        fetchBookings()
    }, [])

    async function fetchBookings() {
        try {
            const res  = await getMyBookings()
            const data = res.data
            if (data.status === 'error') {
                setError(data.data)
                return
            }
            setBookings(data.data || [])
        } catch {
            setError('Failed to load bookings.')
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <Spinner />

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">My Bookings</h1>

            {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
            )}

            {bookings.length === 0 && !error && (
                <div className="text-center text-gray-500 py-16">
                    <p className="text-4xl mb-3">📋</p>
                    <p className="text-lg font-medium">No bookings yet</p>
                    <Link to="/" className="text-blue-600 text-sm mt-2 inline-block hover:underline">
                        Browse PGs
                    </Link>
                </div>
            )}

            <div className="flex flex-col gap-4">
                {bookings.map((b) => (
                    <Link
                        key={b.id}
                        to={`/booking/${b.id}`}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
                    >
                        <div className="flex items-start justify-between flex-wrap gap-2">
                            <div>
                                <h3 className="font-semibold text-gray-800">{b.pgTitle}</h3>
                                <p className="text-gray-500 text-xs mt-0.5">{b.area}, {b.city}</p>
                                <p className="text-gray-600 text-sm mt-1">{b.category_name}</p>
                            </div>
                            <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_STYLES[b.status]}`}>
                                {b.status.replace('_', ' ')}
                            </span>
                        </div>

                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                            <span>📅 Check-in: {new Date(b.check_in_date).toLocaleDateString()}</span>
                            <span>💰 ₹{Number(b.price_per_month).toLocaleString()}/month</span>
                            {b.room_number && <span>🚪 Room {b.room_number}</span>}
                        </div>

                        {/* Payment deadline warning */}
                        {b.status === 'AWAITING_PAYMENT' && b.payment_deadline && (
                            <div className="mt-3 bg-orange-50 border border-orange-200 text-orange-700 text-xs rounded-lg px-3 py-2">
                                ⏰ Pay before: {new Date(b.payment_deadline).toLocaleString()}
                            </div>
                        )}
                    </Link>
                ))}
            </div>
        </div>
    )
}