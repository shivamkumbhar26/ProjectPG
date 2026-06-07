// src/pages/owner/CreatePg.jsx

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPg } from '../../api/owner'

const AMENITIES_OPTIONS = ['wifi', 'ac', 'parking', 'laundry', 'security', 'gym', 'tv', 'geyser']

export default function CreatePg() {

    const navigate = useNavigate()

    const [form, setForm] = useState({
        title:             '',
        description:       '',
        address_line:      '',
        area:              '',
        city:              '',
        district:          '',
        pincode:           '',
        gender_allowed:    'any',
        food_included:     false,
        notice_period_days: 30,
        amenities:         []
    })

    const [error,   setError]   = useState('')
    const [loading, setLoading] = useState(false)

    function handleChange(e) {
        const { name, value, type, checked } = e.target
        setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
    }

    function toggleAmenity(amenity) {
        const current = form.amenities
        if (current.includes(amenity)) {
            setForm({ ...form, amenities: current.filter(a => a !== amenity) })
        } else {
            setForm({ ...form, amenities: [...current, amenity] })
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const res  = await createPg(form)
            const data = res.data

            if (data.status === 'error') {
                setError(data.data)
                return
            }

            // Go to manage PG page to add images and rooms
            navigate(`/owner/pg/${data.data.pgId}`)

        } catch {
            setError('Failed to create PG. Try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Add New PG</h1>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">

                {/* Basic info */}
                <Card title="Basic Information">
                    <Field label="PG Title *">
                        <input name="title" value={form.title} onChange={handleChange}
                            placeholder="e.g. Sharma PG for Boys" required
                            className={inputCls} />
                    </Field>
                    <Field label="Description">
                        <textarea name="description" value={form.description} onChange={handleChange}
                            rows={3} placeholder="Describe your PG..."
                            className={inputCls} />
                    </Field>
                </Card>

                {/* Location */}
                <Card title="Location">
                    <Field label="Address Line *">
                        <input name="address_line" value={form.address_line} onChange={handleChange}
                            placeholder="Street, Building name" required className={inputCls} />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Area *">
                            <input name="area" value={form.area} onChange={handleChange}
                                placeholder="e.g. Shivaji Nagar" required className={inputCls} />
                        </Field>
                        <Field label="City *">
                            <input name="city" value={form.city} onChange={handleChange}
                                placeholder="e.g. Pune" required className={inputCls} />
                        </Field>
                        <Field label="District *">
                            <input name="district" value={form.district} onChange={handleChange}
                                placeholder="e.g. Pune" required className={inputCls} />
                        </Field>
                        <Field label="Pincode *">
                            <input name="pincode" value={form.pincode} onChange={handleChange}
                                placeholder="6 digit pincode" maxLength={6} required className={inputCls} />
                        </Field>
                    </div>
                </Card>

                {/* Rules */}
                <Card title="Rules & Policies">
                    <Field label="Gender Allowed *">
                        <div className="flex gap-3">
                            {['male', 'female', 'any'].map((g) => (
                                <button
                                    key={g}
                                    type="button"
                                    onClick={() => setForm({ ...form, gender_allowed: g })}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all
                                        ${form.gender_allowed === g
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-gray-600 border-gray-300'}`}
                                >
                                    {g === 'male' ? '👨 Male' : g === 'female' ? '👩 Female' : '👥 Any'}
                                </button>
                            ))}
                        </div>
                    </Field>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-700">Food Included</p>
                            <p className="text-xs text-gray-500">Is food/mess provided?</p>
                        </div>
                        <input
                            type="checkbox"
                            name="food_included"
                            checked={form.food_included}
                            onChange={handleChange}
                            className="w-5 h-5 accent-blue-600"
                        />
                    </div>

                    <Field label="Notice Period (days)">
                        <input
                            type="number"
                            name="notice_period_days"
                            value={form.notice_period_days}
                            onChange={handleChange}
                            min={0}
                            className={inputCls}
                        />
                    </Field>
                </Card>

                {/* Amenities */}
                <Card title="Amenities">
                    <div className="flex flex-wrap gap-2">
                        {AMENITIES_OPTIONS.map((a) => (
                            <button
                                key={a}
                                type="button"
                                onClick={() => toggleAmenity(a)}
                                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all capitalize
                                    ${form.amenities.includes(a)
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                            >
                                {a}
                            </button>
                        ))}
                    </div>
                </Card>

                <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm disabled:opacity-60"
                >
                    {loading ? 'Creating PG...' : 'Create PG & Continue →'}
                </button>

            </form>
        </div>
    )
}

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"

function Card({ title, children }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-700 mb-4">{title}</h2>
            <div className="flex flex-col gap-4">{children}</div>
        </div>
    )
}

function Field({ label, children }) {
    return (
        <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
            {children}
        </div>
    )
}