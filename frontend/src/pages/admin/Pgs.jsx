// src/pages/admin/Pgs.jsx
// Sub admin reviews PG listings, super admin approves/rejects

import { useState, useEffect } from 'react'
import {
    getPendingPgs, getUnderReviewPgs,
    getPgDetailAdmin, reviewPg,
    approvePg, rejectPg
} from '../../api/admin'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../../components/Spinner'

export default function AdminPgs() {

    const { isSuperAdmin } = useAuth()

    const [tab,     setTab]     = useState('pending')
    const [pgs,     setPgs]     = useState([])
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState('')
    const [success, setSuccess] = useState('')

    const [selected,   setSelected]   = useState(null)
    const [detailLoad, setDetailLoad] = useState(false)
    const [imgIndex,   setImgIndex]   = useState(0)

    const [note,   setNote]   = useState('')
    const [reason, setReason] = useState('')

    useEffect(() => {
        fetchPgs()
    }, [tab])

    async function fetchPgs() {
        setLoading(true)
        setPgs([])
        try {
            const res  = tab === 'pending' ? await getPendingPgs() : await getUnderReviewPgs()
            const data = res.data
            if (data.status === 'error') { setError(data.data); return }
            setPgs(data.data || [])
        } catch {
            setError('Failed to load PGs.')
        } finally {
            setLoading(false)
        }
    }

    async function openDetail(pgId) {
        setDetailLoad(true)
        setSelected(null)
        setImgIndex(0)
        try {
            const res  = await getPgDetailAdmin(pgId)
            const data = res.data
            if (data.status === 'error') { setError(data.data); return }
            setSelected(data.data)
        } catch {
            setError('Failed to load PG detail.')
        } finally {
            setDetailLoad(false)
        }
    }

    function showMsg(msg, isError = false) {
        if (isError) { setError(msg); setSuccess('') }
        else         { setSuccess(msg); setError('') }
        setTimeout(() => { setError(''); setSuccess('') }, 4000)
    }

    async function handleReview() {
        if (!note.trim()) { showMsg('Review note is required', true); return }
        try {
            const res  = await reviewPg(selected.id, { note })
            const data = res.data
            if (data.status === 'error') { showMsg(data.data, true); return }
            showMsg(data.data.message)
            setSelected(null)
            setNote('')
            fetchPgs()
        } catch {
            showMsg('Failed to review PG.', true)
        }
    }

    async function handleApprove() {
        try {
            const res  = await approvePg(selected.id)
            const data = res.data
            if (data.status === 'error') { showMsg(data.data, true); return }
            showMsg(data.data.message)
            setSelected(null)
            fetchPgs()
        } catch {
            showMsg('Failed to approve PG.', true)
        }
    }

    async function handleReject() {
        if (!reason.trim()) { showMsg('Rejection reason is required', true); return }
        try {
            const res  = await rejectPg(selected.id, { reason })
            const data = res.data
            if (data.status === 'error') { showMsg(data.data, true); return }
            showMsg(data.data.message)
            setSelected(null)
            setReason('')
            fetchPgs()
        } catch {
            showMsg('Failed to reject PG.', true)
        }
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">PG Verification</h1>

            <div className="flex gap-2 mb-6">
                <TabBtn active={tab === 'pending'} onClick={() => setTab('pending')} label="Pending Review" />
                {isSuperAdmin && (
                    <TabBtn active={tab === 'review'} onClick={() => setTab('review')} label="Awaiting Approval" />
                )}
            </div>

            {error   && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}
            {success && <div className="bg-green-50 border border-green-200 text-green-600 text-sm rounded-lg px-4 py-3 mb-4">{success}</div>}

            {loading && <Spinner />}

            {!loading && pgs.length === 0 && (
                <div className="text-center text-gray-400 py-16">
                    <p className="text-4xl mb-2">🏠</p>
                    <p className="text-sm">No PGs to review</p>
                </div>
            )}

            <div className="flex flex-col gap-3">
                {pgs.map((pg) => (
                    <div key={pg.pgId} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <div className="flex items-start justify-between flex-wrap gap-3">
                            <div>
                                <p className="font-semibold text-gray-800">{pg.title}</p>
                                <p className="text-xs text-gray-500">{pg.area}, {pg.city} · {pg.district}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Owner: {pg.ownerName} · {pg.ownerPhone}
                                </p>
                                {pg.subAdminNote && (
                                    <p className="text-xs text-blue-600 mt-1">Note: {pg.subAdminNote}</p>
                                )}
                            </div>
                            <button
                                onClick={() => openDetail(pg.pgId)}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg font-medium"
                            >
                                Review
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Detail modal */}
            {(selected || detailLoad) && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
                    <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl my-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-800">PG Review</h3>
                            <button onClick={() => setSelected(null)} className="text-gray-400 text-xl">✕</button>
                        </div>

                        {detailLoad && <Spinner />}

                        {selected && (
                            <>
                                {/* Images */}
                                {selected.images?.length > 0 && (
                                    <div className="mb-4">
                                        <img
                                            src={selected.images[imgIndex]?.viewUrl}
                                            alt=""
                                            className="w-full h-48 object-cover rounded-xl mb-2"
                                        />
                                        <div className="flex gap-2 overflow-x-auto">
                                            {selected.images.map((img, i) => (
                                                <img
                                                    key={img.id}
                                                    src={img.viewUrl}
                                                    onClick={() => setImgIndex(i)}
                                                    className={`h-12 w-16 object-cover rounded-lg cursor-pointer border-2
                                                        ${i === imgIndex ? 'border-blue-500' : 'border-transparent'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* PG info */}
                                <div className="bg-gray-50 rounded-xl p-4 mb-4 text-xs">
                                    <div className="grid grid-cols-2 gap-2">
                                        <InfoRow label="Title"    value={selected.title} />
                                        <InfoRow label="City"     value={`${selected.area}, ${selected.city}`} />
                                        <InfoRow label="Gender"   value={selected.gender_allowed} />
                                        <InfoRow label="Food"     value={selected.food_included ? 'Yes' : 'No'} />
                                        <InfoRow label="Owner"    value={selected.ownerName} />
                                        <InfoRow label="Phone"    value={selected.ownerPhone} />
                                    </div>
                                    {selected.amenities?.length > 0 && (
                                        <div className="mt-2">
                                            <span className="text-gray-500">Amenities: </span>
                                            <span className="text-gray-700">{selected.amenities.join(', ')}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Room categories */}
                                <div className="mb-4">
                                    <p className="text-sm font-semibold text-gray-700 mb-2">Room Categories</p>
                                    <div className="flex flex-col gap-2">
                                        {selected.roomCategories?.map((cat) => (
                                            <div key={cat.id} className="bg-gray-50 rounded-xl p-3 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="font-medium text-gray-800">{cat.category_name}</span>
                                                    <span className="text-blue-600 font-medium">
                                                        ₹{Number(cat.price_per_month).toLocaleString()}/mo
                                                    </span>
                                                </div>
                                                <p className="text-gray-500 mt-0.5">
                                                    {cat.capacity} beds · {cat.total_units} rooms · {cat.rooms?.length || 0} rooms entered
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Sub admin action */}
                                {!isSuperAdmin && selected.verification_status === 'PENDING_VERIFICATION' && (
                                    <div className="border-t pt-4">
                                        <label className="text-sm font-medium text-gray-700 block mb-1">
                                            Review Note (for super admin)
                                        </label>
                                        <textarea
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            rows={3}
                                            placeholder="e.g. All images verified, room details confirmed..."
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3"
                                        />
                                        <button
                                            onClick={handleReview}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2.5 rounded-lg font-medium"
                                        >
                                            Send to Super Admin
                                        </button>
                                    </div>
                                )}

                                {/* Super admin action */}
                                {isSuperAdmin && selected.verification_status === 'UNDER_REVIEW' && (
                                    <div className="border-t pt-4">
                                        {selected.review_note && (
                                            <div className="bg-blue-50 rounded-xl p-3 mb-3">
                                                <p className="text-xs text-blue-700">
                                                    <span className="font-medium">Sub admin note:</span> {selected.review_note}
                                                </p>
                                            </div>
                                        )}
                                        <button
                                            onClick={handleApprove}
                                            className="w-full bg-green-600 hover:bg-green-700 text-white text-sm py-2.5 rounded-lg font-medium mb-2"
                                        >
                                            ✓ Approve PG — Make it Live
                                        </button>
                                        <textarea
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            rows={2}
                                            placeholder="Rejection reason..."
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 mb-2"
                                        />
                                        <button
                                            onClick={handleReject}
                                            className="w-full border border-red-300 text-red-600 hover:bg-red-50 text-sm py-2.5 rounded-lg font-medium"
                                        >
                                            ✕ Reject PG
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

function TabBtn({ active, onClick, label }) {
    return (
        <button onClick={onClick}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all
                ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
            {label}
        </button>
    )
}

function InfoRow({ label, value }) {
    return (
        <div>
            <span className="text-gray-400">{label}: </span>
            <span className="font-medium text-gray-700">{value}</span>
        </div>
    )
}