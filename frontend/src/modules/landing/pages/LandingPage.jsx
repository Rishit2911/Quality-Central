import Navbar from "../components/Navbar";
import HeroSection from "../components/HeroSection";
import "../styles/landing.css";
import PlatformSection from "../components/PlatformSection";
import FeatureGrid from "../components/FeatureGrid";
import InsightsSection from "../components/InsightsSection";
import Footer from "../components/Footer";
export default function LandingPage() {
  return (
    <div className="landing-scope">
      <Navbar />
      <HeroSection />
      <PlatformSection />
      <FeatureGrid />
      <InsightsSection />
      <Footer />
    </div>
  );
}
