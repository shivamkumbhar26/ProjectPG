// src/pages/owner/OwnerBookings.jsx

import { useState, useEffect } from 'react'
import { getOwnerBookings, approveBooking, rejectBooking, assignRoom } from '../../api/owner'
import { getMyPgDetail } from '../../api/owner'
import Spinner from '../../components/Spinner'

const STATUS_STYLES = {
    PENDING:          'bg-yellow-100 text-yellow-700',
    AWAITING_PAYMENT: 'bg-orange-100 text-orange-700',
    CONFIRMED:        'bg-green-100 text-green-700',
    REJECTED:         'bg-red-100 text-red-600',
    EXPIRED:          'bg-gray-100 text-gray-500',
    CANCELLED:        'bg-gray-100 text-gray-500'
}

export default function OwnerBookings() {

    const [bookings,    setBookings]    = useState([])
    const [loading,     setLoading]     = useState(true)
    const [error,       setError]       = useState('')
    const [success,     setSuccess]     = useState('')
    const [filterStatus, setFilterStatus] = useState('')

    // Reject modal
    const [rejectModal,  setRejectModal]  = useState(false)
    const [rejectId,     setRejectId]     = useState(null)
    const [rejectReason, setRejectReason] = useState('')

    // Assign room modal
    const [assignModal,  setAssignModal]  = useState(false)
    const [assignBooking, setAssignBooking] = useState(null)
    const [rooms,        setRooms]        = useState([])
    const [selectedRoom, setSelectedRoom] = useState('')

    useEffect(() => {
        fetchBookings()
    }, [filterStatus])

    async function fetchBookings() {
        setLoading(true)
        try {
            const res  = await getOwnerBookings(filterStatus)
            const data = res.data
            if (data.status === 'error') { setError(data.data); return }
            setBookings(data.data || [])
        } catch {
            setError('Failed to load bookings.')
        } finally {
            setLoading(false)
        }
    }

    function showMsg(msg, isError = false) {
        if (isError) { setError(msg); setSuccess('') }
        else         { setSuccess(msg); setError('') }
        setTimeout(() => { setError(''); setSuccess('') }, 4000)
    }

    async function handleApprove(bookingId) {
        try {
            const res  = await approveBooking(bookingId)
            const data = res.data
            if (data.status === 'error') { showMsg(data.data, true); return }
            showMsg('Booking approved. User has 24 hours to pay.')
            fetchBookings()
        } catch {
            showMsg('Failed to approve booking.', true)
        }
    }

    async function handleReject() {
        if (!rejectReason.trim()) { showMsg('Please enter a reason', true); return }
        try {
            const res  = await rejectBooking(rejectId, { reason: rejectReason })
            const data = res.data
            if (data.status === 'error') { showMsg(data.data, true); return }
            showMsg('Booking rejected.')
            setRejectModal(false)
            setRejectReason('')
            fetchBookings()
        } catch {
            showMsg('Failed to reject booking.', true)
        }
    }

    async function openAssignModal(booking) {
        setAssignBooking(booking)
        setSelectedRoom('')
        setAssignModal(true)

        // Fetch rooms for this booking's room category
        try {
            // get pgId from booking — we need to fetch PG detail to get rooms
            // booking has room_category_id — we find the PG from bookings pgTitle
            // Simpler: get rooms from all owner PGs and filter
            // For now fetch booking's PG detail using a workaround:
            // We don't have pgId directly in booking — use getMyPgDetail isn't ideal here.
            // Instead we pass rooms from the booking's category via a separate approach.
            // Best approach: get rooms from already loaded PG detail.
            // For simplicity here we show a room number input instead.
            setRooms([])
        } catch {
            setRooms([])
        }
    }

    async function handleAssignRoom() {
        if (!selectedRoom.trim()) { showMsg('Enter a room number', true); return }
        try {
            // selectedRoom here is roomId — owner picks from dropdown if rooms loaded
            // or types roomId manually
            const res  = await assignRoom(assignBooking.id, { roomId: parseInt(selectedRoom) })
            const data = res.data
            if (data.status === 'error') { showMsg(data.data, true); return }
            showMsg('Room assigned successfully.')
            setAssignModal(false)
            fetchBookings()
        } catch {
            showMsg('Failed to assign room.', true)
        }
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Booking Requests</h1>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {['', 'PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED'].map((s) => (
                    <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all
                            ${filterStatus === s
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                    >
                        {s === '' ? 'All' : s.replace('_', ' ')}
                    </button>
                ))}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-600 text-sm rounded-lg px-4 py-3 mb-4">{success}</div>
            )}

            {loading && <Spinner />}

            {!loading && bookings.length === 0 && (
                <div className="text-center text-gray-400 py-16">
                    <p className="text-4xl mb-3">📋</p>
                    <p className="text-sm">No bookings found</p>
                </div>
            )}

            <div className="flex flex-col gap-4">
                {bookings.map((b) => (
                    <div key={b.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">

                        {/* Header */}
                        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                            <div>
                                <p className="font-semibold text-gray-800">{b.userName}</p>
                                <p className="text-xs text-gray-500">{b.userPhone} · {b.userEmail}</p>
                            </div>
                            <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_STYLES[b.status]}`}>
                                {b.status.replace('_', ' ')}
                            </span>
                        </div>

                        {/* Booking info */}
                        <div className="bg-gray-50 rounded-xl p-3 mb-3">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <InfoRow label="PG"        value={b.pgTitle} />
                                <InfoRow label="Room Type" value={b.category_name} />
                                <InfoRow label="Check-in"  value={new Date(b.check_in_date).toLocaleDateString()} />
                                <InfoRow label="Rent"      value={`₹${Number(b.price_per_month).toLocaleString()}/mo`} />
                                <InfoRow label="Proof"     value={b.identity_proof_type?.replace('_', ' ')} />
                                {b.room_number && <InfoRow label="Room" value={b.room_number} />}
                            </div>
                        </div>

                        {/* Identity proof link */}
                        {b.identityProofViewUrl && (
                            <a
                                href={b.identityProofViewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 text-xs hover:underline block mb-3"
                            >
                                📄 View Identity Proof
                            </a>
                        )}

                        {/* Payment deadline */}
                        {b.status === 'AWAITING_PAYMENT' && b.payment_deadline && (
                            <div className="bg-orange-50 text-orange-700 text-xs rounded-lg px-3 py-2 mb-3">
                                ⏰ Payment deadline: {new Date(b.payment_deadline).toLocaleString()}
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 flex-wrap">
                            {b.status === 'PENDING' && (
                                <>
                                    <button
                                        onClick={() => handleApprove(b.id)}
                                        className="bg-green-600 hover:bg-green-700 text-white text-xs px-4 py-2 rounded-lg font-medium"
                                    >
                                        ✓ Approve
                                    </button>
                                    <button
                                        onClick={() => { setRejectId(b.id); setRejectModal(true) }}
                                        className="border border-red-300 text-red-600 hover:bg-red-50 text-xs px-4 py-2 rounded-lg font-medium"
                                    >
                                        ✕ Reject
                                    </button>
                                </>
                            )}

                            {b.status === 'CONFIRMED' && !b.room_number && (
                                <button
                                    onClick={() => openAssignModal(b)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg font-medium"
                                >
                                    🚪 Assign Room
                                </button>
                            )}
                        </div>

                    </div>
                ))}
            </div>

            {/* Reject modal */}
            {rejectModal && (
                <Modal title="Reject Booking" onClose={() => setRejectModal(false)}>
                    <p className="text-sm text-gray-600 mb-3">Please provide a reason for rejection:</p>
                    <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={3}
                        placeholder="Reason..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 mb-3"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleReject}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm py-2 rounded-lg font-medium"
                        >
                            Reject
                        </button>
                        <button
                            onClick={() => setRejectModal(false)}
                            className="flex-1 border border-gray-300 text-gray-600 text-sm py-2 rounded-lg"
                        >
                            Cancel
                        </button>
                    </div>
                </Modal>
            )}

            {/* Assign room modal */}
            {assignModal && assignBooking && (
                <Modal title="Assign Room" onClose={() => setAssignModal(false)}>
                    <p className="text-sm text-gray-600 mb-3">
                        Enter the Room ID to assign to <strong>{assignBooking.userName}</strong>
                    </p>
                    <div className="mb-3">
                        <label className="text-xs font-medium text-gray-600 block mb-1">Room ID</label>
                        <input
                            type="number"
                            value={selectedRoom}
                            onChange={(e) => setSelectedRoom(e.target.value)}
                            placeholder="Enter room ID from your PG"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Check the room IDs in Manage PG → Individual Rooms section
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleAssignRoom}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 rounded-lg font-medium"
                        >
                            Assign
                        </button>
                        <button
                            onClick={() => setAssignModal(false)}
                            className="flex-1 border border-gray-300 text-gray-600 text-sm py-2 rounded-lg"
                        >
                            Cancel
                        </button>
                    </div>
                </Modal>
            )}

        </div>
    )
}

function InfoRow({ label, value }) {
    return (
        <div>
            <span className="text-gray-400">{label}: </span>
            <span className="font-medium text-gray-700">{value || '—'}</span>
        </div>
    )
}

function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                </div>
                {children}
            </div>
        </div>
    )
}