import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Type, Image as ImageIcon, ListChecks, Table as TableIcon, Code2, Pencil, Link2, Paperclip,
  Mic, BarChart3, Network, Workflow, GitBranch, Clock, Copy, Trash2, Plus, Link, X, Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { MermaidDiagram } from "@/components/ai/MermaidDiagram";
import {
  CARD_COLORS, cardSurface, createCard, convertNote,
  type CardKind, type CardsDoc, type ConversionKind, type NoteCard,
} from "@/lib/noteCards";

const PALETTE: { kind: CardKind; label: string; icon: React.ElementType }[] = [
  { kind: "text", label: "Text", icon: Type },
  { kind: "image", label: "Image", icon: ImageIcon },
  { kind: "checklist", label: "Checklist", icon: ListChecks },
  { kind: "table", label: "Table", icon: TableIcon },
  { kind: "code", label: "Code", icon: Code2 },
  { kind: "drawing", label: "Drawing", icon: Pencil },
  { kind: "link", label: "Link", icon: Link2 },
  { kind: "file", label: "File", icon: Paperclip },
  { kind: "voice", label: "Voice", icon: Mic },
  { kind: "chart", label: "Chart", icon: BarChart3 },
  { kind: "mindmap", label: "Mind map", icon: Network },
  { kind: "diagram", label: "Diagram", icon: Workflow },
  { kind: "flowchart", label: "Flowchart", icon: GitBranch },
  { kind: "timeline", label: "Timeline", icon: Clock },
];

const CONVERSIONS: { kind: ConversionKind; label: string; icon: React.ElementType }[] = [
  { kind: "checklist", label: "Checklist", icon: ListChecks },
  { kind: "table", label: "Table", icon: TableIcon },
  { kind: "timeline", label: "Timeline", icon: Clock },
  { kind: "mindmap", label: "Mind map", icon: Network },
  { kind: "flowchart", label: "Flowchart", icon: GitBranch },
  { kind: "chart", label: "Chart", icon: BarChart3 },
];

interface Props {
  doc: CardsDoc;
  onChange: (doc: CardsDoc) => void;
  /** note HTML, used for one-click conversions */
  noteHtml: string;
  onUploadImage?: (file: File) => Promise<string>;
}

export function NoteCardsWorkspace({ doc, onChange, noteHtml, onUploadImage }: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; mode: "move" | "resize"; sx: number; sy: number; ox: number; oy: number } | null>(null);

  const topZ = useMemo(() => doc.cards.reduce((m, c) => Math.max(m, c.z), 0), [doc.cards]);

  const update = useCallback(
    (id: string, patch: Partial<NoteCard>) =>
      onChange({ ...doc, cards: doc.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) }),
    [doc, onChange]
  );

  const updateData = useCallback(
    (id: string, data: any) => update(id, { data }),
    [update]
  );

  const add = (kind: CardKind) => {
    const scroll = surfaceRef.current;
    const at = { x: 40 + (doc.cards.length % 4) * 40, y: 40 + (doc.cards.length % 5) * 32 + (scroll?.scrollTop ?? 0) };
    onChange({ ...doc, cards: [...doc.cards, createCard(kind, at, topZ + 1)] });
    toast.success(`${kind} card added`);
  };

  const convert = (kind: ConversionKind) => {
    const card = convertNote(noteHtml, kind, { x: 60, y: 60 }, topZ + 1);
    if (!card) {
      toast.error("Write something in the note first");
      return;
    }
    onChange({ ...doc, cards: [...doc.cards, card] });
    toast.success(`Note converted to ${kind}`);
  };

  const duplicate = (card: NoteCard) => {
    const copy: NoteCard = { ...card, id: crypto.randomUUID(), x: card.x + 24, y: card.y + 24, z: topZ + 1, data: JSON.parse(JSON.stringify(card.data)) };
    onChange({ ...doc, cards: [...doc.cards, copy] });
  };

  const remove = (id: string) => {
    onChange({
      cards: doc.cards.filter((c) => c.id !== id),
      connections: doc.connections.filter((c) => c.from !== id && c.to !== id),
    });
    setSelected((s) => (s === id ? null : s));
  };

  const toggleConnect = (id: string) => {
    if (!connectFrom) {
      setConnectFrom(id);
      return;
    }
    if (connectFrom === id) {
      setConnectFrom(null);
      return;
    }
    const exists = doc.connections.some((c) => (c.from === connectFrom && c.to === id) || (c.from === id && c.to === connectFrom));
    onChange({
      ...doc,
      connections: exists
        ? doc.connections.filter((c) => !((c.from === connectFrom && c.to === id) || (c.from === id && c.to === connectFrom)))
        : [...doc.connections, { id: crypto.randomUUID(), from: connectFrom, to: id }],
    });
    setConnectFrom(null);
  };

  /* pointer drag & resize (mouse + touch via pointer events) */
  const startDrag = (e: React.PointerEvent, card: NoteCard, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      id: card.id,
      mode,
      sx: e.clientX,
      sy: e.clientY,
      ox: mode === "move" ? card.x : card.w,
      oy: mode === "move" ? card.y : card.h,
    };
    setSelected(card.id);
    update(card.id, { z: topZ + 1 });
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (d.mode === "move") update(d.id, { x: Math.max(0, d.ox + dx), y: Math.max(0, d.oy + dy) });
      else update(d.id, { w: Math.max(180, d.ox + dx), h: Math.max(120, d.oy + dy) });
    };
    const up = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [update]);

  const canvasHeight = Math.max(520, ...doc.cards.map((c) => c.y + c.h + 80));
  const byId = useMemo(() => new Map(doc.cards.map((c) => [c.id, c])), [doc.cards]);

  return (
    <div className="flex flex-col min-h-0">
      {/* toolbar */}
      <div className="flex items-center gap-1.5 flex-wrap px-1 pb-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 rounded-lg text-[12px] gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add card
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="grid grid-cols-2 gap-1">
              {PALETTE.map((p) => (
                <button
                  key={p.kind}
                  onClick={() => add(p.kind)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-foreground hover:bg-accent transition-colors"
                >
                  <p.icon className="h-3.5 w-3.5 text-muted-foreground" /> {p.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 rounded-lg text-[12px] gap-1.5">
              <Workflow className="h-3.5 w-3.5" /> Convert note
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="start">
            <div className="grid gap-1">
              {CONVERSIONS.map((c) => (
                <button
                  key={c.kind}
                  onClick={() => convert(c.kind)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-foreground hover:bg-accent transition-colors"
                >
                  <c.icon className="h-3.5 w-3.5 text-muted-foreground" /> To {c.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {connectFrom && (
          <span className="text-[11px] text-primary flex items-center gap-1">
            <Link className="h-3 w-3" /> Pick a second card to connect
            <button onClick={() => setConnectFrom(null)} className="ml-1 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">{doc.cards.length} cards</span>
      </div>

      {/* canvas */}
      <ScrollArea className="rounded-xl border border-border bg-muted/20 h-[52vh] min-h-[320px]">
        <div
          ref={surfaceRef}
          className="relative"
          style={{
            height: canvasHeight,
            backgroundImage: "radial-gradient(hsl(var(--muted-foreground)/0.18) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
          onPointerDown={() => setSelected(null)}
        >
          <svg className="absolute inset-0 pointer-events-none" width="100%" height={canvasHeight}>
            {doc.connections.map((conn) => {
              const a = byId.get(conn.from);
              const b = byId.get(conn.to);
              if (!a || !b) return null;
              return (
                <line
                  key={conn.id}
                  x1={a.x + a.w / 2}
                  y1={a.y + a.h / 2}
                  x2={b.x + b.w / 2}
                  y2={b.y + b.h / 2}
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  opacity={0.6}
                />
              );
            })}
          </svg>

          <AnimatePresence>
            {doc.cards.map((card) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                style={{ position: "absolute", left: card.x, top: card.y, width: card.w, height: card.h, zIndex: card.z }}
                onPointerDown={(e) => e.stopPropagation()}
                className={`rounded-xl border shadow-sm overflow-hidden flex flex-col ${cardSurface(card.color)} ${
                  selected === card.id ? "ring-2 ring-primary" : ""
                } ${connectFrom === card.id ? "ring-2 ring-primary/60" : ""}`}
              >
                <div
                  className="flex items-center gap-1 px-2 py-1 border-b border-border/60 cursor-grab active:cursor-grabbing touch-none"
                  onPointerDown={(e) => startDrag(e, card, "move")}
                >
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground truncate flex-1">
                    {card.kind}
                  </span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button onPointerDown={(e) => e.stopPropagation()} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Card color">
                        <Square className="h-3 w-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2 flex gap-1.5" align="end">
                      {CARD_COLORS.map((c) => (
                        <button
                          key={c.id}
                          aria-label={c.label}
                          onClick={() => update(card.id, { color: c.id })}
                          className={`h-5 w-5 rounded-full border-2 ${c.chip} ${card.color === c.id ? "ring-2 ring-primary ring-offset-1" : ""}`}
                        />
                      ))}
                    </PopoverContent>
                  </Popover>
                  <button onPointerDown={(e) => e.stopPropagation()} onClick={() => toggleConnect(card.id)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Connect card">
                    <Link className="h-3 w-3" />
                  </button>
                  <button onPointerDown={(e) => e.stopPropagation()} onClick={() => duplicate(card)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Duplicate card">
                    <Copy className="h-3 w-3" />
                  </button>
                  <button onPointerDown={(e) => e.stopPropagation()} onClick={() => remove(card.id)} className="p-1 text-muted-foreground hover:text-destructive" aria-label="Delete card">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-auto p-2">
                  <CardBody card={card} onData={(d) => updateData(card.id, d)} onUploadImage={onUploadImage} />
                </div>

                <div
                  onPointerDown={(e) => startDrag(e, card, "resize")}
                  className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none"
                  style={{ background: "linear-gradient(135deg, transparent 50%, hsl(var(--muted-foreground)/0.35) 50%)" }}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {doc.cards.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-1">
              <Network className="h-8 w-8 opacity-20" />
              <p className="text-[13px]">Build your visual workspace</p>
              <p className="text-[11px] opacity-70">Add a card, or convert your note into a chart, table or mind map</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* card bodies                                                         */
/* ------------------------------------------------------------------ */

function CardBody({
  card,
  onData,
  onUploadImage,
}: {
  card: NoteCard;
  onData: (data: any) => void;
  onUploadImage?: (file: File) => Promise<string>;
}) {
  const d = card.data ?? {};

  switch (card.kind) {
    case "text":
      return (
        <Textarea
          value={d.text ?? ""}
          onChange={(e) => onData({ ...d, text: e.target.value })}
          placeholder="Write…"
          className="h-full resize-none border-none bg-transparent p-0 text-[12px] shadow-none focus-visible:ring-0"
        />
      );

    case "code":
      return (
        <div className="h-full flex flex-col gap-1">
          <Input
            value={d.language ?? ""}
            onChange={(e) => onData({ ...d, language: e.target.value })}
            placeholder="language"
            className="h-6 text-[11px] px-2"
          />
          <Textarea
            value={d.code ?? ""}
            onChange={(e) => onData({ ...d, code: e.target.value })}
            spellCheck={false}
            className="flex-1 resize-none font-mono text-[11px] bg-muted/60 rounded-md"
          />
        </div>
      );

    case "checklist":
      return (
        <div className="space-y-1">
          {(d.items ?? []).map((it: any) => (
            <div key={it.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!it.done}
                onChange={(e) =>
                  onData({ ...d, items: d.items.map((x: any) => (x.id === it.id ? { ...x, done: e.target.checked } : x)) })
                }
                className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
              />
              <input
                value={it.text}
                onChange={(e) =>
                  onData({ ...d, items: d.items.map((x: any) => (x.id === it.id ? { ...x, text: e.target.value } : x)) })
                }
                className={`flex-1 bg-transparent text-[12px] outline-none ${it.done ? "line-through text-muted-foreground" : ""}`}
              />
              <button
                onClick={() => onData({ ...d, items: d.items.filter((x: any) => x.id !== it.id) })}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove item"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onData({ ...d, items: [...(d.items ?? []), { id: crypto.randomUUID(), text: "", done: false }] })}
            className="text-[11px] text-primary hover:underline"
          >
            + Add item
          </button>
        </div>
      );

    case "table": {
      const rows: string[][] = d.rows ?? [[""]];
      const setCell = (r: number, c: number, v: string) =>
        onData({ ...d, rows: rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)) });
      return (
        <div className="space-y-1">
          <table className="w-full border-collapse">
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-border/70 p-0">
                      <input
                        value={cell}
                        onChange={(e) => setCell(ri, ci, e.target.value)}
                        className={`w-full bg-transparent px-1.5 py-1 text-[11px] outline-none ${ri === 0 ? "font-medium" : ""}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2">
            <button
              onClick={() => onData({ ...d, rows: [...rows, Array(rows[0]?.length ?? 1).fill("")] })}
              className="text-[11px] text-primary hover:underline"
            >
              + Row
            </button>
            <button
              onClick={() => onData({ ...d, rows: rows.map((r) => [...r, ""]) })}
              className="text-[11px] text-primary hover:underline"
            >
              + Column
            </button>
          </div>
        </div>
      );
    }

    case "image":
      return (
        <ImageCard data={d} onData={onData} onUploadImage={onUploadImage} />
      );

    case "drawing":
      return <DrawingCard data={d} onData={onData} />;

    case "link":
      return (
        <div className="space-y-1.5">
          <Input value={d.label ?? ""} onChange={(e) => onData({ ...d, label: e.target.value })} placeholder="Label" className="h-7 text-[12px]" />
          <Input value={d.url ?? ""} onChange={(e) => onData({ ...d, url: e.target.value })} placeholder="https://…" className="h-7 text-[12px]" />
          {d.url && (
            <a href={d.url} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline break-all">
              Open link
            </a>
          )}
        </div>
      );

    case "file":
      return <FileCardBody data={d} onData={onData} />;

    case "voice":
      return <VoiceCard data={d} onData={onData} />;

    case "chart":
      return <ChartCard data={d} onData={onData} />;

    case "mindmap":
      return <MindMapCard data={d} onData={onData} />;

    case "timeline":
      return <TimelineCard data={d} onData={onData} />;

    case "diagram":
    case "flowchart":
      return <DiagramCard data={d} onData={onData} />;

    default:
      return null;
  }
}

function ImageCard({ data, onData, onUploadImage }: { data: any; onData: (d: any) => void; onUploadImage?: (f: File) => Promise<string> }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const src = onUploadImage
        ? await onUploadImage(file)
        : await new Promise<string>((res) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.readAsDataURL(file);
          });
      onData({ ...data, src });
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center gap-2">
      {data.src ? (
        <img src={data.src} alt="Note card" className="max-h-full max-w-full rounded-md object-contain" />
      ) : (
        <Button size="sm" variant="outline" className="h-7 text-[12px]" disabled={busy} onClick={() => ref.current?.click()}>
          {busy ? "Uploading…" : "Choose image"}
        </Button>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
    </div>
  );
}

function DrawingCard({ data, onData }: { data: any; onData: (d: any) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes: number[][][] = data.strokes ?? [];
  const current = useRef<number[][]>([]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = getComputedStyle(canvas).color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    [...strokes, current.current].forEach((s) => {
      if (!s?.length) return;
      ctx.beginPath();
      s.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    });
  }, [strokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    redraw();
  }, [redraw]);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  return (
    <div className="h-full flex flex-col gap-1">
      <canvas
        ref={canvasRef}
        className="flex-1 w-full rounded-md bg-background/70 text-foreground touch-none"
        onPointerDown={(e) => {
          e.stopPropagation();
          drawing.current = true;
          current.current = [pos(e)];
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          current.current.push(pos(e));
          redraw();
        }}
        onPointerUp={() => {
          if (!drawing.current) return;
          drawing.current = false;
          onData({ ...data, strokes: [...strokes, current.current] });
          current.current = [];
        }}
      />
      <div className="flex gap-2">
        <button onClick={() => onData({ ...data, strokes: strokes.slice(0, -1) })} className="text-[11px] text-primary hover:underline">
          Undo
        </button>
        <button onClick={() => onData({ ...data, strokes: [] })} className="text-[11px] text-muted-foreground hover:underline">
          Clear
        </button>
      </div>
    </div>
  );
}

function FileCardBody({ data, onData }: { data: any; onData: (d: any) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2">
      {data.name ? (
        <a href={data.url} download={data.name} className="text-[12px] text-primary hover:underline break-all text-center">
          {data.name}
        </a>
      ) : (
        <Button size="sm" variant="outline" className="h-7 text-[12px]" onClick={() => ref.current?.click()}>
          Attach file
        </Button>
      )}
      <input
        ref={ref}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > 3 * 1024 * 1024) {
            toast.error("Keep card attachments under 3MB");
            return;
          }
          const r = new FileReader();
          r.onload = () => onData({ ...data, name: f.name, url: r.result as string });
          r.readAsDataURL(f);
        }}
      />
    </div>
  );
}

function VoiceCard({ data, onData }: { data: any; onData: (d: any) => void }) {
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        const r = new FileReader();
        r.onload = () => onData({ ...data, url: r.result as string });
        r.readAsDataURL(blob);
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Microphone unavailable");
    }
  };

  const stop = () => {
    recRef.current?.stop();
    recRef.current = null;
    setRecording(false);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center gap-2">
      {data.url && <audio controls src={data.url} className="w-full h-8" />}
      <Button size="sm" variant={recording ? "destructive" : "outline"} className="h-7 text-[12px]" onClick={recording ? stop : start}>
        {recording ? "Stop recording" : data.url ? "Record again" : "Record voice note"}
      </Button>
    </div>
  );
}

function ChartCard({ data, onData }: { data: any; onData: (d: any) => void }) {
  const series: { label: string; value: number }[] = data.series ?? [];
  const max = Math.max(1, ...series.map((s) => Math.abs(s.value)));
  const type = data.chartType ?? "bar";

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex gap-1">
        {["bar", "line", "donut"].map((t) => (
          <button
            key={t}
            onClick={() => onData({ ...data, chartType: t })}
            className={`text-[10px] px-1.5 py-0.5 rounded ${type === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {type === "bar" && (
          <div className="h-full flex items-end gap-1.5">
            {series.map((s, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <motion.div
                  layout
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${(Math.abs(s.value) / max) * 100}%` }}
                />
                <span className="text-[9px] text-muted-foreground truncate w-full text-center">{s.label}</span>
              </div>
            ))}
          </div>
        )}
        {type === "line" && (
          <svg viewBox="0 0 100 60" className="h-full w-full" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              points={series
                .map((s, i) => `${(i / Math.max(1, series.length - 1)) * 100},${60 - (Math.abs(s.value) / max) * 55}`)
                .join(" ")}
            />
          </svg>
        )}
        {type === "donut" && (
          <div className="h-full flex items-center justify-center">
            <svg viewBox="0 0 42 42" className="h-full max-h-32">
              {(() => {
                const total = series.reduce((a, s) => a + Math.abs(s.value), 0) || 1;
                let offset = 0;
                return series.map((s, i) => {
                  const pct = (Math.abs(s.value) / total) * 100;
                  const el = (
                    <circle
                      key={i}
                      cx="21"
                      cy="21"
                      r="15.9"
                      fill="transparent"
                      stroke="hsl(var(--primary))"
                      strokeOpacity={1 - i * 0.15}
                      strokeWidth="6"
                      strokeDasharray={`${pct} ${100 - pct}`}
                      strokeDashoffset={25 - offset}
                    />
                  );
                  offset += pct;
                  return el;
                });
              })()}
            </svg>
          </div>
        )}
      </div>

      <div className="space-y-1">
        {series.map((s, i) => (
          <div key={i} className="flex gap-1">
            <input
              value={s.label}
              onChange={(e) => onData({ ...data, series: series.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)) })}
              className="flex-1 bg-transparent text-[11px] outline-none border-b border-border/50"
            />
            <input
              type="number"
              value={s.value}
              onChange={(e) => onData({ ...data, series: series.map((x, xi) => (xi === i ? { ...x, value: Number(e.target.value) } : x)) })}
              className="w-14 bg-transparent text-[11px] outline-none border-b border-border/50"
            />
          </div>
        ))}
        <button
          onClick={() => onData({ ...data, series: [...series, { label: "New", value: 10 }] })}
          className="text-[11px] text-primary hover:underline"
        >
          + Data point
        </button>
      </div>
    </div>
  );
}

function MindMapCard({ data, onData }: { data: any; onData: (d: any) => void }) {
  const branches: string[] = data.branches ?? [];
  return (
    <div className="h-full flex flex-col gap-2">
      <input
        value={data.root ?? ""}
        onChange={(e) => onData({ ...data, root: e.target.value })}
        className="self-center rounded-full bg-primary/10 px-3 py-1 text-[12px] font-medium text-primary text-center outline-none"
      />
      <div className="flex-1 grid grid-cols-2 gap-1.5 content-start">
        {branches.map((b, i) => (
          <div key={i} className="relative rounded-lg border border-border/70 bg-background/60 px-2 py-1">
            <input
              value={b}
              onChange={(e) => onData({ ...data, branches: branches.map((x, xi) => (xi === i ? e.target.value : x)) })}
              className="w-full bg-transparent text-[11px] outline-none pr-4"
            />
            <button
              onClick={() => onData({ ...data, branches: branches.filter((_, xi) => xi !== i) })}
              className="absolute right-1 top-1 text-muted-foreground hover:text-destructive"
              aria-label="Remove branch"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => onData({ ...data, branches: [...branches, "New branch"] })} className="text-[11px] text-primary hover:underline self-start">
        + Branch
      </button>
    </div>
  );
}

function TimelineCard({ data, onData }: { data: any; onData: (d: any) => void }) {
  const events: any[] = data.events ?? [];
  return (
    <div className="space-y-2">
      {events.map((ev) => (
        <div key={ev.id} className="relative pl-4">
          <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-primary" />
          <span className="absolute left-[3px] top-4 bottom-[-8px] w-px bg-border" />
          <input
            value={ev.when}
            onChange={(e) => onData({ ...data, events: events.map((x) => (x.id === ev.id ? { ...x, when: e.target.value } : x)) })}
            className="w-full bg-transparent text-[11px] font-medium outline-none"
          />
          <input
            value={ev.what}
            onChange={(e) => onData({ ...data, events: events.map((x) => (x.id === ev.id ? { ...x, what: e.target.value } : x)) })}
            className="w-full bg-transparent text-[11px] text-muted-foreground outline-none"
          />
        </div>
      ))}
      <button
        onClick={() => onData({ ...data, events: [...events, { id: crypto.randomUUID(), when: "New", what: "" }] })}
        className="text-[11px] text-primary hover:underline"
      >
        + Event
      </button>
    </div>
  );
}

function DiagramCard({ data, onData }: { data: any; onData: (d: any) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="h-full flex flex-col gap-1">
      <button onClick={() => setEditing((v) => !v)} className="self-start text-[11px] text-primary hover:underline">
        {editing ? "Preview" : "Edit code"}
      </button>
      {editing ? (
        <Textarea
          value={data.chart ?? ""}
          onChange={(e) => onData({ ...data, chart: e.target.value })}
          spellCheck={false}
          className="flex-1 resize-none font-mono text-[11px]"
        />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <MermaidDiagram chart={data.chart ?? ""} />
        </div>
      )}
    </div>
  );
}
