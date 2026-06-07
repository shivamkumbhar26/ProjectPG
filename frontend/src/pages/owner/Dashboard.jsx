// src/pages/owner/Dashboard.jsx

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getMyPgs } from '../../api/owner'
import { getOwnerBookings } from '../../api/owner'
import Spinner from '../../components/Spinner'

export default function OwnerDashboard() {

    const [pgs,      setPgs]      = useState([])
    const [bookings, setBookings] = useState([])
    const [loading,  setLoading]  = useState(true)

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        try {
            const [pgRes, bookRes] = await Promise.all([
                getMyPgs(),
                getOwnerBookings('PENDING')
            ])
            setPgs(pgRes.data?.data     || [])
            setBookings(bookRes.data?.data || [])
        } catch {
            // silently fail — cards will just show 0
        } finally {
            setLoading(false)
        }
    }

    const approvedPgs  = pgs.filter(p => p.verification_status === 'APPROVED').length
    const pendingPgs   = pgs.filter(p => p.verification_status !== 'APPROVED').length
    const pendingBooks = bookings.length

    if (loading) return <Spinner />

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Owner Dashboard</h1>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard label="Total PGs"       value={pgs.length}    color="blue"   icon="🏠" />
                <StatCard label="Approved PGs"    value={approvedPgs}   color="green"  icon="✅" />
                <StatCard label="Pending PGs"     value={pendingPgs}    color="yellow" icon="⏳" />
                <StatCard label="New Requests"    value={pendingBooks}  color="orange" icon="📋" />
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <h2 className="text-base font-semibold text-gray-700 mb-4">Quick Actions</h2>
                <div className="flex flex-wrap gap-3">
                    <ActionBtn to="/owner/pg/create"  label="+ Add New PG"        color="blue" />
                    <ActionBtn to="/owner/bookings"   label="View Booking Requests" color="green" />
                    <ActionBtn to="/owner/documents"  label="Manage Documents"    color="gray" />
                </div>
            </div>

            {/* My PGs summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-gray-700">My PGs</h2>
                    <Link to="/owner/pgs" className="text-blue-600 text-sm hover:underline">View all</Link>
                </div>
                {pgs.length === 0 ? (
                    <div className="text-center text-gray-400 py-6">
                        <p className="text-3xl mb-2">🏠</p>
                        <p className="text-sm">No PGs yet.</p>
                        <Link to="/owner/pg/create" className="text-blue-600 text-sm hover:underline mt-1 inline-block">
                            Add your first PG
                        </Link>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {pgs.slice(0, 3).map((pg) => (
                            <Link
                                key={pg.id}
                                to={`/owner/pg/${pg.id}`}
                                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100"
                            >
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{pg.title}</p>
                                    <p className="text-xs text-gray-500">{pg.city}</p>
                                </div>
                                <StatusBadge status={pg.verification_status} />
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Pending bookings */}
            {pendingBooks > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
                    <p className="text-orange-700 font-semibold text-sm mb-1">
                        📋 {pendingBooks} pending booking request{pendingBooks > 1 ? 's' : ''} need your attention
                    </p>
                    <Link to="/owner/bookings" className="text-orange-600 text-sm hover:underline">
                        Review requests →
                    </Link>
                </div>
            )}
        </div>
    )
}

function StatCard({ label, value, color, icon }) {
    const colors = {
        blue:   'bg-blue-50 text-blue-600',
        green:  'bg-green-50 text-green-600',
        yellow: 'bg-yellow-50 text-yellow-600',
        orange: 'bg-orange-50 text-orange-600'
    }
    return (
        <div className={`rounded-2xl p-5 ${colors[color]}`}>
            <p className="text-2xl mb-1">{icon}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs mt-0.5 opacity-80">{label}</p>
        </div>
    )
}

function ActionBtn({ to, label, color }) {
    const colors = {
        blue:  'bg-blue-600 hover:bg-blue-700 text-white',
        green: 'bg-green-600 hover:bg-green-700 text-white',
        gray:  'border border-gray-300 text-gray-600 hover:bg-gray-50'
    }
    return (
        <Link to={to} className={`px-4 py-2 rounded-lg text-sm font-medium ${colors[color]}`}>
            {label}
        </Link>
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
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${styles[status] || 'bg-gray-100 text-gray-500'}`}>
            {status?.replace('_', ' ')}
        </span>
    )
}