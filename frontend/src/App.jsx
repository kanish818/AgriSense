import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import AuthPage from './AuthPage';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check if user is already logged in
  useEffect(() => {
    const savedToken = localStorage.getItem('agrisense_token');
    const savedUser = localStorage.getItem('agrisense_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
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
      <Routes>
        <Route path="/auth" element={
          user ? <Navigate to="/" replace /> : <AuthPage onLogin={handleLogin} />
        } />
        <Route path="/*" element={
          <LandingPage user={user} token={token} onLogout={handleLogout} onRequireAuth={() => window.location.href = '/auth'} />
        } />
      </Routes>
    </Router>
  );
}