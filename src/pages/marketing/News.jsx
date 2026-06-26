import { Link } from "react-router-dom";
import { Reveal, Stagger, StaggerItem } from "../../components/marketing/Reveal";
import PageShell from "../../components/marketing/PageShell";
import Icon from "../../components/shared/Icon";

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
  { title: "Best in Health API", sub: "API World 2024", icon: "award" },
  { title: "Breakthrough Startup Award", sub: "Food as Medicine Conference 2025", icon: "award" },
  { title: "Digital Health Finalist -- Prevention & Wellness", sub: "HLTH Conference 2025", icon: "award" },
  { title: "Named Top 14 AI APIs", sub: "Programmable Web 2019 -- alongside Google, Amazon, IBM", icon: "award" },
];

function NewsCard({ item }) {
  const linked = item.to || item.href;

  const inner = (
    <article
      className={`h-full rounded-[28px] bg-white border border-sand-200 shadow-card p-7 transition-all duration-base ease-ds-out ${
        linked ? "group hover:-translate-y-[2px] hover:shadow-md" : ""
      }`}
    >
      <p className="font-mono text-[12px] font-semibold tracking-[.14em] uppercase text-char-500">{item.date}</p>
      <h3
        className={`font-display font-semibold tracking-[-0.02em] mt-3 text-[20px] sm:text-[22px] leading-[1.2] text-blue-950 ${
          linked ? "group-hover:text-forest-700 transition-colors duration-base ease-ds-out" : ""
        }`}
      >
        {item.title}
      </h3>
      <p className="mt-3 font-sans text-[14.5px] leading-[1.6] text-char-500">{item.desc}</p>
      {linked && (
        <span className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-forest-700">
          Read more
          <Icon name="arrow-right" size={18} />
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
            <span className="font-label text-[12px] font-semibold tracking-[.14em] uppercase text-char-500">Updates</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="font-display font-semibold tracking-[-0.02em] mt-4 text-[34px] leading-[1.08] sm:text-[48px] sm:leading-[1.08] lg:text-[56px] lg:leading-[1.08] text-blue-950">
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
            <span className="font-label text-[12px] font-semibold tracking-[.14em] uppercase text-char-500 block text-center">Awards</span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="font-display font-semibold tracking-[-0.02em] mt-4 text-[30px] leading-[1.08] sm:text-[42px] sm:leading-[1.08] text-center mb-12 text-blue-950">
              Recognition
            </h2>
          </Reveal>
          <Stagger className="grid gap-5 sm:gap-6 md:grid-cols-2">
            {awards.map((a) => (
              <StaggerItem key={a.title}>
                <div className="h-full rounded-[28px] bg-white border border-sand-200 shadow-card p-7 flex items-start gap-4">
                  <span className="h-11 w-11 shrink-0 rounded-[14px] bg-yellow-100 flex items-center justify-center" aria-hidden>
                    <Icon name={a.icon} size={22} className="text-yellow-700" />
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

      {/* CTA band — inverted lavender */}
      <section className="py-20 lg:py-28 bg-blue-950 text-[#F3EFE6]">
        <div className="mx-auto max-w-5xl container-px">
          <Reveal>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
              <h2 className="font-display font-semibold tracking-[-0.02em] text-[26px] sm:text-[32px] leading-[1.08] text-[#F3EFE6]">
                Press inquiry or{" "}
                <em className="font-display italic font-normal text-yellow-400">partnership?</em>
              </h2>
              <Link
                to="/providers"
                className="inline-flex items-center gap-2 font-sans text-[16px] font-semibold px-7 py-3 rounded-[6px] bg-yellow-400 text-blue-950 hover:bg-yellow-500 active:translate-y-[1px] active:scale-[0.99] transition-all duration-base ease-ds-out shrink-0"
              >
                Contact us
                <Icon name="arrow-right" size={20} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </PageShell>
  );
}
