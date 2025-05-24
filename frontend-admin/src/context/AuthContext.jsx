// frontend-admin/src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [authState, setAuthState] = useState({
        token: localStorage.getItem('adminToken') || null,
        user: JSON.parse(localStorage.getItem('adminUser')) || null,
        isAuthenticated: !!localStorage.getItem('adminToken'),
    });

    useEffect(() => {
        // Persist to localStorage when authState changes
        if (authState.token && authState.user) {
            localStorage.setItem('adminToken', authState.token);
            localStorage.setItem('adminUser', JSON.stringify(authState.user));
        } else {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
        }
    }, [authState]);

    const login = (token, user) => {
        setAuthState({
            token,
            user,
            isAuthenticated: true,
        });
    };

    const logout = () => {
        setAuthState({
            token: null,
            user: null,
            isAuthenticated: false,
        });
    };

    // Function to get the auth token for API calls
    const getToken = () => {
        return authState.token;
    };

    return (
        <AuthContext.Provider value={{ authState, login, logout, getToken }}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use the auth context
export const useAuth = () => {
    return useContext(AuthContext);
};