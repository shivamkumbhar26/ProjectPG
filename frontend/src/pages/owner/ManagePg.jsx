// src/pages/owner/ManagePg.jsx
// Owner manages a single PG — upload images, add room categories,
// add individual rooms, and submit for verification.

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
    getMyPgDetail, getPgImageUploadUrl, savePgImage,
    addRoomCategory, addRoom, submitPg, resubmitPg
} from '../../api/owner'
import Spinner from '../../components/Spinner'
import axios from 'axios'

export default function ManagePg() {

    const { pgId } = useParams()

    const [pg,      setPg]      = useState(null)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState('')
    const [success, setSuccess] = useState('')

    // Image upload state
    const [imgFile,    setImgFile]    = useState(null)
    const [imgLabel,   setImgLabel]   = useState('entrance')
    const [isCover,    setIsCover]    = useState(false)
    const [imgLoading, setImgLoading] = useState(false)

    // Room category form
    const [catForm, setCatForm] = useState({
        category_name: '', capacity: '', total_units: '',
        price_per_month: '', deposit_amount: '', description: ''
    })
    const [catLoading, setCatLoading] = useState(false)

    // Add room form
    const [roomForm, setRoomForm] = useState({
        room_category_id: '', room_number: '', floor: '', notes: ''
    })
    const [roomLoading, setRoomLoading] = useState(false)

    useEffect(() => {
        fetchPg()
    }, [pgId])

    async function fetchPg() {
        try {
            const res  = await getMyPgDetail(pgId)
            const data = res.data
            if (data.status === 'error') {
                setError(data.data)
                return
            }
            setPg(data.data)
        } catch {
            setError('Failed to load PG.')
        } finally {
            setLoading(false)
        }
    }

    function showMsg(msg, isError = false) {
        if (isError) { setError(msg); setSuccess('') }
        else         { setSuccess(msg); setError('') }
        setTimeout(() => { setError(''); setSuccess('') }, 4000)
    }

    // ── Upload PG image ──────────────────────────────────────
    async function handleImageUpload(e) {
    e.preventDefault()
    if (!imgFile) { showMsg('Select a file', true); return }
    setImgLoading(true)

    try {
        const urlRes = await getPgImageUploadUrl(pgId, {
            fileType: imgFile.type, fileSize: imgFile.size, label: imgLabel
        })
        if (urlRes.data.status === 'error') { showMsg(urlRes.data.data, true); return }

        const { uploadUrl, fileKey } = urlRes.data.data
       
        // Use 'imgFile' instead of 'file'
        await axios.put(uploadUrl, imgFile, {
            headers: { 'Content-Type': imgFile.type }
        })

        await savePgImage(pgId, { fileKey, label: imgLabel, isCover })
        showMsg('Image uploaded successfully')
        setImgFile(null)
        fetchPg()
    } catch (err) {
        console.error("Upload error details:", err) // Helpful for debugging
        showMsg('Image upload failed', true)
    } finally {
        setImgLoading(false)
    }
    }

    // ── Add room category ────────────────────────────────────
    async function handleAddCategory(e) {
        e.preventDefault()
        setCatLoading(true)

        try {
            const res  = await addRoomCategory(pgId, catForm)
            const data = res.data
            if (data.status === 'error') { showMsg(data.data, true); return }
            showMsg(`Room category added. Now add ${catForm.total_units} rooms for it.`)
            setCatForm({ category_name: '', capacity: '', total_units: '', price_per_month: '', deposit_amount: '', description: '' })
            fetchPg()
        } catch {
            showMsg('Failed to add room category', true)
        } finally {
            setCatLoading(false)
        }
    }

    // ── Add individual room ──────────────────────────────────
    async function handleAddRoom(e) {
        e.preventDefault()
        setRoomLoading(true)

        try {
            const res  = await addRoom(pgId, roomForm)
            const data = res.data
            if (data.status === 'error') { showMsg(data.data, true); return }
            showMsg(data.data.message)
            setRoomForm({ ...roomForm, room_number: '', floor: '', notes: '' })
            fetchPg()
        } catch {
            showMsg('Failed to add room', true)
        } finally {
            setRoomLoading(false)
        }
    }

    // ── Submit for verification ──────────────────────────────
    async function handleSubmit() {
        try {
            const res  = await submitPg(pgId)
            const data = res.data
            if (data.status === 'error') { showMsg(data.data, true); return }
            showMsg(data.data.message)
            fetchPg()
        } catch {
            showMsg('Failed to submit', true)
        }
    }

    // ── Resubmit after rejection ─────────────────────────────
    async function handleResubmit() {
        try {
            const res  = await resubmitPg(pgId)
            const data = res.data
            if (data.status === 'error') { showMsg(data.data, true); return }
            showMsg(data.data.message)
            fetchPg()
        } catch {
            showMsg('Failed to resubmit', true)
        }
    }

    if (loading) return <Spinner />
    if (!pg)     return <div className="text-red-500 text-center py-10">{error}</div>

    const canSubmit = pg.verification_status === 'DRAFT' || pg.verification_status === 'REJECTED'

    return (
        <div className="max-w-2xl mx-auto">

            {/* PG header */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">{pg.title}</h1>
                        <p className="text-gray-500 text-sm">{pg.area}, {pg.city}</p>
                    </div>
                    <StatusBadge status={pg.verification_status} />
                </div>

                {pg.verification_status === 'REJECTED' && pg.rejection_reason && (
                    <div className="mt-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">
                        <p className="font-medium">Rejection Reason:</p>
                        <p className="mt-1">{pg.rejection_reason}</p>
                    </div>
                )}

                {pg.verification_status === 'APPROVED' && (
                    <div className="mt-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3">
                        ✅ Your PG is live and visible to users.
                    </div>
                )}
            </div>

            {/* Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-600 text-sm rounded-lg px-4 py-3 mb-4">{success}</div>
            )}

            {/* Step 1 — Images */}
            <Section step="1" title="PG Images" subtitle={`${pg.images?.length || 0} image(s) uploaded`}>
                <form onSubmit={handleImageUpload} className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">Label</label>
                            <select
                                value={imgLabel}
                                onChange={(e) => setImgLabel(e.target.value)}
                                className={inputCls}
                            >
                                {['entrance', 'mess', 'parking', 'washroom', 'common_area', 'other'].map(l => (
                                    <option key={l} value={l}>{l.replace('_', ' ')}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">File</label>
                            <input
                                type="file"
                                accept=".jpg,.jpeg,.png"
                                onChange={(e) => setImgFile(e.target.files[0])}
                                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                            />
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" checked={isCover} onChange={(e) => setIsCover(e.target.checked)}
                            className="accent-blue-600" />
                        Set as cover image
                    </label>
                    <button type="submit" disabled={imgLoading}
                        className="bg-blue-600 text-white text-sm py-2 rounded-lg disabled:opacity-60 hover:bg-blue-700">
                        {imgLoading ? 'Uploading...' : 'Upload Image'}
                    </button>
                </form>

                {/* Uploaded images */}
                {pg.images?.length > 0 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                        {pg.images.map((img) => (
                            <div key={img.id} className="relative flex-shrink-0">
                                <img src={img.viewUrl} alt={img.label}
                                    className="h-16 w-24 object-cover rounded-lg border border-gray-200" />
                                {img.is_cover == 1 && (
                                    <span className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-1 rounded">Cover</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            {/* Step 2 — Room Categories */}
            <Section step="2" title="Room Categories" subtitle={`${pg.roomCategories?.length || 0} category(s) added`}>
                <form onSubmit={handleAddCategory} className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                        <FormField label="Category Name *" type="text"
                            placeholder="e.g. Double Sharing"
                            value={catForm.category_name}
                            onChange={(e) => setCatForm({ ...catForm, category_name: e.target.value })}
                            required />
                        <FormField label="Capacity (beds/room) *" type="number" min="1"
                            value={catForm.capacity}
                            onChange={(e) => setCatForm({ ...catForm, capacity: e.target.value })}
                            required />
                        <FormField label="Total Units (rooms) *" type="number" min="1"
                            value={catForm.total_units}
                            onChange={(e) => setCatForm({ ...catForm, total_units: e.target.value })}
                            required />
                        <FormField label="Price/month (₹) *" type="number" min="0"
                            value={catForm.price_per_month}
                            onChange={(e) => setCatForm({ ...catForm, price_per_month: e.target.value })}
                            required />
                        <FormField label="Deposit (₹)" type="number" min="0"
                            value={catForm.deposit_amount}
                            onChange={(e) => setCatForm({ ...catForm, deposit_amount: e.target.value })} />
                    </div>
                    <button type="submit" disabled={catLoading}
                        className="bg-blue-600 text-white text-sm py-2 rounded-lg disabled:opacity-60 hover:bg-blue-700">
                        {catLoading ? 'Adding...' : '+ Add Room Category'}
                    </button>
                </form>

                {/* Category list */}
                {pg.roomCategories?.length > 0 && (
                    <div className="flex flex-col gap-2 mt-3">
                        {pg.roomCategories.map((cat) => (
                            <div key={cat.id} className="bg-gray-50 rounded-xl p-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{cat.category_name}</p>
                                        <p className="text-xs text-gray-500">
                                            {cat.capacity} beds/room · {cat.total_units} rooms · ₹{Number(cat.price_per_month).toLocaleString()}/month
                                        </p>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium
                                        ${cat.rooms_entered ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {cat.rooms_entered ? '✓ Complete' : `${cat.rooms?.length || 0}/${cat.total_units} rooms`}
                                    </span>
                                </div>
                                {/* Rooms under this category */}
                                {cat.rooms?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {cat.rooms.map((r) => (
                                            <span key={r.id} className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                                                Room {r.room_number}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            {/* Step 3 — Individual Rooms */}
            {pg.roomCategories?.length > 0 && (
                <Section step="3" title="Individual Rooms" subtitle="Add physical rooms for each category">
                    <form onSubmit={handleAddRoom} className="flex flex-col gap-3">
                        <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">Room Category *</label>
                            <select
                                value={roomForm.room_category_id}
                                onChange={(e) => setRoomForm({ ...roomForm, room_category_id: e.target.value })}
                                required
                                className={inputCls}
                            >
                                <option value="">Select category</option>
                                {pg.roomCategories.filter(c => !c.rooms_entered).map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.category_name} ({cat.rooms?.length || 0}/{cat.total_units} entered)
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <FormField label="Room Number *" type="text" placeholder="e.g. 101"
                                value={roomForm.room_number}
                                onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })}
                                required />
                            <FormField label="Floor" type="text" placeholder="e.g. Ground, 1st"
                                value={roomForm.floor}
                                onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })} />
                        </div>
                        <button type="submit" disabled={roomLoading}
                            className="bg-blue-600 text-white text-sm py-2 rounded-lg disabled:opacity-60 hover:bg-blue-700">
                            {roomLoading ? 'Adding...' : '+ Add Room'}
                        </button>
                    </form>
                </Section>
            )}

            {/* Step 4 — Submit */}
            <Section step="4" title="Submit for Verification" subtitle="All steps complete? Submit for admin review.">
                {canSubmit && (
                    <button
                        onClick={pg.verification_status === 'REJECTED' ? handleResubmit : handleSubmit}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-xl text-sm"
                    >
                        {pg.verification_status === 'REJECTED' ? '🔄 Resubmit for Review' : '✅ Submit for Verification'}
                    </button>
                )}
                {pg.verification_status === 'PENDING_VERIFICATION' && (
                    <p className="text-yellow-600 text-sm text-center">⏳ Already submitted. Waiting for admin to review.</p>
                )}
                {pg.verification_status === 'UNDER_REVIEW' && (
                    <p className="text-blue-600 text-sm text-center">🔍 Under review by admin team.</p>
                )}
                {pg.verification_status === 'APPROVED' && (
                    <p className="text-green-600 text-sm text-center">✅ PG is approved and live.</p>
                )}
            </Section>

        </div>
    )
}

// ── Shared small components ───────────────────────────────────

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"

function Section({ step, title, subtitle, children }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
            <div className="flex items-center gap-3 mb-1">
                <span className="bg-blue-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                    {step}
                </span>
                <h2 className="text-base font-semibold text-gray-700">{title}</h2>
            </div>
            {subtitle && <p className="text-xs text-gray-500 mb-4 ml-9">{subtitle}</p>}
            {children}
        </div>
    )
}

function FormField({ label, ...props }) {
    return (
        <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
            <input {...props} className={inputCls} />
        </div>
    )
}

function StatusBadge({ status }) {
    const styles = {
        APPROVED:             'bg-green-100 text-green-700',
        PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-700',
        UNDER_REVIEW:         'bg-blue-100 text-blue-700',
        REJECTED:             'bg-red-100 text-red-600'
    }
    return (
        <span className={`text-xs font-medium px-3 py-1 rounded-full ${styles[status] || 'bg-gray-100 text-gray-500'}`}>
            {status?.replace(/_/g, ' ')}
        </span>
    )
}