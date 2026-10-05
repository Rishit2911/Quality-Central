import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import { Lock, Command, ArrowRight, Zap, AlertCircle } from 'lucide-react';
import hideIcon from "../../../assets/hide.png";
import viewIcon from "../../../assets/view.png";
import { validatePassword } from '../../../core/utils/validators';

export default function ForceChangePasswordPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!user || !user.password_must_change) {
      navigate('/');
    }
  }, [user, navigate]);

  if (!user || !user.password_must_change) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("New password must be different from current password.");
      return;
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        }),
      });

      const data = await res.json();

      if (res.ok) {
        login({ ...user, password_must_change: false });
        
        const uRoles = (user.roles || [user.role]).map(r => r ? r.toLowerCase() : '');
        if (uRoles.includes('super_admin')) navigate('/superadmin');
        else if (uRoles.includes('org_admin')) navigate('/admin');
        else if (uRoles.includes('manager')) navigate('/deploy?tab=personnel');
        else if (uRoles.includes('candidate')) navigate('/source?tab=my-application');
        else navigate('/deploy');
      } else {
        setError(data.detail || data.message || 'Failed to change password.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#040812] text-white flex items-center justify-center p-6 overflow-hidden">
      <div className="absolute inset-0 z-0 h-full w-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-[#CC97FF]/10 blur-[150px] rounded-full animate-pulse opacity-40 will-change-transform" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        {/* Portal Branding */}
        <div className="mb-12 flex flex-col items-center">
          <div className="w-16 h-16 bg-primary flex items-center justify-center rounded-2xl shadow-[0_0_40px_rgba(204,151,255,0.4)] mb-6 transition-all">
             <Command className="text-black" size={32} />
          </div>
          <h1 className="text-3xl font-display font-extrabold tracking-tighter uppercase mb-2">Phygitron <span className="text-primary">360</span></h1>
        </div>

        <div className="glass-panel p-1 border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.6)]">
          <div className="bg-[#0B1326]/60 backdrop-blur-3xl rounded-[22px] p-10">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-lg flex items-center justify-center">
                  <AlertCircle size={20} />
                </div>
                <h2 className="text-2xl font-display font-extrabold text-white uppercase">Action Required</h2>
              </div>
              <p className="text-[12px] text-white/50 uppercase tracking-widest leading-relaxed">
                Your account was created with a temporary password. You must update it to continue using Phygitron 360.
              </p>
            </div>

            {error && (
              <div className="mb-8 rounded-2xl bg-error/10 p-4 text-xs text-[#FFB4AB] border border-error/20 flex gap-3 items-center animate-shake">
                <Zap size={16} /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3 ml-1">Current/Temporary Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-40" size={18} />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-2xl border border-white/5 bg-white/5 py-4 pl-12 pr-4 text-white placeholder-white/20 transition-all focus:border-primary/40 focus:bg-white/10 outline-none font-medium text-sm"
                    placeholder="••••••••"
                    required
                  />
                  <img
                    src={showCurrentPassword ? hideIcon : viewIcon}
                    alt=""
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    style={{
                      position: 'absolute',
                      right: '16px',
                      top: '45%',
                      transform: 'translateY(-50%)',
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      opacity: 0.7
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3 ml-1">New Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-40" size={18} />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-2xl border border-white/5 bg-white/5 py-4 pl-12 pr-4 text-white placeholder-white/20 transition-all focus:border-primary/40 focus:bg-white/10 outline-none font-medium text-sm"
                    placeholder="••••••••"
                    required
                  />
                  <img
                    src={showNewPassword ? hideIcon : viewIcon}
                    alt=""
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: '16px',
                      top: '45%',
                      transform: 'translateY(-50%)',
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      opacity: 0.7
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3 ml-1">Confirm New Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-40" size={18} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-2xl border border-white/5 bg-white/5 py-4 pl-12 pr-4 text-white placeholder-white/20 transition-all focus:border-primary/40 focus:bg-white/10 outline-none font-medium text-sm"
                    placeholder="••••••••"
                    required
                  />
                  <img
                    src={showConfirmPassword ? hideIcon : viewIcon}
                    alt=""
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '16px',
                      top: '45%',
                      transform: 'translateY(-50%)',
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      opacity: 0.7
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-black font-extrabold text-[11px] uppercase tracking-[0.2em] py-5 rounded-2xl shadow-[0_10px_30px_rgba(204,151,255,0.3)] hover:bg-white hover:shadow-white/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
              >
                {loading ? 'Updating...' : 'Update Password'}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
