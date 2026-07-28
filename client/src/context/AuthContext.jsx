import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const API_URL = '/api/auth';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            localStorage.setItem('token', token);
            try {
                const storedUser = localStorage.getItem('user');
                if (storedUser && storedUser !== 'undefined') {
                    setUser(JSON.parse(storedUser));
                }
            } catch (e) {
                console.error('Failed to parse user from localStorage:', e);
                localStorage.removeItem('user');
            }
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
        }
        setLoading(false);
    }, [token]);

    const login = async (username, password) => {
        const res = await axios.post(`${API_URL}/login`, { username, password });
        const userData = { username: res.data.username };
        setToken(res.data.token);
        setUser(userData);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(userData));
        return res.data;
    };

    const register = async (username, password) => {
        const res = await axios.post(`${API_URL}/register`, { username, password });
        const userData = { username: res.data.username };
        setToken(res.data.token);
        setUser(userData);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(userData));
        return res.data;
    };

    const logout = () => {
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
