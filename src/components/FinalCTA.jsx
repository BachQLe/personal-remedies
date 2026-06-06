import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Reveal } from "./Reveal";

export default function FinalCTA() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(
    scrollYProgress,
    [0, 0.35, 0.65, 1],
    [0.88, 1.06, 1.06, 0.94]
  );
  const y = useTransform(
    scrollYProgress,
    [0, 0.35, 0.65, 1],
    [40, 0, 0, 20]
  );
  const shadowBlur = useTransform(
    scrollYProgress,
    [0, 0.35, 0.65, 1],
    [0, 80, 80, 0]
  );
  const shadowOpacity = useTransform(
    scrollYProgress,
    [0, 0.35, 0.65, 1],
    [0, 0.4, 0.4, 0]
  );
  const boxShadow = useTransform(
    [shadowBlur, shadowOpacity],
    ([b, o]) => `0 ${b * 0.5}px ${b}px -12px rgba(0,0,0,${o})`
  );

  return (
    <motion.section
      ref={ref}
      id="start"
      className="relative overflow-hidden py-28 lg:py-40"
      style={{ scale, y, boxShadow }}
    >
      <div className="relative z-10 mx-auto max-w-3xl container-px text-center">
        <Reveal>
          <span className="tag">You don't have to manage this alone</span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="display mt-5 text-[36px] leading-[1.08] sm:text-[52px] sm:leading-[1.04] lg:text-[64px] lg:leading-[1.02]">
            Take your first step to a healthier life.{" "}
            <em className="font-display italic font-normal text-forest">
              Your first diet plan is on us.
            </em>
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mt-7 text-[17px] sm:text-[18px] leading-[1.55] text-ink-soft">
            No card. No appointment. No waiting room.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <Link
            to="/survey"
            className="pill-forest mt-10 inline-flex text-[16px] px-7 py-3"
          >
            Start free
          </Link>
        </Reveal>
      </div>
    </motion.section>
  );
}
