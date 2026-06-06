const cols = [
  {
    heading: "For Patients",
    items: [
      { label: "Get started", to: "/survey" },
      { label: "How it works", to: "/" },
      { label: "Pricing", to: "/" },
      { label: "Apps", to: "/" },
    ],
  },
  {
    heading: "For Providers",
    items: [
      { label: "Providers", to: "/providers" },
      { label: "Developers / API", to: "/developers" },
      { label: "The science", to: "/science" },
    ],
  },
  {
    heading: "Company",
    items: [
      { label: "Team & Partners", to: "/about" },
      { label: "News", to: "/news" },
      { label: "Contact", to: "/providers" },
      { label: "Terms of Use", to: "/terms" },
      { label: "Privacy Policy", to: "/privacy" },
    ],
  },
];

import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-forest-deep text-cream">
      <div className="mx-auto max-w-7xl container-px py-20 lg:py-24">
        <div className="grid gap-12 lg:gap-16 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link
              to="/"
              style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 900 }}
              className="text-[22px] tracking-tight text-cream"
            >
              personalRemedies
            </Link>
            <p className="mt-4 text-[14px] leading-[1.6] text-cream/65 max-w-[34ch]">
              Individualized help for chronic conditions.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.heading}>
              <h4 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-cream/55">
                {c.heading}
              </h4>
              <ul className="mt-5 space-y-3">
                {c.items.map((i) => (
                  <li key={i.label}>
                    <Link
                      to={i.to}
                      className="text-[14.5px] text-cream/80 hover:text-cream transition-colors"
                    >
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-cream/10 flex flex-col gap-4">
          <p className="text-[12.5px] leading-[1.6] text-cream/45 max-w-[90ch]">
            Personal Remedies provides general, evidence-based health
            information and is not a substitute for professional medical advice.
            Always consult a qualified healthcare provider.
          </p>
          <p className="text-[12.5px] text-cream/40">
            © 2026 Personal Remedies, LLC.
          </p>
        </div>
      </div>
    </footer>
  );
}
