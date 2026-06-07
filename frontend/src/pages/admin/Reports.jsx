// src/pages/admin/Reports.jsx

import { useState, useEffect } from 'react'
import { getReports, updateReportStatus } from '../../api/admin'
import Spinner from '../../components/Spinner'

const STATUS_STYLES = {
    OPEN:      'bg-red-100 text-red-700',
    REVIEWED:  'bg-yellow-100 text-yellow-700',
    RESOLVED:  'bg-green-100 text-green-700',
    DISMISSED: 'bg-gray-100 text-gray-500'
}

export default function AdminReports() {

    const [reports,    setReports]    = useState([])
    const [loading,    setLoading]    = useState(true)
    const [error,      setError]      = useState('')
    const [success,    setSuccess]    = useState('')
    const [filterStatus, setFilterStatus] = useState('')

    useEffect(() => {
        fetchReports()
    }, [filterStatus])

    async function fetchReports() {
        setLoading(true)
        try {
            const res  = await getReports(filterStatus)
            const data = res.data
            if (data.status === 'error') { setError(data.data); return }
            setReports(data.data || [])
        } catch {
            setError('Failed to load reports.')
        } finally {
            setLoading(false)
        }
    }

    async function handleUpdateStatus(reportId, status) {
        try {
            const res  = await updateReportStatus(reportId, { status })
            const data = res.data
            if (data.status === 'error') { setError(data.data); return }
            setSuccess(`Report marked as ${status}`)
            setTimeout(() => setSuccess(''), 3000)
            fetchReports()
        } catch {
            setError('Failed to update report.')
        }
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Reports</h1>

            {/* Filter */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {['', 'OPEN', 'REVIEWED', 'RESOLVED', 'DISMISSED'].map((s) => (
                    <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all
                            ${filterStatus === s
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                    >
                        {s === '' ? 'All' : s}
                    </button>
                ))}
            </div>

            {error   && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}
            {success && <div className="bg-green-50 border border-green-200 text-green-600 text-sm rounded-lg px-4 py-3 mb-4">{success}</div>}

            {loading && <Spinner />}

            {!loading && reports.length === 0 && (
                <div className="text-center text-gray-400 py-16">
                    <p className="text-4xl mb-2">⚠️</p>
                    <p className="text-sm">No reports found</p>
                </div>
            )}

            <div className="flex flex-col gap-4">
                {reports.map((r) => (
                    <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                            <div>
                                <p className="font-semibold text-gray-800">{r.pgTitle}</p>
                                <p className="text-xs text-gray-500">{r.city}, {r.area}</p>
                            </div>
                            <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_STYLES[r.status]}`}>
                                {r.status}
                            </span>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-3 mb-3 text-xs">
                            <p><span className="text-gray-400">Reason: </span>
                                <span className="font-medium text-gray-700 capitalize">{r.reason.replace('_', ' ')}</span>
                            </p>
                            {r.description && (
                                <p className="mt-1"><span className="text-gray-400">Details: </span>
                                    <span className="text-gray-700">{r.description}</span>
                                </p>
                            )}
                            <p className="mt-1"><span className="text-gray-400">Reporter: </span>
                                <span className="text-gray-700">{r.reporterName} ({r.reporterEmail})</span>
                            </p>
                            <p className="mt-1"><span className="text-gray-400">Date: </span>
                                <span className="text-gray-700">{new Date(r.created_at).toLocaleDateString()}</span>
                            </p>
                        </div>

                        {/* Action buttons */}
                        {r.status === 'OPEN' && (
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => handleUpdateStatus(r.id, 'REVIEWED')}
                                    className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium"
                                >
                                    Mark Reviewed
                                </button>
                                <button
                                    onClick={() => handleUpdateStatus(r.id, 'RESOLVED')}
                                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium"
                                >
                                    Mark Resolved
                                </button>
                                <button
                                    onClick={() => handleUpdateStatus(r.id, 'DISMISSED')}
                                    className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs px-3 py-1.5 rounded-lg font-medium"
                                >
                                    Dismiss
                                </button>
                            </div>
                        )}
                        {r.status === 'REVIEWED' && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleUpdateStatus(r.id, 'RESOLVED')}
                                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium"
                                >
                                    Mark Resolved
                                </button>
                                <button
                                    onClick={() => handleUpdateStatus(r.id, 'DISMISSED')}
                                    className="border border-gray-300 text-gray-600 text-xs px-3 py-1.5 rounded-lg"
                                >
                                    Dismiss
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}