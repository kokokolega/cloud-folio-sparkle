/**
 * Card Design engine — a tiny, offline-first, zero-AI design layer that sits on
 * top of the generated card slides. Elements are absolutely positioned in the
 * card's own 1080-based coordinate space so they scale perfectly at export.
 */

import { readDraft, writeDraft } from "@/lib/localDraft";

export type ElementKind =
  // library
  | "badge"
  | "ribbon"
  | "label"
  | "divider"
  | "statBlock"
  | "quoteBox"
  | "featureCard"
  | "pricingCard"
  | "testimonial"
  | "timeline"
  | "callout"
  // widgets
  | "progress"
  | "counter"
  | "rating"
  | "qr"
  | "calendar"
  | "countdown"
  | "bars"
  // primitives
  | "text"
  | "image"
  | "shape";

export interface DesignElement {
  id: string;
  kind: ElementKind;
  name: string;
  /** card-space coordinates (same units as the 1080-wide card) */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
  z: number;
  props: Record<string, any>;
}

export interface Guide {
  id: string;
  axis: "x" | "y";
  pos: number;
}

export interface GlobalStyles {
  textScale: number;
  spacingScale: number;
  radiusScale: number;
  bgOverride: string | null;
  print: boolean;
}

export const DEFAULT_GLOBALS: GlobalStyles = {
  textScale: 1,
  spacingScale: 1,
  radiusScale: 1,
  bgOverride: null,
  print: false,
};

export interface DesignDoc {
  /** elements per slide index */
  bySlide: Record<number, DesignElement[]>;
  guides: Guide[];
  globals: GlobalStyles;
}

export const EMPTY_DESIGN: DesignDoc = { bySlide: {}, guides: [], globals: DEFAULT_GLOBALS };

/* ------------------------------------------------------------------ */
/* element library                                                     */
/* ------------------------------------------------------------------ */

interface LibraryItem {
  kind: ElementKind;
  label: string;
  group: "Elements" | "Widgets" | "Basics";
  w: number;
  h: number;
  props: Record<string, any>;
}

export const ELEMENT_LIBRARY: LibraryItem[] = [
  { kind: "badge", label: "Badge", group: "Elements", w: 240, h: 78, props: { text: "New" } },
  { kind: "ribbon", label: "Ribbon", group: "Elements", w: 420, h: 84, props: { text: "Featured" } },
  { kind: "label", label: "Label", group: "Elements", w: 300, h: 60, props: { text: "Section label" } },
  { kind: "divider", label: "Divider", group: "Elements", w: 520, h: 12, props: { thickness: 4, style: "solid" } },
  { kind: "statBlock", label: "Statistic", group: "Elements", w: 460, h: 240, props: { value: "84%", label: "Retention after 90 days" } },
  { kind: "quoteBox", label: "Quote box", group: "Elements", w: 720, h: 300, props: { text: "Design is intelligence made visible.", author: "Alina Wheeler" } },
  { kind: "featureCard", label: "Feature card", group: "Elements", w: 520, h: 300, props: { title: "Offline first", body: "Everything saves locally and syncs later." } },
  { kind: "pricingCard", label: "Pricing card", group: "Elements", w: 480, h: 520, props: { plan: "Pro", price: "$12", period: "/month", features: ["Unlimited cards", "All templates", "Export in 4K"] } },
  { kind: "testimonial", label: "Testimonial", group: "Elements", w: 720, h: 300, props: { text: "It replaced three tools for our team.", name: "Priya S.", role: "Product lead" } },
  { kind: "timeline", label: "Timeline", group: "Elements", w: 700, h: 420, props: { steps: ["Capture", "Organise", "Share"] } },
  { kind: "callout", label: "Callout", group: "Elements", w: 720, h: 200, props: { text: "Tip: press ⌘D to duplicate any element.", tone: "info" } },

  { kind: "progress", label: "Progress bar", group: "Widgets", w: 640, h: 110, props: { value: 68, label: "Progress" } },
  { kind: "counter", label: "Counter", group: "Widgets", w: 420, h: 220, props: { value: 1240, prefix: "", suffix: "+", label: "Notes captured" } },
  { kind: "rating", label: "Rating stars", group: "Widgets", w: 420, h: 110, props: { value: 4.5, max: 5 } },
  { kind: "qr", label: "QR code", group: "Widgets", w: 300, h: 300, props: { url: "https://oltrid.app" } },
  { kind: "calendar", label: "Calendar", group: "Widgets", w: 520, h: 520, props: { month: null } },
  { kind: "countdown", label: "Countdown", group: "Widgets", w: 640, h: 220, props: { target: null, label: "Launch in" } },
  { kind: "bars", label: "Data bars", group: "Widgets", w: 640, h: 380, props: { series: [{ label: "Mon", value: 40 }, { label: "Tue", value: 72 }, { label: "Wed", value: 55 }, { label: "Thu", value: 90 }] } },

  { kind: "text", label: "Text", group: "Basics", w: 640, h: 140, props: { text: "Double-click to edit", size: 46, weight: 600, align: "left" } },
  { kind: "shape", label: "Shape", group: "Basics", w: 320, h: 320, props: { shape: "rect", fill: "accent" } },
  { kind: "image", label: "Image", group: "Basics", w: 520, h: 380, props: { src: "", fit: "cover" } },
];

let seq = 0;
const eid = () => `el-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function createElement(item: LibraryItem, at: { x: number; y: number }, z: number): DesignElement {
  return {
    id: eid(),
    kind: item.kind,
    name: item.label,
    x: Math.round(at.x),
    y: Math.round(at.y),
    w: item.w,
    h: item.h,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    z,
    props: JSON.parse(JSON.stringify(item.props)),
  };
}

export function cloneElement(el: DesignElement, dx = 32, dy = 32, z?: number): DesignElement {
  return { ...el, id: eid(), x: el.x + dx, y: el.y + dy, z: z ?? el.z + 1, props: JSON.parse(JSON.stringify(el.props)) };
}

/* ------------------------------------------------------------------ */
/* alignment helpers                                                   */
/* ------------------------------------------------------------------ */

export type AlignOp = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom" | "hdist" | "vdist";

export function alignElements(els: DesignElement[], op: AlignOp, canvas: { w: number; h: number }): DesignElement[] {
  if (!els.length) return els;
  const single = els.length === 1;
  const minX = Math.min(...els.map((e) => e.x));
  const maxX = Math.max(...els.map((e) => e.x + e.w));
  const minY = Math.min(...els.map((e) => e.y));
  const maxY = Math.max(...els.map((e) => e.y + e.h));

  const bounds = single ? { minX: 0, maxX: canvas.w, minY: 0, maxY: canvas.h } : { minX, maxX, minY, maxY };

  switch (op) {
    case "left":
      return els.map((e) => ({ ...e, x: bounds.minX }));
    case "right":
      return els.map((e) => ({ ...e, x: bounds.maxX - e.w }));
    case "hcenter":
      return els.map((e) => ({ ...e, x: Math.round((bounds.minX + bounds.maxX) / 2 - e.w / 2) }));
    case "top":
      return els.map((e) => ({ ...e, y: bounds.minY }));
    case "bottom":
      return els.map((e) => ({ ...e, y: bounds.maxY - e.h }));
    case "vcenter":
      return els.map((e) => ({ ...e, y: Math.round((bounds.minY + bounds.maxY) / 2 - e.h / 2) }));
    case "hdist": {
      if (els.length < 3) return els;
      const sorted = [...els].sort((a, b) => a.x - b.x);
      const total = maxX - minX;
      const used = sorted.reduce((s, e) => s + e.w, 0);
      const gap = (total - used) / (sorted.length - 1);
      let cursor = minX;
      const map = new Map<string, number>();
      sorted.forEach((e) => {
        map.set(e.id, Math.round(cursor));
        cursor += e.w + gap;
      });
      return els.map((e) => ({ ...e, x: map.get(e.id) ?? e.x }));
    }
    case "vdist": {
      if (els.length < 3) return els;
      const sorted = [...els].sort((a, b) => a.y - b.y);
      const total = maxY - minY;
      const used = sorted.reduce((s, e) => s + e.h, 0);
      const gap = (total - used) / (sorted.length - 1);
      let cursor = minY;
      const map = new Map<string, number>();
      sorted.forEach((e) => {
        map.set(e.id, Math.round(cursor));
        cursor += e.h + gap;
      });
      return els.map((e) => ({ ...e, y: map.get(e.id) ?? e.y }));
    }
    default:
      return els;
  }
}

/** Snap candidates from siblings + canvas + guides. Returns adjusted value and the matched line. */
export function snapValue(value: number, candidates: number[], tolerance: number): { value: number; line: number | null } {
  let best: number | null = null;
  let bestDist = tolerance;
  for (const c of candidates) {
    const d = Math.abs(c - value);
    if (d <= bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best === null ? { value, line: null } : { value: best, line: best };
}

/* ------------------------------------------------------------------ */
/* templates (no AI, instant)                                          */
/* ------------------------------------------------------------------ */

export interface CardTemplate {
  id: string;
  label: string;
  themeId: string;
  accent: string;
  fontId: string;
  pattern: string;
  globals: Partial<GlobalStyles>;
  /** elements applied to the first slide */
  cover: Array<{ kind: ElementKind; x: number; y: number; w?: number; h?: number; props?: Record<string, any> }>;
}

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: "editorial",
    label: "Editorial",
    themeId: "minimal",
    accent: "#111111",
    fontId: "mixed",
    pattern: "lines",
    globals: { textScale: 1, spacingScale: 1.05, radiusScale: 0.2 },
    cover: [{ kind: "label", x: 88, y: 96, props: { text: "ESSAY" } }, { kind: "divider", x: 88, y: 176, w: 904 }],
  },
  {
    id: "keynote",
    label: "Keynote",
    themeId: "dark",
    accent: "#FFFFFF",
    fontId: "inter",
    pattern: "noise",
    globals: { textScale: 1.05, spacingScale: 1, radiusScale: 1 },
    cover: [{ kind: "badge", x: 88, y: 96, props: { text: "Keynote" } }],
  },
  {
    id: "startup-deck",
    label: "Startup deck",
    themeId: "startup",
    accent: "#38BDF8",
    fontId: "inter",
    pattern: "grid",
    globals: { textScale: 1, spacingScale: 0.95, radiusScale: 1 },
    cover: [
      { kind: "badge", x: 88, y: 96, props: { text: "Series A" } },
      { kind: "statBlock", x: 88, y: 900, props: { value: "3.2x", label: "YoY growth" } },
    ],
  },
  {
    id: "study",
    label: "Study notes",
    themeId: "student",
    accent: "#F59E0B",
    fontId: "inter",
    pattern: "dots",
    globals: { textScale: 0.98, spacingScale: 1, radiusScale: 1 },
    cover: [{ kind: "callout", x: 88, y: 1050, w: 904, props: { text: "Revise these cards before the exam.", tone: "info" } }],
  },
  {
    id: "product",
    label: "Product launch",
    themeId: "apple",
    accent: "#007AFF",
    fontId: "inter",
    pattern: "none",
    globals: { textScale: 1, spacingScale: 1.1, radiusScale: 1.2 },
    cover: [
      { kind: "ribbon", x: 88, y: 96, props: { text: "Launching today" } },
      { kind: "qr", x: 760, y: 1000, w: 230, h: 230, props: { url: "https://oltrid.app" } },
    ],
  },
  {
    id: "quote-poster",
    label: "Quote poster",
    themeId: "neon",
    accent: "#B14BFF",
    fontId: "serif",
    pattern: "noise",
    globals: { textScale: 1.1, spacingScale: 1.1, radiusScale: 1 },
    cover: [{ kind: "quoteBox", x: 88, y: 880, w: 904, props: { text: "Ideas deserve a beautiful frame.", author: "Oltrid" } }],
  },
  {
    id: "report",
    label: "Report",
    themeId: "professional",
    accent: "#0B5CD5",
    fontId: "inter",
    pattern: "none",
    globals: { textScale: 0.95, spacingScale: 1, radiusScale: 0.6 },
    cover: [
      { kind: "label", x: 88, y: 96, props: { text: "QUARTERLY REPORT" } },
      { kind: "bars", x: 88, y: 860, w: 904, h: 380, props: { series: [{ label: "Q1", value: 40 }, { label: "Q2", value: 62 }, { label: "Q3", value: 75 }, { label: "Q4", value: 91 }] } },
    ],
  },
  {
    id: "glass-social",
    label: "Glass social",
    themeId: "glass",
    accent: "#FFFFFF",
    fontId: "inter",
    pattern: "none",
    globals: { textScale: 1.05, spacingScale: 1, radiusScale: 1.2 },
    cover: [{ kind: "rating", x: 88, y: 1080, props: { value: 5, max: 5 } }],
  },
];

export function templateElements(t: CardTemplate): DesignElement[] {
  return t.cover.map((c, i) => {
    const lib = ELEMENT_LIBRARY.find((l) => l.kind === c.kind)!;
    const el = createElement(lib, { x: c.x, y: c.y }, i + 1);
    if (c.w) el.w = c.w;
    if (c.h) el.h = c.h;
    if (c.props) el.props = { ...el.props, ...c.props };
    return el;
  });
}

/* ------------------------------------------------------------------ */
/* persistence: per-note design, global assets, reusable components     */
/* ------------------------------------------------------------------ */

const designKey = (noteId: string) => `card-design:${noteId}`;
const ASSETS_KEY = "card-assets";
const COMPONENTS_KEY = "card-components";

export function loadDesign(noteId: string): DesignDoc {
  const d = readDraft<DesignDoc>(designKey(noteId));
  if (!d?.value) return EMPTY_DESIGN;
  return {
    bySlide: d.value.bySlide ?? {},
    guides: d.value.guides ?? [],
    globals: { ...DEFAULT_GLOBALS, ...(d.value.globals ?? {}) },
  };
}

export function saveDesign(noteId: string, doc: DesignDoc) {
  writeDraft(designKey(noteId), doc);
}

export interface Asset {
  id: string;
  name: string;
  dataUrl: string;
  addedAt: number;
}

export function loadAssets(): Asset[] {
  return readDraft<Asset[]>(ASSETS_KEY)?.value ?? [];
}
export function saveAssets(assets: Asset[]) {
  writeDraft(ASSETS_KEY, assets.slice(0, 60));
}

export interface SavedComponent {
  id: string;
  name: string;
  elements: DesignElement[];
  createdAt: number;
}

export function loadComponents(): SavedComponent[] {
  return readDraft<SavedComponent[]>(COMPONENTS_KEY)?.value ?? [];
}
export function saveComponents(list: SavedComponent[]) {
  writeDraft(COMPONENTS_KEY, list.slice(0, 80));
}

export function instantiateComponent(c: SavedComponent, z: number): DesignElement[] {
  const minX = Math.min(...c.elements.map((e) => e.x));
  const minY = Math.min(...c.elements.map((e) => e.y));
  return c.elements.map((e, i) => ({
    ...cloneElement(e, 0, 0, z + i),
    x: e.x - minX + 120,
    y: e.y - minY + 120,
  }));
}
