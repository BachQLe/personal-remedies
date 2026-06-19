import { Link } from "react-router-dom";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal";
import PageShell from "../components/PageShell";

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
    desc: "\"Fully Automated & Personalized Diet Plans for Multiple Illnesses.\"",
  },
  {
    date: "Jan 14, 2020",
    title: "StartUp Health TV Interview with Mory Bahar",
    desc: "Interview at the 2020 StartUp Health Festival in San Francisco.",
  },
];

const awards = [
  { title: "Best in Health API", sub: "API World 2024", icon: "emoji_events" },
  { title: "Breakthrough Startup Award", sub: "Food as Medicine Conference 2025", icon: "emoji_events" },
  { title: "Digital Health Finalist -- Prevention & Wellness", sub: "HLTH Conference 2025", icon: "emoji_events" },
  { title: "Named Top 14 AI APIs", sub: "Programmable Web 2019 -- alongside Google, Amazon, IBM", icon: "emoji_events" },
];

function NewsCard({ item }) {
  const linked = item.to || item.href;

  const inner = (
    <article
      className={`h-full rounded-xl bg-white border border-sand-200 shadow-card p-7 transition-all duration-base ease-ds-out ${
        linked ? "group hover:-translate-y-[2px] hover:shadow-md" : ""
      }`}
    >
      <p className="font-mono text-[12px] font-semibold tracking-eyebrow uppercase text-char-500">{item.date}</p>
      <h3
        className={`display mt-3 text-[20px] sm:text-[22px] leading-[1.2] font-medium ${
          linked ? "group-hover:text-forest-700 transition-colors duration-base ease-ds-out" : ""
        }`}
      >
        {item.title}
      </h3>
      <p className="mt-3 font-sans text-[14.5px] leading-[1.6] text-char-500">{item.desc}</p>
      {linked && (
        <span className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-forest-700">
          Read more
          <span className="material-symbols-rounded text-[18px]">arrow_forward</span>
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
      <section className="bg-paper-200">
        <div className="mx-auto max-w-5xl container-px py-20 lg:py-24 text-center">
          <Reveal>
            <span className="tag">Updates</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="display mt-4 text-[34px] leading-[1.08] sm:text-[48px] sm:leading-[1.08] lg:text-[56px] lg:leading-[1.08]">
              News &amp; recognition
            </h1>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-6 font-sans text-[17px] sm:text-[18px] leading-[1.6] text-char-500">
              Awards, press coverage, and company updates.
            </p>
          </Reveal>
        </div>
      </section>

      {/* News cards */}
      <section className="py-16 lg:py-24 bg-paper-200">
        <div className="mx-auto max-w-5xl container-px">
          <Stagger className="grid gap-5 sm:gap-6 md:grid-cols-2">
            {news.map((item) => (
              <StaggerItem key={item.title}>
                <NewsCard item={item} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Awards */}
      <section className="py-16 lg:py-24 bg-paper-200 border-y border-sand-200">
        <div className="mx-auto max-w-5xl container-px">
          <Reveal>
            <span className="tag block text-center">Awards</span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="display mt-4 text-[30px] leading-[1.08] sm:text-[42px] sm:leading-[1.08] text-center mb-12">
              Recognition
            </h2>
          </Reveal>
          <Stagger className="grid gap-5 sm:gap-6 md:grid-cols-2">
            {awards.map((a) => (
              <StaggerItem key={a.title}>
                <div className="h-full rounded-xl bg-white border border-sand-200 shadow-card p-7 flex items-start gap-4">
                  <span className="h-11 w-11 shrink-0 rounded-lg bg-honey-50 flex items-center justify-center" aria-hidden>
                    <span className="material-symbols-rounded text-[22px] text-honey-600">{a.icon}</span>
                  </span>
                  <div>
                    <p className="font-sans text-[16px] font-semibold tracking-tight text-char-900 leading-snug">{a.title}</p>
                    <p className="font-sans text-[13.5px] text-char-500 mt-1">{a.sub}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA band — inverted plum */}
      <section className="py-20 lg:py-28 bg-plum-700 text-[#F3EFE6]">
        <div className="mx-auto max-w-5xl container-px">
          <Reveal>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
              <h2 className="display text-[26px] sm:text-[32px] leading-[1.08] text-[#F3EFE6]">
                Press inquiry or{" "}
                <em className="font-display italic font-normal text-honey-600">partnership?</em>
              </h2>
              <Link
                to="/providers"
                className="inline-flex items-center gap-2 font-sans text-[16px] font-semibold px-7 py-3 rounded-pill bg-honey-600 text-white hover:bg-honey-700 transition-all duration-base ease-ds-out shrink-0"
              >
                Contact us
                <span className="material-symbols-rounded text-[20px]">arrow_forward</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </PageShell>
  );
}
