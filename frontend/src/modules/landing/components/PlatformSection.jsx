import demoImage from '../../../assets/demo.png';

const PlatformSection = () => {
  return (
    <div className="relative w-full overflow-hidden">
      {/* Spacer to create gap with guaranteed white background */}
      <div className="w-full bg-white h-24 md:h-32 relative z-10" />

      <section
        className="w-full bg-[#E4E4E4] py-16 sm:py-20 md:py-32 lg:py-40 relative z-10 overflow-hidden"
        style={{
          backgroundImage:
            'radial-gradient(rgba(0,0,0,0.06) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      >
        {/* Decorative purple triangle, stretched full-bleed across the section and tucked behind the preview image — only shown once the image sits in its own column */}
        <div
          aria-hidden="true"
          className="hidden lg:block absolute inset-y-0 left-0 w-[150%] max-w-none pointer-events-none select-none z-0"
          style={{
            background: 'rgba(122, 29, 255, 0.28)',
            clipPath: 'polygon(0 0, 0 100%,   100% 50%)',
          }}
        />

        <div className="mx-auto w-full max-w-[1400px] px-6 lg:px-10 relative z-10">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            <div className="relative">
              <img
                src={demoImage}
                alt="PHYGITRON 360 platform preview"
                className="w-full"
                style={{ maxWidth: '600px' }}
              />
            </div>

            <div className="text-left sm:text-center lg:text-left">
              <h2 className="text-3xl md:text-4xl font-medium text-[#151515] leading-tight mb-6">
                Explore{" "}
                <span
                  className="font-bold px-1.5"
                  style={{ backgroundColor: "rgba(16, 185, 129, 0.67)" }}
                >
                  PHYGITRON 360
                </span>
                <br className="hidden lg:block" /> in Action
              </h2>

              <p className="text-gray-900 text-base leading-relaxed">
                Take a guided tour of PHYGITRON 360 and discover how each intelligent
                module works seamlessly together to simplify hiring, accelerate
                employee development, automate assessments, and enhance workforce
                operations—all through a modern, AI-driven experience designed for
                growing organizations.
              </p>
            </div>

          </div>

        </div>
      </section>
    </div>
  );
};

export default PlatformSection;