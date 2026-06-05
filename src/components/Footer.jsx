const cols = [
  {
    heading: "For Patients",
    items: ["Get started", "How it works", "Pricing", "Apps"],
  },
  {
    heading: "For Providers",
    items: ["Providers", "Developers / API", "The science"],
  },
  {
    heading: "Company",
    items: ["Team & Partners", "News", "Contact"],
  },
];

export default function Footer() {
  return (
    <footer className="bg-forest-deep text-cream">
      <div className="mx-auto max-w-7xl container-px py-20 lg:py-24">
        <div className="grid gap-12 lg:gap-16 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <a
              href="#"
              className="font-display text-[22px] tracking-tighter2 text-cream font-medium"
            >
              Personal <span className="text-amber">Remedies</span>
            </a>
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
                  <li key={i}>
                    <a
                      href="#"
                      className="text-[14.5px] text-cream/80 hover:text-cream transition-colors"
                    >
                      {i}
                    </a>
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
