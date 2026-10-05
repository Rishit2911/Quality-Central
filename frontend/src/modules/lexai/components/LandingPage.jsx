import React from 'react';
import { Star, ArrowRight } from 'lucide-react';

const motion = {
    main: ({ variants, initial, animate, children, ...props }) => <main {...props}>{children}</main>,
    div: ({ variants, children, ...props }) => <div {...props}>{children}</div>
};

export default function LandingPage({ onGetStarted, onSignIn }) {
    const fadeInSlideUp = {};
    const staggerContainer = {};

    return (
        <div className="relative min-h-screen bg-white font-geist overflow-hidden">
            {/* 🎥 Background Video Section */}
            <div className="absolute inset-0 z-0 h-[600px] overflow-hidden">
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover [transform:scaleY(-1)]"
                >
                    <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260302_085640_276ea93b-d7da-4418-a09b-2aa5b490e838.mp4" type="video/mp4" />
                </video>
            </div>

            {/* 🚀 Navigation Bar Container (Floating Pill) */}
            <div className="fixed top-2 left-0 right-0 z-50 px-8 py-6 flex justify-center pointer-events-none">
                <nav className="flex items-center justify-between w-full max-w-[1240px] pointer-events-auto">
                    <div className="flex items-center gap-4 w-1/4">
                        <img src="/logo.png" alt="EWANDZ" className="h-5 w-auto object-contain opacity-90" />
                        <div className="w-[1px] h-4 bg-[#1d1d1f]/10" />
                        <span className="text-[18px] font-bold tracking-tight text-[#1d1d1f]">
                            e-Learning AI
                        </span>
                    </div>
                    
                    {/* Central Links */}
                    <div className="hidden md:flex items-center justify-center gap-10 w-1/2">
                        <a href="#home" className="text-[15px] font-medium text-[#1d1d1f]/60 hover:text-black transition-colors">Home</a>
                        <a href="#features" className="text-[15px] font-medium text-[#1d1d1f]/60 hover:text-black transition-colors">Features</a>
                        <a href="#pricing" className="text-[15px] font-medium text-[#1d1d1f]/60 hover:text-black transition-colors">Pricing</a>
                        <a href="#contact" className="text-[15px] font-medium text-[#1d1d1f]/60 hover:text-black transition-colors">Contact us</a>
                    </div>

                    <div className="flex items-center justify-end gap-6 w-1/4">
                        <button 
                            className="text-[15px] font-semibold text-[#1d1d1f] hover:opacity-70 transition-opacity"
                            onClick={onGetStarted}
                        >
                            Sign up
                        </button>
                        <button 
                            className="bg-[#1d1d1f] text-white px-6 py-2.5 rounded-[40px] text-[15px] font-medium shadow-cta transition-transform active:scale-95 hover:bg-black"
                            onClick={onSignIn}
                        >
                            Sign in
                        </button>
                    </div>
                </nav>
            </div>

            {/* Content Spacer for Fixed Nav */}
            <div className="h-[40px]" />

            {/* ⚡ Hero Content Section */}
            <motion.main 
                className="relative z-10 flex flex-col items-center justify-center text-center min-h-[calc(100vh-80px)] px-4 max-w-[1200px] mx-auto gap-12 pb-20"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
            >
                {/* 📝 Main Heading */}
                <motion.div variants={fadeInSlideUp} className="flex flex-col gap-6">
                    <h1 className="text-[72px] leading-[1.05] font-bold tracking-[-0.04em] text-[#1d1d1f] max-w-[900px]">
                        Automate Your <span className="font-instrument italic font-normal text-[84px] leading-0">Instructional Design</span> with AI
                    </h1>

                    {/* 📄 Description */}
                    <p className="text-[18px] leading-[1.6] text-[#1d1d1f]/50 max-w-[620px] mx-auto font-medium">
                        Transform raw content into comprehensive course outlines and learning materials in seconds.
                        Designed for L&D teams and Educators who want to focus on impact.
                    </p>
                </motion.div>

                {/* 📧 Action Block (Email Pill) */}
                <motion.div variants={fadeInSlideUp} className="flex flex-col items-center gap-6 w-full">
                    <div className="flex items-center p-1.5 pl-8 bg-white/40 backdrop-blur-md border border-[#e2e8f0] rounded-full shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 w-full max-w-[520px]">
                        <input 
                            type="email" 
                            placeholder="Enter your email" 
                            className="flex-1 bg-transparent border-none outline-none text-[#1d1d1f] text-[15px] font-medium placeholder-[#1d1d1f]/30"
                        />
                        <button 
                            className="bg-[#1d1d1f] text-white px-10 py-4 rounded-full text-[15px] font-semibold shadow-cta transition-all hover:bg-black active:scale-95 whitespace-nowrap"
                            onClick={onGetStarted}
                        >
                            Get Started
                        </button>
                    </div>

                    {/* ⭐ Social Proof */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-6 h-6 bg-white rounded-full shadow-sm border border-[#e2e8f0]">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                            </div>
                            <div className="flex gap-0.5">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} size={14} fill="#FFB800" className="text-[#FFB800]" />
                                ))}
                            </div>
                        </div>
                        <span className="text-[14px] font-semibold text-[#1d1d1f]/40 tracking-tight">
                            1,020+ Reviews
                        </span>
                    </div>
                </motion.div>
            </motion.main>
        </div>
    );
}
