// src/App.jsx
// All routes defined here.
// ProtectedRoute wraps pages that need auth or specific role.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import Navbar          from './components/Navbar'
import ProtectedRoute  from './components/ProtectedRoute'

// Auth pages
import Login           from './pages/auth/Login'
import Register        from './pages/auth/Register'
import VerifyOtp       from './pages/auth/VerifyOtp'

// User pages
import Home            from './pages/user/Home'
import PgDetail        from './pages/user/PgDetail'
import MyBookings      from './pages/user/MyBookings'
import BookingDetail   from './pages/user/BookingDetail'

// Owner pages
import OwnerDashboard  from './pages/owner/Dashboard'
import Documents       from './pages/owner/Documents'
import MyPgs           from './pages/owner/MyPgs'
import CreatePg        from './pages/owner/CreatePg'
import ManagePg        from './pages/owner/ManagePg'
import OwnerBookings   from './pages/owner/OwnerBookings'

// Admin pages
import AdminDashboard  from './pages/admin/Dashboard'
import AdminOwners     from './pages/admin/Owners'
import AdminPgs        from './pages/admin/Pgs'
import AdminReports    from './pages/admin/Reports'
import SubAdmins       from './pages/admin/SubAdmins'

export default function App() {

    const { role } = useAuth()

    // After login, redirect to the right dashboard based on role
    function HomeRedirect() {
        if (role === 'owner')      return <Navigate to="/owner/dashboard" replace />
        if (role === 'sub_admin')  return <Navigate to="/admin/dashboard" replace />
        if (role === 'super_admin') return <Navigate to="/admin/dashboard" replace />
        return <Home />   // default — user or not logged in
    }

    return (
        <BrowserRouter>
            <Navbar />
            <div className="max-w-6xl mx-auto px-4 py-6">
                <Routes>

                    {/* Public */}
                    <Route path="/"             element={<HomeRedirect />} />
                    <Route path="/login"        element={<Login />} />
                    <Route path="/register"     element={<Register />} />
                    <Route path="/verify-otp"   element={<VerifyOtp />} />
                    <Route path="/pg/:pgId"     element={<PgDetail />} />

                    {/* User */}
                    <Route path="/bookings" element={
                        <ProtectedRoute allowedRoles={['user']}>
                            <MyBookings />
                        </ProtectedRoute>
                    } />
                    <Route path="/booking/:bookingId" element={
                        <ProtectedRoute allowedRoles={['user']}>
                            <BookingDetail />
                        </ProtectedRoute>
                    } />

                    {/* Owner */}
                    <Route path="/owner/dashboard" element={
                        <ProtectedRoute allowedRoles={['owner']}>
                            <OwnerDashboard />
                        </ProtectedRoute>
                    } />
                    <Route path="/owner/documents" element={
                        <ProtectedRoute allowedRoles={['owner']}>
                            <Documents />
                        </ProtectedRoute>
                    } />
                    <Route path="/owner/pgs" element={
                        <ProtectedRoute allowedRoles={['owner']}>
                            <MyPgs />
                        </ProtectedRoute>
                    } />
                    <Route path="/owner/pg/create" element={
                        <ProtectedRoute allowedRoles={['owner']}>
                            <CreatePg />
                        </ProtectedRoute>
                    } />
                    <Route path="/owner/pg/:pgId" element={
                        <ProtectedRoute allowedRoles={['owner']}>
                            <ManagePg />
                        </ProtectedRoute>
                    } />
                    <Route path="/owner/bookings" element={
                        <ProtectedRoute allowedRoles={['owner']}>
                            <OwnerBookings />
                        </ProtectedRoute>
                    } />

                    {/* Admin */}
                    <Route path="/admin/dashboard" element={
                        <ProtectedRoute allowedRoles={['sub_admin', 'super_admin']}>
                            <AdminDashboard />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/owners" element={
                        <ProtectedRoute allowedRoles={['sub_admin', 'super_admin']}>
                            <AdminOwners />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/pgs" element={
                        <ProtectedRoute allowedRoles={['sub_admin', 'super_admin']}>
                            <AdminPgs />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/reports" element={
                        <ProtectedRoute allowedRoles={['sub_admin', 'super_admin']}>
                            <AdminReports />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/sub-admins" element={
                        <ProtectedRoute allowedRoles={['super_admin']}>
                            <SubAdmins />
                        </ProtectedRoute>
                    } />

                    {/* Catch all */}
                    <Route path="*" element={<Navigate to="/" replace />} />

                </Routes>
            </div>
        </BrowserRouter>
    )
}