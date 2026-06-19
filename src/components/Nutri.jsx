import { motion } from "framer-motion";
import { Reveal } from "./Reveal";

const PAPERS = [
  { journal: "Harvard Medical School", year: 2023, title: "Curcumin supplementation reduces HbA1c in type 2 diabetes patients" },
  { journal: "Nature Medicine", year: 2022, title: "Polyphenol-rich diets reshape gut microbiome and reduce inflammation markers" },
  { journal: "Yale School of Medicine", year: 2021, title: "Mediterranean diet intervention reverses metabolic syndrome in adults" },
  { journal: "The Lancet", year: 2023, title: "Aged garlic extract reduces systolic blood pressure by 10 mmHg" },
  { journal: "Columbia University", year: 2022, title: "Omega-3 fatty acids suppress chronic low-grade systemic inflammation" },
  { journal: "JAMA", year: 2023, title: "Dietary fiber intake inversely associated with cardiovascular events" },
  { journal: "Princeton University", year: 2021, title: "Blueberry anthocyanins improve insulin sensitivity in overweight adults" },
  { journal: "Cell Metabolism", year: 2022, title: "Whole-food plant-based diet reduces all-cause mortality by 23%" },
  { journal: "Cornell University", year: 2023, title: "Fermented foods increase microbiome diversity and lower inflammatory markers" },
  { journal: "N Engl J Med", year: 2022, title: "Time-restricted eating improves cardiometabolic health independent of calories" },
  { journal: "Dartmouth College", year: 2023, title: "Sulforaphane from broccoli activates Nrf2 anti-inflammatory pathway" },
  { journal: "Science", year: 2022, title: "Prebiotic fiber selectively feeds beneficial Bifidobacterium species" },
  { journal: "Penn Medicine", year: 2023, title: "Quercetin-rich foods reduce oxidative stress in hypertensive patients" },
  { journal: "BMJ", year: 2021, title: "Magnesium-rich diet lowers risk of type 2 diabetes by 19%" },
  { journal: "Brown University", year: 2022, title: "Green tea catechins improve lipid profiles across metabolic subtypes" },
  { journal: "Cell", year: 2023, title: "Walnuts modulate gut flora and reduce LDL cholesterol after 8 weeks" },
];

const N = PAPERS.length;
const FACE_H = 76;
const RADIUS = Math.round((FACE_H / 2) / Math.tan(Math.PI / N));
const DURATION = N * 2.2;

function PaperWheel() {
  return (
    <div
      className="relative rounded-xl overflow-hidden border border-sand-200"
      style={{ height: 280, perspective: "520px", background: "#ffffff" }}
    >
      {/* top fade */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 z-10 h-24 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,1), transparent)" }}
      />
      {/* bottom fade */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 z-10 h-24 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(255,255,255,1), transparent)" }}
      />

      {/* center active-row highlight */}
      <div
        aria-hidden
        className="absolute inset-x-4 z-10 pointer-events-none rounded-lg border border-sand-200"
        style={{
          top: "50%",
          transform: "translateY(-50%)",
          height: FACE_H,
          background: "rgba(245, 245, 240, 0.5)",
        }}
      />

      {/* 3-D drum */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          transformStyle: "preserve-3d",
          animation: `nutri-wheel ${DURATION}s linear infinite`,
        }}
      >
        {PAPERS.map((paper, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: FACE_H,
              top: -(FACE_H / 2),
              transform: `rotateX(${i * (360 / N)}deg) translateZ(${RADIUS}px)`,
              backfaceVisibility: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "0 20px",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold tracking-eyebrow uppercase text-honey-600">
                {paper.journal}
              </span>
              <span className="text-[10px] font-mono tabular-nums text-char-400">
                {paper.year}
              </span>
            </div>
            <p className="text-[13px] leading-[1.45] font-sans font-medium text-char-900">
              {paper.title}
            </p>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes nutri-wheel {
          from { transform: rotateX(0deg); }
          to   { transform: rotateX(-360deg); }
        }
      `}</style>
    </div>
  );
}

export default function Nutri() {
  return (
    <section className="relative overflow-hidden py-8 lg:py-12 bg-paper-200">
      <div
        className="relative mx-auto max-w-7xl overflow-hidden px-8 py-4 lg:px-14 lg:py-24"
      >
        <div className="relative mx-auto max-w-7xl container-px">
          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* LEFT -- headline copy */}
            <div>
              <Reveal>
                <span className="text-[12px] font-semibold tracking-eyebrow uppercase text-char-500">Meet Nutri, your AI dietician</span>
              </Reveal>
              <Reveal delay={0.1}>
                <h2 className="display mt-5 text-[34px] leading-[1.1] sm:text-[48px] sm:leading-[1.08] lg:text-[64px] lg:leading-[1.06] text-char-900">
                  We read <span className="font-mono tabular-nums">100,000</span>+ studies{" "}
                  <em className="font-display italic font-normal text-forest-700">
                    so you don't have to
                  </em>
                </h2>
              </Reveal>
              <Reveal delay={0.18}>
                <p className="mt-3 font-sans text-[18px] sm:text-[20px] text-char-500 tracking-tight leading-[1.5]">
                  Nutri shows you the everyday foods that can help your chronic conditions -- the same everyday foods medical companies can't monetize.
                </p>
              </Reveal>
            </div>

            {/* RIGHT -- rolling paper wheel */}
            <div className="relative py-10 px-5">
              <div className="absolute inset-0 pointer-events-none" style={{
                perspective: '1200px',
                transformStyle: 'preserve-3d',
                zIndex: 1,
              }}>
                <div className="absolute inset-0 rounded-xl border border-sand-200" style={{
                  transform: 'translateZ(20px)',
                  background: 'linear-gradient(to right, var(--forest-700, #1E4736) 0%, var(--forest-500, #3A7058) 100%)',
                }} />
              </div>
              <motion.div
                className="flex flex-col gap-3 relative z-10"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
              >
                <p className="text-[12px] font-semibold tracking-eyebrow uppercase text-white/75">
                  <span className="font-mono tabular-nums">100,000</span>+ peer-reviewed studies
                </p>
                <PaperWheel />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
