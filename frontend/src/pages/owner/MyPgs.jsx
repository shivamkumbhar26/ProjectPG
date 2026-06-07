// src/pages/owner/MyPgs.jsx

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getMyPgs } from '../../api/owner'
import Spinner from '../../components/Spinner'

const STATUS_STYLES = {
    DRAFT:                'bg-gray-100 text-gray-600',
    APPROVED:             'bg-green-100 text-green-700',
    PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-700',
    UNDER_REVIEW:         'bg-blue-100 text-blue-700',
    REJECTED:             'bg-red-100 text-red-600'
}

const STATUS_LABELS = {
    DRAFT:                '📝 Draft',
    APPROVED:             '✅ Approved',
    PENDING_VERIFICATION: '⏳ Pending Verification',
    UNDER_REVIEW:         '🔍 Under Review',
    REJECTED:             '❌ Rejected'
}

export default function MyPgs() {

    const [pgs,     setPgs]     = useState([])
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState('')

    useEffect(() => {
        fetchPgs()
    }, [])

    async function fetchPgs() {
        try {
            const res  = await getMyPgs()
            const data = res.data
            if (data.status === 'error') {
                setError(data.data)
                return
            }
            setPgs(data.data || [])
        } catch {
            setError('Failed to load PGs.')
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <Spinner />

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800">My PGs</h1>
                <Link
                    to="/owner/pg/create"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
                >
                    + Add PG
                </Link>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
            )}

            {pgs.length === 0 && !error && (
                <div className="text-center text-gray-400 py-16">
                    <p className="text-5xl mb-3">🏠</p>
                    <p className="text-lg font-medium text-gray-600">No PGs yet</p>
                    <Link
                        to="/owner/pg/create"
                        className="inline-block mt-3 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                        Add your first PG
                    </Link>
                </div>
            )}

            <div className="flex flex-col gap-4">
                {pgs.map((pg) => (
                    <Link
                        key={pg.id}
                        to={`/owner/pg/${pg.id}`}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
                    >
                        <div className="flex items-start justify-between flex-wrap gap-3">
                            <div>
                                <h3 className="font-semibold text-gray-800 text-base">{pg.title}</h3>
                                <p className="text-gray-500 text-xs mt-0.5">{pg.area}, {pg.city}</p>
                            </div>
                            <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_STYLES[pg.verification_status]}`}>
                                {STATUS_LABELS[pg.verification_status]}
                            </span>
                        </div>

                        <div className="flex gap-4 mt-3 text-xs text-gray-500">
                            <span>🚪 {pg.roomCategoryCount} room type{pg.roomCategoryCount !== 1 ? 's' : ''}</span>
                            <span>🛏️ {pg.totalRooms} room{pg.totalRooms !== 1 ? 's' : ''}</span>
                            <span className={pg.gender_allowed === 'male' ? 'text-blue-600' : pg.gender_allowed === 'female' ? 'text-pink-600' : 'text-green-600'}>
                                {pg.gender_allowed === 'any' ? '👥 Any' : pg.gender_allowed === 'male' ? '👨 Male' : '👩 Female'}
                            </span>
                        </div>

                        {/* Guidance for rejected PGs */}
                        {pg.verification_status === 'REJECTED' && (
                            <p className="text-xs text-red-500 mt-2">
                                Your PG was rejected. Click to view reason and resubmit.
                            </p>
                        )}
                    </Link>
                ))}
            </div>
        </div>
    )
}