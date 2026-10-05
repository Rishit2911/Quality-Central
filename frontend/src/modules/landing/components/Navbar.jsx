import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logoDark from "../../../assets/logo.png";
import ewandzLogoDark from "../../../assets/EWANDZ_White.png";

const Navbar = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ── Scroll to About section ──
  const scrollToAbout = () => {
    const aboutSection = document.getElementById('about-section');
    if (aboutSection) {
      aboutSection.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 py-3 sm:py-[15px] ${
        scrolled
          ? 'bg-[#1A1A1A] shadow-lg border-b border-white/10'
          : 'bg-[#1A1A1A] shadow-sm border-b border-white/10'
      }`}
      data-no-tooltip
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-16 flex items-center justify-between">

        {/* ── LEFT: LOGO ── */}
        <div className="flex items-center gap-4 min-w-0" data-no-tooltip>
          {/* PHYGITRON 360 LOGO */}
          <img
            src={logoDark}
            alt="Phygitron Logo"
            className="h-8! sm:h-9! md:h-[45px]! w-auto! shrink-0 max-w-none!"
            data-no-tooltip
          />
        </div>

        {/* ── RIGHT: BUTTON + EWANDZ LOGO ── */}
        <div className="flex items-center gap-2 sm:gap-4 md:gap-6 shrink-0" data-no-tooltip>
          {/* About Phygitron - Scrolls to section
          <button
            onClick={scrollToAbout}
            className="text-white hover:text-[#C084FC] text-sm font-medium transition-colors cursor-pointer"
            data-no-tooltip
          >
            ABOUT PHYGITRON
          </button> */}

          {/* Request Demo - White button with purple hover */}
          <button
            onClick={() => navigate("/request-demo")}
            className="px-3 py-1.5 sm:px-5 sm:py-2 bg-transparent border border-white/50 text-white text-xs sm:text-sm font-medium transition-all duration-300 hover:bg-white hover:text-[#1A1A1A] hover:border-white whitespace-nowrap"
            data-no-tooltip
          >
            REQUEST DEMO
          </button>

          {/* EWANDZ LOGO */}
          <img
            src={ewandzLogoDark}
            alt="EWANDZ Logo"
            className="h-3! sm:h-3.5! md:h-4! w-auto! shrink-0 max-w-none!"
            data-no-tooltip
          />
        </div>

      </div>
    </nav>
  );
};

export default Navbar;