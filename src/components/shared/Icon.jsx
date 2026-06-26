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
