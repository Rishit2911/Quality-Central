import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Mail, CheckCircle2 } from 'lucide-react';
import { isEmail } from '../../../core/utils/validators';
import logoMark from '../../../assets/Favicon_black.png';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const detectSubdomain = () => {
    const hostname = window.location.hostname;

    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
      return 'public';
    }

    const parts = hostname.split('.');
    const nonTenantSubdomains = ['www', 'app', 'api', 'admin'];

    if (hostname.includes('localhost')) {
      if (parts.length >= 2 && !nonTenantSubdomains.includes(parts[0])) {
        return parts[0];
      }
      return 'public';
    }

    if (parts.length > 2 && !nonTenantSubdomains.includes(parts[0])) return parts[0];
    return 'public';
  };

  const [workspaceId] = useState(detectSubdomain());

  const handleReset = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          workspace_id: workspaceId,
          action: "Dispatch Reset"
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || 'Reset failed.');
      } else {
        setSent(true);
      }

    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

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

          {!sent ? (
            <>
              <h2 className="text-[22px] sm:text-[26px] font-bold leading-[1.2] text-center text-gray-900 mb-2">
                Forgot your password?
              </h2>
              <p className="text-sm text-gray-500 text-center mb-7">
                Enter the email linked to your account and we&apos;ll send you a link to reset it.
              </p>

              {error && (
                <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-600 text-sm font-medium text-center rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handleReset} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full pl-11 pr-4 py-3.5 border border-gray-200 bg-gray-50 text-gray-800 placeholder:text-gray-400 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15 transition-all rounded-lg text-[15px]"
                      required
                    />
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
                      Send reset link
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={28} className="text-green-600" />
              </div>
              <h2 className="text-[22px] sm:text-[26px] font-bold text-gray-900 mb-2">
                Check your inbox
              </h2>
              <p className="text-sm text-gray-500 mb-7">
                If an account exists for <span className="font-semibold text-gray-700">{email}</span>, a password reset link is on its way.
              </p>
              <button
                onClick={() => navigate('/')}
                className="w-full py-4 bg-[#7C3AED] hover:bg-[#6b21d8] transition-all shadow-lg shadow-purple-500/25 text-white text-[16px] font-bold rounded-lg"
              >
                Back to login
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
