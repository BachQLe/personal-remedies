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
      className="relative rounded-xl overflow-hidden border border-white/10"
      style={{ height: 280, perspective: "520px" }}
    >
      {/* slot window bg */}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.25)" }} />

      {/* top fade */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 z-10 h-24 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, #111e17, transparent)" }}
      />
      {/* bottom fade */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 z-10 h-24 pointer-events-none"
        style={{ background: "linear-gradient(to top, #111e17, transparent)" }}
      />

      {/* center active-row highlight */}
      <div
        aria-hidden
        className="absolute inset-x-4 z-10 pointer-events-none rounded-lg"
        style={{
          top: "50%",
          transform: "translateY(-50%)",
          height: FACE_H,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      />

      {/* 3-D drum — perspective lives on the parent above, not here */}
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
              <span
                className="text-[10px] font-bold tracking-widest uppercase"
                style={{ color: "rgba(217,138,74,0.85)" }}
              >
                {paper.journal}
              </span>
              <span className="text-[10px]" style={{ color: "rgba(245,242,234,0.3)" }}>
                {paper.year}
              </span>
            </div>
            <p
              className="text-[13px] leading-[1.45] font-medium"
              style={{ color: "rgba(245,242,234,0.88)" }}
            >
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
    <section className="relative overflow-hidden py-8 lg:py-12" style={{ background: "#fffffaff" }}>
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.12]"
        style={{
          backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      />
      <div className="relative mx-auto max-w-6xl container-px">
        <div
          className="relative overflow-hidden rounded-sm px-8 py-4 lg:px-14 lg:py-24"
          style={{ background: "#1a3528" }}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-60 pointer-events-none"
            style={{
              background:
                "radial-gradient(50% 50% at 12% 0%, rgba(31,74,58,0.9) 0%, rgba(22,53,40,0) 70%), radial-gradient(40% 50% at 90% 100%, rgba(217,138,74,0.18) 0%, rgba(22,53,40,0) 70%)",
            }}
          />

          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* LEFT — headline copy */}
            <div>
              <Reveal>
                <span className="tag tag-amber">Meet Nutri, your AI dietician</span>
              </Reveal>
              <Reveal delay={0.1}>
                <h2 className="display mt-5 text-[34px] leading-[1.1] sm:text-[44px] sm:leading-[1.06] lg:text-[50px] lg:leading-[1.04] text-cream">
                  We read 100,000+ studies {" "}
                  <em className="font-display italic font-normal text-amber">
                    so you don't have to
                  </em>
                </h2>
              </Reveal>
              <Reveal delay={0.18}>
                <p className="mt-6 text-[12px] sm:text-[14px] leading-[1.6] text-cream/75">
                  Nutri shows you the everyday foods that can reverse your chronic conditions — the same everyday foods medical companies can't monetize.
                </p>
              </Reveal>
            </div>

            {/* RIGHT — rolling paper wheel */}
            <Reveal delay={0.22}>
              <div className="flex flex-col gap-3">
                <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-cream/35">
                  100,000+ peer-reviewed studies
                </p>
                <PaperWheel />
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
