import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!token) {
            setError('Invalid or missing reset token.');
        }
    }, [token]);

    const handleReset = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            return setError('Passwords do not match.');
        }
        
        setError('');
        setLoading(true);
        try {
            await api.request('/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ token, new_password: password })
            });
            setSuccess('Password reset successful! Redirecting to login...');
            setTimeout(() => navigate('/'), 3000);
        } catch (err) {
            setError(err.message || 'Failed to reset password.');
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
                    <p style={{ fontSize: '1.25rem', fontWeight: 500, opacity: 0.9, marginBottom: '0.25rem', textShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>Secure</p>
                    <h1 style={{ fontSize: '4rem', fontWeight: 'bold', margin: 0, letterSpacing: '-0.04em', textShadow: '0 2px 20px rgba(0,0,0,0.1)' }}>Password Reset</h1>
                    <div style={{ marginTop: '2rem', opacity: 0.25, display: 'flex', justifyContent: 'center' }}>
                         <svg className="animate-float" width="180" height="180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.3">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                         </svg>
                    </div>
                </div>
            </div>

            {/* 📝 Right Side: Form */}
            <div className="auth-split-right" style={{ background: '#ffffff' }}>
                <div className="auth-form-wrapper" style={{ maxWidth: '440px', padding: '0 2rem' }}>
                    <h2 className="stagger-enter stagger-1" style={{ fontSize: '1.75rem', fontWeight: '500', color: '#000', marginBottom: '2.5rem', letterSpacing: '-0.02em' }}>
                        Set your new password
                    </h2>

                    {error && <div className="stagger-enter stagger-2" style={{ padding: '0.75rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fee2e2' }}>{error}</div>}
                    {success && <div className="stagger-enter stagger-2" style={{ padding: '0.75rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#8B5CF6', background: '#f5f3ff', border: '1px solid #ddd6fe' }}>{success}</div>}

                    {!success && token && (
                        <form className="stagger-enter stagger-2" onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#000', marginBottom: '0.4rem' }}>New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    style={{ width: '100%', height: '44px', padding: '0 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0', fontSize: '0.875rem', backgroundColor: '#fff', outline: 'none' }}
                                    onFocus={(e) => e.target.style.borderColor = '#8B5CF6'}
                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#000', marginBottom: '0.4rem' }}>Confirm New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    style={{ width: '100%', height: '44px', padding: '0 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0', fontSize: '0.875rem', backgroundColor: '#fff', outline: 'none' }}
                                    onFocus={(e) => e.target.style.borderColor = '#8B5CF6'}
                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
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
                                {loading ? 'Processing...' : 'Reset Password'}
                            </button>
                        </form>
                    )}
                    
                    <button 
                      className="stagger-enter stagger-3"
                      onClick={() => navigate('/')} 
                      style={{ 
                          marginTop: '1.5rem',
                          width: '100%', 
                          height: '44px', 
                          background: 'white', 
                          border: '1px solid #e2e8f0', 
                          borderRadius: '0', 
                          color: '#64748b', 
                          fontWeight: '500', 
                          cursor: 'pointer',
                          fontSize: '0.875rem'
                      }}
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        </div>
    );
}
