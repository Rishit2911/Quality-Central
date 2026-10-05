import { useNavigate } from "react-router-dom";
import logo from "../../../assets/logo-footer.png";
import phygitron from "../../../assets/EWANDZ_White.png";

import fb from "../../../assets/facebook.png";
import ig from "../../../assets/instagram.png";
import x from "../../../assets/X.png";
import li from "../../../assets/linkedin.png";

import usa from "../../../assets/office-usa.png";
import poland from "../../../assets/office-poland.png";
import india from "../../../assets/office-india.png";
import canada from "../../../assets/office-canada.png";

const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer className="footer">

      {/* TOP BAR */}
      <div className="footer-top">
        <div className="footer-brand">
          <img src={logo} className="footer-logo-glow" />

          <div className="footer-brand-divider"></div>

          <div className="footer-title">
            <p>Human Genius.</p>
            <p>Digital Innovation.</p>
          </div>
        </div>

        <button 
          className="footer-btn" 
          onClick={() => navigate("/partner")}
        >
          Partner with us →
        </button>
      </div>

      {/* DIVIDER */}
      <div className="footer-divider"></div>

      {/* MAIN */}
      <div className="footer-main">

        {/* LEFT */}
        <div className="footer-left">

          <img src={phygitron} className="footer-phygitron" />

          <p>
            EWANDZ is a global tech-driven company offering innovative solutions in cybersecurity,
            e-learning, software development, and more—empowering businesses to grow, stay secure,
            and thrive in the digital age.
          </p>
        </div>

        {/* RIGHT */}
        <div className="footer-right">
          <h4>ABOUT US</h4>
          <ul>
            <li>About Ewandzdigital</li>
            <li>Advisory Board</li>
            <li>Leadership</li>
            <li>Mission, Vision & Values</li>
            <li>Corporate Social Responsibility</li>
            <li>Partnerships and Memberships</li>
          </ul>
        </div>

      </div>

      {/* DIVIDER */}
      <div className="footer-divider"></div>

      
      {/* OFFICES GRID */}
      <div className="footer-offices">
        <div className="footer-social-wrapper">
          <p className="footer-label">Follow us on</p>

          <div className="footer-socials">
            <img src={fb} alt="facebook" />
            <img src={ig} alt="instagram" />
            <img src={x} alt="x" />
            <img src={li} alt="linkedin" />
          </div>

          <p className="footer-contact" style={{ marginTop: 18 }}>
            Contact us at:<br />
            phygitron360@ewandzdigital.com
          </p>
        </div>

        <img src={usa} />
        <img src={poland} />
        <img src={india} />
        <img src={canada} />
      </div>

      {/* BOTTOM */}
      <div className="footer-divider"></div>
      <div className="footer-bottom">
        © 2026 Ewandzdigital. All rights reserved
      </div>

    </footer>
  );
};

export default Footer;