/**
 * Local document scanning engine — edge detection, perspective correction and
 * enhancement. 100% on-device, no network, no AI. Tuned to stay fast on
 * low-end phones by working on a downscaled analysis buffer.
 */

export interface Point {
  x: number;
  y: number;
}
export type Quad = [Point, Point, Point, Point]; // TL, TR, BR, BL

export type EnhanceMode = "original" | "auto" | "grayscale" | "bw";

const ANALYSIS_MAX = 320;

/** Load any blob into a canvas (decoded off the main thread when supported). */
export async function toCanvas(source: Blob | HTMLImageElement, maxDim = 2000) {
  let width: number;
  let height: number;
  let drawable: CanvasImageSource;
  let bitmap: ImageBitmap | null = null;

  if (source instanceof Blob) {
    bitmap = await createImageBitmap(source);
    width = bitmap.width;
    height = bitmap.height;
    drawable = bitmap;
  } else {
    width = source.naturalWidth;
    height = source.naturalHeight;
    drawable = source;
  }

  const scale = Math.min(1, maxDim / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(drawable, 0, 0, canvas.width, canvas.height);
  bitmap?.close?.();
  return canvas;
}

/**
 * Detect the document quadrilateral. Uses a Sobel gradient map on a small
 * buffer, keeps the strongest edge pixels, then picks the extreme corners of
 * that point cloud. Returns null when no confident document edge is found.
 */
export function detectDocumentQuad(canvas: HTMLCanvasElement): Quad | null {
  const scale = Math.min(1, ANALYSIS_MAX / Math.max(canvas.width, canvas.height));
  const w = Math.max(32, Math.round(canvas.width * scale));
  const h = Math.max(32, Math.round(canvas.height * scale));

  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const sctx = small.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(canvas, 0, 0, w, h);
  const { data } = sctx.getImageData(0, 0, w, h);

  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // Sobel magnitude
  const mag = new Float32Array(w * h);
  let max = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1] +
        gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
      const gy =
        -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] +
        gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      const m = Math.hypot(gx, gy);
      mag[i] = m;
      if (m > max) max = m;
    }
  }
  if (max < 40) return null;

  const threshold = max * 0.32;
  let count = 0;
  let tl = { x: 0, y: 0, s: Infinity };
  let br = { x: 0, y: 0, s: -Infinity };
  let tr = { x: 0, y: 0, s: -Infinity };
  let bl = { x: 0, y: 0, s: Infinity };

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (mag[y * w + x] < threshold) continue;
      count++;
      const sum = x + y;
      const diff = x - y;
      if (sum < tl.s) tl = { x, y, s: sum };
      if (sum > br.s) br = { x, y, s: sum };
      if (diff > tr.s) tr = { x, y, s: diff };
      if (diff < bl.s) bl = { x, y, s: diff };
    }
  }

  if (count < w * h * 0.004) return null;

  const inv = 1 / scale;
  const quad: Quad = [
    { x: tl.x * inv, y: tl.y * inv },
    { x: tr.x * inv, y: tr.y * inv },
    { x: br.x * inv, y: br.y * inv },
    { x: bl.x * inv, y: bl.y * inv },
  ];

  // Reject degenerate detections (too small or basically the full frame edge noise)
  const area = quadArea(quad);
  const full = canvas.width * canvas.height;
  if (area < full * 0.12) return null;
  return quad;
}

export function quadArea(q: Quad) {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const p = q[i];
    const n = q[(i + 1) % 4];
    a += p.x * n.y - n.x * p.y;
  }
  return Math.abs(a) / 2;
}

export function fullFrameQuad(canvas: HTMLCanvasElement): Quad {
  const m = 0.02;
  const x0 = canvas.width * m;
  const y0 = canvas.height * m;
  const x1 = canvas.width * (1 - m);
  const y1 = canvas.height * (1 - m);
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/** Solve the 8-parameter homography mapping destination rect -> source quad. */
function solveHomography(dst: Quad, src: Quad): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = dst[i];
    const { x: u, y: v } = src[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }
  // Gaussian elimination with partial pivoting
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    const pv = A[col][col] || 1e-9;
    for (let r = col + 1; r < 8; r++) {
      const f = A[r][col] / pv;
      if (!f) continue;
      for (let c = col; c < 8; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  const h = new Array(8).fill(0);
  for (let r = 7; r >= 0; r--) {
    let s = b[r];
    for (let c = r + 1; c < 8; c++) s -= A[r][c] * h[c];
    h[r] = s / (A[r][r] || 1e-9);
  }
  return h;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Perspective-correct the quad into a clean, upright rectangle. */
export function warpQuad(source: HTMLCanvasElement, quad: Quad, maxDim = 1600): HTMLCanvasElement {
  const wTop = dist(quad[0], quad[1]);
  const wBottom = dist(quad[3], quad[2]);
  const hLeft = dist(quad[0], quad[3]);
  const hRight = dist(quad[1], quad[2]);
  let outW = Math.round(Math.max(wTop, wBottom));
  let outH = Math.round(Math.max(hLeft, hRight));
  const s = Math.min(1, maxDim / Math.max(outW, outH));
  outW = Math.max(16, Math.round(outW * s));
  outH = Math.max(16, Math.round(outH * s));

  const dstQuad: Quad = [
    { x: 0, y: 0 },
    { x: outW - 1, y: 0 },
    { x: outW - 1, y: outH - 1 },
    { x: 0, y: outH - 1 },
  ];
  const h = solveHomography(dstQuad, quad);

  const sctx = source.getContext("2d", { willReadFrequently: true })!;
  const src = sctx.getImageData(0, 0, source.width, source.height);
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const octx = out.getContext("2d")!;
  const dstImg = octx.createImageData(outW, outH);

  const sw = source.width;
  const sh = source.height;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const den = h[6] * x + h[7] * y + 1;
      const u = (h[0] * x + h[1] * y + h[2]) / den;
      const v = (h[3] * x + h[4] * y + h[5]) / den;
      const su = Math.min(sw - 1, Math.max(0, Math.round(u)));
      const sv = Math.min(sh - 1, Math.max(0, Math.round(v)));
      const si = (sv * sw + su) * 4;
      const di = (y * outW + x) * 4;
      dstImg.data[di] = src.data[si];
      dstImg.data[di + 1] = src.data[si + 1];
      dstImg.data[di + 2] = src.data[si + 2];
      dstImg.data[di + 3] = 255;
    }
  }
  octx.putImageData(dstImg, 0, 0);
  return out;
}

/** Contrast / readability enhancement suitable for OCR. */
export function enhanceCanvas(canvas: HTMLCanvasElement, mode: EnhanceMode): HTMLCanvasElement {
  if (mode === "original") return canvas;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;

  if (mode === "grayscale" || mode === "bw") {
    let sum = 0;
    const gray = new Uint8ClampedArray(d.length / 4);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      gray[p] = g;
      sum += g;
    }
    const mean = sum / gray.length;
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      let v = gray[p];
      if (mode === "bw") v = v > mean * 0.92 ? 255 : 0;
      else v = Math.min(255, Math.max(0, (v - mean) * 1.35 + mean + 12));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  } else {
    // auto: white balance + contrast stretch per channel
    for (let c = 0; c < 3; c++) {
      let lo = 255;
      let hi = 0;
      for (let i = c; i < d.length; i += 4) {
        if (d[i] < lo) lo = d[i];
        if (d[i] > hi) hi = d[i];
      }
      const range = Math.max(1, hi - lo);
      for (let i = c; i < d.length; i += 4) {
        d[i] = Math.min(255, Math.max(0, ((d[i] - lo) / range) * 255 * 1.02));
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function rotateCanvas(canvas: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const rad = (degrees * Math.PI) / 180;
  const swap = Math.abs(degrees % 180) === 90;
  const out = document.createElement("canvas");
  out.width = swap ? canvas.height : canvas.width;
  out.height = swap ? canvas.width : canvas.height;
  const ctx = out.getContext("2d")!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

export function canvasToFile(canvas: HTMLCanvasElement, name: string, quality = 0.88): Promise<File> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(new File([blob!], name, { type: "image/jpeg" })),
      "image/jpeg",
      quality
    );
  });
}


/**
 * Zero-click scan: detect the document, straighten it, enhance it and hand back
 * a ready-to-store file. Falls back to the original frame when no reliable
 * document outline is found.
 */
export async function autoScan(file: File, mode: EnhanceMode = "auto"): Promise<File> {
  try {
    const canvas = await toCanvas(file);
    const quad = detectDocumentQuad(canvas);
    const full = fullFrameQuad(canvas);
    const useQuad =
      quad && quadArea(quad) > quadArea(full) * 0.25 && quadArea(quad) < quadArea(full) * 0.995 ? quad : null;
    const warped = useQuad ? warpQuad(canvas, useQuad) : canvas;
    const enhanced = enhanceCanvas(warped, mode);
    return await canvasToFile(enhanced, file.name || `scan-${Date.now()}.jpg`);
  } catch {
    return file;
  }
}
