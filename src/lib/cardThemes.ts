export interface CardTheme {
  id: string;
  label: string;
  bg: string;
  cardBg: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  border: string;
  fontHeading: string;
  fontBody: string;
  radius: number;
  codeBg: string;
  glass?: boolean;
  glow?: boolean;
}

export const CARD_THEMES: CardTheme[] = [
  {
    id: "minimal",
    label: "Minimal",
    bg: "#FCFAF9",
    cardBg: "#FFFFFF",
    text: "#111111",
    muted: "#6B6B6B",
    accent: "#111111",
    accentSoft: "rgba(17,17,17,0.06)",
    border: "rgba(0,0,0,0.08)",
    fontHeading: "'Inter', system-ui, sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: 0,
    codeBg: "#F4F2F1",
  },
  {
    id: "apple",
    label: "Apple Style",
    bg: "linear-gradient(160deg,#FFFFFF 0%,#F2F4F8 100%)",
    cardBg: "rgba(255,255,255,0.85)",
    text: "#0B0B0F",
    muted: "#6E6E73",
    accent: "#007AFF",
    accentSoft: "rgba(0,122,255,0.10)",
    border: "rgba(0,0,0,0.06)",
    fontHeading: "'Inter', -apple-system, sans-serif",
    fontBody: "'Inter', -apple-system, sans-serif",
    radius: 48,
    codeBg: "#F1F3F7",
  },
  {
    id: "glass",
    label: "Glassmorphism",
    bg: "linear-gradient(135deg,#6D5BFF 0%,#00C6FB 50%,#FF6FD8 100%)",
    cardBg: "rgba(255,255,255,0.16)",
    text: "#FFFFFF",
    muted: "rgba(255,255,255,0.78)",
    accent: "#FFFFFF",
    accentSoft: "rgba(255,255,255,0.20)",
    border: "rgba(255,255,255,0.35)",
    fontHeading: "'Inter', system-ui, sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: 44,
    codeBg: "rgba(0,0,0,0.28)",
    glass: true,
  },
  {
    id: "dark",
    label: "Dark",
    bg: "#0B0B0D",
    cardBg: "#141417",
    text: "#F5F5F7",
    muted: "#9A9AA2",
    accent: "#FFFFFF",
    accentSoft: "rgba(255,255,255,0.08)",
    border: "rgba(255,255,255,0.10)",
    fontHeading: "'Inter', system-ui, sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: 40,
    codeBg: "#1B1B20",
  },
  {
    id: "neon",
    label: "Neon",
    bg: "radial-gradient(120% 100% at 20% 0%,#1B0B3B 0%,#06060B 60%)",
    cardBg: "rgba(20,10,45,0.65)",
    text: "#EDE9FF",
    muted: "#A79DE0",
    accent: "#B14BFF",
    accentSoft: "rgba(177,75,255,0.16)",
    border: "rgba(177,75,255,0.45)",
    fontHeading: "'Inter', system-ui, sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: 36,
    codeBg: "rgba(0,0,0,0.5)",
    glow: true,
  },
  {
    id: "startup",
    label: "Startup",
    bg: "linear-gradient(150deg,#0F172A 0%,#1E293B 100%)",
    cardBg: "rgba(255,255,255,0.05)",
    text: "#F8FAFC",
    muted: "#94A3B8",
    accent: "#38BDF8",
    accentSoft: "rgba(56,189,248,0.14)",
    border: "rgba(148,163,184,0.25)",
    fontHeading: "'Inter', system-ui, sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: 32,
    codeBg: "rgba(2,6,23,0.7)",
  },
  {
    id: "student",
    label: "Student",
    bg: "linear-gradient(160deg,#FFF9E6 0%,#FFEFD5 100%)",
    cardBg: "#FFFFFF",
    text: "#3A2E1F",
    muted: "#8A7757",
    accent: "#F59E0B",
    accentSoft: "rgba(245,158,11,0.14)",
    border: "rgba(180,140,60,0.22)",
    fontHeading: "'Inter', system-ui, sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: 28,
    codeBg: "#FFF3D6",
  },
  {
    id: "notebook",
    label: "Notebook",
    bg: "#FBFBF7",
    cardBg: "#FFFFFF",
    text: "#1F2933",
    muted: "#7B8794",
    accent: "#2563EB",
    accentSoft: "rgba(37,99,235,0.10)",
    border: "rgba(31,41,51,0.14)",
    fontHeading: "'Lora', Georgia, serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: 16,
    codeBg: "#F1F3F6",
  },
  {
    id: "professional",
    label: "Professional",
    bg: "#F5F7FA",
    cardBg: "#FFFFFF",
    text: "#0F1E33",
    muted: "#5A6B82",
    accent: "#0B5CD5",
    accentSoft: "rgba(11,92,213,0.09)",
    border: "rgba(15,30,51,0.10)",
    fontHeading: "'Inter', system-ui, sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: 20,
    codeBg: "#EEF2F7",
  },
];

export const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1 Square", w: 1080, h: 1080 },
  { id: "4:5", label: "4:5 Portrait", w: 1080, h: 1350 },
  { id: "9:16", label: "9:16 Story", w: 1080, h: 1920 },
  { id: "16:9", label: "16:9 Wide", w: 1920, h: 1080 },
] as const;

export type AspectId = (typeof ASPECT_RATIOS)[number]["id"];

export const BG_PATTERNS = [
  { id: "none", label: "None" },
  { id: "dots", label: "Dots" },
  { id: "grid", label: "Grid" },
  { id: "noise", label: "Soft glow" },
  { id: "lines", label: "Ruled lines" },
] as const;

export type PatternId = (typeof BG_PATTERNS)[number]["id"];

export const FONT_CHOICES = [
  { id: "inter", label: "Inter (Clean)", heading: "'Inter', system-ui, sans-serif", body: "'Inter', system-ui, sans-serif" },
  { id: "serif", label: "Lora (Editorial)", heading: "'Lora', Georgia, serif", body: "'Lora', Georgia, serif" },
  { id: "mixed", label: "Serif + Sans", heading: "'Lora', Georgia, serif", body: "'Inter', system-ui, sans-serif" },
  { id: "mono", label: "Mono (Technical)", heading: "'JetBrains Mono', ui-monospace, monospace", body: "'JetBrains Mono', ui-monospace, monospace" },
];

export function patternStyle(pattern: PatternId, color: string): React.CSSProperties {
  switch (pattern) {
    case "dots":
      return {
        backgroundImage: `radial-gradient(${color} 1.5px, transparent 1.5px)`,
        backgroundSize: "34px 34px",
      };
    case "grid":
      return {
        backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
        backgroundSize: "64px 64px",
      };
    case "noise":
      return {
        backgroundImage: `radial-gradient(60% 45% at 15% 10%, ${color} 0%, transparent 60%), radial-gradient(55% 40% at 90% 90%, ${color} 0%, transparent 60%)`,
      };
    case "lines":
      return {
        backgroundImage: `repeating-linear-gradient(180deg, transparent 0px, transparent 55px, ${color} 56px)`,
      };
    default:
      return {};
  }
}
