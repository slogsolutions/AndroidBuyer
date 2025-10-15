// SocketContext.tsx
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext<any>(null);
export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  // Prefer VITE_SOCKET_URL. Fallback to VITE_BASE_URL or http://localhost:5000 for local dev.
  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_BASE_URL || 'http://localhost:5000';

  const socket = useMemo(() => io(SOCKET_URL, {
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    autoConnect: true,
    // If you use socket auth via JWT:
    // auth: { token: localStorage.getItem('token') }
  }), [SOCKET_URL]);

  useEffect(() => {
    socket.on('connect', () => console.log('[socket] connected', socket.id));
    socket.on('connect_error', (err: any) => console.error('[socket] connect error', err));
    socket.on('disconnect', (reason: any) => console.warn('[socket] disconnected', reason));
    // debug incoming payloads if needed
    // socket.on('parking-updated', data => console.log('[socket] parking-updated', data));

    return () => {
      try { socket.disconnect(); } catch (e) { console.warn('[socket] disconnect failed', e); }
    };
  }, [socket]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
