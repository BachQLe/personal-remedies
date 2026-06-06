import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Reveal } from "./Reveal";

function StatCounter({ end, suffix, label }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    const duration = 1500;
    const steps = 60;
    const increment = end / steps;
    let current = 0;
    let step = 0;

    const interval = setInterval(() => {
      step += 1;
      current = Math.floor(increment * step);
      if (current >= end) {
        current = end;
        clearInterval(interval);
      }
      setCount(current);
    }, duration / steps);

    return () => clearInterval(interval);
  }, [isInView, end]);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1">
      <div className="font-display text-[48px] sm:text-[56px] lg:text-[64px] leading-none font-medium tracking-tighter text-forest">
        {count.toLocaleString()}{suffix && <span className="text-amber ml-1">{suffix}</span>}
      </div>
      <p className="text-[13px] sm:text-[14px] text-ink/60 tracking-tight text-center">{label}</p>
    </div>
  );
}

export default function Stats() {
  return (
    <section className="py-16 lg:py-20 bg-white">
      <div className="mx-auto max-w-6xl container-px">
        <div className="text-center max-w-[60ch] mx-auto mb-16">
          <Reveal>
            <span className="tag">Built on evidence</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="display mt-5 text-[34px] leading-[1.1] sm:text-[44px] sm:leading-[1.06] lg:text-[52px] lg:leading-[1.04]">
              Powering better health decisions{" "}
              <em className="font-display italic font-normal text-forest">
                backed by real data
              </em>
            </h2>
          </Reveal>
        </div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{
            hidden: {},
            show: {
              transition: { staggerChildren: 0.15 },
            },
          }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6"
        >
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 40 },
              show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
            }}
          >
            <StatCounter end={45000} label="Patients Guided" />
          </motion.div>
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 40 },
              show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
            }}
          >
            <StatCounter end={300} suffix="+" label="Chronic Conditions" />
          </motion.div>
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 40 },
              show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
            }}
          >
            <StatCounter end={100000} suffix="+" label="Research Articles" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
