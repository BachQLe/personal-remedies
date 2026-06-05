import { Link } from "react-router-dom";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import PageShell from "../components/PageShell";

const team = [
  { name: "Mory Bahar", title: "President & CEO" },
  { name: "Andrew Lenhardt, MD", title: "Medical Director" },
  { name: "Katya Tsaioun, PhD", title: "Chief Scientific Advisor" },
  { name: "Frank Slootman", title: "Mentor & Advisor", featured: true },
  { name: "Art McCray", title: "VP, Product Development" },
  { name: "George Sprenkle", title: "Co-Founder & CFO" },
  { name: "Amanda Turton Huff", title: "Functional Nutritionist" },
  { name: "Bruce Gomberg, MD MA", title: "Clinical Advisor" },
  { name: "Eric Egnet", title: "Technology & Business Advisor" },
  { name: "Guido Colombo", title: "Strategic Partner" },
  { name: "Duncan McClain", title: "Biz Dev & Marketing Advisor" },
  { name: "Chris Stakutis", title: "VP, Nutridigm Engineering" },
];

function initials(name) {
  const parts = name.replace(/,.*$/, "").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase();
}

const avatarColors = [
  "bg-herb/15 text-[#3f6b48]",
  "bg-terra/15 text-terra",
  "bg-steel/15 text-steel",
  "bg-gold/15 text-[#a9762a]",
  "bg-clay/15 text-clay",
];

export default function About() {
  return (
    <PageShell>
      {/* Hero */}
      <section className="relative overflow-hidden bg-paper">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(196,113,90,0.18), transparent 70%)",
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
            <span className="tag">About Us</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="display mt-5 text-[32px] leading-[1.1] sm:text-[46px] sm:leading-[1.05] lg:text-[54px] lg:leading-[1.03] max-w-[24ch] mx-auto">
              Built by people who believe food is the{" "}
              <em className="font-display italic font-normal text-forest">most underused medicine in the world.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-7 text-[17px] sm:text-[18px] leading-[1.6] text-ink-soft max-w-[62ch] mx-auto">
              Personal Remedies was founded on a simple, hard problem: the dietary guidance that could help
              millions of people with chronic conditions doesn't reach them. We're fixing that.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-3xl container-px text-center">
          <Reveal>
            <h2 className="display text-[30px] leading-[1.12] sm:text-[40px] sm:leading-[1.06]">
              Why we exist
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-7 text-[17px] sm:text-[18px] leading-[1.7] text-ink-soft">
              Most people managing a chronic condition leave their doctor's office without knowing what to eat.
              Not because the science doesn't exist — it does. But because synthesizing 300+ conditions,
              90+ nutrients, thousands of food items, and each patient's unique combination of health issues is
              a computation no human can do in real time. We built the technology to do it for them.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Team grid */}
      <section className="py-16 lg:py-24 bg-clay/[0.06] border-y border-ink/[0.06]">
        <div className="mx-auto max-w-5xl container-px">
          <Reveal>
            <h2 className="display text-[30px] leading-[1.1] sm:text-[42px] sm:leading-[1.06] text-center mb-12">
              The team
            </h2>
          </Reveal>
          <Stagger className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((m, i) => (
              <StaggerItem key={m.name}>
                <div
                  className={`h-full rounded-2xl p-6 flex items-center gap-4 transition ${
                    m.featured
                      ? "bg-pine text-cream border border-pine shadow-lift"
                      : "bg-white border border-ink/[0.06] shadow-card"
                  }`}
                >
                  <span
                    className={`h-12 w-12 shrink-0 rounded-full flex items-center justify-center text-[15px] font-semibold tracking-tight ${
                      m.featured ? "bg-cream/15 text-cream" : avatarColors[i % avatarColors.length]
                    }`}
                  >
                    {initials(m.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-[15.5px] font-semibold tracking-tight ${m.featured ? "text-cream" : "text-ink"}`}>
                        {m.name}
                      </p>
                      {m.featured && (
                        <span className="text-[10px] font-semibold tracking-[0.14em] uppercase px-2 py-0.5 rounded-full bg-amber text-white">
                          Advisor
                        </span>
                      )}
                    </div>
                    <p className={`text-[13px] mt-0.5 ${m.featured ? "text-cream/70" : "text-ink/55"}`}>
                      {m.title}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Partners — forest band */}
      <section className="py-24 lg:py-32 bg-pine text-cream">
        <div className="mx-auto max-w-3xl container-px text-center">
          <Reveal>
            <h2 className="display text-[30px] leading-[1.1] sm:text-[44px] sm:leading-[1.05] text-cream">
              Our{" "}
              <em className="font-display italic font-normal text-gold">partners</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-[17px] sm:text-[18px] leading-[1.65] text-cream/75">
              We work with telehealth organizations, health-tech platforms, integrative medicine practices, and
              enterprise wellness programs. If your organization serves people with chronic conditions, we
              should talk.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <Link to="/providers" className="pill-amber mt-9 inline-flex text-[16px] px-7 py-3">
              Become a partner
            </Link>
          </Reveal>
        </div>
      </section>
    </PageShell>
  );
}
