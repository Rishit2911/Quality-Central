import talentIcon from "../../../assets/talent_hub_black.png";
import learningIcon from "../../../assets/learning_hub_black.png";
import assessmentIcon from "../../../assets/assessment_hub_black.png";
import employeeIcon from "../../../assets/employee_hub_black.png";

const hubs = [
  {
    icon: talentIcon,
    title: "Talent Central",
    desc: "Create a stronger talent pipeline with engaging, personalized learning.",
    capabilities: [
      "Skill Development",
      "Personalized Learning",
      "Learning Analytics",
      "Engagement Tracking",
    ],
  },
  {
    icon: learningIcon,
    title: "Learning Central",
    desc: "Make data-driven hiring decisions backed by evidence.",
    capabilities: [
      "AI Talent Sourcing",
      "Candidate Matching",
      "Recruitment Analytics",
      "Diversity Insights",
    ],
  },
  {
    icon: assessmentIcon,
    title: "Assessment Central",
    desc: "Turn learning into business impact with AI-powered assessments.",
    capabilities: [
      "AI Assessments",
      "Skill Gap Analysis",
      "Proctoring & Integrity",
      "Actionable Reports",
    ],
  },
  {
    icon: employeeIcon,
    title: "Employee Central",
    desc: "Run workforce operations smoothly and efficiently.",
    capabilities: [
      "Workforce Management",
      "Performance Analytics",
      "Employee Engagement",
      "Diversity & Equity",
    ],
    iconClass: "w-11 h-11",
    iconStyle: { filter: "brightness(0) saturate(100%)" },
  },
];

const FeatureGrid = () => {
  return (
    <section className="relative w-full bg-white py-20 md:py-24">
      <div className="mx-auto w-full max-w-[1100px] px-6 lg:px-10">

        {/* ── HEADER ── */}
        <div className="text-left sm:text-center mb-14 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 leading-tight">
            One Platform.
            <br className="hidden sm:block" />
            Four Powerful Modules.
          </h2>
          <p className="text-gray-500 text-[15px] max-w-[620px] mx-auto mt-4 leading-relaxed">
            From hiring and onboarding to skill validation, learning, and
            workforce management, Phygitron360 delivers an intelligent,
            connected ecosystem for building future-ready organizations.
          </p>
        </div>

        {/* ── 2x2 GRID OF CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
          {hubs.map((hub) => (
            <div
              key={hub.title}
              className="group relative bg-[#10b981ab] border border-black p-8 md:p-10 transition-[background-color] duration-200 ease-linear hover:bg-white"
            >
              <img
                src={hub.icon}
                alt=""
                className={`${hub.iconClass || "w-8 h-8"} mb-4`}
                style={hub.iconStyle}
              />

              <h3 className="text-xl md:text-2xl font-bold text-black mb-2">
                {hub.title}
              </h3>

              <p className="text-black text-sm leading-relaxed mb-4 max-w-[380px]">
                {hub.desc}
              </p>

              <ul className="space-y-1.5">
                {hub.capabilities.map((cap) => (
                  <li
                    key={cap}
                    className="text-black text-sm leading-relaxed"
                  >
                    • {cap}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default FeatureGrid;
