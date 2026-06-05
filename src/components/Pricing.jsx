import { Link } from "react-router-dom";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

function Check({ light }) {
  return (
    <span
      className={`mt-[3px] shrink-0 h-5 w-5 rounded-full flex items-center justify-center ${light ? "bg-amber/20 text-amber" : "bg-sage-soft text-forest"
        }`}
    >
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <path
          d="M1.5 5.5 4 8l5.5-6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

const freeFeatures = [
  "Natural sources for 90+ nutrients",
  "Food facts & nutrient content",
  "Plain-language guidance",
  "No credit card required",
];

const premiumFeatures = [
  "Everything in Free",
  "Personal Health Profile across conditions",
  "Top Do's & Don'ts for your profile",
  "Choose This Not That & Suggestions for You",
  "7-day free trial — no card to start",
];

export default function Pricing() {
  return (
    <section className="relative overflow-hidden py-16 lg:py-16" style={{ background: "#fffffaff" }}>
      {/* halftone dots */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.12]"
        style={{
          backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      />
      {/* grain */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.22]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />
      <div className="relative z-10 mx-auto max-w-7xl container-px">
        <div className="text-center max-w-[60ch] mx-auto">
          <Reveal>
            <span className="tag">Simple, honest pricing</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="display mt-5 text-[34px] leading-[1.1] sm:text-[44px] sm:leading-[1.06] lg:text-[52px] lg:leading-[1.04]">
              Free is genuinely free.{" "}
              <em className="font-display italic font-normal text-forest">
                Premium is for when you want to optimize your living
              </em>
            </h2>
          </Reveal>
        </div>

        <Stagger className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          <StaggerItem>
            <div className="h-full rounded-3xl bg-white border border-ink/[0.1] p-8 sm:p-10 flex flex-col">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-[22px] font-medium tracking-tightish">
                  Free
                </h3>
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-[54px] leading-none font-medium tracking-tighter2">
                  $0
                </span>
                <span className="text-[14px] text-ink-soft">/forever</span>
              </div>
              <ul className="mt-8 space-y-3.5">
                {freeFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex gap-3 text-[15px] leading-[1.5] text-ink"
                  >
                    <Check />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/survey" className="pill-ghost mt-10">
                Start free
              </Link>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="relative h-full rounded-3xl bg-forest text-cream p-8 sm:p-10 flex flex-col shadow-lift">
              <span className="absolute top-5 right-5 inline-flex items-center rounded-full bg-amber text-white text-[11px] font-semibold tracking-[0.14em] uppercase px-3 py-1">
                Most popular
              </span>
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-[22px] font-medium tracking-tightish text-cream">
                  Premium
                </h3>
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-[54px] leading-none font-medium tracking-tighter2 text-cream">
                  $7.99
                </span>
                <span className="text-[14px] text-cream/60">/year</span>
              </div>
              <ul className="mt-8 space-y-3.5">
                {premiumFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex gap-3 text-[15px] leading-[1.5] text-cream/90"
                  >
                    <Check light />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a href="#start" className="pill-amber mt-10">
                Start free trial
              </a>
            </div>
          </StaggerItem>
        </Stagger>
      </div>
    </section>
  );
}
