import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'

export default function Navbar() {

    const { isLoggedIn, role, logout } = useAuth()
    const navigate  = useNavigate()
    const [open, setOpen] = useState(false)

    function handleLogout() {
        logout()
        navigate('/login')
    }

    // Links based on role
    function getRoleLinks() {
        if (role === 'user') return (
            <>
                <NavLink to="/">Search PGs</NavLink>
                <NavLink to="/bookings">My Bookings</NavLink>
            </>
        )
        if (role === 'owner') return (
            <>
                <NavLink to="/owner/dashboard">Dashboard</NavLink>
                <NavLink to="/owner/pgs">My PGs</NavLink>
                <NavLink to="/owner/bookings">Bookings</NavLink>
                <NavLink to="/owner/documents">Documents</NavLink>
            </>
        )
        if (role === 'sub_admin' || role === 'super_admin') return (
            <>
                <NavLink to="/admin/dashboard">Dashboard</NavLink>
                <NavLink to="/admin/owners">Owners</NavLink>
                <NavLink to="/admin/pgs">PGs</NavLink>
                <NavLink to="/admin/reports">Reports</NavLink>
                {role === 'super_admin' && (
                    <NavLink to="/admin/sub-admins">Sub Admins</NavLink>
                )}
            </>
        )
        return null
    }

    return (
        <nav className="bg-white shadow-md sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">

                {/* Logo */}
                <Link to="/" className="text-2xl font-bold text-blue-600">
                    PG<span className="text-gray-800">Finder</span>
                </Link>

                {/* Desktop links */}
                <div className="hidden md:flex items-center gap-6">
                    {isLoggedIn ? (
                        <>
                            {getRoleLinks()}
                            <button
                                onClick={handleLogout}
                                className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-600"
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <NavLink to="/login">Login</NavLink>
                            <Link
                                to="/register"
                                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700"
                            >
                                Register
                            </Link>
                        </>
                    )}
                </div>

                {/* Mobile hamburger */}
                <button
                    className="md:hidden text-gray-600 focus:outline-none"
                    onClick={() => setOpen(!open)}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {open
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        }
                    </svg>
                </button>
            </div>

            {/* Mobile menu */}
            {open && (
                <div className="md:hidden bg-white border-t px-4 py-3 flex flex-col gap-3">
                    {isLoggedIn ? (
                        <>
                            {getRoleLinks()}
                            <button
                                onClick={handleLogout}
                                className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 text-left"
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <NavLink to="/login">Login</NavLink>
                            <NavLink to="/register">Register</NavLink>
                        </>
                    )}
                </div>
            )}
        </nav>
    )
}

// Small reusable nav link
function NavLink({ to, children }) {
    return (
        <Link
            to={to}
            className="text-gray-600 hover:text-blue-600 text-sm font-medium"
        >
            {children}
        </Link>
    )
}