import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCapture: (file: File) => void;
}

export function CaptureCamera({ open, onOpenChange, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setReady(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
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
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, facing, onOpenChange]);

  const shoot = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
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
      <DialogContent className="max-w-[100vw] sm:max-w-2xl h-[100dvh] sm:h-auto p-0 gap-0 border-0 bg-black/95 rounded-none sm:rounded-3xl overflow-hidden">
        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium text-white/90">Smart Capture</span>
            <button onClick={() => onOpenChange(false)} className="rounded-full p-2 text-white/70 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative flex-1 min-h-[50vh] sm:min-h-0 sm:aspect-video bg-black">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-white/60">
                Starting camera…
              </div>
            )}
            <div className="pointer-events-none absolute inset-6 rounded-2xl border border-white/25" />
          </div>

          <div className="flex items-center justify-center gap-6 px-4 py-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
              className="h-11 w-11 rounded-full text-white/80 hover:bg-white/10 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <button
              onClick={shoot}
              disabled={!ready}
              aria-label="Take photo"
              className="h-16 w-16 rounded-full border-4 border-white/80 bg-white/90 transition-transform active:scale-95 disabled:opacity-40"
            >
              <Camera className="mx-auto h-6 w-6 text-black" />
            </button>
            <span className="h-11 w-11" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
