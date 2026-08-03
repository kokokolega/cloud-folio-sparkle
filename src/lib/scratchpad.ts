/**
 * Scratchpad — a permanent, offline-first thinking space.
 *
 * Everything lives in localStorage the moment it is typed, so it survives
 * refreshes, restarts and full offline usage. No network required.
 */

import { readDraft, writeDraft } from "@/lib/localDraft";

export type ScratchKind = "text" | "link" | "todo" | "code" | "image" | "file" | "voice";

export interface ScratchItem {
  id: string;
  kind: ScratchKind;
  /** plain text body / url / code / transcript */
  content: string;
  /** data url for image, file and voice items */
  dataUrl?: string;
  fileName?: string;
  mime?: string;
  section: string;
  pinned: boolean;
  done?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ScratchDoc {
  items: ScratchItem[];
  sections: string[];
}

const KEY = "scratchpad";

export const DEFAULT_SECTIONS = ["Inbox", "Ideas", "To-dos"];

export function loadScratch(): ScratchDoc {
  const d = readDraft<ScratchDoc>(KEY)?.value;
  if (!d) return { items: [], sections: [...DEFAULT_SECTIONS] };
  return {
    items: Array.isArray(d.items) ? d.items : [],
    sections: d.sections?.length ? d.sections : [...DEFAULT_SECTIONS],
  };
}

export function saveScratch(doc: ScratchDoc) {
  writeDraft(KEY, doc);
}

let seq = 0;
const sid = () => `s-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const URL_RE = /^(https?:\/\/|www\.)\S+$/i;

/** Guess the best kind for a pasted / typed chunk of text. */
export function detectKind(text: string): ScratchKind {
  const t = text.trim();
  if (URL_RE.test(t)) return "link";
  if (/^[-*]\s|^\[\s?\]\s|^todo:/i.test(t)) return "todo";
  if (/[;{}]\s*$|^(const|let|function|class|def|import|SELECT)\b/m.test(t)) return "code";
  return "text";
}

export function makeItem(partial: Partial<ScratchItem> & { content: string; section: string }): ScratchItem {
  const now = Date.now();
  return {
    id: sid(),
    kind: partial.kind ?? detectKind(partial.content),
    content: partial.content,
    dataUrl: partial.dataUrl,
    fileName: partial.fileName,
    mime: partial.mime,
    section: partial.section,
    pinned: false,
    done: partial.kind === "todo" ? false : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function itemToHtml(item: ScratchItem): string {
  if (item.kind === "image" && item.dataUrl) return `<p><img src="${item.dataUrl}" alt="${escapeHtml(item.fileName || "image")}" /></p>`;
  if (item.kind === "code") return `<pre><code>${escapeHtml(item.content)}</code></pre>`;
  if (item.kind === "link") return `<p><a href="${escapeHtml(item.content)}">${escapeHtml(item.content)}</a></p>`;
  if (item.kind === "todo") return `<ul><li>${escapeHtml(item.content)}</li></ul>`;
  return `<p>${escapeHtml(item.content).replace(/\n/g, "<br/>")}</p>`;
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function titleFor(item: ScratchItem) {
  const base = item.fileName || item.content.replace(/\s+/g, " ").trim();
  return (base.slice(0, 60) || "Scratchpad note") + (base.length > 60 ? "…" : "");
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}
