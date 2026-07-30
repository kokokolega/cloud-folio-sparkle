import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Camera, ImagePlus, RefreshCw, X, Zap, ZapOff, Grid3x3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCapture: (file: File) => void;
  onImport?: () => void;
}

const MAX_ZOOM = 4;

export function CaptureCamera({ open, onOpenChange, onCapture, onImport }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const swipeRef = useRef<number | null>(null);

  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [torch, setTorch] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [grid, setGrid] = useState(true);
  const [flash, setFlash] = useState(false);
  const [focusAt, setFocusAt] = useState<{ x: number; y: number; k: number } | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      setReady(false);
      setZoom(1);
      setTorch(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as any;
        setHasTorch(!!caps.torch);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch {
        toast.error("Camera unavailable — import an image instead");
        onOpenChange(false);
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, facing, onOpenChange, stop]);

  // Apply optical zoom where supported, otherwise fall back to CSS scale.
  const [opticalZoom, setOpticalZoom] = useState(false);
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const caps = (track.getCapabilities?.() ?? {}) as any;
    if (!caps.zoom) {
      setOpticalZoom(false);
      return;
    }
    setOpticalZoom(true);
    const value = Math.min(caps.max, Math.max(caps.min, caps.min + (caps.max - caps.min) * ((zoom - 1) / (MAX_ZOOM - 1))));
    track.applyConstraints({ advanced: [{ zoom: value }] } as any).catch(() => undefined);
  }, [zoom, ready]);

  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !hasTorch) return;
    track.applyConstraints({ advanced: [{ torch }] } as any).catch(() => undefined);
  }, [torch, hasTorch]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinchRef.current = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom };
      swipeRef.current = null;
    } else if (e.touches.length === 1) {
      swipeRef.current = e.touches[0].clientX;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const next = pinchRef.current.zoom * (d / pinchRef.current.dist);
      setZoom(Math.min(MAX_ZOOM, Math.max(1, next)));
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    pinchRef.current = null;
    const start = swipeRef.current;
    swipeRef.current = null;
    if (start != null && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - start;
      if (Math.abs(dx) > 90) setFacing((f) => (f === "environment" ? "user" : "environment"));
    }
  };

  const tapFocus = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setFocusAt({ x: e.clientX - rect.left, y: e.clientY - rect.top, k: Date.now() });
    window.setTimeout(() => setFocusAt(null), 650);
  };

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const canvas = document.createElement("canvas");
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    // Honour digital zoom by cropping the centre when optical zoom isn't available.
    const z = opticalZoom ? 1 : zoom;
    const cw = vw / z;
    const ch = vh / z;
    canvas.width = Math.round(cw);
    canvas.height = Math.round(ch);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, canvas.width, canvas.height);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 160);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" }));
        onOpenChange(false);
      },
      "image/jpeg",
      0.92
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] sm:max-w-2xl h-[100dvh] sm:h-auto p-0 gap-0 border-0 bg-black rounded-none sm:rounded-3xl overflow-hidden [&>button]:hidden">
        <div className="relative flex h-full flex-col select-none">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close camera"
              className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="text-[13px] font-medium tracking-tight text-white/90">Smart Capture</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setGrid((g) => !g)}
                aria-label="Toggle grid"
                className={`rounded-full p-2 transition-colors ${grid ? "text-white" : "text-white/40"} hover:bg-white/10`}
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => hasTorch && setTorch((t) => !t)}
                aria-label="Toggle flash"
                disabled={!hasTorch}
                className={`rounded-full p-2 transition-colors disabled:opacity-25 ${torch ? "text-amber-300" : "text-white/70"} hover:bg-white/10`}
              >
                {torch ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div
            className="relative flex-1 min-h-[52vh] touch-none overflow-hidden bg-black sm:min-h-0 sm:aspect-[3/4] sm:max-h-[70vh]"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onClick={tapFocus}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover transition-transform duration-150 will-change-transform"
              style={{ transform: opticalZoom ? undefined : `scale(${zoom})` }}
            />

            {grid && (
              <div className="pointer-events-none absolute inset-0 opacity-25">
                <div className="absolute left-1/3 top-0 h-full w-px bg-white" />
                <div className="absolute left-2/3 top-0 h-full w-px bg-white" />
                <div className="absolute left-0 top-1/3 h-px w-full bg-white" />
                <div className="absolute left-0 top-2/3 h-px w-full bg-white" />
              </div>
            )}

            {/* Document framing corners */}
            <div className="pointer-events-none absolute inset-7">
              {[
                "left-0 top-0 border-l-2 border-t-2 rounded-tl-xl",
                "right-0 top-0 border-r-2 border-t-2 rounded-tr-xl",
                "right-0 bottom-0 border-r-2 border-b-2 rounded-br-xl",
                "left-0 bottom-0 border-l-2 border-b-2 rounded-bl-xl",
              ].map((c) => (
                <span key={c} className={`absolute h-8 w-8 border-white/70 ${c}`} />
              ))}
            </div>

            <AnimatePresence>
              {focusAt && (
                <motion.span
                  key={focusAt.k}
                  initial={{ scale: 1.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="pointer-events-none absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200/90"
                  style={{ left: focusAt.x, top: focusAt.y }}
                />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {zoom > 1.02 && (
                <motion.span
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-1 text-[11px] text-white backdrop-blur"
                >
                  {zoom.toFixed(1)}×
                </motion.span>
              )}
            </AnimatePresence>

            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white/60">
                Starting camera…
              </div>
            )}

            <AnimatePresence>
              {flash && (
                <motion.div
                  initial={{ opacity: 0.85 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="pointer-events-none absolute inset-0 bg-white"
                />
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between px-8 py-6 sm:py-7">
            <button
              onClick={() => {
                onOpenChange(false);
                onImport?.();
              }}
              aria-label="Import from gallery"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ImagePlus className="h-4 w-4" />
            </button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={shoot}
              disabled={!ready}
              aria-label="Take photo"
              className="flex h-[70px] w-[70px] items-center justify-center rounded-full border-[3px] border-white/85 bg-white/95 shadow-[0_0_40px_-8px_rgba(255,255,255,0.55)] disabled:opacity-40"
            >
              <Camera className="h-6 w-6 text-black" />
            </motion.button>

            <motion.button
              whileTap={{ rotate: 180 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
              aria-label="Switch camera"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </motion.button>
          </div>

          <p className="pb-4 text-center text-[10.5px] text-white/35 sm:hidden">
            Pinch to zoom · swipe to flip · tap to focus
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
