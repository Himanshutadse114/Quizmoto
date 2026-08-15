import React, { createContext, useState, useContext, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import axios from 'axios';
import { apiUrl } from '../config';

const AuthContext = createContext();

const API_URL = apiUrl('/api/auth');
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1001652255296-695gf3vjul0fjh1oden4k2n6tvvdvncn.apps.googleusercontent.com';
const SCORM_ACCESS_KEY = 'scormAccessGranted';
const PLATFORM_ACCESS_KEY = 'scormPlatformAccess';
const HOST_TOKEN_BACKUP = 'quizmotoHostToken';
const HOST_USER_BACKUP = 'quizmotoHostUser';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [scormAccess, setScormAccess] = useState(localStorage.getItem(SCORM_ACCESS_KEY) === '1');
    const [platformAccess, setPlatformAccess] = useState(
        localStorage.getItem(PLATFORM_ACCESS_KEY) === '1' || localStorage.getItem(SCORM_ACCESS_KEY) === '1'
    );
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

    const persistSession = (nextToken, nextUser) => {
        setToken(nextToken || null);
        setUser(nextUser || null);
        if (nextToken) localStorage.setItem('token', nextToken);
        else localStorage.removeItem('token');
        if (nextUser) localStorage.setItem('user', JSON.stringify(nextUser));
        else localStorage.removeItem('user');
    };

    const setAccessFlags = ({ platform = false, scorm = false } = {}) => {
        setPlatformAccess(platform);
        setScormAccess(scorm);
        if (platform) localStorage.setItem(PLATFORM_ACCESS_KEY, '1');
        else localStorage.removeItem(PLATFORM_ACCESS_KEY);
        if (scorm) localStorage.setItem(SCORM_ACCESS_KEY, '1');
        else localStorage.removeItem(SCORM_ACCESS_KEY);
    };

    const loginWithGoogle = async (credential) => {
        const res = await axios.post(`${API_URL}/google`, { credential });
        const userData = { username: res.data.username, avatar: res.data.avatar, email: res.data.email };
        setAccessFlags({ platform: false, scorm: false });
        persistSession(res.data.token, userData);
        return res.data;
    };

    const prepareScormLogin = () => {
        if (!platformAccess && token && !localStorage.getItem(HOST_TOKEN_BACKUP)) {
            localStorage.setItem(HOST_TOKEN_BACKUP, token);
            if (user) localStorage.setItem(HOST_USER_BACKUP, JSON.stringify(user));
        }
        setAccessFlags({ platform: false, scorm: false });
    };

    const enterScormSession = (data) => {
        if (!data?.token) return data;
        const approved = Boolean(data.scormAccess ?? (!data.pendingApproval && data.role && data.role !== 'pending'));
        const scormUser = {
            username: data.username,
            avatar: data.avatar || null,
            email: data.email || null,
            role: data.role || (approved ? 'user' : 'pending'),
            isSuperAdmin: Boolean(data.isSuperAdmin),
            adminContact: data.adminContact || null,
            product: 'scorm-ai',
            pendingApproval: Boolean(data.pendingApproval || !approved),
            platformAccess: true,
            scormAccess: approved
        };
        setAccessFlags({ platform: true, scorm: approved });
        persistSession(data.token, scormUser);
        return data;
    };

    const resolveScormAuthResponse = (data) => {
        if (!data?.token) return data;
        return enterScormSession(data);
    };

    const loginScorm = async ({ identifier, password }) => {
        const res = await axios.post(`${API_URL}/scorm/login`, { identifier, password });
        return resolveScormAuthResponse(res.data);
    };

    const loginScormWithGoogle = async (credential) => {
        const res = await axios.post(`${API_URL}/scorm/google`, { credential });
        return resolveScormAuthResponse(res.data);
    };

    const registerScorm = async ({ username, email, password }) => {
        const res = await axios.post(`${API_URL}/scorm/register`, {
            username,
            email,
            password
        });
        return resolveScormAuthResponse(res.data);
    };

    const refreshScormAccess = async () => {
        if (!token || !platformAccess) return null;
        const res = await axios.get(`${API_URL}/scorm/status`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        enterScormSession(res.data);
        return res.data;
    };

    const leaveScorm = () => {
        const hostToken = localStorage.getItem(HOST_TOKEN_BACKUP);
        let hostUser = null;
        try {
            const raw = localStorage.getItem(HOST_USER_BACKUP);
            if (raw) hostUser = JSON.parse(raw);
        } catch (_) {}

        setAccessFlags({ platform: false, scorm: false });
        localStorage.removeItem(HOST_TOKEN_BACKUP);
        localStorage.removeItem(HOST_USER_BACKUP);

        if (hostToken) {
            persistSession(hostToken, hostUser);
            return true;
        }

        persistSession(null, null);
        return false;
    };

    const logout = () => {
        setAccessFlags({ platform: false, scorm: false });
        localStorage.removeItem(HOST_TOKEN_BACKUP);
        localStorage.removeItem(HOST_USER_BACKUP);
        persistSession(null, null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            loginWithGoogle,
            loginScorm,
            loginScormWithGoogle,
            registerScorm,
            refreshScormAccess,
            prepareScormLogin,
            leaveScorm,
            platformAccess,
            scormAccess,
            logout,
            loading
        }}>
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                {children}
            </GoogleOAuthProvider>
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
