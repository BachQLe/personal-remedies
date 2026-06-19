import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Reveal, Stagger, StaggerItem } from "./Reveal";

const freeFeatures = [
  "Natural sources for 90+ nutrients",
  "Food facts and nutrient content",
  "Plain-language guidance",
  "No credit card required",
];

const premiumFeatures = [
  "Everything in Free",
  "Personal health profile across conditions",
  "Top do's and don'ts for your profile",
  "Choose this not that and suggestions for you",
  "7-day free trial -- no card to start",
];

export default function Pricing() {
  return (
    <section className="relative overflow-hidden py-16 lg:py-16 bg-paper-200">
      <div className="relative z-10 mx-auto max-w-7xl container-px">
        <div className="text-center max-w-[60ch] mx-auto">
          <Reveal>
            <span className="text-[12px] font-semibold tracking-eyebrow uppercase text-char-500">Simple, honest pricing</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="display mt-5 text-[34px] leading-[1.1] sm:text-[48px] sm:leading-[1.08] lg:text-[64px] lg:leading-[1.06]">
              Free is genuinely free.{" "}
              <em className="font-display italic font-normal text-forest-700">
                Premium is for when you want to optimize your living
              </em>
            </h2>
          </Reveal>
        </div>

        <Stagger className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          <StaggerItem>
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
              className="ds-card h-full p-8 sm:p-10 flex flex-col"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-[22px] font-medium tracking-tightish text-char-900">
                  Free
                </h3>
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-mono text-[54px] leading-none font-medium tabular-nums text-char-900">
                  $0
                </span>
                <span className="text-[14px] font-sans text-char-500">/forever</span>
              </div>
              <ul className="mt-8 space-y-3.5">
                {freeFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex gap-3 text-[15px] leading-[1.5] font-sans text-char-900"
                  >
                    <span className="mt-[3px] shrink-0 h-5 w-5 rounded-full flex items-center justify-center bg-forest-100 text-forest-700">
                      <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>check</span>
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/survey" className="pill-ghost mt-10">
                Start free
              </Link>
            </motion.div>
          </StaggerItem>

          <StaggerItem>
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
              className="relative h-full rounded-xl bg-forest-700 text-white p-8 sm:p-10 flex flex-col shadow-card hover:shadow-md"
            >
              <span className="absolute top-5 right-5 inline-flex items-center rounded-full bg-honey-600 text-white text-[11px] font-semibold tracking-eyebrow uppercase px-3 py-1">
                Most popular
              </span>
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-[22px] font-medium tracking-tightish text-white">
                  Premium
                </h3>
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-mono text-[54px] leading-none font-medium tabular-nums text-white">
                  $7.99
                </span>
                <span className="text-[14px] font-sans text-white/60">/year</span>
              </div>
              <ul className="mt-8 space-y-3.5">
                {premiumFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex gap-3 text-[15px] leading-[1.5] font-sans text-white/90"
                  >
                    <span className="mt-[3px] shrink-0 h-5 w-5 rounded-full flex items-center justify-center bg-honey-600/20 text-honey-600">
                      <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>check</span>
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/survey" className="pill-honey mt-10">
                Start free trial
              </Link>
            </motion.div>
          </StaggerItem>
        </Stagger>
      </div>
    </section>
  );
}
