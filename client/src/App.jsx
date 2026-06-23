import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './components/Login';
import Register from './components/Register';
import Feed from './components/Feed';
import Chat from './components/Chat';
import ScreenTime from './components/ScreenTime';
import SocialConnect from './components/SocialConnect';
import AgeVerification from './components/AgeVerification';
import TwoFactorAuth from './components/TwoFactorAuth';
import AdminPanel from './components/AdminPanel';
import Navbar from './components/Navbar';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'admin' && user.role !== 'moderator') return <Navigate to="/" />;
  return children;
}

function AppLayout() {
  const { user } = useAuth();
  return (
    <SocketProvider>
      <div className="app-container">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/screen-time" element={<ScreenTime />} />
            <Route path="/social" element={<SocialConnect />} />
            <Route path="/verify" element={<AgeVerification />} />
            <Route path="/security" element={<TwoFactorAuth />} />
            <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
          </Routes>
        </main>
      </div>
    </SocketProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
