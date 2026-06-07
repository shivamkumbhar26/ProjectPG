import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, allowedRoles }) {

    const { isLoggedIn, role } = useAuth()

    // Not logged in → send to login
    if (!isLoggedIn) {
        return <Navigate to="/login" replace />
    }

    // Wrong role → send to home
    if (allowedRoles && !allowedRoles.includes(role)) {
        return <Navigate to="/" replace />
    }

    return children
}