import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

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
        setSocket(newSocket);

        return () => {
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
