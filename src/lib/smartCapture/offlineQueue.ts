/**
 * Offline-first queue for Smart Capture.
 *
 * Captures are always written to IndexedDB first (image blob + metadata), so the
 * whole flow — capture, scan, enhance, OCR, organize — works with no network.
 * Queued items sync to the cloud automatically as soon as the browser is online.
 */

import { supabase } from "@/integrations/supabase/client";
import { processCapture, fetchUserRules, type CaptureRow } from "./pipeline";
import type { UserRule } from "./rules";

const DB_NAME = "oltrid-capture";
const DB_VERSION = 1;
const PENDING = "pending";
const CACHE = "captures";

export interface PendingCapture {
  id: string;
  userId: string;
  blob: Blob;
  name: string;
  createdAt: string;
  allowDuplicate?: boolean;
  error?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PENDING)) db.createObjectStore(PENDING, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CACHE)) db.createObjectStore(CACHE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction([store], mode);
    const req = run(t.objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

/* ---------------- pending queue ---------------- */

export async function queueCapture(item: Omit<PendingCapture, "id" | "createdAt">): Promise<PendingCapture> {
  const record: PendingCapture = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await tx(PENDING, "readwrite", (s) => s.put(record));
  return record;
}

export async function listPending(userId: string): Promise<PendingCapture[]> {
  const all = await tx<PendingCapture[]>(PENDING, "readonly", (s) => s.getAll());
  return (all ?? []).filter((p) => p.userId === userId);
}

export async function removePending(id: string) {
  await tx(PENDING, "readwrite", (s) => s.delete(id));
}

/* ---------------- local capture cache (offline reads) ---------------- */

export async function cacheCaptures(rows: CaptureRow[]) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([CACHE], "readwrite");
    const store = t.objectStore(CACHE);
    rows.forEach((r) => store.put(r));
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = () => reject(t.error);
  });
}

export async function readCachedCaptures(userId: string): Promise<CaptureRow[]> {
  const all = await tx<CaptureRow[]>(CACHE, "readonly", (s) => s.getAll());
  return (all ?? [])
    .filter((c) => c.user_id === userId)
    .sort((a, b) => (a.captured_at < b.captured_at ? 1 : -1));
}

/* ---------------- sync ---------------- */

export interface SyncOutcome {
  synced: CaptureRow[];
  failed: number;
}

let syncing = false;

export async function syncPendingCaptures(
  userId: string,
  onProgress?: (done: number, total: number) => void
): Promise<SyncOutcome> {
  if (syncing || !navigator.onLine) return { synced: [], failed: 0 };
  syncing = true;
  const synced: CaptureRow[] = [];
  let failed = 0;
  try {
    const pending = await listPending(userId);
    if (!pending.length) return { synced, failed };

    let rules: UserRule[] = [];
    try {
      rules = await fetchUserRules(userId);
    } catch {
      /* offline mid-flight */
    }

    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      onProgress?.(i + 1, pending.length);
      try {
        const file = new File([item.blob], item.name, { type: item.blob.type || "image/jpeg" });
        const res = await processCapture({
          userId,
          file,
          userRules: rules,
          allowDuplicate: item.allowDuplicate ?? true,
        });
        if (res.capture) synced.push(res.capture);
        await removePending(item.id);
      } catch {
        failed++;
      }
      if (!navigator.onLine) break;
    }
    if (synced.length) await cacheCaptures(synced);
    return { synced, failed };
  } finally {
    syncing = false;
  }
}

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export async function warmCaptureCache(userId: string) {
  if (!isOnline()) return;
  const { data } = await (supabase as any)
    .from("captures")
    .select("*")
    .eq("user_id", userId)
    .order("captured_at", { ascending: false })
    .limit(400);
  if (data) await cacheCaptures(data as CaptureRow[]);
}
