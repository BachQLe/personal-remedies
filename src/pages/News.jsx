import { Link } from "react-router-dom";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import PageShell from "../components/PageShell";

// newest first. `to` = internal route, `href` = external. omit both for a plain card.
const news = [
  {
    date: "Oct 1, 2025",
    title: "Announcing Nutridigm API Release 3.0",
    desc: "A major update to our food-disease interaction knowledgebase.",
  },
  {
    date: "Oct 15, 2025",
    title: "Support Notes: Food as Medicine App Series",
    desc: "Usage guidance for our updated apps for chronic conditions and comorbidities.",
    to: "/support-notes",
  },
  {
    date: "Apr 13, 2021",
    title: "Complex Health Solutions Partners with Personal Remedies",
    desc: "Patients can now address root causes through dietary measures via this partnership.",
  },
  {
    date: "Dec 22, 2020",
    title: "This Founder Has Built a Personalized Food Knowledge Base for People With Chronic Illnesses",
    desc: "Coverage of Mory Bahar and the Personal Remedies mission.",
  },
  {
    date: "Nov 24, 2020",
    title: "Radio Entrepreneurs Interviews Mory Bahar",
    desc: "“Fully Automated & Personalized Diet Plans for Multiple Illnesses.”",
  },
  {
    date: "Jan 14, 2020",
    title: "StartUp Health TV Interview with Mory Bahar",
    desc: "Interview at the 2020 StartUp Health Festival in San Francisco.",
  },
];

const awards = [
  { title: "Best in Health API", sub: "API World 2024", chip: "bg-gold/15" },
  { title: "Breakthrough Startup Award", sub: "Food as Medicine Conference 2025", chip: "bg-herb/15" },
  { title: "Digital Health Finalist — Prevention & Wellness", sub: "HLTH Conference 2025", chip: "bg-steel/15" },
  { title: "Named Top 14 AI APIs", sub: "Programmable Web 2019 — alongside Google, Amazon, IBM", chip: "bg-terra/15" },
];

const accents = [
  { date: "text-terra", border: "border-l-terra" },
  { date: "text-[#a9762a]", border: "border-l-gold" },
  { date: "text-steel", border: "border-l-steel" },
  { date: "text-[#3f6b48]", border: "border-l-herb" },
  { date: "text-clay", border: "border-l-clay" },
];

function NewsCard({ item, accent }) {
  const linked = item.to || item.href;

  const inner = (
    <article
      className={`h-full rounded-2xl bg-white border border-ink/[0.06] border-l-[3px] ${accent.border} shadow-card p-7 transition ${
        linked ? "group hover:-translate-y-[2px] hover:shadow-lift" : ""
      }`}
    >
      <p className={`text-[12px] font-semibold tracking-[0.14em] uppercase ${accent.date}`}>{item.date}</p>
      <h3
        className={`display mt-3 text-[20px] sm:text-[22px] leading-[1.2] font-medium ${
          linked ? "group-hover:text-forest transition-colors" : ""
        }`}
      >
        {item.title}
      </h3>
      <p className="mt-3 text-[14.5px] leading-[1.6] text-ink-soft">{item.desc}</p>
      {linked && (
        <span className={`mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium ${accent.date}`}>
          Read more <span aria-hidden>→</span>
        </span>
      )}
    </article>
  );

  if (item.to) return <Link to={item.to} className="block h-full">{inner}</Link>;
  if (item.href) return <a href={item.href} className="block h-full">{inner}</a>;
  return inner;
}

export default function News() {
  return (
    <PageShell>
      {/* Header */}
      <section className="relative overflow-hidden bg-paper">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(201,151,58,0.18), transparent 70%)",
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
        <div className="relative mx-auto max-w-5xl container-px py-20 lg:py-24 text-center">
          <Reveal>
            <h1 className="display text-[34px] leading-[1.06] sm:text-[48px] sm:leading-[1.03] lg:text-[56px]">
              News &amp; Recognition
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-[17px] sm:text-[18px] leading-[1.6] text-ink-soft">
              Awards, press coverage, and company updates.
            </p>
          </Reveal>
        </div>
      </section>

      {/* News cards */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-5xl container-px">
          <Stagger className="grid gap-5 sm:gap-6 md:grid-cols-2">
            {news.map((item, i) => (
              <StaggerItem key={item.title}>
                <NewsCard item={item} accent={accents[i % accents.length]} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Awards */}
      <section className="py-16 lg:py-24 bg-herb/[0.08] border-y border-ink/[0.06]">
        <div className="mx-auto max-w-5xl container-px">
          <Reveal>
            <h2 className="display text-[30px] leading-[1.1] sm:text-[42px] sm:leading-[1.06] text-center mb-12">
              Recognition
            </h2>
          </Reveal>
          <Stagger className="grid gap-5 sm:gap-6 md:grid-cols-2">
            {awards.map((a) => (
              <StaggerItem key={a.title}>
                <div className="h-full rounded-2xl bg-white border border-ink/[0.06] shadow-card p-7 flex items-start gap-4">
                  <span className={`h-11 w-11 shrink-0 rounded-xl ${a.chip} flex items-center justify-center text-[22px] leading-none`} aria-hidden>🏆</span>
                  <div>
                    <p className="text-[16px] font-semibold tracking-tight text-ink leading-snug">{a.title}</p>
                    <p className="text-[13.5px] text-ink/55 mt-1">{a.sub}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA strip */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-5xl container-px">
          <Reveal>
            <div className="rounded-3xl bg-pine text-cream px-8 py-12 sm:px-12 sm:py-14 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
              <h2 className="display text-[26px] sm:text-[32px] leading-[1.1] text-cream">
                Press inquiry or{" "}
                <em className="font-display italic font-normal text-gold">partnership?</em>
              </h2>
              <Link
                to="/providers"
                className="pill-btn bg-amber text-white hover:brightness-110 hover:-translate-y-[1px] hover:shadow-lift text-[16px] px-7 py-3 shrink-0"
              >
                Contact us
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </PageShell>
  );
}
