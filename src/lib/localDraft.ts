/**
 * Excalidraw-style local persistence.
 *
 * Every change is written to localStorage immediately (debounced by a frame),
 * so a refresh, crash or browser restart never loses work. Drafts are keyed and
 * carry a timestamp so callers can decide whether the local copy is newer than
 * whatever the cloud returned.
 */

const PREFIX = "oltrid-draft:";

export interface Draft<T> {
  value: T;
  updatedAt: number;
}

export function readDraft<T>(key: string): Draft<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft<T>;
    if (!parsed || typeof parsed.updatedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDraft<T>(key: string, value: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ value, updatedAt: Date.now() } satisfies Draft<T>));
  } catch {
    /* quota — drop silently, cloud copy still applies */
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** Remove drafts that haven't been touched in `days` days. */
export function pruneDrafts(days = 30) {
  const cutoff = Date.now() - days * 86400000;
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(PREFIX)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.updatedAt && parsed.updatedAt < cutoff) localStorage.removeItem(k);
      } catch {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}
