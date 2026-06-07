import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { verifyOtp, resendOtp } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'

export default function VerifyOtp() {

    const navigate       = useNavigate()
    const location       = useLocation()
    const { login }      = useAuth()

    // userId and phone passed from Register page via navigate state
    const { userId, phone } = location.state || {}

    const [otp,     setOtp]     = useState(['', '', '', '', '', ''])
    const [error,   setError]   = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(false)
    const [resendTimer, setResendTimer] = useState(30)

    const inputRefs = useRef([])

    // Countdown timer for resend OTP button
    useEffect(() => {
        if (resendTimer === 0) return
        const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000)
        return () => clearTimeout(timer)
    }, [resendTimer])

    // If navigated here without userId redirect to register
    useEffect(() => {
        if (!userId) navigate('/register')
    }, [userId])

    // Handle each OTP digit input
    function handleOtpChange(index, value) {
        if (!/^\d?$/.test(value)) return    // only allow single digit

        const newOtp = [...otp]
        newOtp[index] = value
        setOtp(newOtp)

        // Auto focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus()
        }
    }

    // Handle backspace
    function handleKeyDown(index, e) {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')

        const otpValue = otp.join('')
        if (otpValue.length !== 6) {
            setError('Please enter all 6 digits')
            return
        }

        setLoading(true)

        try {
            const res  = await verifyOtp({ userId, otp: parseInt(otpValue) })
            const data = res.data

            if (data.status === 'error') {
                setError(data.data)
                return
            }

            const { token, role } = data.data
            const payload = JSON.parse(atob(token.split('.')[1]))
            login(token, role, payload.userId)

            // Redirect based on role
            if (role === 'owner')                               navigate('/owner/dashboard')
            else if (role === 'sub_admin' || role === 'super_admin') navigate('/admin/dashboard')
            else                                                navigate('/')

        } catch (err) {
            setError('Something went wrong. Try again.')
        } finally {
            setLoading(false)
        }
    }

    async function handleResend() {
        setError('')
        setSuccess('')

        try {
            await resendOtp({ userId, phone })
            setSuccess('OTP resent successfully')
            setResendTimer(30)
            setOtp(['', '', '', '', '', ''])
            inputRefs.current[0]?.focus()
        } catch (err) {
            setError('Failed to resend OTP')
        }
    }

    return (
        <div className="min-h-[80vh] flex items-center justify-center">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-lg p-8">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">📱</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Verify OTP</h2>
                    <p className="text-gray-500 text-sm mt-1">
                        Enter the 6-digit OTP sent to{' '}
                        <span className="font-medium text-gray-700">{phone}</span>
                    </p>
                    {/* Dev hint */}
                    <p className="text-xs text-blue-500 mt-1">
                        (Development: use OTP <strong>123456</strong>)
                    </p>
                </div>

                {/* Error / Success */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="bg-green-50 border border-green-200 text-green-600 text-sm rounded-lg px-4 py-3 mb-4">
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit}>

                    {/* OTP input boxes */}
                    <div className="flex justify-center gap-3 mb-6">
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => (inputRefs.current[index] = el)}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleOtpChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            />
                        ))}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60"
                    >
                        {loading ? 'Verifying...' : 'Verify OTP'}
                    </button>

                </form>

                {/* Resend */}
                <div className="text-center mt-4">
                    {resendTimer > 0 ? (
                        <p className="text-sm text-gray-500">
                            Resend OTP in <span className="font-medium text-blue-600">{resendTimer}s</span>
                        </p>
                    ) : (
                        <button
                            onClick={handleResend}
                            className="text-sm text-blue-600 font-medium hover:underline"
                        >
                            Resend OTP
                        </button>
                    )}
                </div>

            </div>
        </div>
    )
}