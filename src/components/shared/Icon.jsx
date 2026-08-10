import React from 'react';
import {
  Home,
  Search,
  LayoutGrid,
  BarChart2,
  User,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Plus,
  Check,
  X,
  Info,
  AlertTriangle,
  Heart,
  Star,
  Settings,
  Menu,
  Bell,
  Eye,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Clock,
  Bookmark,
  Share,
  Filter,
  RefreshCw,
  Trash2,
  Edit,
  Copy,
  Mail,
  Phone,
  MapPin,
  Globe,
  Shield,
  Zap,
  Leaf,
  Utensils,
  ShoppingCart,
  List,
  TrendingUp,
  Award,
  BookOpen,
  Microscope,
  FlaskConical,
  Stethoscope,
  Pill,
  ClipboardList,
  Scale,
  Activity,
  Sun,
  Moon,
  Cloud,
} from 'lucide-react';

const ICON_MAP = {
  'home': Home,
  'search': Search,
  'grid-2x2': LayoutGrid,
  'layout-grid': LayoutGrid,
  'bar-chart-2': BarChart2,
  'user': User,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'chevron-down': ChevronDown,
  'plus': Plus,
  'check': Check,
  'x': X,
  'info': Info,
  'alert-triangle': AlertTriangle,
  'heart': Heart,
  'star': Star,
  'settings': Settings,
  'menu': Menu,
  'bell': Bell,
  'eye': Eye,
  'external-link': ExternalLink,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'calendar': Calendar,
  'clock': Clock,
  'bookmark': Bookmark,
  'share': Share,
  'filter': Filter,
  'refresh-cw': RefreshCw,
  'trash-2': Trash2,
  'edit': Edit,
  'copy': Copy,
  'mail': Mail,
  'phone': Phone,
  'map-pin': MapPin,
  'globe': Globe,
  'shield': Shield,
  'zap': Zap,
  'leaf': Leaf,
  'utensils': Utensils,
  'shopping-cart': ShoppingCart,
  'list': List,
  'trending-up': TrendingUp,
  'award': Award,
  'book-open': BookOpen,
  'microscope': Microscope,
  'flask-conical': FlaskConical,
  'stethoscope': Stethoscope,
  'pill': Pill,
  'clipboard-list': ClipboardList,
  'scale': Scale,
  'activity': Activity,
  'sun': Sun,
  'moon': Moon,
  'cloud': Cloud,
};

export default function Icon({ name, size = 20, className, ...props }) {
  const LucideIcon = ICON_MAP[name];
  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found in icon map.`);
    return null;
  }
  return (
    <LucideIcon
      size={size}
      className={className}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export function BackArrow({ className, ...props }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
      <path d="M11 8.5 Q10 12 7 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" fill="none" />
      <path d="M11 15.5 Q10 12 7 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" fill="none" />
    </svg>
  );
}

/**
 * SkullGlyph — hand-authored inline-SVG skull, filled (not stroked) so it
 * reads as a solid glyph alongside lucide's filled `Star` in FoodRating's
 * 3-star / 3-skull row (see src/utils/rating.js, src/components/shared/
 * FoodRating.jsx). Deliberately NOT lucide's `Skull` icon: lucide's is a
 * stroked line-icon that goes muddy at the ~14-16px sizes this glyph is used
 * at, and its teeth grooves disappear into sub-pixel mush there anyway.
 *
 * The eye sockets and nose are real negative-space holes (via `fillRule`/
 * `clipRule="evenodd"`), not overlaid shapes, so the card photo underneath
 * shows through them. Eye sockets are deliberately oversized (r ≈ 2.8 in the
 * 24-unit viewBox) so the silhouette still reads at small sizes. No teeth
 * grooves by design — at 14px a 1-unit gap is sub-pixel and turns to mush;
 * the sockets + nose triangle alone carry the read.
 *
 * @param {Object} props
 * @param {number} [props.size] - Width/height in px, default 16.
 * @param {string} [props.className]
 */
export function SkullGlyph({ size = 16, className, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M12 1.5C6.2 1.5 2.5 5.4 2.5 10.3c0 2.9 1.4 5.3 3.6 6.8.3.2.4.5.4.8V20a2.5 2.5 0 0 0 2.5 2.5h6a2.5 2.5 0 0 0 2.5-2.5v-2.1c0-.3.1-.6.4-.8 2.2-1.5 3.6-3.9 3.6-6.8C21.5 5.4 17.8 1.5 12 1.5ZM8.2 8a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm7.6 0a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm-3.8 6.4-1.6 2.8h3.2l-1.6-2.8Z" />
    </svg>
  );
}
