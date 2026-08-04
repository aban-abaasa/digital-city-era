/**
 * SupermartKera Unified Theme Configuration
 * Based on landing page emerald/green color design
 */

// Color Palette matching SupermartkeraLanding.jsx themeStyles
export const COLORS = {
  emerald: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
    950: '#022c22'
  },
  green: {
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a'
  },
  teal: {
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488'
  },
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    400: '#94a3b8',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a'
  }
};

// Theme styles matching landing page structure
export const themeStyles = {
  dark: {
    shell: 'bg-[#061510] text-white',
    header: 'bg-emerald-950/50 border-emerald-800/25',
    headerGradient: 'bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600',
    panel: 'bg-emerald-950/55 border-emerald-800/20',
    softPanel: 'bg-emerald-900/15 border-emerald-700/20',
    muted: 'text-emerald-100/65',
    body: 'text-emerald-50/75',
    accent: 'text-white',
    button: 'bg-emerald-400 text-emerald-950 hover:bg-emerald-500',
    buttonGradient: 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700',
    outline: 'border-emerald-700/25 bg-emerald-900/20 text-white hover:bg-emerald-800/25',
    input: 'bg-emerald-950/55 border-emerald-700/25 text-white placeholder:text-emerald-700',
    featureItem: 'border-emerald-800/25 bg-emerald-950/60',
    blob1: 'bg-emerald-500/12',
    blob2: 'bg-green-400/10',
    blob3: 'bg-teal-400/8',
    badge: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
    iconBg: 'from-emerald-400/20 to-green-500/15 text-emerald-300',
    price: 'text-emerald-300',
    sectionLabel: 'text-emerald-400/75',
    logo: 'from-emerald-400 via-green-500 to-teal-600 shadow-emerald-500/20',
    check: 'text-emerald-400',
    divider: 'border-emerald-800/25',
    sidebar: 'bg-gradient-to-b from-emerald-900 to-emerald-950',
    sidebarActive: 'bg-emerald-800/40 border-l-4 border-emerald-400',
    cardHover: 'hover:shadow-emerald-500/20'
  },
  light: {
    shell: 'bg-[linear-gradient(180deg,#ffffff_0%,#f0fdf4_45%,#ecfdf5_100%)] text-slate-900',
    header: 'bg-white/92 border-emerald-100 shadow-sm shadow-emerald-100/40',
    headerGradient: 'bg-gradient-to-r from-emerald-500 via-green-600 to-teal-600',
    panel: 'bg-white border-emerald-100 shadow-xl shadow-emerald-100/35',
    softPanel: 'bg-white border-emerald-100/90 hover:border-emerald-200',
    muted: 'text-slate-600',
    body: 'text-slate-600',
    accent: 'text-slate-900',
    button: 'bg-emerald-600 text-white hover:bg-emerald-700',
    buttonGradient: 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700',
    outline: 'border-emerald-200 bg-white text-slate-900 hover:bg-emerald-50',
    input: 'bg-white border-emerald-200 text-slate-900 placeholder:text-slate-400',
    featureItem: 'border-emerald-100 bg-emerald-50/70',
    blob1: 'bg-emerald-200/55',
    blob2: 'bg-green-100/65',
    blob3: 'bg-teal-100/45',
    badge: 'border-emerald-300/40 bg-emerald-50 text-emerald-800',
    iconBg: 'from-emerald-100 to-green-100 text-emerald-600',
    price: 'text-emerald-600',
    sectionLabel: 'text-emerald-600',
    logo: 'from-emerald-500 via-green-600 to-teal-600 shadow-emerald-400/20',
    check: 'text-emerald-500',
    divider: 'border-emerald-100',
    sidebar: 'bg-gradient-to-b from-emerald-50 to-white border-r-2 border-emerald-100',
    sidebarActive: 'bg-emerald-100 border-l-4 border-emerald-600 text-emerald-900',
    cardHover: 'hover:shadow-emerald-200/50'
  }
};

// Status colors for various states
export const STATUS_COLORS = {
  success: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: 'text-emerald-500'
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: 'text-amber-500'
  },
  error: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: 'text-red-500'
  },
  info: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: 'text-emerald-500'
  },
  pending: {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    icon: 'text-slate-500'
  }
};

// Chart colors for data visualization
export const CHART_COLORS = {
  primary: '#10b981',      // emerald-500
  secondary: '#34d399',    // emerald-400
  accent: '#14b8a6',       // teal-500
  light: '#6ee7b7',        // emerald-300
  dark: '#059669',         // emerald-600
  success: '#22c55e',      // green-500
  alternate1: '#4ade80',   // green-400
  alternate2: '#2dd4bf',   // teal-400
  gradient: ['#10b981', '#34d399', '#22c55e', '#14b8a6', '#4ade80']
};

// Recharts compatible color array
export const RECHARTS_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.accent,
  CHART_COLORS.success,
  CHART_COLORS.alternate1,
  CHART_COLORS.alternate2
];

// Portal-specific gradients
export const GRADIENTS = {
  primary: 'bg-gradient-to-r from-emerald-500 via-green-600 to-teal-600',
  primaryHover: 'hover:bg-gradient-to-r hover:from-emerald-600 hover:via-green-700 hover:to-teal-700',
  soft: 'bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500',
  subtle: 'bg-gradient-to-br from-emerald-50 to-green-50',
  hero: 'bg-gradient-to-b from-white via-emerald-50/50 to-green-50',
  dark: 'bg-gradient-to-br from-emerald-900 to-emerald-950',
  badge: 'bg-gradient-to-r from-emerald-100 to-green-100'
};

// Button styles
export const BUTTON_STYLES = {
  primary: 'bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold px-6 py-3 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all duration-300 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:-translate-y-0.5',
  secondary: 'bg-white text-emerald-600 font-semibold px-6 py-3 rounded-xl border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all duration-300',
  outline: 'border-2 border-emerald-200 bg-transparent text-emerald-600 font-semibold px-6 py-3 rounded-xl hover:bg-emerald-50 hover:border-emerald-400 transition-all duration-300',
  ghost: 'bg-transparent text-emerald-600 font-semibold px-6 py-3 rounded-xl hover:bg-emerald-50 transition-all duration-300',
  danger: 'bg-red-500 text-white font-semibold px-6 py-3 rounded-xl hover:bg-red-600 transition-all duration-300'
};

// Card styles
export const CARD_STYLES = {
  default: 'bg-white rounded-2xl border border-emerald-100 p-6 shadow-lg shadow-emerald-100/50 hover:shadow-xl hover:shadow-emerald-200/60 hover:-translate-y-1 transition-all duration-300',
  stat: 'bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100 p-6 shadow-lg shadow-emerald-100/50 relative overflow-hidden',
  feature: 'bg-white rounded-2xl border border-emerald-100 p-5 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/50 transition-all duration-300',
  interactive: 'bg-white rounded-2xl border border-emerald-100 p-6 cursor-pointer hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-200/60 hover:-translate-y-1 transition-all duration-300',
  dark: 'bg-emerald-950/55 rounded-2xl border border-emerald-800/20 p-6 backdrop-blur-md shadow-lg shadow-emerald-900/50'
};

// Input styles
export const INPUT_STYLES = {
  default: 'w-full px-4 py-3 border-2 border-emerald-200 rounded-xl focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 outline-none transition-all duration-300',
  error: 'w-full px-4 py-3 border-2 border-red-300 rounded-xl focus:border-red-400 focus:ring-4 focus:ring-red-100 outline-none transition-all duration-300',
  success: 'w-full px-4 py-3 border-2 border-emerald-300 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all duration-300'
};

// Badge styles
export const BADGE_STYLES = {
  primary: 'inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-sm',
  success: 'inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200 font-semibold text-sm',
  warning: 'inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-semibold text-sm',
  error: 'inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 border border-red-200 font-semibold text-sm',
  info: 'inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-sm',
  gradient: 'inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200 font-semibold text-sm'
};

// Navigation tab styles
export const NAV_TAB_STYLES = {
  inactive: 'px-4 py-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all duration-300',
  active: 'px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg shadow-lg shadow-emerald-500/30 font-semibold'
};

// Sidebar styles
export const SIDEBAR_STYLES = {
  light: {
    container: 'bg-white border-r-2 border-emerald-100 h-full',
    item: 'px-6 py-3 flex items-center gap-3 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border-l-4 border-transparent hover:border-emerald-600 transition-all duration-300 cursor-pointer',
    itemActive: 'px-6 py-3 flex items-center gap-3 bg-emerald-100 text-emerald-900 border-l-4 border-emerald-600 font-semibold'
  },
  dark: {
    container: 'bg-gradient-to-b from-emerald-900 to-emerald-950 h-full',
    item: 'px-6 py-3 flex items-center gap-3 text-emerald-100/80 hover:bg-emerald-800/40 hover:text-white border-l-4 border-transparent hover:border-emerald-400 transition-all duration-300 cursor-pointer',
    itemActive: 'px-6 py-3 flex items-center gap-3 bg-emerald-800/60 text-white border-l-4 border-emerald-400 font-semibold'
  }
};

// Animation classes (matching landing page)
export const ANIMATIONS = {
  fadeUp: 'animate-[skFadeUp_0.7s_cubic-bezier(0.22,1,0.36,1)_both]',
  fadeIn: 'animate-[skFadeIn_0.5s_ease_both]',
  float: 'animate-[skFloat_4s_ease-in-out_infinite]',
  pulse: 'animate-[skPulseGreen_2.5s_ease-in-out_infinite]',
  shimmer: 'animate-[skShimmer_4s_linear_infinite]'
};

// Helper function to get theme by mode
export const getTheme = (theme = 'light') => {
  return themeStyles[theme] || themeStyles.light;
};

// Helper function to format currency (Uganda)
export const formatUGX = (amount) => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0
  }).format(amount);
};

// Export default theme object
export default {
  colors: COLORS,
  themeStyles,
  statusColors: STATUS_COLORS,
  chartColors: CHART_COLORS,
  rechartsColors: RECHARTS_COLORS,
  gradients: GRADIENTS,
  buttonStyles: BUTTON_STYLES,
  cardStyles: CARD_STYLES,
  inputStyles: INPUT_STYLES,
  badgeStyles: BADGE_STYLES,
  navTabStyles: NAV_TAB_STYLES,
  sidebarStyles: SIDEBAR_STYLES,
  animations: ANIMATIONS,
  getTheme,
  formatUGX
};
