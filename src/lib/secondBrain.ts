/**
 * Second Brain Desktop — offline-first data model.
 *
 * Everything lives in localStorage first (instant, survives refresh/restart)
 * and is mirrored to the cloud opportunistically by the page.
 */

export type SBKind =
  | "note"
  | "pdf"
  | "image"
  | "file"
  | "capture"
  | "whiteboard"
  | "drawing"
  | "voice"
  | "video"
  | "bookmark"
  | "project"
  | "folder"
  | "sticky"
  | "widget";

export type SBWidget =
  | "calendar"
  | "tasks"
  | "recent-notes"
  | "quick-capture"
  | "clock"
  | "storage"
  | "reading"
  | "pomodoro"
  | "bookmarks"
  | "favorites";

export interface SBObject {
  id: string;
  kind: SBKind;
  title: string;
  preview?: string;      // text snippet / data-url / remote url
  href?: string;         // route or external link
  widget?: SBWidget;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color?: string;        // hsl token-ish accent
  pinned?: boolean;
  locked?: boolean;
  collapsed?: boolean;
  groupId?: string | null;
  parentId?: string | null; // inside a desktop folder
  z: number;
  createdAt: number;
  updatedAt: number;
  meta?: Record<string, any>;
}

export interface SBLink {
  id: string;
  from: string;
  to: string;
  label?: string;
  directed?: boolean;
}

export interface SBGroup {
  id: string;
  name: string;
  color: string;
  collapsed?: boolean;
}

export interface SBDesktop {
  id: string;
  name: string;
  wallpaper: string;      // css background
  accent: string;
  grid: boolean;
  objects: SBObject[];
  links: SBLink[];
  groups: SBGroup[];
  camera: { x: number; y: number; zoom: number };
  bookmarks: { id: string; name: string; x: number; y: number; zoom: number }[];
}

export interface SBState {
  desktops: SBDesktop[];
  activeId: string;
  updatedAt: number;
}

export const WALLPAPERS = [
  { id: "paper", label: "Paper", css: "radial-gradient(hsl(var(--muted)) 1px, transparent 1px)" },
  { id: "dusk", label: "Dusk", css: "linear-gradient(160deg, hsl(230 40% 12%), hsl(260 45% 18%))" },
  { id: "mint", label: "Mint", css: "linear-gradient(160deg, hsl(160 45% 92%), hsl(190 50% 88%))" },
  { id: "sand", label: "Sand", css: "linear-gradient(160deg, hsl(35 55% 94%), hsl(20 45% 90%))" },
  { id: "ink", label: "Ink", css: "linear-gradient(160deg, hsl(0 0% 8%), hsl(0 0% 16%))" },
  { id: "plain", label: "Plain", css: "none" },
];

export const OBJECT_COLORS = [
  "hsl(210 85% 58%)",
  "hsl(150 60% 45%)",
  "hsl(35 90% 55%)",
  "hsl(340 75% 58%)",
  "hsl(270 65% 62%)",
  "hsl(190 75% 48%)",
];

const KEY = "oltrid-second-brain";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function makeDesktop(name: string, wallpaper = WALLPAPERS[0].css): SBDesktop {
  return {
    id: uid(),
    name,
    wallpaper,
    accent: OBJECT_COLORS[0],
    grid: true,
    objects: [],
    links: [],
    groups: [],
    camera: { x: 0, y: 0, zoom: 1 },
    bookmarks: [],
  };
}

export function makeObject(partial: Partial<SBObject> & { kind: SBKind; title: string }): SBObject {
  const now = Date.now();
  return {
    id: uid(),
    preview: "",
    x: 80,
    y: 80,
    w: 220,
    h: 150,
    rotation: 0,
    z: now,
    groupId: null,
    parentId: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

const STARTER_DESKTOPS = ["Personal", "Work", "Study"];

export function defaultState(): SBState {
  const desktops = STARTER_DESKTOPS.map((n, i) => {
    const d = makeDesktop(n, WALLPAPERS[i % WALLPAPERS.length].css);
    d.accent = OBJECT_COLORS[i % OBJECT_COLORS.length];
    return d;
  });
  desktops[0].objects = [
    makeObject({ kind: "widget", widget: "clock", title: "Clock", x: 60, y: 60, w: 200, h: 130 }),
    makeObject({ kind: "widget", widget: "tasks", title: "Today's Tasks", x: 300, y: 60, w: 250, h: 220 }),
    makeObject({
      kind: "sticky",
      title: "Welcome",
      preview: "Drag anything anywhere. Connect ideas. This desktop is yours.",
      x: 60,
      y: 230,
      w: 220,
      h: 150,
      color: OBJECT_COLORS[2],
    }),
  ];
  return { desktops, activeId: desktops[0].id, updatedAt: Date.now() };
}

export function loadSB(): SBState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as SBState;
    if (!parsed?.desktops?.length) return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
}

export function saveSB(state: SBState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, updatedAt: Date.now() }));
  } catch {
    /* quota */
  }
}

/* ---------------- layout helpers ---------------- */

export const snap = (v: number, grid = 20) => Math.round(v / grid) * grid;

export function autoArrange(objs: SBObject[], cols = 4, gap = 24): SBObject[] {
  const movable = objs.filter((o) => !o.locked && !o.pinned);
  const w = Math.max(...movable.map((o) => o.w), 200) + gap;
  const h = Math.max(...movable.map((o) => o.h), 150) + gap;
  let i = 0;
  return objs.map((o) => {
    if (o.locked || o.pinned) return o;
    const x = 60 + (i % cols) * w;
    const y = 60 + Math.floor(i / cols) * h;
    i++;
    return { ...o, x, y, updatedAt: Date.now() };
  });
}

export function sortObjects(objs: SBObject[], by: "type" | "date" | "color" | "project"): SBObject[] {
  const keyed = [...objs].sort((a, b) => {
    if (by === "type") return a.kind.localeCompare(b.kind);
    if (by === "date") return b.createdAt - a.createdAt;
    if (by === "color") return (a.color || "").localeCompare(b.color || "");
    return (a.groupId || "zz").localeCompare(b.groupId || "zz");
  });
  const order = new Map(keyed.map((o, i) => [o.id, i]));
  const arranged = autoArrange(keyed);
  const byId = new Map(arranged.map((o) => [o.id, o]));
  return objs
    .map((o) => byId.get(o.id) || o)
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export function alignObjects(objs: SBObject[], ids: string[], mode: "left" | "right" | "top" | "bottom" | "hcenter" | "vcenter") {
  const sel = objs.filter((o) => ids.includes(o.id) && !o.locked);
  if (sel.length < 2) return objs;
  const left = Math.min(...sel.map((o) => o.x));
  const right = Math.max(...sel.map((o) => o.x + o.w));
  const top = Math.min(...sel.map((o) => o.y));
  const bottom = Math.max(...sel.map((o) => o.y + o.h));
  return objs.map((o) => {
    if (!ids.includes(o.id) || o.locked) return o;
    switch (mode) {
      case "left": return { ...o, x: left };
      case "right": return { ...o, x: right - o.w };
      case "top": return { ...o, y: top };
      case "bottom": return { ...o, y: bottom - o.h };
      case "hcenter": return { ...o, x: (left + right) / 2 - o.w / 2 };
      case "vcenter": return { ...o, y: (top + bottom) / 2 - o.h / 2 };
    }
  });
}

export function findDuplicates(objs: SBObject[]): string[] {
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  for (const o of objs) {
    const k = `${o.kind}|${o.title.trim().toLowerCase()}`;
    if (seen.has(k)) dupes.push(o.id);
    else seen.set(k, o.id);
  }
  return dupes;
}

export function findOrphans(objs: SBObject[], links: SBLink[]): string[] {
  const linked = new Set(links.flatMap((l) => [l.from, l.to]));
  return objs.filter((o) => o.kind !== "widget" && !linked.has(o.id) && !o.groupId).map((o) => o.id);
}

export function boundsOf(objs: SBObject[]) {
  if (!objs.length) return { x: 0, y: 0, w: 1000, h: 700 };
  const x = Math.min(...objs.map((o) => o.x));
  const y = Math.min(...objs.map((o) => o.y));
  const r = Math.max(...objs.map((o) => o.x + o.w));
  const b = Math.max(...objs.map((o) => o.y + o.h));
  return { x, y, w: Math.max(r - x, 1), h: Math.max(b - y, 1) };
}
