import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Lock, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { validatePassword } from '../../../core/utils/validators';
import logoMark from '../../../assets/Favicon_black.png';

function Shell({ children }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-[420px]">

        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors mb-6"
        >
          <ArrowLeft size={16} /> Back to login
        </button>

        <div className="bg-white px-6 sm:px-9 py-8 sm:py-12 shadow-[0_40px_90px_rgba(0,0,0,0.12)]">
          <div className="flex flex-col items-center mb-7">
            <img src={logoMark} alt="Phygitron 360" className="w-9 h-9 mb-3" />
            <span className="text-sm font-bold tracking-wide text-gray-900">
              PHYGITRON <span className="text-[#7C3AED]">360</span>
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenChecking, setTokenChecking] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token');

  useEffect(() => {
    if (!token) {
        setError('No access token provided.');
        setTokenChecking(false);
        return;
    }

    // Check token validity
    fetch('/api/auth/verify-reset-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
    })
    .then(res => res.json())
    .then(data => {
        if (data.valid) {
            setTokenValid(true);
        } else {
            setError('Invalid or expired token.');
        }
    })
    .catch(() => setError('Connection failed.'))
    .finally(() => setTokenChecking(false));

  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
        setError(passwordError);
        return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || data.detail || 'Reset failed');
      setSuccess(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (tokenChecking) {
    return (
      <Shell>
        <div className="flex flex-col items-center py-6">
          <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-gray-500">Verifying your link...</p>
        </div>
      </Shell>
    );
  }

  if (!tokenValid && !success) {
    return (
      <Shell>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
            <XCircle size={28} className="text-red-500" />
          </div>
          <h2 className="text-[22px] sm:text-[26px] font-bold text-gray-900 mb-2">
            Invalid or expired link
          </h2>
          <p className="text-sm text-gray-500 mb-7">{error}</p>
          <button
            onClick={() => navigate('/forgot-password')}
            className="w-full py-4 bg-[#7C3AED] hover:bg-[#6b21d8] transition-all shadow-lg shadow-purple-500/25 text-white text-[16px] font-bold rounded-lg mb-3"
          >
            Request a new link
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 text-gray-500 hover:text-gray-800 text-sm font-semibold transition-colors"
          >
            Back to login
          </button>
        </div>
      </Shell>
    );
  }

  if (success) {
    return (
      <Shell>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={28} className="text-green-600" />
          </div>
          <h2 className="text-[22px] sm:text-[26px] font-bold text-gray-900 mb-2">
            Password updated
          </h2>
          <p className="text-sm text-gray-500 mb-7">
            Your password has been reset successfully. You can now log in with your new password.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-4 bg-[#7C3AED] hover:bg-[#6b21d8] transition-all shadow-lg shadow-purple-500/25 text-white text-[16px] font-bold rounded-lg"
          >
            Log in
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h2 className="text-[22px] sm:text-[26px] font-bold leading-[1.2] text-center text-gray-900 mb-2">
        Set a new password
      </h2>
      <p className="text-sm text-gray-500 text-center mb-7">
        Choose a strong password you haven&apos;t used before.
      </p>

      {error && (
        <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-600 text-sm font-medium text-center rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            New Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your new password"
              className="w-full pl-11 pr-12 py-3.5 border border-gray-200 bg-gray-50 text-gray-800 placeholder:text-gray-400 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15 transition-all rounded-lg text-[15px]"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Confirm Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              className="w-full pl-11 pr-12 py-3.5 border border-gray-200 bg-gray-50 text-gray-800 placeholder:text-gray-400 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15 transition-all rounded-lg text-[15px]"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-[#7C3AED] hover:bg-[#6b21d8] transition-all shadow-lg shadow-purple-500/25 text-white text-[16px] font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2.5 group mt-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              Reset password
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>
    </Shell>
  );
}
