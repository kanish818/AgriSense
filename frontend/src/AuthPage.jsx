import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, User, MapPin, Eye, EyeOff } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function AuthPage({ onLogin }) {
    const [isLogin, setIsLogin] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    const googleButtonRef = useRef(null);

    const [form, setForm] = useState({ name: '', email: '', password: '', location: '', language: 'english' });

    const finishLogin = (user, token) => {
        localStorage.setItem('agrisense_token', token);
        localStorage.setItem('agrisense_user', JSON.stringify(user));
        onLogin(user, token);
        const fallbackPath = '/';
        const from = location.state?.from;
        const safeTarget = typeof from === 'string' && from.startsWith('/') ? from : fallbackPath;
        navigate(safeTarget, { replace: true });
    };

    useEffect(() => {
        if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) return;

        const renderGoogleButton = () => {
            if (!window.google?.accounts?.id || !googleButtonRef.current) return;
            googleButtonRef.current.innerHTML = '';
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: async ({ credential }) => {
                    setError('');
                    setLoading(true);
                    try {
                        const res = await fetch(`${API_BASE}/auth/google`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                credential,
                                location: form.location,
                                language: form.language
                            }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                            setError(data.message || 'Google sign-in failed');
                            return;
                        }
                        finishLogin(data.user, data.token);
                    } catch (err) {
                        setError('Google sign-in failed. Please try again.');
                    } finally {
                        setLoading(false);
                    }
                }
            });
            window.google.accounts.id.renderButton(googleButtonRef.current, {
                theme: 'outline',
                size: 'large',
                text: isLogin ? 'signin_with' : 'signup_with',
                shape: 'pill',
                width: 320
            });
        };

        if (window.google?.accounts?.id) {
            renderGoogleButton();
            return;
        }

        const existingScript = document.querySelector('script[data-google-identity="true"]');
        if (existingScript) {
            existingScript.addEventListener('load', renderGoogleButton);
            return () => existingScript.removeEventListener('load', renderGoogleButton);
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.googleIdentity = 'true';
        script.addEventListener('load', renderGoogleButton);
        document.body.appendChild(script);

        return () => script.removeEventListener('load', renderGoogleButton);
    }, [form.language, form.location, isLogin]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = isLogin ? '/auth/login' : '/auth/signup';
        const body = isLogin ? { email: form.email, password: form.password } : form;

        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.message || 'Something went wrong');
                return;
            }

            finishLogin(data.user, data.token);
        } catch (err) {
            setError('Cannot connect to server. Is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-yellow-50 to-orange-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center h-16 w-16 bg-green-800 rounded-2xl text-white text-3xl mb-3 shadow-lg">🌾</div>
                    <h1 className="text-3xl font-extrabold text-green-800">AgriSense</h1>
                    <p className="text-gray-500 mt-1">Your Smart Farming Assistant</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                    {/* Toggle */}
                    <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
                        <button onClick={() => { setIsLogin(true); setError(''); }} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${isLogin ? 'bg-green-800 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}>Login</button>
                        <button onClick={() => { setIsLogin(false); setError(''); }} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${!isLogin ? 'bg-green-800 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}>Sign Up</button>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>
                    )}
                    {location.state?.reason && (
                        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl text-sm mb-4">
                            {location.state.reason}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <div className="relative">
                                <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <input type="text" placeholder="Full Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent focus:outline-none" />
                            </div>
                        )}

                        <div className="relative">
                            <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                            <input type="email" placeholder="Email address" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                                className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent focus:outline-none" />
                        </div>

                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                            <input type={showPassword ? 'text' : 'password'} placeholder="Password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                                className="w-full pl-11 pr-11 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent focus:outline-none" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>

                        {!isLogin && (
                            <>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    <input type="text" placeholder="Location (e.g., Punjab, Maharashtra)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                                        className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent focus:outline-none" />
                                </div>
                                <div>
                                    <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent focus:outline-none text-gray-700">
                                        <option value="english">🇬🇧 English</option>
                                        <option value="hindi">🇮🇳 हिंदी (Hindi)</option>
                                        <option value="punjabi">🇮🇳 ਪੰਜਾਬੀ (Punjabi)</option>
                                    </select>
                                </div>
                            </>
                        )}

                        <button type="submit" disabled={loading}
                            className="w-full bg-green-800 hover:bg-green-900 disabled:bg-gray-400 text-white py-3.5 rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg">
                            {loading ? 'Please wait...' : isLogin ? 'Login' : 'Create Account'}
                        </button>
                    </form>

                    <div className="my-6 flex items-center gap-3">
                        <div className="h-px flex-1 bg-gray-200" />
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">or</span>
                        <div className="h-px flex-1 bg-gray-200" />
                    </div>

                    {GOOGLE_CLIENT_ID ? (
                        <div className="flex justify-center">
                            <div ref={googleButtonRef} />
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
                            Google sign-in will appear after `VITE_GOOGLE_CLIENT_ID` is configured.
                        </div>
                    )}
                </div>

                <p className="text-center text-xs text-gray-400 mt-6">&copy; 2025 AgriSense. Built for Indian Farmers.</p>
            </div>
        </div>
    );
}
