import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

function readPlayerInfo() {
    try {
        return JSON.parse(localStorage.getItem('player_info') || 'null');
    } catch (_) {
        return null;
    }
}

/**
 * Socket.IO creates a new socket id after a transport reconnect and room
 * membership is not retained. Rejoin the active Live Quiz room centrally so
 * every host/player screen gets the same recovery behaviour.
 */
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

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
        const newSocket = io(backendUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 400,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            forceNew: false
        });

        const onConnect = () => rejoinActiveLiveQuiz(newSocket);
        newSocket.on('connect', onConnect);
        setSocket(newSocket);

        return () => {
            try { newSocket.off('connect', onConnect); } catch (_) {}
            try { newSocket.close(); } catch (_) {}
        };
    }, []);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
