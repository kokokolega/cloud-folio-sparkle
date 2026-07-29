import { supabase } from "@/integrations/supabase/client";
import { runOcr } from "./ocr";
import { compressImage, hashSimilarity, perceptualHash } from "./image";
import {
  classify,
  extractEntities,
  generateTags,
  generateTitle,
  safeFileName,
  textSimilarity,
  type UserRule,
} from "./rules";

export type CaptureStep =
  | "reading"
  | "detecting"
  | "workspace"
  | "organizing"
  | "saving"
  | "done"
  | "duplicate"
  | "error";

export const STEP_LABELS: Record<string, string> = {
  reading: "Reading text",
  detecting: "Detecting category",
  workspace: "Finding workspace",
  organizing: "Organizing files",
  saving: "Saving",
};

export interface CaptureRow {
  id: string;
  user_id: string;
  file_id: string | null;
  folder_id: string | null;
  title: string;
  category: string;
  subfolder: string | null;
  tags: string[];
  ocr_text: string;
  entities: any;
  confidence: number;
  status: string;
  storage_path: string;
  size: number;
  phash: string | null;
  captured_at: string;
  created_at: string;
}

export interface DuplicateInfo {
  existing: CaptureRow;
  score: number;
}

export interface ProcessResult {
  capture?: CaptureRow;
  duplicate?: DuplicateInfo;
}

const db = supabase as any;

export async function fetchUserRules(userId: string): Promise<UserRule[]> {
  const { data } = await db
    .from("capture_rules")
    .select("keyword, category, subfolder, weight")
    .eq("user_id", userId);
  return (data ?? []) as UserRule[];
}

/** Find (or create) a nested folder path like ["College", "Physics"]. */
export async function ensureFolderPath(userId: string, path: string[]): Promise<string | null> {
  let parentId: string | null = null;
  for (const name of path.filter(Boolean)) {
    let query = db.from("folders").select("id").eq("user_id", userId).eq("name", name).limit(1);
    query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);
    const { data } = await query;
    if (data && data.length) {
      parentId = data[0].id;
      continue;
    }
    const { data: created, error } = await db
      .from("folders")
      .insert({ user_id: userId, name, parent_id: parentId })
      .select("id")
      .single();
    if (error) throw error;
    parentId = created.id;
  }
  return parentId;
}

async function findDuplicate(
  userId: string,
  phash: string,
  ocrText: string,
  size: number
): Promise<DuplicateInfo | undefined> {
  const { data } = await db
    .from("captures")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (!data?.length) return undefined;

  let best: DuplicateInfo | undefined;
  for (const row of data as CaptureRow[]) {
    const imageScore = hashSimilarity(phash, row.phash);
    const textScore = ocrText.trim().length > 40 ? textSimilarity(ocrText, row.ocr_text) : 0;
    const metaScore = row.size && Math.abs(row.size - size) / Math.max(row.size, size) < 0.02 ? 1 : 0;
    const score = imageScore * 0.6 + textScore * 0.3 + metaScore * 0.1;
    if (score > (best?.score ?? 0)) best = { existing: row, score };
  }
  return best && best.score >= 0.82 ? best : undefined;
}

export interface ProcessOptions {
  userId: string;
  file: File;
  userRules: UserRule[];
  onStep?: (step: CaptureStep) => void;
  allowDuplicate?: boolean;
}

export async function processCapture({
  userId,
  file,
  userRules,
  onStep,
  allowDuplicate,
}: ProcessOptions): Promise<ProcessResult> {
  onStep?.("reading");
  const blob = await compressImage(file);
  const cacheKey = `${file.name}:${file.size}:${file.lastModified}`;
  const ocr = await runOcr(blob, cacheKey);

  onStep?.("detecting");
  const classification = classify(ocr.text, userRules);
  const entities = extractEntities(ocr.text);
  const title = generateTitle(ocr.text, classification, entities);
  const tags = generateTags(ocr.text, classification);
  const phash = await perceptualHash(blob);

  if (!allowDuplicate) {
    const dup = await findDuplicate(userId, phash, ocr.text, blob.size);
    if (dup) {
      onStep?.("duplicate");
      return { duplicate: dup };
    }
  }

  onStep?.("workspace");
  const folderId = await ensureFolderPath(userId, [
    "Smart Capture",
    classification.category,
    classification.subfolder,
  ]);

  onStep?.("organizing");
  const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const storagePath = `${userId}/captures/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("user-files").upload(storagePath, blob, {
    contentType: blob.type || "image/jpeg",
  });
  if (upErr) throw upErr;

  onStep?.("saving");
  const displayName = safeFileName(title, ext);
  const { data: fileRow, error: fileErr } = await db
    .from("files")
    .insert({
      user_id: userId,
      folder_id: folderId,
      name: displayName,
      type: "image",
      size: blob.size,
      storage_path: storagePath,
    })
    .select("id")
    .single();
  if (fileErr) throw fileErr;

  const { data: capture, error: capErr } = await db
    .from("captures")
    .insert({
      user_id: userId,
      file_id: fileRow.id,
      folder_id: folderId,
      title,
      category: classification.category,
      subfolder: classification.subfolder,
      tags,
      ocr_text: ocr.text,
      entities,
      confidence: classification.confidence,
      status: classification.confidence < 55 ? "review" : "organized",
      storage_path: storagePath,
      size: blob.size,
      phash,
    })
    .select("*")
    .single();
  if (capErr) throw capErr;

  onStep?.("done");
  return { capture: capture as CaptureRow };
}

/** Remember a manual correction so similar captures land in the same place next time. */
export async function learnFromCorrection(
  userId: string,
  capture: CaptureRow,
  category: string,
  subfolder: string | null
) {
  const keywords = (capture.tags ?? []).slice(0, 4).map((t) => t.replace(/-/g, " "));
  for (const keyword of keywords) {
    if (!keyword || keyword.length < 3) continue;
    const { data: existing } = await db
      .from("capture_rules")
      .select("id, weight")
      .eq("user_id", userId)
      .eq("keyword", keyword)
      .eq("category", category)
      .maybeSingle();
    if (existing) {
      await db.from("capture_rules").update({ weight: existing.weight + 1, subfolder }).eq("id", existing.id);
    } else {
      await db.from("capture_rules").insert({ user_id: userId, keyword, category, subfolder, weight: 1 });
    }
  }
}

export function timeBucket(date: string): "Today" | "Yesterday" | "This Week" | "This Month" | "This Year" | "Older" {
  const d = new Date(date);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.floor((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return "This Month";
  if (d.getFullYear() === now.getFullYear()) return "This Year";
  return "Older";
}

export const TIME_BUCKETS = ["Today", "Yesterday", "This Week", "This Month", "This Year", "Older"] as const;

export function relatedCaptures(target: CaptureRow, all: CaptureRow[], limit = 6) {
  return all
    .filter((c) => c.id !== target.id)
    .map((c) => {
      const text = textSimilarity(target.ocr_text, c.ocr_text);
      const tagOverlap =
        target.tags?.length && c.tags?.length
          ? c.tags.filter((t) => target.tags.includes(t)).length / Math.min(target.tags.length, c.tags.length)
          : 0;
      const visual = hashSimilarity(target.phash, c.phash);
      return { capture: c, score: text * 0.5 + tagOverlap * 0.3 + visual * 0.2 };
    })
    .filter((r) => r.score > 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
