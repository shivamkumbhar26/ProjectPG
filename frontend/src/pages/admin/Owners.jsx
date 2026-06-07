// src/pages/admin/Owners.jsx
// Sub admin reviews owners, super admin approves/rejects

import { useState, useEffect } from 'react'
import {
    getPendingOwners, getUnderReviewOwners,
    getOwnerDetail, reviewOwner,
    approveOwner, rejectOwner
} from '../../api/admin'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../../components/Spinner'

export default function AdminOwners() {

    const { isSuperAdmin } = useAuth()

    const [tab,     setTab]     = useState('pending')  // 'pending' | 'review'
    const [owners,  setOwners]  = useState([])
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState('')
    const [success, setSuccess] = useState('')

    // Detail modal
    const [selected,    setSelected]    = useState(null)
    const [detailLoad,  setDetailLoad]  = useState(false)

    // Action inputs
    const [note,   setNote]   = useState('')
    const [reason, setReason] = useState('')

    useEffect(() => {
        fetchOwners()
    }, [tab])

    async function fetchOwners() {
        setLoading(true)
        setOwners([])
        try {
            const res  = tab === 'pending' ? await getPendingOwners() : await getUnderReviewOwners()
            const data = res.data
            if (data.status === 'error') { setError(data.data); return }
            setOwners(data.data || [])
        } catch {
            setError('Failed to load owners.')
        } finally {
            setLoading(false)
        }
    }

    async function openDetail(ownerId) {
        setDetailLoad(true)
        setSelected(null)
        try {
            const res  = await getOwnerDetail(ownerId)
            const data = res.data
            if (data.status === 'error') { setError(data.data); return }
            setSelected(data.data)
        } catch {
            setError('Failed to load owner detail.')
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
            const res  = await reviewOwner(selected.ownerId, { note })
            const data = res.data
            if (data.status === 'error') { showMsg(data.data, true); return }
            showMsg(data.data.message)
            setSelected(null)
            setNote('')
            fetchOwners()
        } catch {
            showMsg('Failed to review owner.', true)
        }
    }

    async function handleApprove() {
        try {
            const res  = await approveOwner(selected.ownerId)
            const data = res.data
            if (data.status === 'error') { showMsg(data.data, true); return }
            showMsg(data.data.message)
            setSelected(null)
            fetchOwners()
        } catch {
            showMsg('Failed to approve owner.', true)
        }
    }

    async function handleReject() {
        if (!reason.trim()) { showMsg('Rejection reason is required', true); return }
        try {
            const res  = await rejectOwner(selected.ownerId, { reason })
            const data = res.data
            if (data.status === 'error') { showMsg(data.data, true); return }
            showMsg(data.data.message)
            setSelected(null)
            setReason('')
            fetchOwners()
        } catch {
            showMsg('Failed to reject owner.', true)
        }
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Owner Verification</h1>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <TabBtn active={tab === 'pending'} onClick={() => setTab('pending')} label="Pending Review" />
                {isSuperAdmin && (
                    <TabBtn active={tab === 'review'} onClick={() => setTab('review')} label="Awaiting Approval" />
                )}
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}
            {success && <div className="bg-green-50 border border-green-200 text-green-600 text-sm rounded-lg px-4 py-3 mb-4">{success}</div>}

            {loading && <Spinner />}

            {!loading && owners.length === 0 && (
                <div className="text-center text-gray-400 py-16">
                    <p className="text-4xl mb-2">👤</p>
                    <p className="text-sm">No owners to review</p>
                </div>
            )}

            <div className="flex flex-col gap-3">
                {owners.map((owner) => (
                    <div key={owner.ownerId} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <div className="flex items-start justify-between flex-wrap gap-3">
                            <div>
                                <p className="font-semibold text-gray-800">{owner.name}</p>
                                <p className="text-xs text-gray-500">{owner.email} · {owner.phone}</p>
                                {owner.subAdminNote && (
                                    <p className="text-xs text-blue-600 mt-1">
                                        Sub admin note: {owner.subAdminNote}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => openDetail(owner.ownerId)}
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
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-800">Owner Details</h3>
                            <button onClick={() => setSelected(null)} className="text-gray-400 text-xl">✕</button>
                        </div>

                        {detailLoad && <Spinner />}

                        {selected && (
                            <>
                                {/* Owner info */}
                                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                    <p className="font-semibold text-gray-800">{selected.name}</p>
                                    <p className="text-xs text-gray-500">{selected.email} · {selected.phone}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Registered: {new Date(selected.created_at).toLocaleDateString()}
                                    </p>
                                </div>

                                {/* Documents */}
                                <div className="mb-4">
                                    <p className="text-sm font-semibold text-gray-700 mb-2">Documents</p>
                                    {selected.documents?.length === 0 && (
                                        <p className="text-xs text-gray-400">No documents uploaded</p>
                                    )}
                                    <div className="flex flex-col gap-2">
                                        {selected.documents?.map((doc) => (
                                            <div key={doc.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2">
                                                <div>
                                                    <p className="text-xs font-medium text-gray-700 capitalize">
                                                        {doc.docType.replace('_', ' ')}
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                        {new Date(doc.uploadedAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <a
                                                    href={doc.viewUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-blue-600 text-xs hover:underline"
                                                >
                                                    View
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Sub admin action */}
                                {!isSuperAdmin && selected.verification_status === 'PENDING' && (
                                    <div className="border-t pt-4">
                                        <label className="text-sm font-medium text-gray-700 block mb-1">
                                            Review Note (for super admin)
                                        </label>
                                        <textarea
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            rows={3}
                                            placeholder="e.g. All documents verified, address confirmed..."
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
                                        {selected.subAdminNote && (
                                            <div className="bg-blue-50 rounded-xl p-3 mb-3">
                                                <p className="text-xs text-blue-700">
                                                    <span className="font-medium">Sub admin note:</span> {selected.subAdminNote || selected.rejection_reason}
                                                </p>
                                            </div>
                                        )}
                                        <div className="flex gap-2 mb-3">
                                            <button
                                                onClick={handleApprove}
                                                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2.5 rounded-lg font-medium"
                                            >
                                                ✓ Approve Owner
                                            </button>
                                        </div>
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
                                            ✕ Reject Owner
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
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all
                ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
        >
            {label}
        </button>
    )
}