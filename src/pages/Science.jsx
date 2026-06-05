import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import PageShell from "../components/PageShell";

// One "row" of the visual math. parts are joined by the operator symbol.
const mathRows = [
  {
    parts: [
      { value: "~90", label: "nutrients tracked per food item" },
      { value: "2,000+", label: "common foods" },
    ],
    op: "×",
    result: { value: "180,000", label: "nutrient facts", color: "text-[#3f6b48]" },
  },
  {
    parts: [
      { value: "180,000", label: "nutrient facts" },
      { value: "300+", label: "health conditions" },
    ],
    op: "×",
    result: { value: "600,000+", label: "interactions to compute", color: "text-steel" },
  },
  {
    parts: [
      { value: "600,000+", label: "interactions" },
      { value: "comorbidities,\nmedications, allergies", label: "" },
    ],
    op: "+",
    result: { value: "Impossible", label: "for any human to calculate in real time" },
    emphasizeResult: true,
  },
];

const sources = [
  {
    title: "Authoritative sources only",
    body: "NIH, USDA, MedLine/PubMed, EU health agencies, and leading US universities and clinics. No supplement industry funding. No conflicts of interest.",
    bar: "bg-herb",
  },
  {
    title: "Beyond the standard label",
    body: "We track ~90 nutrients and substances — including dozens the USDA doesn't measure: gluten, myo-inositol, mercury, purine, tyramine, and more.",
    bar: "bg-terra",
  },
  {
    title: "Continuously updated",
    body: "Our research team actively scans systematic reviews, clinical studies, and expert findings. Updates go live immediately — no app download required.",
    bar: "bg-steel",
  },
];

const dotColors = ["bg-herb", "bg-gold", "bg-terra", "bg-steel", "bg-clay"];

const footerBar = [
  "Peer-reviewed sources",
  "US Patent No. 8504385",
  "45,000+ patients served",
  "300+ conditions tracked",
  "Independent from product manufacturers",
];

function MathTerm({ value, label, big = false, emphasize = false, colorClass }) {
  const color = colorClass || (emphasize ? "text-gold" : "text-forest");
  return (
    <div className="text-center">
      <span
        className={`display block leading-[0.95] whitespace-pre-line ${color} ${
          big ? "text-[40px] sm:text-[56px]" : "text-[30px] sm:text-[40px]"
        }`}
      >
        {value}
      </span>
      {label && (
        <span className="mt-2 block text-[13px] sm:text-[14px] leading-[1.4] text-ink-soft max-w-[20ch] mx-auto">
          {label}
        </span>
      )}
    </div>
  );
}

export default function Science() {
  return (
    <PageShell>
      {/* Hero */}
      <section className="relative overflow-hidden bg-paper">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(201,151,58,0.20), transparent 70%)",
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
            <span className="tag">The Science</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="display mt-5 text-[34px] leading-[1.08] sm:text-[48px] sm:leading-[1.04] lg:text-[58px] lg:leading-[1.02] max-w-[20ch] mx-auto">
              The human body is too complex for{" "}
              <em className="font-display italic font-normal text-forest">human memory alone.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-7 text-[17px] sm:text-[18px] leading-[1.6] text-ink-soft max-w-[52ch] mx-auto">
              That's not a limitation of medicine. It's the problem we solved.
            </p>
          </Reveal>
        </div>
      </section>

      {/* The scale of the problem — visual math */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-5xl container-px">
          <Reveal>
            <h2 className="display text-[28px] leading-[1.12] sm:text-[40px] sm:leading-[1.06] text-center max-w-[24ch] mx-auto">
              Why no doctor, dietitian, or app has solved this —{" "}
              <em className="font-display italic font-normal text-forest">until now</em>
            </h2>
          </Reveal>

          <div className="mt-14 space-y-5">
            {mathRows.map((row, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div className="rounded-3xl bg-white border border-ink/[0.06] shadow-card px-6 py-10 sm:px-10">
                  <div className="flex flex-col lg:flex-row items-center justify-center gap-y-8 gap-x-6">
                    {row.parts.map((p, j) => (
                      <div key={j} className="flex items-center gap-6 lg:gap-8">
                        <MathTerm value={p.value} label={p.label} />
                        {j < row.parts.length - 1 && (
                          <span className="display text-[34px] sm:text-[44px] text-ink/25 leading-none">{row.op}</span>
                        )}
                      </div>
                    ))}

                    <span className="display text-[34px] sm:text-[44px] text-ink/25 leading-none">=</span>

                    <MathTerm
                      value={row.result.value}
                      label={row.result.label}
                      big
                      emphasize={row.emphasizeResult}
                      colorClass={row.result.color}
                    />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2}>
            <p className="mt-8 text-center text-[15px] sm:text-[16px] italic font-display text-ink-soft">
              This is what Nutri computes for each patient profile, instantly.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Where the data comes from */}
      <section className="py-16 lg:py-24 bg-herb/[0.08] border-y border-ink/[0.06]">
        <div className="mx-auto max-w-5xl container-px">
          <Reveal>
            <h2 className="display text-[30px] leading-[1.1] sm:text-[42px] sm:leading-[1.06] text-center mb-12">
              Where the data comes from
            </h2>
          </Reveal>
          <Stagger className="grid gap-5 sm:gap-6 md:grid-cols-3">
            {sources.map((s) => (
              <StaggerItem key={s.title}>
                <div className="h-full rounded-3xl bg-white border border-ink/[0.06] shadow-card overflow-hidden">
                  <span className={`block h-1.5 w-full ${s.bar}`} />
                  <div className="p-8">
                    <h3 className="display text-[20px] sm:text-[22px] leading-tight font-medium">{s.title}</h3>
                    <p className="mt-3 text-[15px] leading-[1.6] text-ink-soft">{s.body}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* The algorithm — forest band */}
      <section className="py-20 lg:py-28 bg-pine text-cream">
        <div className="mx-auto max-w-3xl container-px text-center">
          <Reveal>
            <h2 className="display text-[30px] leading-[1.12] sm:text-[44px] sm:leading-[1.05] text-cream">
              It's not a search engine.{" "}
              <em className="font-display italic font-normal text-gold">It's a reasoning engine.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-7 text-[17px] sm:text-[18px] leading-[1.7] text-cream/75">
              For each food item, our algorithms weigh every relevant nutrient — how much it helps one
              condition, how much it harms another, how two nutrients interact with each other — and produce
              a single, actionable answer: helpful, harmful, or somewhere in between. Specific to your profile.
              Available in seconds.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Credibility footer bar */}
      <section className="border-t border-ink/[0.08] bg-paper">
        <div className="mx-auto max-w-7xl container-px py-8">
          <Reveal>
            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-center">
              {footerBar.map((item, i) => (
                <li key={item} className="flex items-center gap-x-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${dotColors[i % dotColors.length]}`} aria-hidden />
                  <span className="text-[13.5px] sm:text-[14.5px] font-medium tracking-tight text-ink/75">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>
    </PageShell>
  );
}
