// src/pages/admin/SubAdmins.jsx
// Super admin manages sub admins

import { useState, useEffect } from 'react'
import {
    getSubAdmins, createSubAdmin,
    deactivateSubAdmin, reactivateSubAdmin
} from '../../api/admin'
import Spinner from '../../components/Spinner'

export default function SubAdmins() {

    const [subAdmins, setSubAdmins] = useState([])
    const [loading,   setLoading]   = useState(true)
    const [error,     setError]     = useState('')
    const [success,   setSuccess]   = useState('')

    const [showForm, setShowForm] = useState(false)
    const [form,     setForm]     = useState({ name: '', email: '', phone: '', notes: '' })
    const [creating, setCreating] = useState(false)

    // Show created credentials
    const [createdCreds, setCreatedCreds] = useState(null)

    useEffect(() => {
        fetchSubAdmins()
    }, [])

    async function fetchSubAdmins() {
        try {
            const res  = await getSubAdmins()
            const data = res.data
            if (data.status === 'error') { setError(data.data); return }
            setSubAdmins(data.data || [])
        } catch {
            setError('Failed to load sub admins.')
        } finally {
            setLoading(false)
        }
    }

    function showMsg(msg, isError = false) {
        if (isError) { setError(msg); setSuccess('') }
        else         { setSuccess(msg); setError('') }
        setTimeout(() => { setError(''); setSuccess('') }, 5000)
    }

    async function handleCreate(e) {
        e.preventDefault()
        setCreating(true)
        try {
            const res  = await createSubAdmin(form)
            const data = res.data
            if (data.status === 'error') { showMsg(data.data, true); return }
            setCreatedCreds(data.data)
            setForm({ name: '', email: '', phone: '', notes: '' })
            setShowForm(false)
            fetchSubAdmins()
        } catch {
            showMsg('Failed to create sub admin.', true)
        } finally {
            setCreating(false)
        }
    }

    async function handleToggle(userId, isActive) {
        try {
            const res  = isActive
                ? await deactivateSubAdmin(userId)
                : await reactivateSubAdmin(userId)
            const data = res.data
            if (data.status === 'error') { showMsg(data.data, true); return }
            showMsg(data.data.message)
            fetchSubAdmins()
        } catch {
            showMsg('Failed to update sub admin.', true)
        }
    }

    if (loading) return <Spinner />

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Sub Admins</h1>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
                >
                    {showForm ? 'Cancel' : '+ Add Sub Admin'}
                </button>
            </div>

            {error   && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}
            {success && <div className="bg-green-50 border border-green-200 text-green-600 text-sm rounded-lg px-4 py-3 mb-4">{success}</div>}

            {/* Created credentials card */}
            {createdCreds && (
                <div className="bg-green-50 border border-green-300 rounded-2xl p-5 mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-green-800">✅ Sub Admin Created</p>
                        <button onClick={() => setCreatedCreds(null)} className="text-green-600 text-sm">✕</button>
                    </div>
                    <p className="text-green-700 text-sm">Share these credentials with the sub admin:</p>
                    <div className="bg-white rounded-xl p-4 mt-3 font-mono text-sm">
                        <p><span className="text-gray-500">Email: </span><strong>{createdCreds.email}</strong></p>
                        <p className="mt-1"><span className="text-gray-500">Password: </span><strong>{createdCreds.tempPassword}</strong></p>
                    </div>
                    <p className="text-green-600 text-xs mt-2">⚠️ Ask them to change the password after first login.</p>
                </div>
            )}

            {/* Create form */}
            {showForm && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                    <h2 className="text-base font-semibold text-gray-700 mb-4">Create Sub Admin</h2>
                    <form onSubmit={handleCreate} className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Full Name *">
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Full name"
                                    required
                                    className={inputCls}
                                />
                            </Field>
                            <Field label="Email *">
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="email@example.com"
                                    required
                                    className={inputCls}
                                />
                            </Field>
                            <Field label="Phone *">
                                <input
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    placeholder="10 digit phone"
                                    maxLength={10}
                                    required
                                    className={inputCls}
                                />
                            </Field>
                            <Field label="Notes">
                                <input
                                    value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                    placeholder="e.g. Handles Sangli area"
                                    className={inputCls}
                                />
                            </Field>
                        </div>
                        <button
                            type="submit"
                            disabled={creating}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60"
                        >
                            {creating ? 'Creating...' : 'Create Sub Admin'}
                        </button>
                    </form>
                </div>
            )}

            {/* Sub admin list */}
            {subAdmins.length === 0 && !showForm && (
                <div className="text-center text-gray-400 py-16">
                    <p className="text-4xl mb-2">👤</p>
                    <p className="text-sm">No sub admins yet</p>
                </div>
            )}

            <div className="flex flex-col gap-3">
                {subAdmins.map((sa) => (
                    <div key={sa.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <div className="flex items-start justify-between flex-wrap gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold text-gray-800">{sa.name}</p>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                        ${sa.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {sa.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500">{sa.email} · {sa.phone}</p>
                                {sa.notes && (
                                    <p className="text-xs text-gray-400 mt-1">{sa.notes}</p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                    Added: {new Date(sa.addedAt).toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={() => handleToggle(sa.id, sa.is_active)}
                                className={`text-xs px-4 py-2 rounded-lg font-medium border
                                    ${sa.is_active
                                        ? 'border-red-300 text-red-600 hover:bg-red-50'
                                        : 'border-green-300 text-green-600 hover:bg-green-50'}`}
                            >
                                {sa.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"

function Field({ label, children }) {
    return (
        <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
            {children}
        </div>
    )
}