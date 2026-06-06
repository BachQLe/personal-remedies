import alexaLogo from "../assets/alexa-logo.png";
import edamamLogo from "../assets/edamam-logo.png";
import adherisLogo from "../assets/adheris-logo.png";
import snowflakeLogo from "../assets/snowflake-logo.png";

const logoFilter = "brightness(0) invert(1)";
const logoStyle = { filter: logoFilter, opacity: 1 };

const items = [
  { type: "logo", src: alexaLogo, alt: "Amazon Alexa" },
  { type: "logo", src: edamamLogo, alt: "Edamam" },
  { type: "logo", src: adherisLogo, alt: "Adheris Health" },
  { type: "snowflake", src: snowflakeLogo },
];

export default function TrustStrip() {
  return (
    <section className="border-y border-ink/[0.08] bg-amber-900 mx-24 rounded-lg">
      <div className="mx-auto max-w-7xl container-px py-1 sm:py-1 px-10">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-12">
          <span className="text-[14px] sm:text-[15px] text-white font-medium tracking-tight shrink-0">
            The technology behind
          </span>
          <ul className="flex flex-wrap items-center gap-x-8 gap-y-3">
            {items.map((item, i) => (
              <li
                key={i}
                className="flex items-center gap-8"
              >
                {item.type === "snowflake" ? (
                  <span className="flex items-center gap-2 text-[14px] sm:text-[15px] text-white font-medium tracking-tight">
                    Advised by the former CEO of
                    <img src={item.src} alt="Snowflake" className="h-6 sm:h-7 w-auto object-contain" style={logoStyle} />
                  </span>
                ) : (
                  <img
                    src={item.src}
                    alt={item.alt}
                    className="w-auto object-contain h-6 sm:h-7"
                    style={item.alt === "Amazon Alexa" ? { clipPath: "inset(24% 0 24%)", height: "2.5rem", ...logoStyle } : logoStyle}
                  />
                )}
                {i < items.length - 1 && (
                  <span className="hidden sm:inline text-white/25">·</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
