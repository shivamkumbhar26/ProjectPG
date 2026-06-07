// src/pages/auth/Register.jsx

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '../../api/auth'

export default function Register() {

    const navigate = useNavigate()

    const [form, setForm] = useState({
        name:     '',
        email:    '',
        phone:    '',
        password: '',
        role:     'user'
    })
    const [error,   setError]   = useState('')
    const [loading, setLoading] = useState(false)

    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')

        if (form.phone.length !== 10) {
            setError('Phone number must be 10 digits')
            return
        }

        setLoading(true)

        try {
            const res  = await registerUser(form)
            const data = res.data

            if (data.status === 'error') {
                setError(data.data)
                return
            }

            // Go to OTP page — pass userId and phone via state
            navigate('/verify-otp', {
                state: { userId: data.userId, phone: form.phone }
            })

        } catch (err) {
            setError('Something went wrong. Try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-[80vh] flex items-center justify-center py-8">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-lg p-8">

                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-blue-600">PGFinder</h1>
                    <p className="text-gray-500 mt-1 text-sm">Create your account</p>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                    {/* Role selector */}
                    <div className="flex gap-3">
                        {['user', 'owner'].map((r) => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setForm({ ...form, role: r })}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all
                                    ${form.role === r
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                                    }`}
                            >
                                {r === 'user' ? '🎓 Student / Tenant' : '🏠 PG Owner'}
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Full Name</label>
                        <input
                            type="text"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            placeholder="John Doe"
                            required
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

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
                        <label className="text-sm font-medium text-gray-700 block mb-1">Phone Number</label>
                        <input
                            type="tel"
                            name="phone"
                            value={form.phone}
                            onChange={handleChange}
                            placeholder="10 digit mobile number"
                            maxLength={10}
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
                            placeholder="Min 8 characters"
                            minLength={8}
                            required
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60 mt-1"
                    >
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>

                </form>

                <p className="text-center text-sm text-gray-500 mt-6">
                    Already have an account?{' '}
                    <Link to="/login" className="text-blue-600 font-medium hover:underline">
                        Sign in
                    </Link>
                </p>

            </div>
        </div>
    )
}