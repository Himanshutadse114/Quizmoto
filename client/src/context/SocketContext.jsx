import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

const SocketContext = createContext(null);

function readPlayerInfo() {
    try {
        return JSON.parse(localStorage.getItem('player_info') || 'null');
    } catch (_) {
        return null;
    }
}

function rejoinActiveLiveQuiz(socket) {
    const pathname = window.location.pathname || '';

    const hostMatch = pathname.match(/\/host\/(?:lobby|game)\/([^/?#]+)\/?$/);
    if (hostMatch) {
        const token = localStorage.getItem('token');
        if (token) {
            socket.emit('join_room', {
                pin: decodeURIComponent(hostMatch[1]),
                role: 'host',
                token
            });
        }
        return;
    }

    if (/\/player\/(?:lobby|game)\/?$/.test(pathname)) {
        const info = readPlayerInfo();
        if (info && info.pin && info.nickname) {
            socket.emit('join_room', {
                pin: info.pin,
                nickname: info.nickname,
                role: 'player',
                token: info.token,
                avatar: info.avatar,
                teamName: info.teamName
            });
        }
    }
}

function routeNeedsRealtime(pathname) {
    const path = String(pathname || '');
    if (path === '/join' || path === '/join/') return true;
    if (/^\/host\/(?:lobby|game)\/[^/]+\/?$/.test(path)) return true;
    if (/^\/player\/(?:lobby|game)\/?$/.test(path)) return true;
    if (/^\/scorm\/courses\/[^/]+\/?$/.test(path)) return true;
    return false;
}

export const SocketProvider = ({ children }) => {
    const { pathname } = useLocation();
    const [socket, setSocket] = useState(null);
    const needsRealtime = useMemo(() => routeNeedsRealtime(pathname), [pathname]);

    useEffect(() => {
        if (!needsRealtime) {
            setSocket(null);
            return undefined;
        }

        let active = true;
        let newSocket = null;
        let onConnect = null;
        let hasConnectedOnce = false;

        (async () => {
            const { io } = await import('socket.io-client');
            if (!active) return;

            const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
            newSocket = io(backendUrl, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 400,
                reconnectionDelayMax: 5000,
                timeout: 20000,
                forceNew: false
            });

            // Route components perform the initial join as soon as they receive
            // the socket object (Socket.IO safely buffers emits until connected).
            // Only auto-rejoin after a real reconnect. Doing both on first connect
            // sent duplicate host joins and could overlap lease transactions.
            onConnect = () => {
                if (!hasConnectedOnce) {
                    hasConnectedOnce = true;
                    return;
                }
                rejoinActiveLiveQuiz(newSocket);
            };
            newSocket.on('connect', onConnect);

            if (!active) {
                try { newSocket.close(); } catch (_) {}
                return;
            }
            setSocket(newSocket);
        })().catch(() => {
            if (active) setSocket(null);
        });

        return () => {
            active = false;
            if (newSocket) {
                try { if (onConnect) newSocket.off('connect', onConnect); } catch (_) {}
                try { newSocket.close(); } catch (_) {}
            }
        };
    }, [needsRealtime]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
export { routeNeedsRealtime };
