import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import PageShell from "../components/PageShell";

const mathRows = [
  {
    parts: [
      { value: "~90", label: "nutrients tracked per food item" },
      { value: "2,000+", label: "common foods" },
    ],
    op: "×",
    result: { value: "180,000", label: "nutrient facts", color: "text-forest-700" },
  },
  {
    parts: [
      { value: "180,000", label: "nutrient facts" },
      { value: "300+", label: "health conditions" },
    ],
    op: "×",
    result: { value: "600,000+", label: "interactions to compute", color: "text-signal-info" },
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
    icon: "menu_book",
    title: "Authoritative sources only",
    body: "NIH, USDA, MedLine/PubMed, EU health agencies, and leading US universities and clinics. No supplement industry funding. No conflicts of interest.",
  },
  {
    icon: "biotech",
    title: "Beyond the standard label",
    body: "We track ~90 nutrients and substances -- including dozens the USDA doesn't measure: gluten, myo-inositol, mercury, purine, tyramine, and more.",
  },
  {
    icon: "sync",
    title: "Continuously updated",
    body: "Our research team actively scans systematic reviews, clinical studies, and expert findings. Updates go live immediately -- no app download required.",
  },
];

const footerBar = [
  { text: "Peer-reviewed sources", icon: "verified" },
  { text: "US Patent No. 8504385", icon: "workspace_premium" },
  { text: "45,000+ patients served", icon: "groups" },
  { text: "300+ conditions tracked", icon: "monitoring" },
  { text: "Independent from product manufacturers", icon: "shield" },
];

function MathTerm({ value, label, big = false, emphasize = false, colorClass }) {
  const color = colorClass || (emphasize ? "text-honey-600" : "text-forest-700");
  return (
    <div className="text-center">
      <span
        className={`font-mono font-semibold block leading-[0.95] whitespace-pre-line ${color} ${
          big ? "text-[40px] sm:text-[56px]" : "text-[30px] sm:text-[40px]"
        }`}
      >
        {value}
      </span>
      {label && (
        <span className="mt-2 block font-sans text-[13px] sm:text-[14px] leading-[1.4] text-char-500 max-w-[20ch] mx-auto">
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
      <section className="bg-paper-200">
        <div className="mx-auto max-w-5xl container-px py-20 lg:py-28 text-center">
          <Reveal>
            <span className="tag">The science</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="display mt-5 text-[34px] leading-[1.08] sm:text-[48px] sm:leading-[1.08] lg:text-[58px] lg:leading-[1.08] max-w-[20ch] mx-auto">
              The human body is too complex for{" "}
              <em className="font-display italic font-normal text-forest-700">human memory alone.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-7 font-sans text-[17px] sm:text-[18px] leading-[1.6] text-char-500 max-w-[52ch] mx-auto">
              That's not a limitation of medicine. It's the problem we solved.
            </p>
          </Reveal>
        </div>
      </section>

      {/* The scale of the problem — visual math */}
      <section className="py-16 lg:py-24 bg-paper-200">
        <div className="mx-auto max-w-5xl container-px">
          <Reveal>
            <span className="tag block text-center">The problem</span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="display mt-4 text-[28px] leading-[1.08] sm:text-[40px] sm:leading-[1.08] text-center max-w-[24ch] mx-auto">
              Why no doctor, dietitian, or app has solved this --{" "}
              <em className="font-display italic font-normal text-forest-700">until now</em>
            </h2>
          </Reveal>

          <div className="mt-14 space-y-5">
            {mathRows.map((row, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div className="rounded-xl bg-white border border-sand-200 shadow-card px-6 py-10 sm:px-10">
                  <div className="flex flex-col lg:flex-row items-center justify-center gap-y-8 gap-x-6">
                    {row.parts.map((p, j) => (
                      <div key={j} className="flex items-center gap-6 lg:gap-8">
                        <MathTerm value={p.value} label={p.label} />
                        {j < row.parts.length - 1 && (
                          <span className="font-mono text-[34px] sm:text-[44px] text-char-300 leading-none">{row.op}</span>
                        )}
                      </div>
                    ))}

                    <span className="font-mono text-[34px] sm:text-[44px] text-char-300 leading-none">=</span>

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
            <p className="mt-8 text-center font-sans text-[15px] sm:text-[16px] italic text-char-500">
              This is what Nutri computes for each patient profile, instantly.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Where the data comes from */}
      <section className="py-16 lg:py-24 bg-paper-200 border-y border-sand-200">
        <div className="mx-auto max-w-5xl container-px">
          <Reveal>
            <span className="tag block text-center">Our data</span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="display mt-4 text-[30px] leading-[1.08] sm:text-[42px] sm:leading-[1.08] text-center mb-12">
              Where the data comes from
            </h2>
          </Reveal>
          <Stagger className="grid gap-5 sm:gap-6 md:grid-cols-3">
            {sources.map((s) => (
              <StaggerItem key={s.title}>
                <div className="h-full rounded-xl bg-white border border-sand-200 shadow-card p-8">
                  <span className="material-symbols-rounded text-[28px] text-forest-700 mb-4 block">{s.icon}</span>
                  <h3 className="display text-[20px] sm:text-[22px] leading-tight font-medium">{s.title}</h3>
                  <p className="mt-3 font-sans text-[15px] leading-[1.6] text-char-500">{s.body}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          {/* Study reference chips */}
          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {["NIH", "USDA", "PubMed", "EU Health Agencies"].map((ref) => (
                <span
                  key={ref}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-signal-info-tint text-signal-info text-[13px] font-semibold tracking-tight"
                >
                  <span className="material-symbols-rounded text-[16px]">link</span>
                  {ref}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* The algorithm — inverted forest band */}
      <section className="py-20 lg:py-28 bg-forest-700 text-[#F3EFE6]">
        <div className="mx-auto max-w-3xl container-px text-center">
          <Reveal>
            <h2 className="display text-[30px] leading-[1.08] sm:text-[44px] sm:leading-[1.08] text-[#F3EFE6]">
              It's not a search engine.{" "}
              <em className="font-display italic font-normal text-honey-600">It's a reasoning engine.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-7 font-sans text-[17px] sm:text-[18px] leading-[1.65] text-[#F3EFE6]/75">
              For each food item, our algorithms weigh every relevant nutrient -- how much it helps one
              condition, how much it harms another, how two nutrients interact with each other -- and produce
              a single, actionable answer: helpful, harmful, or somewhere in between. Specific to your profile.
              Available in seconds.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Credibility footer bar */}
      <section className="border-t border-sand-200 bg-paper-200">
        <div className="mx-auto max-w-7xl container-px py-8">
          <Reveal>
            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-center">
              {footerBar.map((item) => (
                <li key={item.text} className="flex items-center gap-x-2">
                  <span className="material-symbols-rounded text-[16px] text-forest-700" aria-hidden>{item.icon}</span>
                  <span className="font-sans text-[13.5px] sm:text-[14.5px] font-medium tracking-tight text-char-500">
                    {item.text}
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
