import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowRight, Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../../core/auth/AuthContext';
import { defaultRouteForUser, resolveModuleAccess } from '../../../utils/resolveModuleAccess';

// ── Banner Images ──
import talentBanner from '../../../assets/hero5.png';
import learningBanner from '../../../assets/hero6.png';
import assessmentBanner from '../../../assets/hero7.png';
import empBanner from '../../../assets/hero8.png';

const slides = [
  {
    id: 1,
    image: talentBanner,
    title: "Beyond Resumes. Hire with Intelligence.",
    description: "Transform recruitment with AI-powered candidate discovery, skill intelligence, identity verification, and intelligent role matching.",
    tagline: "Talent Central"
  },
  {
    id: 2,
    image: learningBanner,
    title: "Accelerating Learning Through AI",
    description: "Empower employees with AI-driven learning experiences that accelerate skill development, improve performance, and support career growth.",
    tagline: "Learning Central"
  },
  {
    id: 3,
    image: assessmentBanner,
    title: "Intelligent Assessments. Trusted Outcomes",
    description: "AI-powered evaluations and secure proctoring that provide objective, evidence-based insights into skills and capabilities.",
    tagline: "Assessment Central"
  },
  {
    id: 4,
    image: empBanner,
    title: "Everything Your Workforce Needs. One Platform.",
    description: "Simplify Human Capital Management with AI-powered onboarding, payroll, compliance, attendance, and workforce analytics in one connected platform.",
    tagline: "Employee Central"
  }
];

export default function HeroSection() {
  const navigate = useNavigate();
  const { login, refreshUser } = useAuth();
  const [slidePosition, setSlidePosition] = useState(slides.length);
  const [skipTransition, setSkipTransition] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const slideContainerRef = useRef(null);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);

  const currentSlide = ((slidePosition % slides.length) + slides.length) % slides.length;

  // ── Detect subdomain for workspace ──
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

  const workspaceId = detectSubdomain();

  // ── Helper function for permissions ──
  const hasPermissionForUser = (user, permission) => {
    const moduleMatch = permission.match(/^module\.([a-z]+)\.access$/);
    if (moduleMatch && !(user.modules_enabled || []).map(String).map((m) => m.toLowerCase()).includes(moduleMatch[1])) {
      return false;
    }

    const roles = (user.roles || [user.role]).filter(Boolean).map((role) => String(role).toLowerCase());
    if (roles.includes('super_admin') || roles.includes('superadmin')) return true;

    if (Array.isArray(user.permissions)) return user.permissions.includes(permission);
    return Boolean(user.permissions?.[permission]);
  };

  // ── Seamless strip setup ──
  const stripSlides = [...slides, ...slides, ...slides];
  const totalSlides = stripSlides.length;
  const startIndex = slidePosition;

  // ── Auto-slide carousel (seamless strip, forward-only loop) ──
  useEffect(() => {
    const interval = setInterval(() => {
      goToNext();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Track viewport for login card positioning ──
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const goToNext = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setSlidePosition((prev) => prev + 1);
    setTimeout(() => setIsTransitioning(false), 700);
  };

  const goToPrev = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setSlidePosition((prev) => prev - 1);
    setTimeout(() => setIsTransitioning(false), 700);
  };

  useEffect(() => {
    if (slidePosition >= slides.length * 2) {
      const timeout = setTimeout(() => {
        setSkipTransition(true);
        setSlidePosition((prev) => prev - slides.length);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setSkipTransition(false));
        });
      }, 700);
      return () => clearTimeout(timeout);
    }
    if (slidePosition < slides.length) {
      const timeout = setTimeout(() => {
        setSkipTransition(true);
        setSlidePosition((prev) => prev + slides.length);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setSkipTransition(false));
        });
      }, 700);
      return () => clearTimeout(timeout);
    }
  }, [slidePosition]);

  const jumpToSlide = (targetIndex) => {
    if (isTransitioning || targetIndex === currentSlide) return;
    const forwardSteps = (targetIndex - currentSlide + slides.length) % slides.length;
    const backwardSteps = (currentSlide - targetIndex + slides.length) % slides.length;
    const delta = forwardSteps <= backwardSteps ? forwardSteps : -backwardSteps;
    setIsTransitioning(true);
    setSlidePosition((prev) => prev + delta);
    setTimeout(() => setIsTransitioning(false), 700);
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workspace_id: workspaceId,
          username: (email || '').trim(),
          password: (password || '').trim()
        }),
      });

      const data = await res.json();

      if (res.ok) {
        login(data.user);

        if (data.user?.password_must_change) {
          // Skip refreshUser — it can overwrite the flag before React re-renders.
          // Navigate directly so ProtectedRoute sees password_must_change immediately.
          navigate('/force-change-password');
        } else {
          // Refresh from /api/auth/check to pick up template-role permissions
          // that the login response may not fully include
          await refreshUser();
          toast.success('Login successful! Welcome back.');
          navigate(defaultRouteForUser(data.user));
        }
      } else {
        setError(data.detail || 'Access Denied: Invalid Credentials.');
        toast.error(data.detail || 'Login failed');
      }
    } catch (err) {
      const errorMsg = 'Phygitron 360 Network Interrupted: Check Connection.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    // ── Page shell: white canvas, generous air above/below the banner ──
    <section className="w-full bg-white pt-32 md:pt-36 pb-4 md:pb-6 overflow-visible">

      {/* Outer wrapper is intentionally NOT overflow-hidden so the login
          card and arrows can break outside the banner's bounds. No side
          padding/max-width here — the banner runs true edge-to-edge. */}
      <div className="relative w-full">

          {/* ── CINEMATIC BANNER (image + text move together per slide, clipped to rounded rect) ── */}
          <div className="relative h-[300px] sm:h-[360px] md:h-[400px] w-full overflow-hidden bg-black">

            {/* Carousel strip — each slide carries its own image + overlay + text,
                so they all translate together as one unit. */}
            <div
              ref={slideContainerRef}
              className={`flex h-full ${skipTransition ? '' : 'transition-transform duration-[750ms] ease-[cubic-bezier(0.22,1,0.36,1)]'}`}
              style={{
                transform: `translateX(-${startIndex * (100 / totalSlides)}%)`,
                width: `${totalSlides * 100}%`
              }}
            >
              {stripSlides.map((slide, index) => (
                <div
                  key={`${slide.id}-${index}`}
                  className="relative flex-shrink-0 h-full overflow-hidden"
                  style={{ width: `${100 / totalSlides}%` }}
                >
                  <img
                    src={slide.image}
                    alt={slide.tagline}
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />

                  {/* Neutral dark overlay for text legibility — lives per-slide now */}
                  <div 
                    className="absolute inset-0 pointer-events-none" 
                    style={{ backgroundColor: '#7c1eff7b' }}
                  />

                  {/* Text sits on top of its own image so both move together */}
                  <div className="absolute inset-0 z-10 flex items-center pl-6 sm:pl-10 md:pl-16 lg:pl-[90px] pr-6 sm:pr-8">
                    <div className="w-full max-w-[560px] sm:max-w-[640px] md:max-w-[440px] lg:max-w-[520px] xl:max-w-[600px] text-white">
                      <h1 className="text-[26px] sm:text-[34px] md:text-[42px] lg:text-[48px] xl:text-[52px] font-black leading-[1.1] tracking-tight">
                        {slide.title}
                      </h1>
                      <p className="text-sm sm:text-base md:text-[17px] text-white/80 mt-3 sm:mt-4 leading-6 sm:leading-7 max-w-[520px]">
                        {slide.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── DOTS ── fixed on screen (not part of the sliding strip) */}
            <div className="absolute bottom-4 sm:bottom-6 left-6 sm:left-10 md:left-16 lg:left-[90px] z-20 flex gap-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => jumpToSlide(index)}
                  aria-label={`Go to slide ${index + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    index === currentSlide
                      ? 'w-8 bg-white'
                      : 'w-1.5 bg-white/35 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>

            {/* ── NAVIGATION ARROWS ── scoped inside the banner so they stay
                 centered on it regardless of what stacks below on mobile ── */}
            <button
              onClick={goToPrev}
              aria-label="Previous slide"
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white shadow-[0_8px_24px_rgba(0,0,0,0.15)] text-gray-700 hover:bg-gray-50 hover:scale-105 transition-all flex items-center justify-center"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={goToNext}
              aria-label="Next slide"
              className="absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 z-40 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white shadow-[0_8px_24px_rgba(0,0,0,0.15)] text-gray-700 hover:bg-gray-50 hover:scale-105 transition-all flex items-center justify-center"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* ── LOGIN CARD ──
               Stacked below the banner in normal flow on mobile/tablet so it
               never overflows a narrow viewport; becomes a floating overlay,
               vertically centered on the banner, from lg upward. */}
          <div
            className="flex items-center px-0"
            style={isDesktop ? {
              position: 'absolute',
              right: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '420px',
              maxWidth: '420px',
              zIndex: 30,
              margin: 0,
            } : {
              position: 'relative',
              width: '92%',
              maxWidth: '420px',
              marginTop: '24px',
              marginLeft: 'auto',
              marginRight: 'auto',
              zIndex: 30,
            }}
          >

            {/* Depth shadow layer, offset downward, soft and low opacity */}
            <div
              className="absolute -inset-3 top-8 bg-black/15 blur-2xl rounded-[48px] -z-10"
              aria-hidden="true"
            />

            {/* Card body */}
            <div className="relative w-full bg-white px-6 sm:px-9 py-8 sm:py-14 shadow-[0_40px_90px_rgba(0,0,0,0.28)]">

              <h2 className="text-[24px] sm:text-[32px] lg:text-[36px] font-bold leading-[1.1] text-center text-gray-900 mb-6 sm:mb-8">
                Login to your account
              </h2>

              {error && (
                <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-600 text-sm font-medium text-center rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-4 py-3.5 border border-gray-200 bg-gray-50 text-gray-800 placeholder:text-gray-400 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15 transition-all rounded-lg text-[15px]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full px-4 py-3.5 border border-gray-200 bg-gray-50 text-gray-800 placeholder:text-gray-400 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15 transition-all rounded-lg text-[15px] pr-12"
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
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-sm font-medium text-[#7C3AED] hover:text-[#6b21d8] transition-colors"
                    >
                      Forgot password?
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
                      Login
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

      </div>
    </section>
  );
}