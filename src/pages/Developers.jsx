import { Link } from "react-router-dom";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import PageShell from "../components/PageShell";

const awards = [
  { title: "Best in Health API", sub: "API World 2024", icon: "emoji_events" },
  { title: "Breakthrough Startup Award", sub: "Food as Medicine 2025", icon: "rocket_launch" },
  { title: "Digital Health Finalist", sub: "HLTH Conference 2025", icon: "health_and_safety" },
  { title: "Top 14 AI APIs", sub: "Programmable Web — alongside Google, Amazon, IBM", icon: "star" },
];

const queries = [
  {
    q: "Is [food item] good for [condition]?",
    a: "Returns one of seven responses from Most Helpful to Most Harmful, specific to that condition.",
  },
  {
    q: "What should someone with [condition] eat more of?",
    a: "Returns a ranked list of top foods, nutrients, and lifestyle choices for that health profile.",
  },
  {
    q: "What should they avoid?",
    a: "Returns foods, substances, and habits most harmful to the selected condition.",
  },
  {
    q: "What are the best [food group] options for [condition]?",
    a: "Ranks items within any of 18 food groups against the patient's health profile.",
  },
];

const useCases = [
  "Telehealth platforms expanding from acute care into chronic condition management",
  "Hospitals reducing readmissions with discharge nutrition guidance",
  "Clinics offering personalized dietary support alongside prescribed treatment",
  "Chronic illness coaching firms serving beyond diabetes and obesity",
  "\"Food is Medicine\" organizations that need programmatic, condition-specific food guidance",
  "Health-tech and corporate wellness platforms addressing autoimmune, cancer, and behavioral conditions",
  "Recipe and content platforms that want to flag harmful ingredients for specific conditions",
];

export default function Developers() {
  return (
    <PageShell>
      {/* Hero */}
      <section className="relative overflow-hidden bg-paper-200">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(63,110,134,0.14), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl container-px py-20 lg:py-28 text-center">
          <Reveal>
            <span className="tag">Nutridigm API by Personal Remedies</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="display mt-5 text-[34px] leading-[1.08] sm:text-[48px] sm:leading-[1.04] lg:text-[58px] lg:leading-[1.02] max-w-[20ch] mx-auto">
              The food-disease intelligence layer{" "}
              <em className="font-display italic font-normal text-forest-700">your platform is missing.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-7 text-[17px] sm:text-[18px] leading-[1.6] text-char-500 max-w-[62ch] mx-auto font-sans">
              Real-time, personalized dietary guidance for 300+ conditions — delivered via API. The only
              knowledgebase of its kind in healthcare.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link to="/survey" className="pill-forest text-[16px] px-7 py-3">
                Sign up for free account
              </Link>
              <a href="#docs" className="pill-ghost text-[16px] px-7 py-3">
                View API docs
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Awards bar */}
      <section className="border-y border-sand-200 bg-paper-100">
        <div className="mx-auto max-w-7xl container-px py-8">
          <Reveal>
            <p className="tag mb-5">Recognition</p>
          </Reveal>
          <Stagger className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {awards.map((a) => (
              <StaggerItem key={a.title}>
                <div className="flex items-start gap-3">
                  <span className="h-9 w-9 shrink-0 rounded-lg bg-signal-info-tint flex items-center justify-center" aria-hidden>
                    <span className="material-symbols-rounded text-signal-info text-[20px]">{a.icon}</span>
                  </span>
                  <div>
                    <p className="text-[14.5px] font-semibold tracking-tightish text-char-900 leading-snug font-sans">{a.title}</p>
                    <p className="text-[12.5px] text-char-500 mt-0.5 font-sans">{a.sub}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* What the API does */}
      <section id="docs" className="py-16 lg:py-24 bg-paper-200">
        <div className="mx-auto max-w-5xl container-px">
          <Reveal>
            <h2 className="display text-[30px] leading-[1.1] sm:text-[42px] sm:leading-[1.06] text-center max-w-[24ch] mx-auto">
              Four questions the Nutridigm API answers{" "}
              <em className="font-display italic font-normal text-forest-700">instantly</em>
            </h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-5 sm:gap-6 md:grid-cols-2">
            {queries.map((c, i) => (
              <StaggerItem key={i}>
                <div className="ds-card h-full p-7">
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="h-6 w-6 rounded-full bg-signal-info-tint text-signal-info text-[12px] font-mono font-semibold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="tag">Query</span>
                  </div>
                  <p className="font-mono text-[15px] sm:text-[16px] leading-snug text-char-900 bg-sand-100 rounded-md px-3 py-2">
                    {c.q}
                  </p>
                  <p className="mt-3 text-[14.5px] leading-[1.6] text-char-500 font-sans">{c.a}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal delay={0.2}>
            <p className="mt-7 text-center text-[14px] text-char-500 max-w-[64ch] mx-auto font-sans">
              Queries support combinations of multiple conditions simultaneously — the feature no other API offers.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-16 lg:py-24 bg-paper-100 border-y border-sand-200">
        <div className="mx-auto max-w-3xl container-px">
          <Reveal>
            <h2 className="display text-[28px] leading-[1.12] sm:text-[38px] sm:leading-[1.06] text-center mb-12">
              Who's already using it
            </h2>
          </Reveal>
          <Stagger className="space-y-3">
            {useCases.map((u, i) => (
              <StaggerItem key={i}>
                <div className="ds-card flex gap-4 p-5 sm:p-6 border-l-[3px] border-l-signal-info">
                  <span className="mt-[3px] shrink-0 text-signal-info" aria-hidden>
                    <span className="material-symbols-rounded text-[18px]">arrow_forward</span>
                  </span>
                  <p className="text-[15.5px] leading-[1.55] text-char-900 font-sans">{u}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA — forest band */}
      <section className="py-24 lg:py-32 bg-forest-900">
        <div className="mx-auto max-w-3xl container-px text-center">
          <Reveal>
            <h2 className="display text-[32px] leading-[1.08] sm:text-[46px] sm:leading-[1.04] text-[#F3EFE6]">
              Start with a{" "}
              <em className="font-display italic font-normal text-honey-500">free account.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-[17px] sm:text-[18px] leading-[1.6] text-[#F3EFE6]/75 font-sans">
              Explore the knowledgebase, test queries, and see what's possible before you commit to a plan.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link to="/survey" className="pill-honey text-[16px] px-7 py-3">
                Sign up free
              </Link>
              <Link to="/survey" className="pill-ghost-dark text-[16px] px-7 py-3">
                Contact us for enterprise pricing
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </PageShell>
  );
}
