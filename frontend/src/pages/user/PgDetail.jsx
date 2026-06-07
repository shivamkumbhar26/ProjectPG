// src/pages/user/PgDetail.jsx

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPgDetail } from '../../api/search'
import { getIdentityProofUploadUrl, requestBooking } from '../../api/booking'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../../components/Spinner'
import axios from 'axios'

export default function PgDetail() {

    const { pgId }    = useParams()
    const navigate    = useNavigate()
    const { isLoggedIn, isUser } = useAuth()

    const [pg,      setPg]      = useState(null)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState('')

    // Booking modal state
    const [showModal,    setShowModal]    = useState(false)
    const [selectedCat,  setSelectedCat]  = useState(null)
    const [bookingForm,  setBookingForm]  = useState({
        check_in_date:       '',
        duration_months:     '',
        identity_proof_type: 'aadhaar'
    })
    const [proofFile,    setProofFile]    = useState(null)
    const [bookingLoad,  setBookingLoad]  = useState(false)
    const [bookingError, setBookingError] = useState('')
    const [bookingSuccess, setBookingSuccess] = useState('')

    // Active image index
    const [imgIndex, setImgIndex] = useState(0)

    useEffect(() => {
        fetchPg()
    }, [pgId])

    async function fetchPg() {
        try {
            const res  = await getPgDetail(pgId)
            const data = res.data
            if (data.status === 'error') {
                setError(data.data)
                return
            }
            setPg(data.data)
        } catch {
            setError('Failed to load PG details.')
        } finally {
            setLoading(false)
        }
    }

    function openBooking(category) {
        if (!isLoggedIn) {
            navigate('/login')
            return
        }
        setSelectedCat(category)
        setShowModal(true)
        setBookingError('')
        setBookingSuccess('')
    }

    async function handleBooking(e) {
        e.preventDefault()
        setBookingError('')
        setBookingSuccess('')

        if (!proofFile) {
            setBookingError('Please upload your identity proof')
            return
        }

        setBookingLoad(true)

        try {
            // Step 1 — get upload URL
            const urlRes = await getIdentityProofUploadUrl({
                fileType: proofFile.type,
                fileSize: proofFile.size
            })

            if (urlRes.data.status === 'error') {
                setBookingError(urlRes.data.data)
                return
            }

            const { uploadUrl, fileKey } = urlRes.data.data

            // Step 2 — upload file to simulate endpoint
            await axios.put(uploadUrl, file, {
                headers: { 'Content-Type': file.type }
            })

            // Step 3 — send booking request
            const bookRes = await requestBooking({
                room_category_id:    selectedCat.id,
                check_in_date:       bookingForm.check_in_date,
                duration_months:     bookingForm.duration_months || null,
                identity_proof_type: bookingForm.identity_proof_type,
                identity_proof_url:  fileKey
            })

            if (bookRes.data.status === 'error') {
                setBookingError(bookRes.data.data)
                return
            }

            setBookingSuccess('Booking request sent! Owner will review it shortly.')

        } catch {
            setBookingError('Something went wrong. Try again.')
        } finally {
            setBookingLoad(false)
        }
    }

    if (loading) return <Spinner />
    if (error)   return <div className="text-red-500 text-center py-10">{error}</div>
    if (!pg)     return null

    const images = pg.images || []

    return (
        <div className="max-w-4xl mx-auto">

            {/* Image gallery */}
            <div className="rounded-2xl overflow-hidden mb-6 bg-gray-100">
                {images.length > 0 ? (
                    <div>
                        <img
                            src={images[imgIndex]?.viewUrl}
                            alt={pg.title}
                            className="w-full h-72 object-cover"
                        />
                        {images.length > 1 && (
                            <div className="flex gap-2 p-3 overflow-x-auto">
                                {images.map((img, i) => (
                                    <img
                                        key={img.id}
                                        src={img.viewUrl}
                                        onClick={() => setImgIndex(i)}
                                        className={`h-14 w-20 object-cover rounded-lg cursor-pointer border-2
                                            ${i === imgIndex ? 'border-blue-500' : 'border-transparent'}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-72 flex items-center justify-center text-6xl">🏠</div>
                )}
            </div>

            {/* PG Info */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">{pg.title}</h1>
                        <p className="text-gray-500 text-sm mt-1">
                            📍 {pg.address_line}, {pg.area}, {pg.city} — {pg.pincode}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-full">
                        <span className="text-yellow-500">⭐</span>
                        <span className="font-semibold text-sm">{Number(pg.avgRating).toFixed(1)}</span>
                        <span className="text-gray-400 text-xs">({pg.reviewCount} reviews)</span>
                    </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mt-4">
                    <Tag label={pg.gender_allowed === 'male' ? '👨 Male Only' : pg.gender_allowed === 'female' ? '👩 Female Only' : '👥 Any Gender'} color="blue" />
                    {pg.food_included == 1 && <Tag label="🍽️ Food Included" color="orange" />}
                    <Tag label={`📋 ${pg.notice_period_days} days notice`} color="gray" />
                </div>

                {/* Amenities */}
                {pg.amenities?.length > 0 && (
                    <div className="mt-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Amenities</h3>
                        <div className="flex flex-wrap gap-2">
                            {pg.amenities.map((a) => (
                                <span key={a} className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full capitalize">
                                    {a}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Description */}
                {pg.description && (
                    <div className="mt-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-1">About</h3>
                        <p className="text-gray-600 text-sm leading-relaxed">{pg.description}</p>
                    </div>
                )}

                {/* Owner contact */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-600">
                        🏠 Owner: <span className="font-medium">{pg.ownerName}</span>
                        {' · '}
                        📞 <span className="font-medium">{pg.ownerPhone}</span>
                    </p>
                </div>
            </div>

            {/* Room Categories */}
            <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Room Types</h2>
                <div className="flex flex-col gap-4">
                    {pg.roomCategories?.map((cat) => (
                        <div
                            key={cat.id}
                            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
                        >
                            <div className="flex items-start justify-between flex-wrap gap-3">
                                <div>
                                    <h3 className="font-semibold text-gray-800">{cat.category_name}</h3>
                                    <p className="text-gray-500 text-xs mt-1">
                                        {cat.capacity} person{cat.capacity > 1 ? 's' : ''} per room
                                    </p>
                                    {cat.description && (
                                        <p className="text-gray-600 text-sm mt-2">{cat.description}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-blue-600 font-bold text-lg">
                                        ₹{Number(cat.price_per_month).toLocaleString()}
                                    </p>
                                    <p className="text-gray-400 text-xs">per month</p>
                                    {cat.deposit_amount > 0 && (
                                        <p className="text-gray-500 text-xs mt-1">
                                            + ₹{Number(cat.deposit_amount).toLocaleString()} deposit
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-4">
                                <span className={`text-xs font-medium px-3 py-1 rounded-full
                                    ${cat.available_slots > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                    {cat.available_slots > 0
                                        ? `✓ ${cat.available_slots} slot${cat.available_slots > 1 ? 's' : ''} available`
                                        : '✗ Full'}
                                </span>

                                {isUser && cat.available_slots > 0 && (
                                    <button
                                        onClick={() => openBooking(cat)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded-lg font-medium"
                                    >
                                        Book Now
                                    </button>
                                )}
                                {!isLoggedIn && cat.available_slots > 0 && (
                                    <button
                                        onClick={() => navigate('/login')}
                                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded-lg font-medium"
                                    >
                                        Login to Book
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reviews */}
            {pg.reviews?.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">Reviews</h2>
                    <div className="flex flex-col gap-4">
                        {pg.reviews.map((rv) => (
                            <div key={rv.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-sm text-gray-700">{rv.reviewerName}</span>
                                    <div className="flex text-yellow-400 text-sm">
                                        {'⭐'.repeat(rv.rating)}
                                    </div>
                                </div>
                                {rv.comment && (
                                    <p className="text-gray-600 text-sm">{rv.comment}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Booking Modal */}
            {showModal && selectedCat && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-800">Book — {selectedCat.category_name}</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>

                        <p className="text-blue-600 font-semibold mb-4">
                            ₹{Number(selectedCat.price_per_month).toLocaleString()}/month
                            {selectedCat.deposit_amount > 0 && ` + ₹${Number(selectedCat.deposit_amount).toLocaleString()} deposit`}
                        </p>

                        {bookingError && (
                            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
                                {bookingError}
                            </div>
                        )}
                        {bookingSuccess && (
                            <div className="bg-green-50 border border-green-200 text-green-600 text-sm rounded-lg px-4 py-3 mb-4">
                                {bookingSuccess}
                            </div>
                        )}

                        {!bookingSuccess && (
                            <form onSubmit={handleBooking} className="flex flex-col gap-4">

                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1">Check-in Date</label>
                                    <input
                                        type="date"
                                        required
                                        min={new Date().toISOString().split('T')[0]}
                                        value={bookingForm.check_in_date}
                                        onChange={(e) => setBookingForm({ ...bookingForm, check_in_date: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1">Duration (months)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={bookingForm.duration_months}
                                        onChange={(e) => setBookingForm({ ...bookingForm, duration_months: e.target.value })}
                                        placeholder="Optional"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1">Identity Proof Type</label>
                                    <select
                                        value={bookingForm.identity_proof_type}
                                        onChange={(e) => setBookingForm({ ...bookingForm, identity_proof_type: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    >
                                        <option value="aadhaar">Aadhaar</option>
                                        <option value="college_id">College ID</option>
                                        <option value="employee_id">Employee ID</option>
                                        <option value="passport">Passport</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1">Upload Identity Proof</label>
                                    <input
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.pdf"
                                        onChange={(e) => setProofFile(e.target.files[0])}
                                        required
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">JPG, PNG or PDF. Max 5MB.</p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={bookingLoad}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60"
                                >
                                    {bookingLoad ? 'Submitting...' : 'Send Booking Request'}
                                </button>

                            </form>
                        )}

                        {bookingSuccess && (
                            <div className="flex flex-col gap-3 mt-2">
                                <button
                                    onClick={() => navigate('/bookings')}
                                    className="bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium"
                                >
                                    View My Bookings
                                </button>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>
    )
}

function Tag({ label, color }) {
    const colors = {
        blue:   'bg-blue-100 text-blue-700',
        orange: 'bg-orange-100 text-orange-700',
        gray:   'bg-gray-100 text-gray-600',
        green:  'bg-green-100 text-green-700',
        pink:   'bg-pink-100 text-pink-700'
    }
    return (
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${colors[color] || colors.gray}`}>
            {label}
        </span>
    )
}