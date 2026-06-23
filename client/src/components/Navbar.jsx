import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { onlineCount } = useSocket();

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        🦞 EduConnect
      </div>

      <div className="sidebar-nav">
        <NavLink to="/" end>
          <span className="nav-icon">🏠</span> Feed
        </NavLink>
        <NavLink to="/chat">
          <span className="nav-icon">💬</span> Chat
        </NavLink>
        <NavLink to="/screen-time">
          <span className="nav-icon">⏱️</span> Screen Time
        </NavLink>
        <NavLink to="/social">
          <span className="nav-icon">🔗</span> Social Media
        </NavLink>
        <NavLink to="/verify">
          <span className="nav-icon">🔞</span> Adult Access
        </NavLink>
        <NavLink to="/security">
          <span className="nav-icon">🔐</span> Security
        </NavLink>
        <NavLink to="/ai">
          <span className="nav-icon">🤖</span> AI Assistant
        </NavLink>
        {(user?.role === 'admin' || user?.role === 'moderator') && (
          <NavLink to="/admin">
            <span className="nav-icon">🛡️</span> Admin Panel
          </NavLink>
        )}
      </div>

      <div className="sidebar-user">
        <div className="avatar">
          {user?.username?.[0]?.toUpperCase()}
        </div>
        <div className="sidebar-user-info">
          <div className="name">{user?.username}</div>
          <div className="role">
            {user?.role} · {onlineCount} online
          </div>
        </div>
        <button className="logout-btn" onClick={logout} title="Logout">⎋</button>
      </div>
    </nav>
  );
}
