import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import LandingPage from './LandingPage';
import AuthPage from './AuthPage';

function AppRoutes({ user, token, onLogin, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleRequireAuth = (reason = 'Please login to use this feature.', options = {}) => {
    const from = `${location.pathname}${location.search}${location.hash}`;
    if (options.forceLogout) {
      onLogout();
    }
    navigate('/auth', { state: { from, reason } });
  };

  return (
    <Routes>
      <Route path="/auth" element={
        user ? <Navigate to="/" replace /> : <AuthPage onLogin={onLogin} />
      } />
      <Route path="/*" element={
        <LandingPage user={user} token={token} onLogout={onLogout} onRequireAuth={handleRequireAuth} />
      } />
    </Routes>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check if user is already logged in
  useEffect(() => {
    const savedToken = localStorage.getItem('agrisense_token');
    const savedUser = localStorage.getItem('agrisense_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('agrisense_token');
        localStorage.removeItem('agrisense_user');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('agrisense_token');
    localStorage.removeItem('agrisense_user');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-center">
          <div className="text-4xl mb-3">🌾</div>
          <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <AppRoutes user={user} token={token} onLogin={handleLogin} onLogout={handleLogout} />
    </Router>
  );
}
