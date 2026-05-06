import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Eraser, Pencil, Trash2, Loader2, Wand2, Undo2 } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const COLORS = ["#0f172a", "#007AFF", "#dc2626", "#16a34a", "#f59e0b", "#9333ea"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (html: string) => void;
  onConverted?: (payload: { html: string; imageDataUrl: string }) => void;
}

export function DrawingPad({ open, onOpenChange, onInsert, onConverted }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(3);
  const [erasing, setErasing] = useState(false);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const strokes = useRef<ImageData[]>([]);
  const [converting, setConverting] = useState(false);

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokes.current = [];
  };

  useEffect(() => {
    if (open) setTimeout(setupCanvas, 50);
  }, [open]);

  const getPoint = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const saveStroke = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    strokes.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (strokes.current.length > 30) strokes.current.shift();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drawing.current = true;
    lastPoint.current = getPoint(e);
    saveStroke();
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const p = getPoint(e);
    ctx.strokeStyle = erasing ? "#ffffff" : color;
    ctx.lineWidth = erasing ? size * 6 : size;
    ctx.beginPath();
    ctx.moveTo(lastPoint.current!.x, lastPoint.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint.current = p;
  };

  const onPointerUp = () => { drawing.current = false; lastPoint.current = null; };

  const undo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const last = strokes.current.pop();
    if (last) ctx.putImageData(last, 0, 0);
  };

  const clear = () => setupCanvas();

  const convert = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setConverting(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/notes-drawing-to-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ imageBase64: base64, mode: "handwriting" }),
      });
      if (!resp.ok) throw new Error("Transcription failed");
      const { html } = await resp.json();
      if (!html) throw new Error("No text recognized");
      onInsert(html);
      toast.success("Drawing converted to text ॥");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Could not transcribe");
    } finally {
      setConverting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>Drawing Pad</DialogTitle>
          <DialogDescription>Write or sketch. Convert your handwriting into typed text.</DialogDescription>
        </VisuallyHidden>
        <div className="p-3 border-b border-border/50 flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold mr-2">Notepad — write by drawing</p>
          <div className="flex items-center gap-1">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); setErasing(false); }}
                className={`h-6 w-6 rounded-full border-2 transition-all ${color === c && !erasing ? "ring-2 ring-primary ring-offset-1 scale-110" : "border-border"}`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 ml-2">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            <Slider value={[size]} min={1} max={10} step={1} onValueChange={(v) => setSize(v[0])} className="w-24" />
          </div>
          <Button size="sm" variant={erasing ? "secondary" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => setErasing(!erasing)}>
            <Eraser className="h-3.5 w-3.5" /> Erase
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={undo}>
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs text-destructive" onClick={clear}>
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </Button>
          <div className="flex-1" />
          <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={convert} disabled={converting}>
            {converting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {converting ? "Reading…" : "Convert to text"}
          </Button>
        </div>
        <div className="bg-white">
          <canvas
            ref={canvasRef}
            className="w-full h-[480px] touch-none cursor-crosshair"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
