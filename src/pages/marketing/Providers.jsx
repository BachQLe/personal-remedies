import { Link } from "react-router-dom";
import { Reveal, Stagger, StaggerItem } from "../../components/marketing/Reveal";
import PageShell from "../../components/marketing/PageShell";
import Icon from "../../components/shared/Icon";

const stats = [
  { figure: "50%", label: "of US adults have at least one chronic condition" },
  { figure: "75%", label: "of total healthcare costs come from chronic care" },
];

const offerings = [
  {
    icon: "shopping-cart",
    title: "White-label deployment",
    body: "Offer our platform under your own brand on every major app store.",
  },
  {
    icon: "globe",
    title: "API integration",
    body: "Plug our Nutridigm knowledgebase directly into your existing patient portal or app.",
  },
  {
    icon: "book-open",
    title: "Condition depth no one else has",
    body: "300+ conditions, including complex comorbidities. Not just diabetes and obesity.",
  },
  {
    icon: "trending-up",
    title: "New revenue stream",
    body: "Package and price our capabilities as your own telehealth service offering.",
  },
];

const differentiators = [
  {
    icon: "user",
    title: "Personalized, not generic",
    body: "Guidance tied to each patient's exact profile: their conditions, medications, allergies, and health risks — together.",
  },
  {
    icon: "check",
    title: "Actionable, not encyclopedic",
    body: "Not a wall of text. Clear do's, don'ts, and swaps a patient can use today.",
  },
  {
    icon: "award",
    title: "Credible and independent",
    body: "No supplement sponsors. No product placements. Science-backed and conflict-free.",
  },
  {
    icon: "shield",
    title: "Patented and proprietary",
    body: "Ranks foods against a condition profile. Backed by US Patent No. 8504385 — a legal moat you can't get anywhere else in nutrition.",
  },
];

export default function Providers() {
  return (
    <PageShell>
      {/* Hero */}
      <section className="relative overflow-hidden bg-paper-200">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(30,71,54,0.12), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl container-px py-20 lg:py-28 text-center">
          <Reveal>
            <span className="font-label text-[12px] font-semibold tracking-[.14em] uppercase text-char-500">For providers</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="font-display font-semibold tracking-[-0.02em] mt-5 text-[34px] leading-[1.08] sm:text-[48px] sm:leading-[1.04] lg:text-[58px] lg:leading-[1.02] max-w-[18ch] mx-auto text-blue-950">
              Better chronic care starts with{" "}
              <em className="font-display italic font-normal text-forest-700">better nutrition intelligence.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-7 text-[17px] sm:text-[18px] leading-[1.6] text-char-500 max-w-[60ch] mx-auto font-sans">
              Half of US adults live with at least one chronic condition. The dietary guidance they need
              doesn't exist anywhere in your current stack — until now.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <Link to="/onboarding" className="mt-9 inline-flex items-center justify-center font-sans font-semibold text-[16px] px-7 py-3 rounded-[6px] bg-forest-700 text-[#F3EFE6] hover:bg-forest-800 active:translate-y-[1px] active:scale-[0.99] transition-all duration-fast">
              Talk to our team
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Problem — stat cards */}
      <section className="py-16 lg:py-24 bg-paper-200">
        <div className="mx-auto max-w-5xl container-px">
          <Stagger className="grid gap-5 sm:gap-6 md:grid-cols-3">
            {stats.map((s) => (
              <StaggerItem key={s.figure}>
                <div className="bg-white rounded-[28px] border border-sand-200 shadow-card h-full overflow-hidden text-center flex flex-col p-8">
                  <span className="font-mono text-[56px] leading-none tabular-nums text-forest-700 font-semibold">{s.figure}</span>
                  <p className="mt-4 text-[15px] leading-[1.5] text-char-500 font-sans">{s.label}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal delay={0.2}>
            <p className="mt-6 text-center font-label text-[12px] tracking-[.14em] uppercase text-char-500">
              Sources: US Dept. of Health &amp; Human Services, peer-reviewed literature
            </p>
          </Reveal>
        </div>
      </section>

      {/* Body copy block */}
      <section className="pb-4 bg-paper-200">
        <div className="mx-auto max-w-3xl container-px text-center">
          <Reveal>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[30px] leading-[1.12] sm:text-[40px] sm:leading-[1.06] text-blue-950">
              The gap your patients feel every day
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-[17px] sm:text-[18px] leading-[1.65] text-char-500 font-sans">
              Most physicians don't have the time, the training, or the reimbursement structure to answer
              nutrition questions. Registered dietitians help — but they don't scale. The result: patients
              with Type 2 diabetes, hypertension, and three other conditions leave your office without knowing
              what to eat for lunch.
            </p>
          </Reveal>
        </div>
      </section>

      {/* What we offer */}
      <section className="py-16 lg:py-24 bg-paper-100 border-y border-sand-200">
        <div className="mx-auto max-w-3xl container-px">
          <Reveal>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[28px] leading-[1.12] sm:text-[36px] sm:leading-[1.08] text-center mb-12 text-blue-950">
              What we offer
            </h2>
          </Reveal>
          <Stagger className="space-y-4">
            {offerings.map((o) => (
              <StaggerItem key={o.title}>
                <div className="bg-white rounded-[28px] border border-sand-200 shadow-card flex gap-5 p-6 sm:p-7">
                  <div className="h-12 w-12 shrink-0 rounded-[14px] bg-forest-100 flex items-center justify-center" aria-hidden>
                    <Icon name={o.icon} size={24} className="text-forest-700" />
                  </div>
                  <div>
                    <h3 className="text-[17px] font-semibold tracking-tightish text-char-900 font-sans">{o.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-[1.6] text-char-500 font-sans">{o.body}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Differentiators — forest band */}
      <section className="py-20 lg:py-28 bg-forest-900">
        <div className="mx-auto max-w-5xl container-px">
          <Reveal>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[30px] leading-[1.1] sm:text-[42px] sm:leading-[1.06] text-center max-w-[20ch] mx-auto text-[#F3EFE6]">
              Why providers choose{" "}
              <em className="font-display italic font-normal text-yellow-400">Personal Remedies</em>
            </h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-5 sm:gap-6 md:grid-cols-2">
            {differentiators.map((d) => (
              <StaggerItem key={d.title}>
                <div className="h-full rounded-[28px] bg-[#F3EFE6]/[0.06] border border-[#F3EFE6]/15 p-8">
                  <Icon name={d.icon} size={28} className="text-yellow-400 mb-4 block" />
                  <h3 className="font-display font-semibold text-[20px] sm:text-[22px] leading-tight text-[#F3EFE6]">{d.title}</h3>
                  <p className="mt-3 text-[15px] leading-[1.6] text-[#F3EFE6]/70 font-sans">{d.body}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 lg:py-32 bg-paper-200">
        <div className="mx-auto max-w-3xl container-px text-center">
          <Reveal>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[32px] leading-[1.08] sm:text-[46px] sm:leading-[1.04] text-blue-950">
              Let's talk about your{" "}
              <em className="font-display italic font-normal text-lavender-700">patient population.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-[17px] sm:text-[18px] leading-[1.6] text-char-500 font-sans">
              We work with telehealth groups, integrative medicine practices, ACOs, and health-tech platforms.
              One conversation is enough to know if we're a fit.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <Link to="/onboarding" className="mt-9 inline-flex items-center justify-center font-sans font-semibold text-[16px] px-7 py-3 rounded-[6px] bg-forest-700 text-[#F3EFE6] hover:bg-forest-800 active:translate-y-[1px] active:scale-[0.99] transition-all duration-fast">
              Contact us
            </Link>
          </Reveal>
        </div>
      </section>
    </PageShell>
  );
}
