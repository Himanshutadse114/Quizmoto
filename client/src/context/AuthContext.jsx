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

function normalizeScormRole(role, approved = false) {
    const value = String(role || '').trim().toLowerCase();
    if (value === 'user') return 'admin';
    if (['super_admin', 'admin', 'co_admin', 'analytics_viewer', 'pending', 'quizmoto'].includes(value)) return value;
    return approved ? 'admin' : 'pending';
}

function normalizeStoredUser(value) {
    if (!value || typeof value !== 'object') return value;
    if (!value.product && !value.scormAccess && !value.pendingApproval && !value.quizmotoOnly) return value;
    const approved = Boolean(value.scormAccess && !value.pendingApproval);
    return { ...value, role: normalizeScormRole(value.role, approved) };
}

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
                    const parsed = normalizeStoredUser(JSON.parse(storedUser));
                    setUser(parsed);
                    localStorage.setItem('user', JSON.stringify(parsed));
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
        const normalizedUser = normalizeStoredUser(nextUser || null);
        setToken(nextToken || null);
        setUser(normalizedUser);
        if (nextToken) localStorage.setItem('token', nextToken);
        else localStorage.removeItem('token');
        if (normalizedUser) localStorage.setItem('user', JSON.stringify(normalizedUser));
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
        const role = normalizeScormRole(data.role, approved);
        const workspaceId = data.workspaceId || data.tenantId || null;
        const workspaceName = data.workspaceName || data.tenantName || null;
        const scormUser = {
            username: data.username,
            avatar: data.avatar || null,
            email: data.email || null,
            role,
            isSuperAdmin: Boolean(data.isSuperAdmin || role === 'super_admin'),
            adminContact: data.adminContact || null,
            product: 'scorm-ai',
            pendingApproval: Boolean(data.pendingApproval || !approved),
            platformAccess: true,
            scormAccess: approved,
            workspaceId,
            workspaceName,
            tenantId: workspaceId,
            tenantName: workspaceName,
            authMethod: data.authMethod || null,
            staffSso: Boolean(data.staffSso),
            quizmotoOnly: false
        };
        setAccessFlags({ platform: true, scorm: approved });
        persistSession(data.token, scormUser);
        return { ...data, role, workspaceId, workspaceName, tenantId: workspaceId, tenantName: workspaceName };
    };

    const enterQuizmotoOnlySession = (data) => {
        if (!data?.token) return data;
        const quizmotoUser = {
            username: data.username,
            avatar: data.avatar || null,
            email: data.email || null,
            role: 'quizmoto',
            isSuperAdmin: false,
            product: 'quizmoto',
            pendingApproval: false,
            platformAccess: true,
            scormAccess: false,
            workspaceId: null,
            workspaceName: null,
            tenantId: null,
            tenantName: null,
            authMethod: 'google',
            staffSso: false,
            quizmotoOnly: true
        };
        setAccessFlags({ platform: true, scorm: false });
        persistSession(data.token, quizmotoUser);
        return { ...data, role: 'quizmoto', platformAccess: true, scormAccess: false, quizmotoOnly: true };
    };

    const resolveScormAuthResponse = (data) => {
        if (!data?.token) return data;
        if (data.quizmotoOnly) return enterQuizmotoOnlySession(data);
        return enterScormSession(data);
    };

    const loginWithGoogle = async (credential) => {
        const res = await axios.post(`${API_URL}/google`, { credential });
        return resolveScormAuthResponse(res.data);
    };

    const loginScorm = async ({ identifier, password }) => {
        const res = await axios.post(`${API_URL}/scorm/login`, { identifier, password });
        return resolveScormAuthResponse(res.data);
    };

    const loginScormWithGoogle = async (credential) => {
        const res = await axios.post(`${API_URL}/google`, { credential });
        return resolveScormAuthResponse(res.data);
    };

    const loginQuizmotoOnlyWithGoogle = async (credential) => {
        const res = await axios.post(`${API_URL}/google`, { credential });
        return resolveScormAuthResponse(res.data);
    };

    const loginScormWorkspaceWithGoogle = async (workspaceId, credential) => {
        const res = await axios.post(apiUrl(`/api/scorm/staff-auth/workspace/${workspaceId}/google`), { credential });
        return resolveScormAuthResponse(res.data);
    };

    const loginScormWorkspaceWithMicrosoft = async (workspaceId, idToken) => {
        const res = await axios.post(apiUrl(`/api/scorm/staff-auth/workspace/${workspaceId}/microsoft`), { idToken });
        return resolveScormAuthResponse(res.data);
    };

    const requestMailOtp = async ({ email, purpose, name = null }) => {
        const res = await axios.post(apiUrl('/api/scorm/otp/request'), { email, purpose, name });
        return res.data;
    };

    const verifyMailOtp = async ({ email, purpose, code }) => {
        const res = await axios.post(apiUrl('/api/scorm/otp/verify'), { email, purpose, code });
        return res.data;
    };

    const registerScorm = async ({ username, email, password, verificationToken }) => {
        const res = await axios.post(`${API_URL}/scorm/register`, { username, email, password, verificationToken });
        return resolveScormAuthResponse(res.data);
    };

    const resetScormPassword = async ({ email, newPassword, verificationToken }) => {
        const res = await axios.post(`${API_URL}/scorm/reset-password`, { email, newPassword, verificationToken });
        return res.data;
    };

    const refreshScormAccess = async () => {
        if (!token || !platformAccess) return null;
        if (user?.quizmotoOnly) return user;
        if (user?.staffSso && user?.workspaceId) return user;
        const res = await axios.get(`${API_URL}/scorm/status`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return resolveScormAuthResponse(res.data);
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
            loginQuizmotoOnlyWithGoogle,
            loginScormWorkspaceWithGoogle,
            loginScormWorkspaceWithMicrosoft,
            requestMailOtp,
            verifyMailOtp,
            registerScorm,
            resetScormPassword,
            refreshScormAccess,
            prepareScormLogin,
            leaveScorm,
            platformAccess,
            scormAccess,
            logout,
            loading
        }}>
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider>
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
