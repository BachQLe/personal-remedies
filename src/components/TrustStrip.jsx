import alexaLogo from "../assets/alexa-logo.png";
import edamamLogo from "../assets/edamam-logo.png";
import adherisLogo from "../assets/adheris-logo.png";
import snowflakeLogo from "../assets/snowflake-logo.png";

const logoFilter = "brightness(0)";
const logoStyle = { filter: logoFilter, opacity: 1 };

const items = [
  { type: "logo", src: alexaLogo, alt: "Amazon Alexa" },
  { type: "logo", src: edamamLogo, alt: "Edamam" },
  { type: "logo", src: adherisLogo, alt: "Adheris Health" },
  { type: "snowflake", src: snowflakeLogo },
];

export default function TrustStrip() {

  return (
    <section className="border-y border-ink/[0.08] backdrop-blur-lg bg-white/30 mx-36 rounded-full mb-2 shadow-sm">
      <div className="mx-auto max-w-7xl container-px py-2 sm:py-2 px-6">
        <div className="hidden lg:flex lg:items-center justify-center gap-6">
          <span className="text-[14px] sm:text-[15px] text-black font-medium tracking-tight shrink-0">
            The technology behind
          </span>
          <ul className="flex items-center justify-center gap-x-4">
            {items.map((item, i) => (
              <li key={i} className="flex items-center gap-3">
                {item.type === "snowflake" ? (
                  <span className="flex items-center gap-2 text-[14px] sm:text-[15px] text-black font-medium tracking-tight">
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
                  <span className="text-black/25">·</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Mobile conveyor */}
        <div className="lg:hidden overflow-hidden">
          <style>{`
            @keyframes scroll-left {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .conveyor-track {
              animation: scroll-left 20s linear infinite;
            }
            .conveyor-track:hover {
              animation-play-state: paused;
            }
          `}</style>
          <div className="conveyor-track flex items-center gap-6 py-2 w-max">
            {[...items, ...items].map((item, i) => (
              <div key={i} className="flex items-center gap-3 shrink-0">
                {item.type === "snowflake" ? (
                  <span className="flex items-center gap-2 text-[12px] text-black font-medium tracking-tight whitespace-nowrap">
                    Advised by the former CEO of
                    <img src={item.src} alt="Snowflake" className="h-5 w-auto object-contain" style={logoStyle} />
                  </span>
                ) : (
                  <img
                    src={item.src}
                    alt={item.alt}
                    className="w-auto object-contain h-5"
                    style={item.alt === "Amazon Alexa" ? { clipPath: "inset(24% 0 24%)", height: "2rem", ...logoStyle } : logoStyle}
                  />
                )}
                {i % items.length < items.length - 1 && (
                  <span className="text-black/25">·</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
