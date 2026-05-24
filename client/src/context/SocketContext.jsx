import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    
    // Connect to WebSocket Server
    const socketInstance = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketInstance.on('connect', () => {
      console.log('🔌 Socket connected successfully:', socketInstance.id);
    });

    socketInstance.on('disconnect', () => {
      console.log('🔌 Socket disconnected.');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Join a specific SOS tracking room
  const joinRoom = (panicId, token) => {
    if (socket) {
      socket.emit('join-panic-room', { panicId, token });
      console.log(`Socket request: Join panic_${panicId}`);
    }
  };

  // Broadcast user live location shift
  const sendLocationUpdate = (panicId, lat, lng) => {
    if (socket) {
      socket.emit('location-update', {
        panicId,
        lat,
        lng,
        timestamp: new Date()
      });
    }
  };

  // Trigger resolve panic WebSocket room termination
  const resolvePanicSocket = (panicId) => {
    if (socket) {
      socket.emit('resolve-panic', { panicId });
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        joinRoom,
        sendLocationUpdate,
        resolvePanicSocket
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be executed within a SocketProvider.');
  }
  return context;
};
