import React, { useState } from 'react';
import { api } from '../api';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';

export default function Auth({ onLogin, onBack, initialIsLogin = true }) {
    const [isLogin, setIsLogin] = useState(initialIsLogin);
    const [isForgot, setIsForgot] = useState(false);
    const [forgotSuccess, setForgotSuccess] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleForgot = async (e) => {
        e.preventDefault();
        setError('');
        setForgotSuccess('');
        setLoading(true);
        try {
            await api.request('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email: email.trim() })
            });
            setForgotSuccess('A reset link has been sent to your email (check your inbox).');
        } catch (err) {
            setError(err.message || 'Failed to send reset link.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isForgot) return handleForgot(e);
        setError('');
        setLoading(true);

        try {
            const cleanEmail = email.trim();
            const cleanPassword = password.trim();

            if (isLogin) {
                const formData = new URLSearchParams();
                formData.append('username', cleanEmail);
                formData.append('password', cleanPassword);

                const res = await api.request('/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData.toString()
                });

                localStorage.setItem('token', res.access_token);

                // Fetch user data
                const userRes = await api.request('/auth/me');
                localStorage.setItem('user', JSON.stringify(userRes));
                onLogin(userRes);
            } else {
                await api.request('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ email: cleanEmail, password: cleanPassword, name })
                });

                // Auto login after register
                const formData = new URLSearchParams();
                formData.append('username', cleanEmail);
                formData.append('password', cleanPassword);

                const res = await api.request('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData.toString()
                });
                localStorage.setItem('token', res.access_token);
                const userRes = await api.request('/auth/me');
                localStorage.setItem('user', JSON.stringify(userRes));
                onLogin(userRes);
            }
        } catch (err) {
            setError(err.message || 'Authentication failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-split-container">
            {/* 🎨 Left Side: Branding & Graphic */}
            <div className="auth-split-left">
                <div className="auth-graphic-overlay"></div>
                <div className="auth-noise-overlay"></div>

                <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', color: 'white' }}>
                    <p style={{ fontSize: '1.25rem', fontWeight: 500, opacity: 0.9, marginBottom: '0.25rem', textShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>Welcome to</p>
                    <h1 style={{ fontSize: '4rem', fontWeight: 'bold', margin: 0, letterSpacing: '-0.04em', textShadow: '0 2px 20px rgba(0,0,0,0.1)' }}>e-Learning AI</h1>
                    <div style={{ marginTop: '2rem', opacity: 0.25, display: 'flex', justifyContent: 'center' }}>
                        {/* Abstract book line art to match the faint background elements */}
                        <svg className="animate-float" width="180" height="180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.3">
                            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                            <path d="M8 7h8 M8 11h8" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* 📝 Right Side: Auth Form */}
            <div className="auth-split-right" style={{ background: '#ffffff' }}>
                <div className="auth-form-wrapper" style={{ maxWidth: '440px', padding: '0 2rem' }}>
                    <button
                        className="stagger-enter stagger-1"
                        onClick={onBack}
                        style={{
                            marginBottom: '3rem',
                            display: 'flex',
                            alignItems: 'center',
                            color: '#000',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            padding: 0
                        }}
                    >
                        <ArrowLeft size={24} strokeWidth={1.5} />
                    </button>

                    <h2 className="stagger-enter stagger-2" style={{ fontSize: '1.75rem', fontWeight: '500', color: '#000', marginBottom: '2.5rem', letterSpacing: '-0.02em' }}>
                        {isForgot ? 'Reset Password' : (isLogin ? 'Log In to your account' : 'Create new account')}
                    </h2>

                    {error && <div className="stagger-enter stagger-3" style={{ padding: '0.75rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fee2e2' }}>{error}</div>}
                    {forgotSuccess && <div className="stagger-enter stagger-3" style={{ padding: '0.75rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#8B5CF6', background: '#f5f3ff', border: '1px solid #ddd6fe' }}>{forgotSuccess}</div>}

                    <form onSubmit={handleSubmit} className="stagger-enter stagger-3" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {!isLogin && !isForgot && (
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#000', marginBottom: '0.4rem' }}>Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    style={{ width: '100%', height: '44px', padding: '0 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0', fontSize: '0.875rem', backgroundColor: '#fff', outline: 'none' }}
                                    onFocus={(e) => e.target.style.borderColor = '#8B5CF6'}
                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#000', marginBottom: '0.4rem' }}>Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{ width: '100%', height: '44px', padding: '0 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0', fontSize: '0.875rem', backgroundColor: '#fff', outline: 'none' }}
                                onFocus={(e) => e.target.style.borderColor = '#8B5CF6'}
                                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                            />
                        </div>

                        {!isForgot && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#000' }}>
                                        {isLogin ? 'Password' : 'Create Password'}
                                    </label>
                                    {isLogin && (
                                        <button
                                            type="button"
                                            onClick={() => { setIsForgot(true); setError(''); setForgotSuccess(''); }}
                                            style={{ fontSize: '0.7rem', fontWeight: '500', color: '#8B5CF6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                                        >
                                            Forgot Password?
                                        </button>
                                    )}
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        style={{ width: '100%', height: '44px', padding: '0 2.5rem 0 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0', fontSize: '0.875rem', backgroundColor: '#fff', outline: 'none' }}
                                        onFocus={(e) => e.target.style.borderColor = '#8B5CF6'}
                                        onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: '0.75rem',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            color: '#64748b'
                                        }}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>

                            </div>
                        )}

                        <button
                            type="submit"
                            className="animate-shiny"
                            disabled={loading}
                            style={{
                                width: '100%',
                                height: '44px',
                                background: '#9347FF',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'opacity 0.2s',
                                marginTop: '0.5rem'
                            }}
                        >
                            {loading ? 'Processing...' : (isForgot ? 'Send Reset Link' : (isLogin ? 'Log In' : 'Register'))}
                        </button>
                    </form>

                    <div className="stagger-enter stagger-4" style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                        <div style={{ position: 'relative', marginBottom: '2.5rem' }}>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}><div style={{ width: '100%', borderTop: '1px solid #e2e8f0' }}></div></div>
                            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', fontSize: '0.65rem', color: '#94a3b8' }}>
                                <span style={{ background: 'white', padding: '0 0.75rem' }}>OR</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsLogin(!isLogin)}
                            style={{
                                width: '100%',
                                height: '44px',
                                background: 'white',
                                border: '1px solid #d8b4fe',
                                borderRadius: '0',
                                color: '#9347FF',
                                fontWeight: '500',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                transition: 'background 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.background = '#faf5ff'}
                            onMouseOut={(e) => e.target.style.background = 'white'}
                        >
                            {isLogin ? 'Register' : 'Log In'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

