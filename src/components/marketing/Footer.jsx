import { Link } from "react-router-dom";
import logoMark from "../../assets/remedy-mark.svg";

const cols = [
  {
    heading: "For patients",
    items: [
      { label: "Get started", to: "/onboarding" },
      { label: "How it works", to: "/" },
      { label: "Pricing", to: "/" },
      { label: "Apps", to: "/" },
    ],
  },
  {
    heading: "For providers",
    items: [
      { label: "Providers", to: "/providers" },
      { label: "Developers / API", to: "/developers" },
      { label: "The science", to: "/science" },
    ],
  },
  {
    heading: "Company",
    items: [
      { label: "Team & partners", to: "/about" },
      { label: "News", to: "/news" },
      { label: "Contact", to: "/providers" },
      { label: "Terms of use", to: "/terms" },
      { label: "Privacy policy", to: "/privacy" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-forest-900 text-[#F3EFE6]">
      <div className="mx-auto max-w-7xl container-px py-20 lg:py-24">
        <div className="grid gap-12 lg:gap-16 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div>
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logoMark} alt="Remedy" className="h-8 w-8" />
              <span className="text-[20px] font-display font-semibold tracking-tight text-[#F3EFE6]">
                Personal Remedies
              </span>
            </Link>
            <p className="mt-4 text-[14px] leading-[1.6] font-sans text-[#BFC9BD] max-w-[34ch]">
              Individualized help for chronic conditions.
            </p>
          </div>

          {/* Link columns */}
          {cols.map((c) => (
            <div key={c.heading}>
              <h4 className="text-[12px] font-label font-medium tracking-[0.14em] uppercase text-[#BFC9BD]">
                {c.heading}
              </h4>
              <ul className="mt-5 space-y-3">
                {c.items.map((i) => (
                  <li key={i.label}>
                    <Link
                      to={i.to}
                      className="text-[14.5px] font-sans text-[#BFC9BD] hover:text-[#F3EFE6] transition-colors duration-[120ms]"
                    >
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-[#F3EFE6]/10 flex flex-col gap-4">
          <p className="text-[12.5px] leading-[1.6] font-sans text-[#BFC9BD]/70 max-w-[90ch]">
            Personal Remedies provides general, evidence-based health
            information and is not a substitute for professional medical advice.
            Always consult a qualified healthcare provider.
          </p>
          <p className="text-[12.5px] font-mono text-[#BFC9BD]/50">
            &copy; 2026 Personal Remedies, LLC.
          </p>
        </div>
      </div>
    </footer>
  );
}
