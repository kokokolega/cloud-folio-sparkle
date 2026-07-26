import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Pencil, Eraser, Square, Circle as CircleIcon, Minus as LineIcon, ArrowRight,
  Type as TypeIcon, MousePointer2, Trash2, Undo2, Redo2, Download, ImagePlus,
  X, Maximize2, Minimize2,
} from "lucide-react";
import { toast } from "sonner";

type Tool = "select" | "pen" | "eraser" | "rect" | "ellipse" | "line" | "arrow" | "text";

type ElBase = { id: string; color: string; size: number };
type PenEl = ElBase & { type: "pen"; points: { x: number; y: number }[] };
type ShapeEl = ElBase & { type: "rect" | "ellipse" | "line" | "arrow"; x1: number; y1: number; x2: number; y2: number };
type TextEl = ElBase & { type: "text"; x: number; y: number; text: string };
type El = PenEl | ShapeEl | TextEl;

const COLORS = ["#0f172a", "#007AFF", "#dc2626", "#16a34a", "#f59e0b", "#9333ea"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (html: string) => void;
  onInsertImage?: (dataUrl: string) => void;
}

export function DrawingPad({ open, onOpenChange, onInsert, onInsertImage }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(3);
  const [expanded, setExpanded] = useState(false);

  const elementsRef = useRef<El[]>([]);
  const historyRef = useRef<El[][]>([[]]);
  const historyIndexRef = useRef(0);
  const drawingRef = useRef(false);
  const currentRef = useRef<El | null>(null);
  const [, forceRerender] = useState(0);
  const rerender = () => forceRerender((n) => n + 1);

  const pushHistory = () => {
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(JSON.parse(JSON.stringify(elementsRef.current)));
    historyIndexRef.current++;
    if (historyRef.current.length > 60) {
      historyRef.current.shift();
      historyIndexRef.current--;
    }
  };

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(resize, 50);
    const onR = () => resize();
    window.addEventListener("resize", onR);
    return () => { clearTimeout(t); window.removeEventListener("resize", onR); };
  }, [open, expanded, resize]);

  useEffect(() => {
    if (open) {
      elementsRef.current = [];
      historyRef.current = [[]];
      historyIndexRef.current = 0;
    }
  }, [open]);

  const drawEl = (ctx: CanvasRenderingContext2D, el: El) => {
    ctx.strokeStyle = el.color;
    ctx.fillStyle = el.color;
    ctx.lineWidth = el.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (el.type === "pen") {
      if (el.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(el.points[0].x, el.points[0].y);
      // smooth quadratic curves
      for (let i = 1; i < el.points.length - 1; i++) {
        const midX = (el.points[i].x + el.points[i + 1].x) / 2;
        const midY = (el.points[i].y + el.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(el.points[i].x, el.points[i].y, midX, midY);
      }
      const last = el.points[el.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    } else if (el.type === "rect") {
      ctx.strokeRect(el.x1, el.y1, el.x2 - el.x1, el.y2 - el.y1);
    } else if (el.type === "ellipse") {
      const cx = (el.x1 + el.x2) / 2;
      const cy = (el.y1 + el.y2) / 2;
      const rx = Math.abs(el.x2 - el.x1) / 2;
      const ry = Math.abs(el.y2 - el.y1) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (el.type === "line" || el.type === "arrow") {
      ctx.beginPath();
      ctx.moveTo(el.x1, el.y1);
      ctx.lineTo(el.x2, el.y2);
      ctx.stroke();
      if (el.type === "arrow") {
        const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
        const head = 10 + el.size * 2;
        ctx.beginPath();
        ctx.moveTo(el.x2, el.y2);
        ctx.lineTo(el.x2 - head * Math.cos(angle - Math.PI / 6), el.y2 - head * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(el.x2, el.y2);
        ctx.lineTo(el.x2 - head * Math.cos(angle + Math.PI / 6), el.y2 - head * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    } else if (el.type === "text") {
      ctx.font = `${12 + el.size * 4}px Inter, sans-serif`;
      ctx.textBaseline = "top";
      el.text.split("\n").forEach((line, i) => {
        ctx.fillText(line, el.x, el.y + i * (14 + el.size * 4));
      });
    }
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    for (const el of elementsRef.current) drawEl(ctx, el);
    if (currentRef.current) drawEl(ctx, currentRef.current);
  };

  const getPos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const uid = () => Math.random().toString(36).slice(2, 10);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = getPos(e);

    if (tool === "eraser") {
      // erase topmost element under pointer
      for (let i = elementsRef.current.length - 1; i >= 0; i--) {
        if (hitTest(elementsRef.current[i], p)) {
          elementsRef.current.splice(i, 1);
          pushHistory();
          redraw();
          break;
        }
      }
      drawingRef.current = true;
      return;
    }
    if (tool === "text") {
      const text = window.prompt("Enter text");
      if (text) {
        elementsRef.current.push({ id: uid(), type: "text", x: p.x, y: p.y, text, color, size });
        pushHistory();
        redraw();
      }
      return;
    }
    if (tool === "select") return;

    drawingRef.current = true;
    if (tool === "pen") {
      currentRef.current = { id: uid(), type: "pen", color, size, points: [p] };
    } else {
      currentRef.current = { id: uid(), type: tool, color, size, x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    }
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const p = getPos(e);
    if (tool === "eraser") {
      for (let i = elementsRef.current.length - 1; i >= 0; i--) {
        if (hitTest(elementsRef.current[i], p)) {
          elementsRef.current.splice(i, 1);
          redraw();
          break;
        }
      }
      return;
    }
    const cur = currentRef.current;
    if (!cur) return;
    if (cur.type === "pen") cur.points.push(p);
    else if (cur.type !== "text") { cur.x2 = p.x; cur.y2 = p.y; }
    redraw();
  };

  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (tool === "eraser") { pushHistory(); return; }
    const cur = currentRef.current;
    if (cur) {
      elementsRef.current.push(cur);
      currentRef.current = null;
      pushHistory();
      redraw();
    }
  };

  const hitTest = (el: El, p: { x: number; y: number }) => {
    const tol = Math.max(6, el.size + 4);
    if (el.type === "pen") {
      return el.points.some((pt) => Math.hypot(pt.x - p.x, pt.y - p.y) < tol);
    }
    if (el.type === "text") {
      return p.x >= el.x - tol && p.x <= el.x + 200 && p.y >= el.y - tol && p.y <= el.y + 30;
    }
    const minX = Math.min(el.x1, el.x2) - tol;
    const maxX = Math.max(el.x1, el.x2) + tol;
    const minY = Math.min(el.y1, el.y2) - tol;
    const maxY = Math.max(el.y1, el.y2) + tol;
    return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
  };

  const undo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      elementsRef.current = JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current]));
      redraw(); rerender();
    }
  };
  const redo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      elementsRef.current = JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current]));
      redraw(); rerender();
    }
  };
  const clear = () => {
    elementsRef.current = [];
    currentRef.current = null;
    pushHistory();
    redraw();
  };

  const exportPng = () => canvasRef.current?.toDataURL("image/png") ?? "";

  const saveDrawing = () => {
    if (elementsRef.current.length === 0) {
      toast.error("Draw something first");
      return;
    }
    const dataUrl = exportPng();
    if (onInsertImage) onInsertImage(dataUrl);
    else onInsert(`<img src="${dataUrl}" />`);
    toast.success("Drawing added to note");
    onOpenChange(false);
  };

  const downloadDrawing = () => {
    const a = document.createElement("a");
    a.href = exportPng();
    a.download = `sketch-${Date.now()}.png`;
    a.click();
  };

  const TOOL_BTNS: { id: Tool; icon: any; label: string }[] = [
    { id: "select", icon: MousePointer2, label: "Select" },
    { id: "pen", icon: Pencil, label: "Pen" },
    { id: "rect", icon: Square, label: "Rectangle" },
    { id: "ellipse", icon: CircleIcon, label: "Ellipse" },
    { id: "line", icon: LineIcon, label: "Line" },
    { id: "arrow", icon: ArrowRight, label: "Arrow" },
    { id: "text", icon: TypeIcon, label: "Text" },
    { id: "eraser", icon: Eraser, label: "Eraser" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`p-0 overflow-hidden flex flex-col ${expanded ? "w-screen h-screen max-w-none sm:max-w-none rounded-none" : "w-[98vw] sm:w-[95vw] max-w-4xl h-[90vh] sm:h-[85vh]"}`}>
        <VisuallyHidden>
          <DialogTitle>Sketch Pad</DialogTitle>
          <DialogDescription>Draw with shapes, freehand, arrows, and text.</DialogDescription>
        </VisuallyHidden>

        <div className="p-2 border-b border-border/50 flex items-center gap-1 flex-wrap">
          <p className="text-[13px] font-semibold mr-2 pl-1">Sketch</p>

          <div className="flex items-center gap-0.5 rounded-lg bg-muted/40 p-0.5">
            {TOOL_BTNS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                title={t.label}
                className={`h-7 w-7 flex items-center justify-center rounded-md transition-all ${tool === t.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <t.icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 ml-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-5 w-5 rounded-full border-2 transition-all ${color === c ? "ring-2 ring-primary ring-offset-1 scale-110" : "border-border"}`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-2 ml-2 px-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Size</span>
            <Slider value={[size]} min={1} max={12} step={1} onValueChange={(v) => setSize(v[0])} className="w-20" />
          </div>

          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs px-2" onClick={undo} title="Undo">
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs px-2" onClick={redo} title="Redo">
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs px-2 text-destructive" onClick={clear} title="Clear">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>

          <div className="flex-1" />

          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs px-2" onClick={downloadDrawing} title="Download PNG">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="h-7 gap-1 text-xs px-2" onClick={saveDrawing} title="Insert into note">
            <ImagePlus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Insert</span>
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setExpanded((v) => !v)} title={expanded ? "Restore" : "Expand"}>
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onOpenChange(false)} title="Close">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div ref={wrapRef} className="flex-1 min-h-0 bg-white relative overflow-hidden">
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 touch-none block ${tool === "text" ? "cursor-text" : tool === "select" ? "cursor-default" : "cursor-crosshair"}`}
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
