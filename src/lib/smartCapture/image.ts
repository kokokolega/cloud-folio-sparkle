/** Perceptual (average) hash — 64-bit, hex encoded. Fully local. */
export async function perceptualHash(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 8;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(bitmap, 0, 0, size, size);
  bitmap.close?.();
  const { data } = ctx.getImageData(0, 0, size, size);
  const gray: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  const avg = gray.reduce((a, b) => a + b, 0) / gray.length;
  let hex = "";
  for (let i = 0; i < gray.length; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4; j++) nibble = (nibble << 1) | (gray[i + j] > avg ? 1 : 0);
    hex += nibble.toString(16);
  }
  return hex;
}

/** 0..1 similarity between two hex hashes. */
export function hashSimilarity(a?: string | null, b?: string | null): number {
  if (!a || !b || a.length !== b.length) return 0;
  let same = 0;
  const total = a.length * 4;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    for (let bit = 0; bit < 4; bit++) if (!((x >> bit) & 1)) same++;
  }
  return same / total;
}

/** Downscale large images before upload/OCR to keep things fast. */
export async function compressImage(file: File, maxDim = 1600, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}
