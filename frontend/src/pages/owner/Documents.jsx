// src/pages/owner/Documents.jsx

import { useState, useEffect } from 'react'
import { getMyDocuments, getDocumentUploadUrl, saveDocument, deleteDocument } from '../../api/owner'
import Spinner from '../../components/Spinner'
import axios from 'axios'

const DOC_TYPES = ['aadhaar', 'pan', 'property_deed', 'noc', 'other']

export default function Documents() {

    const [docs,    setDocs]    = useState([])
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState('')
    const [success, setSuccess] = useState('')

    // Upload form state
    const [docType,   setDocType]   = useState('aadhaar')
    const [file,      setFile]      = useState(null)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        fetchDocs()
    }, [])

    async function fetchDocs() {
        try {
            const res  = await getMyDocuments()
            const data = res.data
            if (data.status === 'error') {
                setError(data.data)
                return
            }
            setDocs(data.data || [])
        } catch {
            setError('Failed to load documents.')
        } finally {
            setLoading(false)
        }
    }

    async function handleUpload(e) {
        e.preventDefault()
        setError('')
        setSuccess('')

        if (!file) {
            setError('Please select a file')
            return
        }

        setUploading(true)

        try {
            // Step 1 — get upload URL
            const urlRes = await getDocumentUploadUrl({
                docType,
                fileType: file.type,
                fileSize: file.size
            })

            if (urlRes.data.status === 'error') {
                setError(urlRes.data.data)
                return
            }

            const { uploadUrl, fileKey } = urlRes.data.data

            // Step 2 — upload file
            await axios.put(uploadUrl, file, {
                headers: { 'Content-Type': file.type }
            })

            // Step 3 — save record
            const saveRes = await saveDocument({ fileKey, docType })
            if (saveRes.data.status === 'error') {
                setError(saveRes.data.data)
                return
            }

            setSuccess('Document uploaded successfully')
            setFile(null)
            e.target.reset()
            fetchDocs()

        } catch {
            setError('Upload failed. Try again.')
        } finally {
            setUploading(false)
        }
    }

    async function handleDelete(docId) {
        if (!window.confirm('Delete this document?')) return
        try {
            await deleteDocument(docId)
            setDocs(docs.filter(d => d.id !== docId))
            setSuccess('Document deleted')
        } catch {
            setError('Failed to delete document.')
        }
    }

    if (loading) return <Spinner />

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">My Documents</h1>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-600 text-sm rounded-lg px-4 py-3 mb-4">{success}</div>
            )}

            {/* Upload form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <h2 className="text-base font-semibold text-gray-700 mb-4">Upload Document</h2>
                <form onSubmit={handleUpload} className="flex flex-col gap-4">

                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Document Type</label>
                        <select
                            value={docType}
                            onChange={(e) => setDocType(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                            {DOC_TYPES.map(t => (
                                <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">File</label>
                        <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf"
                            onChange={(e) => setFile(e.target.files[0])}
                            required
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                        <p className="text-xs text-gray-400 mt-1">JPG, PNG or PDF. Max 5MB.</p>
                    </div>

                    <button
                        type="submit"
                        disabled={uploading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60"
                    >
                        {uploading ? 'Uploading...' : 'Upload Document'}
                    </button>
                </form>
            </div>

            {/* Document list */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-700 mb-4">Uploaded Documents</h2>

                {docs.length === 0 ? (
                    <div className="text-center text-gray-400 py-6">
                        <p className="text-3xl mb-2">📄</p>
                        <p className="text-sm">No documents uploaded yet</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {docs.map((doc) => (
                            <div
                                key={doc.id}
                                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">📄</span>
                                    <div>
                                        <p className="text-sm font-medium text-gray-800 capitalize">
                                            {doc.docType.replace('_', ' ')}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(doc.uploadedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium
                                        ${doc.verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {doc.verified ? '✓ Verified' : 'Pending'}
                                    </span>
                                    <a
                                        href={doc.viewUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-600 text-xs hover:underline"
                                    >
                                        View
                                    </a>
                                    <button
                                        onClick={() => handleDelete(doc.id)}
                                        className="text-red-500 text-xs hover:underline"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}