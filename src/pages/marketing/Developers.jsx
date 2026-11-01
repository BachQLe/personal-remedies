import { Link } from "react-router-dom";
import { Reveal, Stagger, StaggerItem } from "../../components/marketing/Reveal";
import PageShell from "../../components/marketing/PageShell";
import Icon from "../../components/shared/Icon";

const awards = [
  { title: "Best in Health API", sub: "API World 2024", icon: "award" },
  { title: "Breakthrough Startup Award", sub: "Food as Medicine 2025", icon: "zap" },
  { title: "Digital Health Finalist", sub: "HLTH Conference 2025", icon: "shield" },
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
            <span className="font-label text-[0.875rem] font-semibold tracking-[.14em] uppercase text-char-500">Nutridigm API by Personal Remedies</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="font-display font-semibold tracking-[-0.02em] mt-5 text-[2.125rem] leading-[1.08] sm:text-[3rem] sm:leading-[1.04] lg:text-[3.625rem] lg:leading-[1.02] max-w-[20ch] mx-auto text-blue-950">
              The food-disease intelligence layer{" "}
              <em className="font-display italic font-normal text-forest-700">your platform is missing.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-7 text-[1.0625rem] sm:text-[1.125rem] leading-[1.6] text-char-500 max-w-[62ch] mx-auto font-sans">
              Real-time, personalized dietary guidance for 300+ conditions — delivered via API. The only
              knowledgebase of its kind in healthcare.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link to="/onboarding" className="inline-flex items-center justify-center font-sans font-semibold text-[1rem] px-7 py-3 rounded-[6px] bg-forest-700 text-[#F3EFE6] hover:bg-forest-800 active:translate-y-[1px] active:scale-[0.99] transition-all duration-fast">
                Sign up for free account
              </Link>
              <a href="#docs" className="inline-flex items-center justify-center font-sans font-semibold text-[1rem] px-7 py-3 rounded-[6px] border border-sand-200 bg-white text-char-900 hover:bg-forest-50 transition-all duration-fast">
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
            <p className="font-label text-[0.875rem] font-semibold tracking-[.14em] uppercase text-char-500 mb-5">Recognition</p>
          </Reveal>
          <Stagger className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {awards.map((a) => (
              <StaggerItem key={a.title}>
                <div className="flex items-start gap-3">
                  <span className="h-9 w-9 shrink-0 rounded-[14px] bg-signal-info-tint flex items-center justify-center" aria-hidden>
                    <Icon name={a.icon} size={20} className="text-signal-info" />
                  </span>
                  <div>
                    <p className="text-[0.9062rem] font-semibold tracking-tightish text-char-900 leading-snug font-sans">{a.title}</p>
                    <p className="text-[0.875rem] text-char-500 mt-0.5 font-sans">{a.sub}</p>
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
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[1.875rem] leading-[1.1] sm:text-[2.625rem] sm:leading-[1.06] text-center max-w-[24ch] mx-auto text-blue-950">
              Four questions the Nutridigm API answers{" "}
              <em className="font-display italic font-normal text-forest-700">instantly</em>
            </h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-5 sm:gap-6 md:grid-cols-2">
            {queries.map((c, i) => (
              <StaggerItem key={i}>
                <div className="bg-white rounded-[28px] border border-sand-200 shadow-card h-full p-7">
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="h-6 w-6 rounded-full bg-signal-info-tint text-signal-info text-[0.875rem] font-mono font-semibold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="font-label text-[0.875rem] font-semibold tracking-[.14em] uppercase text-char-500">Query</span>
                  </div>
                  <p className="font-mono text-[0.9375rem] sm:text-[1rem] leading-snug text-char-900 bg-sand-100 rounded-md px-3 py-2">
                    {c.q}
                  </p>
                  <p className="mt-3 text-[0.9062rem] leading-[1.6] text-char-500 font-sans">{c.a}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal delay={0.2}>
            <p className="mt-7 text-center text-[0.875rem] text-char-500 max-w-[64ch] mx-auto font-sans">
              Queries support combinations of multiple conditions simultaneously — the feature no other API offers.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-16 lg:py-24 bg-paper-100 border-y border-sand-200">
        <div className="mx-auto max-w-3xl container-px">
          <Reveal>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[1.75rem] leading-[1.12] sm:text-[2.375rem] sm:leading-[1.06] text-center mb-12 text-blue-950">
              Who's already using it
            </h2>
          </Reveal>
          <Stagger className="space-y-3">
            {useCases.map((u, i) => (
              <StaggerItem key={i}>
                <div className="bg-white rounded-[28px] border border-sand-200 shadow-card flex gap-4 p-5 sm:p-6 border-l-[3px] border-l-signal-info">
                  <span className="mt-[3px] shrink-0 text-signal-info" aria-hidden>
                    <Icon name="arrow-right" size={18} />
                  </span>
                  <p className="text-[0.9688rem] leading-[1.55] text-char-900 font-sans">{u}</p>
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
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[2rem] leading-[1.08] sm:text-[2.875rem] sm:leading-[1.04] text-[#F3EFE6]">
              Start with a{" "}
              <em className="font-display italic font-normal text-yellow-400">free account.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-[1.0625rem] sm:text-[1.125rem] leading-[1.6] text-[#F3EFE6]/75 font-sans">
              Explore the knowledgebase, test queries, and see what's possible before you commit to a plan.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link to="/onboarding" className="inline-flex items-center justify-center font-sans font-semibold text-[1rem] px-7 py-3 rounded-[6px] bg-yellow-400 text-blue-950 hover:bg-yellow-500 active:translate-y-[1px] active:scale-[0.99] transition-all duration-fast">
                Sign up free
              </Link>
              <Link to="/onboarding" className="inline-flex items-center justify-center font-sans font-semibold text-[1rem] px-7 py-3 rounded-[6px] border border-[#F3EFE6]/25 bg-transparent text-[#F3EFE6] hover:bg-[#F3EFE6]/10 transition-all duration-fast">
                Contact us for enterprise pricing
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </PageShell>
  );
}
