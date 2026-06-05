import { Link } from "react-router-dom";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import PageShell from "../components/PageShell";

const awards = [
  { title: "Best in Health API", sub: "API World 2024", chip: "bg-gold/15" },
  { title: "Breakthrough Startup Award", sub: "Food as Medicine 2025", chip: "bg-herb/15" },
  { title: "Digital Health Finalist", sub: "HLTH Conference 2025", chip: "bg-steel/15" },
  { title: "Top 14 AI APIs", sub: "Programmable Web — alongside Google, Amazon, IBM", chip: "bg-terra/15" },
];

const queryColors = ["bg-herb", "bg-steel", "bg-terra", "bg-gold"];

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
  "“Food is Medicine” organizations that need programmatic, condition-specific food guidance",
  "Health-tech and corporate wellness platforms addressing autoimmune, cancer, and behavioral conditions",
  "Recipe and content platforms that want to flag harmful ingredients for specific conditions",
];

export default function Developers() {
  return (
    <PageShell>
      {/* Hero */}
      <section className="relative overflow-hidden bg-paper">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(74,124,142,0.20), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.10]"
          style={{
            backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="relative mx-auto max-w-5xl container-px py-20 lg:py-28 text-center">
          <Reveal>
            <span className="tag">Nutridigm API by Personal Remedies</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="display mt-5 text-[34px] leading-[1.08] sm:text-[48px] sm:leading-[1.04] lg:text-[58px] lg:leading-[1.02] max-w-[20ch] mx-auto">
              The food-disease intelligence layer{" "}
              <em className="font-display italic font-normal text-forest">your platform is missing.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-7 text-[17px] sm:text-[18px] leading-[1.6] text-ink-soft max-w-[62ch] mx-auto">
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
      <section className="border-y border-ink/[0.08] bg-cream/50">
        <div className="mx-auto max-w-7xl container-px py-8">
          <Reveal>
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink/45 mb-5">Recognition</p>
          </Reveal>
          <Stagger className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {awards.map((a) => (
              <StaggerItem key={a.title}>
                <div className="flex items-start gap-3">
                  <span className={`h-9 w-9 shrink-0 rounded-lg ${a.chip} flex items-center justify-center text-[18px] leading-none`} aria-hidden>🏆</span>
                  <div>
                    <p className="text-[14.5px] font-semibold tracking-tight text-ink leading-snug">{a.title}</p>
                    <p className="text-[12.5px] text-ink/50 mt-0.5">{a.sub}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* What the API does */}
      <section id="docs" className="py-16 lg:py-24">
        <div className="mx-auto max-w-5xl container-px">
          <Reveal>
            <h2 className="display text-[30px] leading-[1.1] sm:text-[42px] sm:leading-[1.06] text-center max-w-[24ch] mx-auto">
              Four questions the Nutridigm API answers{" "}
              <em className="font-display italic font-normal text-forest">instantly</em>
            </h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-5 sm:gap-6 md:grid-cols-2">
            {queries.map((c, i) => (
              <StaggerItem key={i}>
                <div className="h-full rounded-3xl bg-white border border-ink/[0.06] shadow-card p-7">
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className={`h-6 w-6 rounded-full ${queryColors[i]} text-white text-[12px] font-semibold flex items-center justify-center shrink-0`}>
                      {i + 1}
                    </span>
                    <span className="text-[11px] font-semibold tracking-widest uppercase text-ink/35">Query</span>
                  </div>
                  <p className="font-display text-[19px] sm:text-[21px] leading-snug text-ink font-medium">
                    {c.q}
                  </p>
                  <p className="mt-3 text-[14.5px] leading-[1.6] text-ink-soft">{c.a}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal delay={0.2}>
            <p className="mt-7 text-center text-[14px] text-ink/55 max-w-[64ch] mx-auto">
              Queries support combinations of multiple conditions simultaneously — the feature no other API offers.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-16 lg:py-24 bg-steel/[0.07] border-y border-ink/[0.06]">
        <div className="mx-auto max-w-3xl container-px">
          <Reveal>
            <h2 className="display text-[28px] leading-[1.12] sm:text-[38px] sm:leading-[1.06] text-center mb-12">
              Who's already using it
            </h2>
          </Reveal>
          <Stagger className="space-y-3">
            {useCases.map((u, i) => (
              <StaggerItem key={i}>
                <div className="flex gap-4 rounded-2xl bg-white border border-ink/[0.06] p-5 sm:p-6 border-l-[3px] border-l-steel">
                  <span className="mt-[3px] shrink-0 text-steel" aria-hidden>
                    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                      <path d="M1 6h13M9 1l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <p className="text-[15.5px] leading-[1.55] text-ink">{u}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA — forest band */}
      <section className="py-24 lg:py-32 bg-pine text-cream">
        <div className="mx-auto max-w-3xl container-px text-center">
          <Reveal>
            <h2 className="display text-[32px] leading-[1.08] sm:text-[46px] sm:leading-[1.04] text-cream">
              Start with a{" "}
              <em className="font-display italic font-normal text-gold">free account.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-[17px] sm:text-[18px] leading-[1.6] text-cream/75">
              Explore the knowledgebase, test queries, and see what's possible before you commit to a plan.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link to="/survey" className="pill-amber text-[16px] px-7 py-3">
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
