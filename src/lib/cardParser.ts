export type SlideKind =
  | "cover"
  | "points"
  | "paragraph"
  | "quote"
  | "stat"
  | "image"
  | "code"
  | "cta";

export interface CardSlide {
  id: string;
  kind: SlideKind;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  points?: string[];
  body?: string;
  quote?: string;
  attribution?: string;
  stat?: string;
  statLabel?: string;
  imageUrl?: string;
  caption?: string;
  code?: string;
  language?: string;
}

let counter = 0;
const uid = () => `s${++counter}`;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

const STAT_RE = /^(?:[-–—•]\s*)?([₹$€£]?\s?\d[\d,.]*\s?(?:%|k|K|M|B|x|X|\+|hrs?|days?|mins?)?)\s*[-–—:|]?\s*(.{0,60})$/;

/** Detects short numeric-led lines that deserve a big stat card. */
function asStat(text: string): { stat: string; label: string } | null {
  const t = clean(text);
  if (t.length > 70) return null;
  const m = t.match(STAT_RE);
  if (!m) return null;
  const stat = clean(m[1]);
  const label = clean(m[2] || "");
  if (!/\d/.test(stat) || !label) return null;
  return { stat, label };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Splits a long paragraph into readable slide-sized chunks. */
function splitParagraph(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > max && cur) {
      out.push(clean(cur));
      cur = s;
    } else cur += s;
  }
  if (clean(cur)) out.push(clean(cur));
  return out;
}

export interface ParseOptions {
  title: string;
  content: string;
  /** points per content slide — tighter for story/square formats */
  pointsPerSlide?: number;
  includeCta?: boolean;
  /** smart overflow: max characters of body copy that fit one card */
  maxChars?: number;
}

/**
 * Smart overflow capacity — how much copy comfortably fits a card of this size
 * at the current global text scale. Used to spill content onto a new card that
 * keeps exactly the same design.
 */
export function capacityFor(width: number, height: number, textScale = 1) {
  const area = (width * height) / (1080 * 1350);
  const maxChars = Math.max(140, Math.round((340 * area) / (textScale * textScale)));
  const pointsPerSlide = Math.max(2, Math.min(6, Math.round((4 * Math.sqrt(area)) / textScale)));
  return { maxChars, pointsPerSlide };
}

export function parseNoteToSlides({
  title,
  content,
  pointsPerSlide = 4,
  includeCta = true,
  maxChars = 340,
}: ParseOptions): CardSlide[] {

  counter = 0;
  const doc = new DOMParser().parseFromString(
    `<div id="root">${content || ""}</div>`,
    "text/html"
  );
  const root = doc.getElementById("root");
  const nodes = Array.from(root?.children || []) as HTMLElement[];

  const slides: CardSlide[] = [];
  let section: string | undefined;
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (!bulletBuffer.length) return;
    const stats = bulletBuffer.map(asStat);
    const allStats = stats.every(Boolean) && bulletBuffer.length <= 3;
    if (allStats) {
      stats.forEach((s) => {
        slides.push({
          id: uid(),
          kind: "stat",
          eyebrow: section,
          stat: s!.stat,
          statLabel: s!.label,
        });
      });
    } else {
      chunk(bulletBuffer, pointsPerSlide).forEach((group, i, all) => {
        slides.push({
          id: uid(),
          kind: "points",
          eyebrow: section,
          title: all.length > 1 ? `${section || "Key points"} (${i + 1}/${all.length})` : section || "Key points",
          points: group,
        });
      });
    }
    bulletBuffer = [];
  };

  const firstParagraph = clean(
    (nodes.find((n) => n.tagName === "P")?.textContent || "").slice(0, 180)
  );

  slides.push({
    id: uid(),
    kind: "cover",
    title: clean(title) || "Untitled note",
    subtitle: firstParagraph || undefined,
  });

  const walk = (el: HTMLElement) => {
    const tag = el.tagName.toLowerCase();
    const text = clean(el.textContent || "");

    if (/^h[1-6]$/.test(tag)) {
      flushBullets();
      section = text || section;
      return;
    }

    if (tag === "ul" || tag === "ol") {
      const items = Array.from(el.querySelectorAll(":scope > li"))
        .map((li) => clean(li.textContent || ""))
        .filter(Boolean);
      bulletBuffer.push(...items);
      return;
    }

    if (tag === "blockquote") {
      flushBullets();
      if (text)
        slides.push({ id: uid(), kind: "quote", quote: text, attribution: section });
      return;
    }

    if (tag === "pre" || tag === "code") {
      flushBullets();
      const code = (el.textContent || "").replace(/\s+$/, "");
      if (code)
        slides.push({ id: uid(), kind: "code", eyebrow: section, code, language: "code" });
      return;
    }

    if (tag === "hr") {
      flushBullets();
      return;
    }

    const img = el.tagName === "IMG" ? el : el.querySelector("img");
    if (img) {
      flushBullets();
      slides.push({
        id: uid(),
        kind: "image",
        eyebrow: section,
        imageUrl: (img as HTMLImageElement).src,
        caption: text || undefined,
      });
      const rest = clean(el.textContent || "");
      if (!rest) return;
      return;
    }

    if (tag === "p" || tag === "div") {
      if (!text) return;
      flushBullets();
      const stat = asStat(text);
      if (stat) {
        slides.push({ id: uid(), kind: "stat", eyebrow: section, stat: stat.stat, statLabel: stat.label });
        return;
      }
      splitParagraph(text, maxChars).forEach((part) =>
        slides.push({ id: uid(), kind: "paragraph", eyebrow: section, title: section, body: part })
      );
      return;
    }

    if (text) {
      flushBullets();
      slides.push({ id: uid(), kind: "paragraph", eyebrow: section, body: text });
    }
  };

  nodes.forEach(walk);
  flushBullets();

  // Drop the intro paragraph if it was reused verbatim as the cover subtitle.
  if (firstParagraph) {
    const idx = slides.findIndex((s) => s.kind === "paragraph" && s.body === firstParagraph);
    if (idx > 0) slides.splice(idx, 1);
  }

  if (slides.length === 1) {
    slides.push({
      id: uid(),
      kind: "paragraph",
      body: clean(root?.textContent || "") || "This note is empty.",
    });
  }

  if (includeCta) {
    slides.push({ id: uid(), kind: "cta", title: "Created with Oltrid", subtitle: "Your knowledge, beautifully shareable." });
  }

  return slides;
}
