import { Link } from "react-router-dom";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import PageShell from "../components/PageShell";

const stats = [
  { figure: "50%", label: "of US adults have at least one chronic condition", tint: "bg-herb/10", bar: "bg-herb", fig: "text-[#3f6b48]" },
  { figure: "75%", label: "of total healthcare costs come from chronic care", tint: "bg-terra/10", bar: "bg-terra", fig: "text-terra" },
  { figure: "80%", label: "of chronic patients would benefit meaningfully from dietary changes", tint: "bg-steel/10", bar: "bg-steel", fig: "text-steel" },
];

const offerings = [
  {
    icon: "🏷️",
    title: "White-label deployment",
    body: "Offer our platform under your own brand on every major app store.",
    chip: "bg-herb/15",
  },
  {
    icon: "🔌",
    title: "API integration",
    body: "Plug our Nutridigm knowledgebase directly into your existing patient portal or app.",
    chip: "bg-steel/15",
  },
  {
    icon: "🧬",
    title: "Condition depth no one else has",
    body: "300+ conditions, including complex comorbidities. Not just diabetes and obesity.",
    chip: "bg-terra/15",
  },
  {
    icon: "📈",
    title: "New revenue stream",
    body: "Package and price our capabilities as your own telehealth service offering.",
    chip: "bg-gold/15",
  },
];

const differentiators = [
  {
    title: "Personalized, not generic",
    body: "Guidance tied to each patient's exact profile: their conditions, medications, allergies, and health risks — together.",
    dot: "bg-herb",
  },
  {
    title: "Actionable, not encyclopedic",
    body: "Not a wall of text. Clear do's, don'ts, and swaps a patient can use today.",
    dot: "bg-gold",
  },
  {
    title: "Credible and independent",
    body: "No supplement sponsors. No product placements. Science-backed and conflict-free.",
    dot: "bg-terra",
  },
  {
    title: "Proven at scale",
    body: "Over 45,000 patients and consumers have used our knowledgebase. US Patent No. 8504385.",
    dot: "bg-steel",
  },
];

export default function Providers() {
  return (
    <PageShell>
      {/* Hero */}
      <section className="relative overflow-hidden bg-paper">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(122,158,126,0.22), transparent 70%)",
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
            <span className="tag">For Providers</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="display mt-5 text-[34px] leading-[1.08] sm:text-[48px] sm:leading-[1.04] lg:text-[58px] lg:leading-[1.02] max-w-[18ch] mx-auto">
              Better chronic care starts with{" "}
              <em className="font-display italic font-normal text-forest">better nutrition intelligence.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-7 text-[17px] sm:text-[18px] leading-[1.6] text-ink-soft max-w-[60ch] mx-auto">
              Half of US adults live with at least one chronic condition. The dietary guidance they need
              doesn't exist anywhere in your current stack — until now.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <Link to="/survey" className="pill-forest mt-9 inline-flex text-[16px] px-7 py-3">
              Talk to our team
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Problem — stat cards */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-5xl container-px">
          <Stagger className="grid gap-5 sm:gap-6 md:grid-cols-3">
            {stats.map((s) => (
              <StaggerItem key={s.figure}>
                <div className={`h-full rounded-3xl ${s.tint} border border-ink/[0.06] shadow-card overflow-hidden text-center flex flex-col`}>
                  <span className={`h-1.5 w-full ${s.bar}`} />
                  <div className="p-8 flex flex-col flex-1">
                    <span className={`display text-[56px] leading-none ${s.fig}`}>{s.figure}</span>
                    <p className="mt-4 text-[15px] leading-[1.5] text-ink-soft">{s.label}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal delay={0.2}>
            <p className="mt-6 text-center text-[12.5px] text-ink/45">
              Sources: US Dept. of Health &amp; Human Services, peer-reviewed literature
            </p>
          </Reveal>
        </div>
      </section>

      {/* Body copy block */}
      <section className="pb-4">
        <div className="mx-auto max-w-3xl container-px text-center">
          <Reveal>
            <h2 className="display text-[30px] leading-[1.12] sm:text-[40px] sm:leading-[1.06]">
              The gap your patients feel every day
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-[17px] sm:text-[18px] leading-[1.65] text-ink-soft">
              Most physicians don't have the time, the training, or the reimbursement structure to answer
              nutrition questions. Registered dietitians help — but they don't scale. The result: patients
              with Type 2 diabetes, hypertension, and three other conditions leave your office without knowing
              what to eat for lunch.
            </p>
          </Reveal>
        </div>
      </section>

      {/* What we offer */}
      <section className="py-16 lg:py-24 bg-clay/[0.06] border-y border-ink/[0.06]">
        <div className="mx-auto max-w-3xl container-px">
          <Reveal>
            <h2 className="display text-[28px] leading-[1.12] sm:text-[36px] sm:leading-[1.08] text-center mb-12">
              What we offer
            </h2>
          </Reveal>
          <Stagger className="space-y-4">
            {offerings.map((o) => (
              <StaggerItem key={o.title}>
                <div className="flex gap-5 rounded-2xl bg-white border border-ink/[0.06] shadow-card p-6 sm:p-7">
                  <span className={`h-12 w-12 shrink-0 rounded-xl ${o.chip} flex items-center justify-center text-[24px] leading-none`} aria-hidden>{o.icon}</span>
                  <div>
                    <h3 className="text-[17px] font-semibold tracking-tight text-ink">{o.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-[1.6] text-ink-soft">{o.body}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Differentiators — forest band */}
      <section className="py-20 lg:py-28 bg-pine text-cream">
        <div className="mx-auto max-w-5xl container-px">
          <Reveal>
            <h2 className="display text-[30px] leading-[1.1] sm:text-[42px] sm:leading-[1.06] text-center max-w-[20ch] mx-auto text-cream">
              Why providers choose{" "}
              <em className="font-display italic font-normal text-gold">Personal Remedies</em>
            </h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-5 sm:gap-6 md:grid-cols-2">
            {differentiators.map((d) => (
              <StaggerItem key={d.title}>
                <div className="h-full rounded-3xl bg-cream/[0.06] border border-cream/15 p-8">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${d.dot} mb-4`} />
                  <h3 className="display text-[20px] sm:text-[22px] leading-tight font-medium text-cream">{d.title}</h3>
                  <p className="mt-3 text-[15px] leading-[1.6] text-cream/70">{d.body}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 lg:py-32 bg-gold/[0.10]">
        <div className="mx-auto max-w-3xl container-px text-center">
          <Reveal>
            <h2 className="display text-[32px] leading-[1.08] sm:text-[46px] sm:leading-[1.04]">
              Let's talk about your{" "}
              <em className="font-display italic font-normal text-[#a9762a]">patient population.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-[17px] sm:text-[18px] leading-[1.6] text-ink-soft">
              We work with telehealth groups, integrative medicine practices, ACOs, and health-tech platforms.
              One conversation is enough to know if we're a fit.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <Link to="/survey" className="pill-forest mt-9 inline-flex text-[16px] px-7 py-3">
              Contact us
            </Link>
          </Reveal>
        </div>
      </section>
    </PageShell>
  );
}
