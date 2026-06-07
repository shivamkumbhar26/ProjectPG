import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {

    const [token, setToken]   = useState(() => localStorage.getItem('token') || null)
    const [role, setRole]     = useState(() => localStorage.getItem('role')  || null)
    const [userId, setUserId] = useState(() => localStorage.getItem('userId') || null)

   
    function login(tokenValue, roleValue, userIdValue) {
        localStorage.setItem('token',  tokenValue)
        localStorage.setItem('role',   roleValue)
        localStorage.setItem('userId', userIdValue)
        setToken(tokenValue)
        setRole(roleValue)
        setUserId(userIdValue)
    }

    
    function logout() {
        localStorage.removeItem('token')
        localStorage.removeItem('role')
        localStorage.removeItem('userId')
        setToken(null)
        setRole(null)
        setUserId(null)
    }

    const isLoggedIn  = !!token
    const isUser      = role === 'user'
    const isOwner     = role === 'owner'
    const isSubAdmin  = role === 'sub_admin'
    const isSuperAdmin = role === 'super_admin'
    const isAnyAdmin  = isSubAdmin || isSuperAdmin

    return (
        <AuthContext.Provider value={{
            token, role, userId,
            isLoggedIn, isUser, isOwner,
            isSubAdmin, isSuperAdmin, isAnyAdmin,
            login, logout
        }}>
            {children}
        </AuthContext.Provider>
    )
}

// Custom hook — instead of useContext (AuthContext) directly
export function useAuth() {
    return useContext(AuthContext)
}