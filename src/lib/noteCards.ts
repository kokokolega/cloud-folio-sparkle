/**
 * Note Cards — a Notion/Miro-style block canvas embedded inside a note.
 *
 * Cards are serialized into the note HTML as an inert HTML comment so no schema
 * change is required and the plain-text note stays readable everywhere else.
 */

export type CardKind =
  | "text"
  | "image"
  | "checklist"
  | "table"
  | "code"
  | "drawing"
  | "link"
  | "file"
  | "voice"
  | "chart"
  | "mindmap"
  | "diagram"
  | "flowchart"
  | "timeline";

export interface NoteCard {
  id: string;
  kind: CardKind;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  color: string;
  title?: string;
  /** free-form payload, shape depends on `kind` */
  data: any;
}

export interface CardConnection {
  id: string;
  from: string;
  to: string;
}

export interface CardsDoc {
  cards: NoteCard[];
  connections: CardConnection[];
}

export const EMPTY_DOC: CardsDoc = { cards: [], connections: [] };

export const CARD_COLORS = [
  { id: "default", label: "Default", chip: "bg-card border-border" },
  { id: "amber", label: "Amber", chip: "bg-amber-300 border-amber-400" },
  { id: "emerald", label: "Emerald", chip: "bg-emerald-300 border-emerald-400" },
  { id: "sky", label: "Sky", chip: "bg-sky-300 border-sky-400" },
  { id: "rose", label: "Rose", chip: "bg-rose-300 border-rose-400" },
  { id: "violet", label: "Violet", chip: "bg-violet-300 border-violet-400" },
];

export function cardSurface(color: string) {
  switch (color) {
    case "amber":
      return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50";
    case "emerald":
      return "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50";
    case "sky":
      return "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900/50";
    case "rose":
      return "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50";
    case "violet":
      return "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-900/50";
    default:
      return "bg-card border-border";
  }
}

/* ------------------------------------------------------------------ */
/* serialization                                                       */
/* ------------------------------------------------------------------ */

const MARKER = "OLTRID_CARDS:";
const RE = /<!--OLTRID_CARDS:([\s\S]*?)-->/;

export function parseCards(content: string): CardsDoc {
  const match = content?.match(RE);
  if (!match) return EMPTY_DOC;
  try {
    const doc = JSON.parse(decodeURIComponent(match[1]));
    return {
      cards: Array.isArray(doc?.cards) ? doc.cards : [],
      connections: Array.isArray(doc?.connections) ? doc.connections : [],
    };
  } catch {
    return EMPTY_DOC;
  }
}

export function stripCards(content: string): string {
  return (content ?? "").replace(RE, "").trim();
}

export function embedCards(content: string, doc: CardsDoc): string {
  const base = stripCards(content);
  if (!doc.cards.length) return base;
  return `${base}<!--${MARKER}${encodeURIComponent(JSON.stringify(doc))}-->`;
}

/* ------------------------------------------------------------------ */
/* card factory                                                        */
/* ------------------------------------------------------------------ */

const DEFAULT_SIZE: Partial<Record<CardKind, { w: number; h: number }>> = {
  text: { w: 300, h: 180 },
  image: { w: 300, h: 240 },
  checklist: { w: 280, h: 220 },
  table: { w: 380, h: 240 },
  code: { w: 360, h: 220 },
  drawing: { w: 320, h: 260 },
  link: { w: 280, h: 120 },
  file: { w: 280, h: 120 },
  voice: { w: 280, h: 130 },
  chart: { w: 340, h: 260 },
  mindmap: { w: 380, h: 300 },
  diagram: { w: 400, h: 300 },
  flowchart: { w: 400, h: 300 },
  timeline: { w: 360, h: 280 },
};

export function defaultData(kind: CardKind): any {
  switch (kind) {
    case "text":
      return { text: "" };
    case "checklist":
      return { items: [{ id: crypto.randomUUID(), text: "New item", done: false }] };
    case "table":
      return { rows: [["Column A", "Column B"], ["", ""]] };
    case "code":
      return { language: "javascript", code: "// code" };
    case "link":
      return { url: "", label: "" };
    case "file":
      return { url: "", name: "" };
    case "voice":
      return { url: "", duration: 0 };
    case "chart":
      return { chartType: "bar", series: [{ label: "A", value: 40 }, { label: "B", value: 70 }, { label: "C", value: 25 }] };
    case "mindmap":
      return { root: "Idea", branches: ["Branch one", "Branch two", "Branch three"] };
    case "timeline":
      return { events: [{ id: crypto.randomUUID(), when: "Step 1", what: "Describe this moment" }] };
    case "diagram":
    case "flowchart":
      return { chart: "graph TD\n  A[Start] --> B[Next]\n  B --> C[Done]" };
    case "image":
    case "drawing":
      return { src: "", strokes: [] };
    default:
      return {};
  }
}

export function createCard(kind: CardKind, at: { x: number; y: number }, z: number): NoteCard {
  const size = DEFAULT_SIZE[kind] ?? { w: 300, h: 200 };
  return {
    id: crypto.randomUUID(),
    kind,
    x: at.x,
    y: at.y,
    w: size.w,
    h: size.h,
    z,
    color: "default",
    data: defaultData(kind),
  };
}

/* ------------------------------------------------------------------ */
/* one-click conversions from written notes                            */
/* ------------------------------------------------------------------ */

export function htmlToLines(html: string): string[] {
  const doc = new DOMParser().parseFromString(stripCards(html) || "", "text/html");
  return Array.from(doc.body.querySelectorAll("p,li,h1,h2,h3,h4,blockquote,div"))
    .map((el) => (el.textContent ?? "").trim())
    .filter((t) => t.length > 0)
    .filter((t, i, arr) => arr.indexOf(t) === i);
}

export type ConversionKind = "checklist" | "table" | "timeline" | "mindmap" | "flowchart" | "chart";

export function convertNote(html: string, kind: ConversionKind, at: { x: number; y: number }, z: number): NoteCard | null {
  const lines = htmlToLines(html);
  if (!lines.length) return null;
  const card = createCard(kind === "flowchart" ? "flowchart" : kind, at, z);

  switch (kind) {
    case "checklist":
      card.data = { items: lines.slice(0, 25).map((t) => ({ id: crypto.randomUUID(), text: t, done: false })) };
      break;
    case "table": {
      const rows = lines.slice(0, 25).map((line) => {
        const parts = line.split(/\s[–—:-]\s|\t|\s{2,}/).map((p) => p.trim()).filter(Boolean);
        return parts.length > 1 ? parts.slice(0, 4) : [line, ""];
      });
      const width = Math.max(...rows.map((r) => r.length));
      card.data = { rows: rows.map((r) => [...r, ...Array(width - r.length).fill("")]) };
      break;
    }
    case "timeline":
      card.data = {
        events: lines.slice(0, 20).map((t, i) => {
          const [when, ...rest] = t.split(/\s[–—:-]\s/);
          return { id: crypto.randomUUID(), when: rest.length ? when.trim() : `Step ${i + 1}`, what: (rest.join(" - ") || when).trim() };
        }),
      };
      break;
    case "mindmap":
      card.data = { root: lines[0].slice(0, 60), branches: lines.slice(1, 9) };
      break;
    case "flowchart": {
      const nodes = lines.slice(0, 12).map((t, i) => ({ id: `N${i}`, label: t.replace(/["[\]|]/g, "").slice(0, 48) }));
      const body = nodes.map((n) => `  ${n.id}["${n.label}"]`).join("\n");
      const edges = nodes.slice(1).map((n, i) => `  ${nodes[i].id} --> ${n.id}`).join("\n");
      card.data = { chart: `graph TD\n${body}\n${edges}` };
      break;
    }
    case "chart": {
      const series = lines
        .slice(0, 10)
        .map((line) => {
          const m = line.match(/^(.*?)[\s:–—-]+(-?\d+(?:\.\d+)?)\s*%?$/);
          return m ? { label: m[1].trim().slice(0, 20), value: Number(m[2]) } : { label: line.slice(0, 20), value: line.length };
        });
      card.data = { chartType: "bar", series };
      break;
    }
  }
  return card;
}
