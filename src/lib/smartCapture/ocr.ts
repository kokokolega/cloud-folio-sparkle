// Local, offline OCR via tesseract.js. Lazy-loaded, browser only, with a result cache.

let workerPromise: Promise<any> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return createWorker("eng");
    })();
  }
  return workerPromise;
}

const CACHE_KEY = "oltrid-ocr-cache";

function readCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, string>) {
  try {
    const entries = Object.entries(cache).slice(-200);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* quota — ignore */
  }
}

export interface OcrWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

export interface OcrResult {
  text: string;
  words: OcrWord[];
  confidence: number;
}

export async function runOcr(
  image: Blob | string,
  cacheKey?: string,
  onProgress?: (p: number) => void
): Promise<OcrResult> {
  if (cacheKey) {
    const cached = readCache()[cacheKey];
    if (cached) {
      onProgress?.(1);
      return { text: cached, words: [], confidence: 90 };
    }
  }

  const worker = await getWorker();
  const { data } = await worker.recognize(image, {}, { blocks: true });
  onProgress?.(1);

  const words: OcrWord[] = [];
  const blocks = (data as any).blocks ?? [];
  for (const b of blocks) {
    for (const p of b.paragraphs ?? []) {
      for (const l of p.lines ?? []) {
        for (const w of l.words ?? []) {
          if (w.text?.trim()) words.push({ text: w.text, bbox: w.bbox, confidence: w.confidence });
        }
      }
    }
  }

  if (cacheKey) {
    const cache = readCache();
    cache[cacheKey] = data.text;
    writeCache(cache);
  }

  return { text: data.text ?? "", words, confidence: data.confidence ?? 0 };
}

export async function terminateOcr() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}
