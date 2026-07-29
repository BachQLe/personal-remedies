import { Star } from 'lucide-react';
import Skeleton from './Skeleton.jsx';

/**
 * Half-star-capable rating row. `stars` is 0.5-stepped, 0–5 (see
 * numericIdToStars in adapter.js). Renders a clip-overlay of a filled Star
 * over an outline Star per position so partial (half) fills work without a
 * dedicated half-star glyph. The verdict phrase and raw score are
 * intentionally not rendered.
 *
 * @param {Object} props
 * @param {number | null} props.stars
 * @param {number} [props.size] - star glyph size in px, default 15
 * @param {boolean} [props.showValue] - show the `X/5` text next to the stars
 * @param {boolean} [props.loading]
 * @param {string} [props.className] - appended to the root element
 */
export default function StarRating({ stars, size = 15, showValue = true, loading = false, className = '' }) {
  if (loading) {
    return <Skeleton shape="pill" className={`w-28 ${className}`} tint="bg-white/15" />;
  }
  if (stars == null) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-[1px]">
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = Math.max(0, Math.min(1, stars - i)) * 100;
          return (
            <span
              key={i}
              className="relative inline-block flex-shrink-0"
              style={{ width: size, height: size }}
            >
              <Star size={size} className="absolute inset-0 text-white/30" />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill}%` }}
              >
                <Star size={size} className="text-white" fill="currentColor" />
              </span>
            </span>
          );
        })}
      </div>
      {showValue && (
        <span className="text-xs text-white/80 font-sans">{stars}/5</span>
      )}
    </div>
  );
}
