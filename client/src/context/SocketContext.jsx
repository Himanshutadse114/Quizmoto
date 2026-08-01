import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        // In production (Vercel), point to the Koyeb backend URL.
        // In local development, use the same origin (Docker nginx proxy).
        const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
        const newSocket = io(backendUrl, {
            transports: ['websocket', 'polling']
        });
        setSocket(newSocket);

        return () => newSocket.close();
    }, []);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
