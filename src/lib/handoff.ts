/**
 * Multi-device handoff state registry.
 *
 * Any feature can publish a small slice of its live state (zoom level, open
 * document, selected tool, cursor position, unsaved text …). The handoff hook
 * snapshots the registry and syncs it to the cloud in the background, and the
 * restore side writes it back so features can pick it up on the new device.
 */

export type HandoffSlice = Record<string, unknown>;

const registry = new Map<string, HandoffSlice>();
const RESTORE_KEY = "oltrid-handoff-restore";

export function publishHandoffState(key: string, value: HandoffSlice | null) {
  if (value === null) registry.delete(key);
  else registry.set(key, value);
}

export function snapshotHandoffState(): Record<string, HandoffSlice> {
  return Object.fromEntries(registry.entries());
}

/** Stash the incoming state so pages can read it once they mount. */
export function stageRestore(state: Record<string, unknown>) {
  try {
    sessionStorage.setItem(RESTORE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** Read (and keep) a restored slice for a feature key. */
export function readRestore<T = HandoffSlice>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(RESTORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed?.[key] as T) ?? null;
  } catch {
    return null;
  }
}

export function clearRestore() {
  try {
    sessionStorage.removeItem(RESTORE_KEY);
  } catch {
    /* ignore */
  }
}

export function deviceId(): string {
  const KEY = "oltrid-device-id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `d-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const kind = /iPad|Tablet/i.test(ua) ? "Tablet" : /Mobi|Android|iPhone/i.test(ua) ? "Phone" : "Desktop";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : "";
  return [kind, os && `· ${os}`, `· ${browser}`].filter(Boolean).join(" ");
}

export function scrollSnapshot() {
  const main = document.querySelector("main");
  return {
    window: window.scrollY,
    main: main ? main.scrollTop : 0,
  };
}

export function applyScroll(s: { window?: number; main?: number } | undefined) {
  if (!s) return;
  requestAnimationFrame(() => {
    if (typeof s.window === "number") window.scrollTo({ top: s.window });
    const main = document.querySelector("main");
    if (main && typeof s.main === "number") main.scrollTop = s.main;
  });
}
