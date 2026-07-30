import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Check, Loader2, RotateCw, ScanLine, Maximize2 } from "lucide-react";
import {
  canvasToFile,
  detectDocumentQuad,
  enhanceCanvas,
  fullFrameQuad,
  rotateCanvas,
  toCanvas,
  warpQuad,
  type EnhanceMode,
  type Quad,
} from "@/lib/smartCapture/scan";

interface Props {
  file: File | null;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

const MODES: { id: EnhanceMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "grayscale", label: "Gray" },
  { id: "bw", label: "B&W" },
  { id: "original", label: "Original" },
];

export function CaptureReviewSheet({ file, onCancel, onConfirm }: Props) {
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [mode, setMode] = useState<EnhanceMode>("auto");
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);

  useEffect(() => {
    if (!file) {
      sourceRef.current = null;
      setPreview(null);
      setQuad(null);
      setRotation(0);
      setMode("auto");
      return;
    }
    let revoked: string | null = null;
    let cancelled = false;
    setBusy(true);
    (async () => {
      const canvas = await toCanvas(file, 1800);
      if (cancelled) return;
      sourceRef.current = canvas;
      const detected = detectDocumentQuad(canvas);
      setAutoDetected(!!detected);
      setQuad(detected ?? fullFrameQuad(canvas));
      canvas.toBlob((b) => {
        if (!b || cancelled) return;
        revoked = URL.createObjectURL(b);
        setPreview(revoked);
        setBusy(false);
      }, "image/jpeg", 0.85);
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [file]);

  const canvas = sourceRef.current;

  const toStage = useCallback(
    (p: { x: number; y: number }) => {
      if (!canvas) return { left: "0%", top: "0%" };
      return { left: `${(p.x / canvas.width) * 100}%`, top: `${(p.y / canvas.height) * 100}%` };
    },
    [canvas]
  );

  const movePoint = (index: number, clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage || !canvas) return;
    const rect = stage.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * canvas.width;
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)) * canvas.height;
    setQuad((q) => {
      if (!q) return q;
      const next = [...q] as Quad;
      next[index] = { x, y };
      return next;
    });
  };

  useEffect(() => {
    if (dragging === null) return;
    const move = (e: PointerEvent) => movePoint(dragging, e.clientX, e.clientY);
    const up = () => setDragging(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging]);

  const polygon = useMemo(() => {
    if (!quad || !canvas) return "";
    return quad.map((p) => `${(p.x / canvas.width) * 100}% ${(p.y / canvas.height) * 100}%`).join(", ");
  }, [quad, canvas]);

  const confirm = async () => {
    if (!canvas || !quad || !file) return;
    setSaving(true);
    // Yield a frame so the spinner paints before the heavy warp.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      let out = warpQuad(canvas, quad, 1600);
      if (rotation) out = rotateCanvas(out, rotation);
      out = enhanceCanvas(out, mode);
      const scanned = await canvasToFile(out, file.name.replace(/\.\w+$/, "") + "-scan.jpg");
      onConfirm(scanned);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={!!file} onOpenChange={(v) => !v && onCancel()}>
      <SheetContent
        side="bottom"
        className="h-[92dvh] rounded-t-3xl border-border/60 p-0 sm:h-[90dvh]"
      >
        <div className="flex h-full flex-col">
          <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" />

          <div className="flex items-center justify-between px-5 pb-3 pt-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Review scan</p>
              <p className="text-[11px] text-muted-foreground">
                {autoDetected ? "Edges detected — drag corners to adjust" : "Drag the corners to frame the document"}
              </p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[10.5px] text-muted-foreground">
              <ScanLine className="h-3 w-3" /> On-device
            </span>
          </div>

          <div className="flex-1 overflow-hidden px-4">
            <div className="relative flex h-full items-center justify-center">
              {busy || !preview ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-[11px]">Analysing edges…</span>
                </div>
              ) : (
                <div ref={stageRef} className="relative max-h-full max-w-full">
                  <img
                    src={preview}
                    alt="Captured document preview"
                    className="max-h-[52dvh] w-auto rounded-2xl object-contain"
                    draggable={false}
                  />
                  {quad && (
                    <>
                      <div
                        className="pointer-events-none absolute inset-0 rounded-2xl bg-background/55"
                        style={{
                          clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${polygon}, 0% 0%)`,
                        }}
                      />
                      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <polygon
                          points={quad
                            .map((p) => `${(p.x / (canvas?.width || 1)) * 100},${(p.y / (canvas?.height || 1)) * 100}`)
                            .join(" ")}
                          className="fill-primary/10 stroke-primary"
                          strokeWidth={0.5}
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                      {quad.map((p, i) => (
                        <motion.button
                          key={i}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            setDragging(i);
                          }}
                          whileTap={{ scale: 1.25 }}
                          aria-label={`Adjust corner ${i + 1}`}
                          className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-primary bg-background/90 shadow-md"
                          style={toStage(p)}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 space-y-3 border-t border-border/60 px-5 pb-6 pt-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] transition-all ${
                    mode === m.id
                      ? "border-foreground/25 bg-secondary text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m.label}
                </button>
              ))}
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                aria-label="Rotate"
                className="ml-auto shrink-0 rounded-full border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => canvas && setQuad(fullFrameQuad(canvas))}
                aria-label="Use full frame"
                className="shrink-0 rounded-full border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel} className="h-10 flex-1 rounded-xl text-xs">
                Retake
              </Button>
              <Button onClick={confirm} disabled={busy || saving} className="h-10 flex-[1.6] rounded-xl text-xs">
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                {saving ? "Enhancing…" : "Scan & organize"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
