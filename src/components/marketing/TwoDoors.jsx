import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Reveal, Stagger, StaggerItem } from "./Reveal";
import Icon from "../shared/Icon";

const patientBullets = [
  "Personalized to your conditions and goals",
  "Actionable -- you know the next step",
  "Free to start, premium when you want more",
];

const providerBullets = [
  "Better care, lower re-admission rates",
  "Higher compliance with prescribed therapy",
  "Integrates with telehealth, ACO and health-tech",
];

export default function TwoDoors() {
  return (
    <section id="providers" className="py-16 lg:py-24">
      <div className="mx-auto max-w-5xl container-px">
        <div className="text-center max-w-[64ch] mx-auto">
          <Reveal>
            <span className="text-[12px] font-label font-semibold tracking-eyebrow uppercase text-char-500">Two paths, one agent</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="display mt-5 text-[34px] leading-[1.1] sm:text-[48px] sm:leading-[1.08] lg:text-[64px] lg:leading-[1.06]">
              Built for the people living it --{" "}
              <em className="font-display italic font-normal text-forest-700">
                and the people treating it.
              </em>
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 text-[17px] leading-[1.6] font-sans text-char-500">
              The consumer product helps those in need. That same engine can be used to power health-tech partners.
            </p>
          </Reveal>
        </div>

        <Stagger className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-2">
          <StaggerItem>
            <motion.article
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
              className="h-full rounded-xl p-8 sm:p-10 bg-forest-700 flex flex-col shadow-card hover:shadow-md"
            >
              <span className="text-[12px] font-label font-semibold tracking-eyebrow uppercase text-yellow-400">
                For patients and caregivers
              </span>
              <h3 className="font-display font-medium tracking-tightish mt-4 text-[26px] sm:text-[30px] leading-[1.15] text-white">
                Take an active role in your health.
              </h3>
              <p className="mt-4 text-[15.5px] leading-[1.6] font-sans text-white/80 max-w-[42ch]">
                Guidance tailored to your profile, in plain language, easy to
                act on.
              </p>
              <ul className="mt-7 space-y-3.5">
                {patientBullets.map((b) => (
                  <li
                    key={b}
                    className="flex gap-3 text-[15px] leading-[1.5] font-sans text-white/90"
                  >
                    <Icon name="arrow-right" size={18} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/onboarding"
                className="mt-auto pt-8 inline-flex items-center gap-1.5 text-[14.5px] font-medium text-white border-b border-white/40 self-start hover:border-white transition-colors duration-base"
              >
                Start free
                <Icon name="arrow-right" size={16} />
              </Link>
            </motion.article>
          </StaggerItem>

          <StaggerItem>
            <motion.article
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
              className="h-full rounded-xl p-8 sm:p-10 bg-lavender-700 flex flex-col shadow-card hover:shadow-md"
            >
              <span className="text-[12px] font-label font-semibold tracking-eyebrow uppercase text-yellow-400">
                For providers and developers
              </span>
              <h3 className="font-display font-medium tracking-tightish mt-4 text-[26px] sm:text-[30px] leading-[1.15] text-white">
                The API behind better outcomes.
              </h3>
              <p className="mt-4 text-[15.5px] leading-[1.6] font-sans text-white/80 max-w-[42ch]">
                Engage patients in proactive management of their own conditions.
              </p>
              <ul className="mt-7 space-y-3.5">
                {providerBullets.map((b) => (
                  <li
                    key={b}
                    className="flex gap-3 text-[15px] leading-[1.5] font-sans text-white/90"
                  >
                    <Icon name="arrow-right" size={18} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#api"
                className="mt-auto pt-8 inline-flex items-center gap-1.5 text-[14.5px] font-medium text-white border-b border-white/40 self-start hover:border-white transition-colors duration-base"
              >
                Explore the API
                <Icon name="arrow-right" size={16} />
              </a>
            </motion.article>
          </StaggerItem>
        </Stagger>
      </div>
    </section>
  );
}
