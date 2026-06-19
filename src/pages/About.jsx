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
  "bg-forest-50 text-forest-700",
  "bg-plum-50 text-plum-700",
  "bg-signal-info-tint text-signal-info",
  "bg-honey-50 text-honey-700",
  "bg-forest-100 text-forest-600",
];

export default function About() {
  return (
    <PageShell>
      {/* Hero */}
      <section className="bg-paper-200">
        <div className="mx-auto max-w-5xl container-px py-20 lg:py-28 text-center">
          <Reveal>
            <span className="tag">About us</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="display mt-5 text-[32px] leading-[1.08] sm:text-[46px] sm:leading-[1.08] lg:text-[54px] lg:leading-[1.08] max-w-[24ch] mx-auto">
              Built by people who believe food is the{" "}
              <em className="font-display italic font-normal text-forest-700">most underused medicine in the world.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-7 font-sans text-[17px] sm:text-[18px] leading-[1.6] text-char-500 max-w-[62ch] mx-auto">
              Personal Remedies was founded on a simple, hard problem: the dietary guidance that could help
              millions of people with chronic conditions doesn't reach them. We're fixing that.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 lg:py-28 bg-paper-200">
        <div className="mx-auto max-w-3xl container-px text-center">
          <Reveal>
            <span className="tag">Our mission</span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="display mt-4 text-[30px] leading-[1.08] sm:text-[40px] sm:leading-[1.08]">
              Why we exist
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-7 font-sans text-[17px] sm:text-[18px] leading-[1.65] text-char-500">
              Most people managing a chronic condition leave their doctor's office without knowing what to eat.
              Not because the science doesn't exist — it does. But because synthesizing 300+ conditions,
              90+ nutrients, thousands of food items, and each patient's unique combination of health issues is
              a computation no human can do in real time. We built the technology to do it for them.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Team grid */}
      <section className="py-16 lg:py-24 bg-paper-200 border-y border-sand-200">
        <div className="mx-auto max-w-5xl container-px">
          <Reveal>
            <span className="tag block text-center">Leadership</span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="display mt-4 text-[30px] leading-[1.08] sm:text-[42px] sm:leading-[1.08] text-center mb-12">
              The team
            </h2>
          </Reveal>
          <Stagger className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((m, i) => (
              <StaggerItem key={m.name}>
                <div
                  className={`h-full rounded-xl p-6 flex items-center gap-4 transition-all duration-base ease-ds-out ${
                    m.featured
                      ? "bg-forest-700 text-[#F3EFE6] border border-forest-800 shadow-card"
                      : "bg-white border border-sand-200 shadow-card"
                  }`}
                >
                  <span
                    className={`h-12 w-12 shrink-0 rounded-full flex items-center justify-center text-[15px] font-semibold tracking-tight ${
                      m.featured ? "bg-white/15 text-[#F3EFE6]" : avatarColors[i % avatarColors.length]
                    }`}
                  >
                    {initials(m.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-sans text-[15.5px] font-semibold tracking-tight ${m.featured ? "text-[#F3EFE6]" : "text-char-900"}`}>
                        {m.name}
                      </p>
                      {m.featured && (
                        <span className="text-[10px] font-semibold tracking-eyebrow uppercase px-2 py-0.5 rounded-full bg-honey-600 text-white">
                          Advisor
                        </span>
                      )}
                    </div>
                    <p className={`font-sans text-[13px] mt-0.5 ${m.featured ? "text-[#F3EFE6]/70" : "text-char-500"}`}>
                      {m.title}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Partners — inverted forest CTA band */}
      <section className="py-24 lg:py-32 bg-forest-700 text-[#F3EFE6]">
        <div className="mx-auto max-w-3xl container-px text-center">
          <Reveal>
            <h2 className="display text-[30px] leading-[1.08] sm:text-[44px] sm:leading-[1.08] text-[#F3EFE6]">
              Our{" "}
              <em className="font-display italic font-normal text-honey-600">partners</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 font-sans text-[17px] sm:text-[18px] leading-[1.65] text-[#F3EFE6]/75">
              We work with telehealth organizations, health-tech platforms, integrative medicine practices, and
              enterprise wellness programs. If your organization serves people with chronic conditions, we
              should talk.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <Link
              to="/providers"
              className="mt-9 inline-flex items-center gap-2 font-sans text-[16px] font-semibold px-7 py-3 rounded-pill bg-honey-600 text-white hover:bg-honey-700 transition-all duration-base ease-ds-out"
            >
              Become a partner
              <span className="material-symbols-rounded text-[20px]">arrow_forward</span>
            </Link>
          </Reveal>
        </div>
      </section>
    </PageShell>
  );
}
