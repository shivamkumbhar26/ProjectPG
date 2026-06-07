// src/pages/auth/Login.jsx

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginUser } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'

export default function Login() {

    const navigate  = useNavigate()
    const { login } = useAuth()

    const [form, setForm]     = useState({ email: '', password: '' })
    const [error, setError]   = useState('')
    const [loading, setLoading] = useState(false)

    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const res  = await loginUser(form)
            const data = res.data

            if (data.status === 'error') {
                setError(data.data)
                return
            }

            const { token, role } = data.data

            // Decode userId from JWT payload (middle part)
            const payload = JSON.parse(atob(token.split('.')[1]))
            login(token, role, payload.userId)

            // Redirect based on role
            if (role === 'owner')                          navigate('/owner/dashboard')
            else if (role === 'sub_admin' || role === 'super_admin') navigate('/admin/dashboard')
            else                                           navigate('/')

        } catch (err) {
            setError('Something went wrong. Try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-[80vh] flex items-center justify-center">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-lg p-8">

                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-blue-600">PGFinder</h1>
                    <p className="text-gray-500 mt-1 text-sm">Sign in to your account</p>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={handleChange}
                            placeholder="you@example.com"
                            required
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Password</label>
                        <input
                            type="password"
                            name="password"
                            value={form.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            required
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>

                </form>

                {/* Footer */}
                <p className="text-center text-sm text-gray-500 mt-6">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-blue-600 font-medium hover:underline">
                        Register
                    </Link>
                </p>

            </div>
        </div>
    )
}