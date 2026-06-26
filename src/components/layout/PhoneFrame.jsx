import { useState, useEffect, useMemo } from "react";

const PHONE_W = 430;
const PHONE_H = 932;
const BEZEL = 12;
const RADIUS = 50;
const PAD = 8;
const GRID = 60;

const plusPattern = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='${GRID * 2}' height='${GRID * 2}'>` +
    `<line x1='${GRID / 2 - 4}' y1='${GRID / 2}' x2='${GRID / 2 + 4}' y2='${GRID / 2}' stroke='%23444' stroke-width='1' stroke-linecap='round' opacity='0.25'/>` +
    `<line x1='${GRID / 2}' y1='${GRID / 2 - 4}' x2='${GRID / 2}' y2='${GRID / 2 + 4}' stroke='%23444' stroke-width='1' stroke-linecap='round' opacity='0.25'/>` +
    `<line x1='${GRID + GRID / 2 - 4}' y1='${GRID + GRID / 2}' x2='${GRID + GRID / 2 + 4}' y2='${GRID + GRID / 2}' stroke='%23444' stroke-width='1' stroke-linecap='round' opacity='0.25'/>` +
    `<line x1='${GRID + GRID / 2}' y1='${GRID + GRID / 2 - 4}' x2='${GRID + GRID / 2}' y2='${GRID + GRID / 2 + 4}' stroke='%23444' stroke-width='1' stroke-linecap='round' opacity='0.25'/>` +
    `</svg>`
)}")`;

const FOOD_ICONS = [
  // carrot
  `<path d="M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46"/><path d="M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z"/><path d="M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5C17 3.33 15 2 15 2z"/>`,
  // apple
  `<path d="M12 6.528V3a1 1 0 0 1 1-1h0"/><path d="M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21"/>`,
  // beef
  `<path d="M16.4 13.7A6.5 6.5 0 1 0 6.28 6.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3"/><path d="m18.5 6 2.19 4.5a6.48 6.48 0 0 1-2.29 7.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5"/><circle cx="12.5" cy="8.5" r="2.5"/>`,
  // cherry
  `<path d="M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"/><path d="M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"/><path d="M7 14c3.22-2.91 4.29-8.75 5-12 1.66 2.38 4.94 9 5 12"/><path d="M22 9c-4.29 0-7.14-2.33-10-7 5.71 0 10 4.67 10 7Z"/>`,
  // egg
  `<path d="M12 2C8 2 4 8 4 14a8 8 0 0 0 16 0c0-6-4-12-8-12"/>`,
  // leaf
  `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>`,
  // fish
  `<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/><path d="M18 12v.5"/><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86"/><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33"/><path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4"/><path d="m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98"/>`,
];

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function generateFoodItems() {
  const rand = seededRandom(42);
  const items = [];
  const cols = 12;
  const rows = 10;
  const cellW = 100 / cols;
  const cellH = 100 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + rand() * cellW * 0.6 + cellW * 0.2;
      const y = r * cellH + rand() * cellH * 0.6 + cellH * 0.2;
      const rotation = rand() * 360;
      const iconIdx = Math.floor(rand() * FOOD_ICONS.length);
      items.push({ x, y, rotation, icon: iconIdx });
    }
  }
  return items;
}

function useScale() {
  const [scale, setScale] = useState(() =>
    Math.min(1, (window.innerHeight - PAD) / (PHONE_H + BEZEL * 2))
  );
  useEffect(() => {
    const onResize = () =>
      setScale(Math.min(1, (window.innerHeight - PAD) / (PHONE_H + BEZEL * 2)));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return scale;
}

export default function PhoneFrame({ children }) {
  const [enabled, setEnabled] = useState(() => {
    if (window.innerWidth < 500) return false;
    const params = new URLSearchParams(window.location.search);
    return !params.has("noframe");
  });

  const scale = useScale();
  const foodItems = useMemo(generateFoodItems, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "p" && e.metaKey && e.shiftKey) {
        e.preventDefault();
        setEnabled((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!enabled) return children;

  const base = window.location.origin + window.location.pathname;
  const iframeSrc = base + "?noframe";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `#1a1a1a ${plusPattern}`,
        zIndex: 0,
      }}
    >
      {/* Food icons scattered in background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        {foodItems.map((item, i) => (
          <svg
            key={i}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              position: "absolute",
              left: `${item.x}%`,
              top: `${item.y}%`,
              width: 28,
              height: 28,
              transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
            }}
            dangerouslySetInnerHTML={{ __html: FOOD_ICONS[item.icon] }}
          />
        ))}
      </div>

      {/* Phone body */}
      <div
        style={{
          position: "relative",
          width: PHONE_W + BEZEL * 2,
          height: PHONE_H + BEZEL * 2,
          borderRadius: RADIUS,
          background: "#000",
          boxShadow: "0 0 0 2px #333, 0 20px 60px rgba(0,0,0,0.5)",
          flexShrink: 0,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          zIndex: 1,
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            position: "absolute",
            top: BEZEL + 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 126,
            height: 36,
            borderRadius: 20,
            background: "#000",
            zIndex: 10,
          }}
        />

        {/* Screen area */}
        <div
          style={{
            position: "absolute",
            top: BEZEL,
            left: BEZEL,
            width: PHONE_W,
            height: PHONE_H,
            borderRadius: RADIUS - BEZEL,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <iframe
            src={iframeSrc}
            style={{
              width: PHONE_W,
              height: PHONE_H,
              border: "none",
            }}
            title="Phone Preview"
          />
        </div>
      </div>

      {/* Toggle hint */}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          color: "#666",
          fontSize: 12,
          fontFamily: "system-ui",
          zIndex: 2,
        }}
      >
        ⌘⇧P to toggle frame
      </div>
    </div>
  );
}
