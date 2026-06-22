import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [notifications, setNotifications] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user || !token) return;

    const s = io('/', { auth: { token } });
    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => {
      s.emit('authenticate', { 
        token, 
        userId: user.id, 
        username: user.username 
      });
    });

    s.on('online:count', setOnlineCount);
    
    s.on('user:online', ({ userId, username, online }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        online ? next.add(userId) : next.delete(userId);
        return next;
      });
    });

    s.on('notification', (notif) => {
      const id = Date.now();
      setNotifications(prev => [...prev, { ...notif, id }]);
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 6000);
    });

    s.on('screenTime:status', (status) => {
      window.__screenTimeStatus = status;
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  const addNotification = (type, message) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 6000);
  };

  return (
    <SocketContext.Provider value={{ 
      socket, onlineCount, onlineUsers, notifications, addNotification 
    }}>
      {children}
      {notifications.map(n => (
        <div key={n.id} className={`notification-toast ${n.type}`}>
          {n.message}
        </div>
      ))}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
