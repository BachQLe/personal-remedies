import { Link } from "react-router-dom";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

function Arrow({ color = "text-forest" }) {
  return (
    <span className={`mt-[7px] shrink-0 ${color}`}>
      <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden>
        <path
          d="M1 6h13M9 1l5 5-5 5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

const patientBullets = [
  "Personalized to your conditions and goals",
  "Actionable — you know the next step",
  "Free to start, premium when you want more",
];

const providerBullets = [
  "Better care, lower re-admission rates",
  "Higher compliance with prescribed therapy",
  "Integrates with telehealth, ACO & health-tech",
];

export default function TwoDoors() {
  return (
    <section id="providers" className="py-16 lg:py-24">
      <div className="mx-auto max-w-5xl container-px">
        <div className="text-center max-w-[64ch] mx-auto">
          <Reveal>
            <span className="tag">Two paths, one agent</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="display mt-5 text-[34px] leading-[1.1] sm:text-[44px] sm:leading-[1.06] lg:text-[54px] lg:leading-[1.04]">
              Built for the people living it —{" "}
              <em className="font-display italic font-normal text-forest">
                and the people treating it.
              </em>
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 text-[17px] leading-[1.6] text-ink-soft">
              The consumer product helps those in need. That same engine can be used to power health-tech partners.
            </p>
          </Reveal>
        </div>

        <Stagger className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-2">
          <StaggerItem>
            <article className="h-full rounded-3xl p-8 sm:p-10 border border-ink/[0.05] flex flex-col" style={{ backgroundColor: "#C4715A" }}>
              <span className="tag text-white">For Patients &amp; Caregivers</span>
              <h3 className="display mt-4 text-[26px] sm:text-[30px] leading-[1.15] font-medium text-white">
                Take an active role in your health.
              </h3>
              <p className="mt-4 text-[15.5px] leading-[1.6] text-white max-w-[42ch]">
                Guidance tailored to your profile, in plain language, easy to
                act on.
              </p>
              <ul className="mt-7 space-y-3.5">
                {patientBullets.map((b) => (
                  <li
                    key={b}
                    className="flex gap-3 text-[15px] leading-[1.5] text-white"
                  >
                    <Arrow color="text-white" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/survey"
                className="mt-auto pt-8 inline-flex items-center gap-1.5 text-[14.5px] font-medium text-white border-b border-white/40 self-start hover:border-white transition"
              >
                Start free <span aria-hidden>→</span>
              </Link>
            </article>
          </StaggerItem>

          <StaggerItem>
            <article className="h-full rounded-3xl p-8 sm:p-10 border border-ink/[0.05] flex flex-col" style={{ backgroundColor: "#4A7C8E" }}>
              <span className="tag text-white">For Providers &amp; Developers</span>
              <h3 className="display mt-4 text-[26px] sm:text-[30px] leading-[1.15] font-medium text-white">
                The API behind better outcomes.
              </h3>
              <p className="mt-4 text-[15.5px] leading-[1.6] text-white max-w-[42ch]">
                Engage patients in proactive management of their own conditions.
              </p>
              <ul className="mt-7 space-y-3.5">
                {providerBullets.map((b) => (
                  <li
                    key={b}
                    className="flex gap-3 text-[15px] leading-[1.5] text-white"
                  >
                    <Arrow color="text-white" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#api"
                className="mt-auto pt-8 inline-flex items-center gap-1.5 text-[14.5px] font-medium text-white border-b border-white/40 self-start hover:border-white transition"
              >
                Explore the API <span aria-hidden>→</span>
              </a>
            </article>
          </StaggerItem>
        </Stagger>
      </div>
    </section>
  );
}
