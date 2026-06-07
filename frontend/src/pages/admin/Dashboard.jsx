// src/pages/admin/Dashboard.jsx

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getPendingOwners, getPendingPgs, getReports } from '../../api/admin'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../../components/Spinner'

export default function AdminDashboard() {

    const { isSuperAdmin } = useAuth()
    const [counts,  setCounts]  = useState({ owners: 0, pgs: 0, reports: 0 })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchCounts()
    }, [])

    async function fetchCounts() {
        try {
            const [ownerRes, pgRes, reportRes] = await Promise.all([
                getPendingOwners(),
                getPendingPgs(),
                getReports('OPEN')
            ])
            setCounts({
                owners:  ownerRes.data?.data?.length  || 0,
                pgs:     pgRes.data?.data?.length     || 0,
                reports: reportRes.data?.data?.length || 0
            })
        } catch {
            // silently fail
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <Spinner />

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
                <p className="text-gray-500 text-sm mt-1">
                    {isSuperAdmin ? 'Super Admin' : 'Sub Admin'} panel
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                <StatCard
                    label="Pending Owners"
                    value={counts.owners}
                    color="yellow"
                    icon="👤"
                    to="/admin/owners"
                />
                <StatCard
                    label="Pending PGs"
                    value={counts.pgs}
                    color="blue"
                    icon="🏠"
                    to="/admin/pgs"
                />
                <StatCard
                    label="Open Reports"
                    value={counts.reports}
                    color="red"
                    icon="⚠️"
                    to="/admin/reports"
                />
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <h2 className="text-base font-semibold text-gray-700 mb-4">Quick Actions</h2>
                <div className="flex flex-wrap gap-3">
                    <ActionLink to="/admin/owners" label="Review Owners" color="yellow" />
                    <ActionLink to="/admin/pgs"    label="Review PGs"    color="blue"   />
                    <ActionLink to="/admin/reports" label="View Reports" color="red"    />
                    {isSuperAdmin && (
                        <ActionLink to="/admin/sub-admins" label="Manage Sub Admins" color="gray" />
                    )}
                </div>
            </div>

            {/* Role info */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                <h3 className="text-blue-800 font-semibold text-sm mb-2">
                    Your Role: {isSuperAdmin ? 'Super Admin' : 'Sub Admin'}
                </h3>
                {isSuperAdmin ? (
                    <ul className="text-blue-700 text-xs space-y-1">
                        <li>✓ Final approval for owners and PGs</li>
                        <li>✓ Create and manage sub admins</li>
                        <li>✓ View and resolve all reports</li>
                    </ul>
                ) : (
                    <ul className="text-blue-700 text-xs space-y-1">
                        <li>✓ Review owner documents and send to super admin</li>
                        <li>✓ Review PG listings and send to super admin</li>
                        <li>✓ View and update reports</li>
                    </ul>
                )}
            </div>
        </div>
    )
}

function StatCard({ label, value, color, icon, to }) {
    const colors = {
        yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        blue:   'bg-blue-50 text-blue-700 border-blue-200',
        red:    'bg-red-50 text-red-700 border-red-200',
        green:  'bg-green-50 text-green-700 border-green-200'
    }
    return (
        <Link to={to} className={`rounded-2xl p-5 border ${colors[color]} hover:shadow-md transition-shadow`}>
            <p className="text-2xl mb-1">{icon}</p>
            <p className="text-3xl font-bold">{value}</p>
            <p className="text-xs mt-1 opacity-80">{label}</p>
        </Link>
    )
}

function ActionLink({ to, label, color }) {
    const colors = {
        yellow: 'bg-yellow-500 hover:bg-yellow-600 text-white',
        blue:   'bg-blue-600 hover:bg-blue-700 text-white',
        red:    'bg-red-500 hover:bg-red-600 text-white',
        gray:   'border border-gray-300 text-gray-600 hover:bg-gray-50'
    }
    return (
        <Link to={to} className={`px-4 py-2 rounded-lg text-sm font-medium ${colors[color]}`}>
            {label}
        </Link>
    )
}