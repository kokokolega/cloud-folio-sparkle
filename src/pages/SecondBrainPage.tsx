import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Boxes, Plus, Search, ZoomIn, ZoomOut, Maximize2, Grid3x3, Link2, Lock, Unlock, Pin, PinOff,
  Trash2, Copy, Layers, Wand2, Undo2, Redo2, LayoutGrid, Clock, Images, ListTree, Command,
  StickyNote, FileText, Image as ImageIcon, Files, ScanLine, Bookmark, Palette, X, ChevronDown, Map,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SBWidgetView } from "@/components/desktop/SBWidgetView";
import {
  OBJECT_COLORS, SBDesktop, SBObject, SBState, SBWidget, WALLPAPERS, alignObjects, autoArrange,
  boundsOf, findDuplicates, findOrphans, loadSB, makeDesktop, makeObject, saveSB, snap, sortObjects, uid,
} from "@/lib/secondBrain";

type View = "free" | "grid" | "timeline" | "gallery" | "list";

const KIND_ICON: Record<string, any> = {
  note: FileText, sticky: StickyNote, image: ImageIcon, pdf: FileText, file: Files,
  capture: ScanLine, bookmark: Bookmark, folder: Boxes, project: Layers, widget: LayoutGrid,
};

const WIDGET_ITEMS: { id: SBWidget; label: string; w: number; h: number }[] = [
  { id: "clock", label: "Clock", w: 200, h: 130 },
  { id: "calendar", label: "Calendar", w: 260, h: 260 },
  { id: "tasks", label: "Today's Tasks", w: 240, h: 210 },
  { id: "recent-notes", label: "Recent Notes", w: 240, h: 200 },
  { id: "quick-capture", label: "Quick Capture", w: 240, h: 120 },
  { id: "storage", label: "Storage Usage", w: 220, h: 130 },
  { id: "reading", label: "Progress", w: 220, h: 130 },
  { id: "pomodoro", label: "Pomodoro", w: 200, h: 150 },
  { id: "bookmarks", label: "Bookmarks", w: 240, h: 180 },
  { id: "favorites", label: "Favorite Notes", w: 240, h: 200 },
];

export default function SecondBrainPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<SBState>(() => loadSB());
  const [history, setHistory] = useState<SBState[]>([]);
  const [future, setFuture] = useState<SBState[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [view, setView] = useState<View>("free");
  const [query, setQuery] = useState("");
  const [palette, setPalette] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [lasso, setLasso] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [focus, setFocus] = useState(false);
  const [minimap, setMinimap] = useState(true);

  const stageRef = useRef<HTMLDivElement>(null);
  const camRef = useRef({ x: 0, y: 0, zoom: 1 });
  const pointer = useRef<any>(null);

  const desktop = state.desktops.find((d) => d.id === state.activeId) ?? state.desktops[0];
  camRef.current = desktop.camera;

  /* ---------------- persistence ---------------- */
  useEffect(() => { saveSB(state); }, [state]);

  /* ---------------- mutation helpers ---------------- */
  const commit = useCallback((fn: (d: SBDesktop) => SBDesktop, record = true) => {
    setState((prev) => {
      if (record) {
        setHistory((h) => [...h.slice(-49), prev]);
        setFuture([]);
      }
      return {
        ...prev,
        desktops: prev.desktops.map((d) => (d.id === prev.activeId ? fn(d) : d)),
      };
    });
  }, []);

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [state, ...f]);
      setState(prev);
      return h.slice(0, -1);
    });
  };
  const redo = () => {
    setFuture((f) => {
      if (!f.length) return f;
      setHistory((h) => [...h, state]);
      setState(f[0]);
      return f.slice(1);
    });
  };

  const patchObject = (id: string, patch: Partial<SBObject>, record = false) =>
    commit((d) => ({
      ...d,
      objects: d.objects.map((o) => (o.id === id ? { ...o, ...patch, updatedAt: Date.now() } : o)),
    }), record);

  const addObject = (o: SBObject) => {
    commit((d) => ({ ...d, objects: [...d.objects, o] }));
    setSelected([o.id]);
  };

  const removeSelected = () => {
    if (!selected.length) return;
    commit((d) => ({
      ...d,
      objects: d.objects.filter((o) => !(selected.includes(o.id) && !o.locked)),
      links: d.links.filter((l) => !selected.includes(l.from) && !selected.includes(l.to)),
    }));
    setSelected([]);
    toast.success("Removed from desktop");
  };

  const duplicateSelected = () => {
    commit((d) => {
      const clones = d.objects
        .filter((o) => selected.includes(o.id))
        .map((o) => ({ ...o, id: uid(), x: o.x + 24, y: o.y + 24, z: Date.now() }));
      return { ...d, objects: [...d.objects, ...clones] };
    });
  };

  const setCamera = (cam: Partial<SBDesktop["camera"]>) =>
    commit((d) => ({ ...d, camera: { ...d.camera, ...cam } }), false);

  /* ---------------- canvas pan / zoom ---------------- */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = camRef.current;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
        const next = Math.min(2.5, Math.max(0.2, cam.zoom * Math.exp(-dy * 0.0015)));
        const k = next / cam.zoom;
        setCamera({ zoom: next, x: px - (px - cam.x) * k, y: py - (py - cam.y) * k });
      } else {
        setCamera({ x: cam.x - e.deltaX, y: cam.y - e.deltaY });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [state.activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toCanvas = (clientX: number, clientY: number) => {
    const rect = stageRef.current!.getBoundingClientRect();
    const cam = camRef.current;
    return { x: (clientX - rect.left - cam.x) / cam.zoom, y: (clientY - rect.top - cam.y) / cam.zoom };
  };

  /* ---------------- pointer interactions ---------------- */
  const onStagePointerDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.stage) return;
    const start = toCanvas(e.clientX, e.clientY);
    const cam = { ...camRef.current };
    const panning = e.button === 1 || e.shiftKey || e.pointerType === "touch";
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointer.current = { mode: panning ? "pan" : "lasso", start, cam, ox: e.clientX, oy: e.clientY };
    if (!panning) { setSelected([]); setLasso({ x: start.x, y: start.y, w: 0, h: 0 }); }
  };

  const onStagePointerMove = (e: React.PointerEvent) => {
    const p = pointer.current;
    if (!p) return;
    if (p.mode === "pan") {
      setCamera({ x: p.cam.x + (e.clientX - p.ox), y: p.cam.y + (e.clientY - p.oy) });
    } else if (p.mode === "lasso") {
      const cur = toCanvas(e.clientX, e.clientY);
      setLasso({
        x: Math.min(p.start.x, cur.x), y: Math.min(p.start.y, cur.y),
        w: Math.abs(cur.x - p.start.x), h: Math.abs(cur.y - p.start.y),
      });
    } else if (p.mode === "drag") {
      const cur = toCanvas(e.clientX, e.clientY);
      const dx = cur.x - p.start.x;
      const dy = cur.y - p.start.y;
      commit((d) => ({
        ...d,
        objects: d.objects.map((o) => {
          const orig = p.origins[o.id];
          if (!orig || o.locked) return o;
          const nx = orig.x + dx;
          const ny = orig.y + dy;
          return { ...o, x: d.grid ? snap(nx) : nx, y: d.grid ? snap(ny) : ny };
        }),
      }), false);
    } else if (p.mode === "resize") {
      const cur = toCanvas(e.clientX, e.clientY);
      patchObject(p.id, {
        w: Math.max(120, p.w + (cur.x - p.start.x)),
        h: Math.max(90, p.h + (cur.y - p.start.y)),
      });
    } else if (p.mode === "rotate") {
      const cur = toCanvas(e.clientX, e.clientY);
      const angle = (Math.atan2(cur.y - p.cy, cur.x - p.cx) * 180) / Math.PI;
      patchObject(p.id, { rotation: Math.round(angle) });
    }
  };

  const onStagePointerUp = () => {
    const p = pointer.current;
    if (p?.mode === "lasso" && lasso && (lasso.w > 6 || lasso.h > 6)) {
      const hits = desktop.objects
        .filter((o) => o.x < lasso.x + lasso.w && o.x + o.w > lasso.x && o.y < lasso.y + lasso.h && o.y + o.h > lasso.y)
        .map((o) => o.id);
      setSelected(hits);
    }
    if (p && (p.mode === "drag" || p.mode === "resize" || p.mode === "rotate")) {
      setHistory((h) => [...h.slice(-49), state]);
    }
    pointer.current = null;
    setLasso(null);
  };

  const startDrag = (e: React.PointerEvent, obj: SBObject) => {
    e.stopPropagation();
    if (linkMode) {
      if (!linkFrom) { setLinkFrom(obj.id); return; }
      if (linkFrom !== obj.id) {
        const label = window.prompt("Label for this connection (optional)") || "";
        commit((d) => ({ ...d, links: [...d.links, { id: uid(), from: linkFrom, to: obj.id, label, directed: true }] }));
        toast.success("Connected");
      }
      setLinkFrom(null);
      return;
    }
    const ids = selected.includes(obj.id) ? selected : [obj.id];
    setSelected(ids);
    if (obj.locked) return;
    const origins: Record<string, { x: number; y: number }> = {};
    desktop.objects.forEach((o) => { if (ids.includes(o.id)) origins[o.id] = { x: o.x, y: o.y }; });
    pointer.current = { mode: "drag", start: toCanvas(e.clientX, e.clientY), origins };
    patchObject(obj.id, { z: Date.now() });
    stageRef.current?.setPointerCapture?.(e.pointerId);
  };

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); return; }
      if (typing) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSelected(); }
      else if (e.key === "Delete" || e.key === "Backspace") { if (selected.length) { e.preventDefault(); removeSelected(); } }
      else if (e.key === "Escape") { setSelected([]); setLinkMode(false); setLinkFrom(null); }
      else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && selected.length) {
        e.preventDefault();
        const step = e.shiftKey ? 20 : 4;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        commit((d) => ({ ...d, objects: d.objects.map((o) => (selected.includes(o.id) && !o.locked ? { ...o, x: o.x + dx, y: o.y + dy } : o)) }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ---------------- import from cloud ---------------- */
  const importFromCloud = async (what: "notes" | "files" | "captures") => {
    if (!user) return toast.error("Sign in to import");
    try {
      let created: SBObject[] = [];
      if (what === "notes") {
        const { data } = await supabase.from("notes").select("id,title,content,color").eq("user_id", user.id).is("deleted_at", null).limit(40);
        created = (data ?? []).map((n: any, i) =>
          makeObject({
            kind: "note", title: n.title || "Untitled",
            preview: String(n.content || "").replace(/<[^>]+>/g, " ").slice(0, 220),
            href: "/notes", color: n.color, x: 80 + (i % 5) * 250, y: 80 + Math.floor(i / 5) * 190,
            meta: { sourceId: n.id },
          }));
      } else if (what === "files") {
        const { data } = await supabase.from("files").select("id,name,type,storage_path,public_id").eq("user_id", user.id).is("deleted_at", null).limit(40);
        created = (data ?? []).map((f: any, i) => {
          const kind = f.type?.startsWith("image/") ? "image" : f.type?.includes("pdf") ? "pdf" : "file";
          const { data: pub } = supabase.storage.from("user-files").getPublicUrl(f.storage_path);
          return makeObject({
            kind: kind as any, title: f.name, preview: kind === "image" ? pub.publicUrl : f.type,
            href: `/file/${f.public_id}`, x: 80 + (i % 5) * 250, y: 80 + Math.floor(i / 5) * 190,
            meta: { sourceId: f.id },
          });
        });
      } else {
        const { data } = await supabase.from("captures").select("id,title,category,ocr_text,storage_path").eq("user_id", user.id).limit(40);
        created = (data ?? []).map((c: any, i) => {
          const { data: pub } = supabase.storage.from("user-files").getPublicUrl(c.storage_path);
          return makeObject({
            kind: "capture", title: c.title, preview: pub.publicUrl, href: "/capture",
            x: 80 + (i % 5) * 250, y: 80 + Math.floor(i / 5) * 190,
            meta: { sourceId: c.id, ocr: String(c.ocr_text || "").slice(0, 160) },
          });
        });
      }
      if (!created.length) return toast.info("Nothing to import yet");
      const existing = new Set(desktop.objects.map((o) => o.meta?.sourceId).filter(Boolean));
      const fresh = created.filter((o) => !existing.has(o.meta?.sourceId));
      commit((d) => ({ ...d, objects: [...d.objects, ...fresh] }));
      toast.success(`Placed ${fresh.length} ${what} on the desktop`);
    } catch (e: any) {
      toast.error(e?.message || "Import failed");
    }
  };

  /* ---------------- desktop-level actions ---------------- */
  const cleanWorkspace = () => {
    commit((d) => ({ ...d, objects: autoArrange(d.objects) }));
    toast.success("Workspace tidied");
  };
  const doSort = (by: "type" | "date" | "color" | "project") => {
    commit((d) => ({ ...d, objects: sortObjects(d.objects, by) }));
    toast.success(`Sorted by ${by}`);
  };
  const doAlign = (mode: any) => {
    if (selected.length < 2) return toast.info("Select two or more objects");
    commit((d) => ({ ...d, objects: alignObjects(d.objects, selected, mode) }));
  };
  const groupSelected = () => {
    if (selected.length < 2) return toast.info("Select two or more objects");
    const name = window.prompt("Cluster name", "Cluster")?.trim() || "Cluster";
    const g = { id: uid(), name, color: OBJECT_COLORS[Math.floor(Math.random() * OBJECT_COLORS.length)] };
    commit((d) => ({
      ...d, groups: [...d.groups, g],
      objects: d.objects.map((o) => (selected.includes(o.id) ? { ...o, groupId: g.id } : o)),
    }));
    toast.success("Grouped");
  };
  const detectDuplicates = () => {
    const ids = findDuplicates(desktop.objects);
    setSelected(ids);
    toast[ids.length ? "warning" : "success"](ids.length ? `${ids.length} duplicates selected` : "No duplicates");
  };
  const detectOrphans = () => {
    const ids = findOrphans(desktop.objects, desktop.links);
    setSelected(ids);
    toast.info(ids.length ? `${ids.length} unconnected items selected` : "Everything is connected");
  };
  const fitToScreen = () => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || !desktop.objects.length) return;
    const b = boundsOf(desktop.objects);
    const zoom = Math.min(2, Math.max(0.2, Math.min((rect.width - 80) / b.w, (rect.height - 80) / b.h)));
    setCamera({ zoom, x: rect.width / 2 - (b.x + b.w / 2) * zoom, y: rect.height / 2 - (b.y + b.h / 2) * zoom });
  };

  const addDesktop = () => {
    const name = window.prompt("Desktop name", "Research")?.trim();
    if (!name) return;
    const d = makeDesktop(name, WALLPAPERS[state.desktops.length % WALLPAPERS.length].css);
    setState((s) => ({ ...s, desktops: [...s.desktops, d], activeId: d.id }));
  };

  const spawn = (kind: SBObject["kind"], extra: Partial<SBObject> = {}) => {
    const rect = stageRef.current?.getBoundingClientRect();
    const cam = camRef.current;
    const cx = rect ? (rect.width / 2 - cam.x) / cam.zoom : 200;
    const cy = rect ? (rect.height / 2 - cam.y) / cam.zoom : 200;
    addObject(makeObject({
      kind, title: extra.title || (kind === "sticky" ? "Sticky note" : kind === "folder" ? "New folder" : "Untitled"),
      x: snap(cx - 110 + Math.random() * 40), y: snap(cy - 80 + Math.random() * 40), ...extra,
    }));
  };

  /* ---------------- search / highlight ---------------- */
  const matches = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return new Set(desktop.objects.filter((o) => (o.title + " " + (o.preview || "")).toLowerCase().includes(q)).map((o) => o.id));
  }, [query, desktop.objects]);

  const connectedTo = useMemo(() => {
    const set = new Set<string>();
    desktop.links.forEach((l) => {
      if (selected.includes(l.from)) set.add(l.to);
      if (selected.includes(l.to)) set.add(l.from);
    });
    return set;
  }, [desktop.links, selected]);

  /* ---------------- object card ---------------- */
  const renderObject = (o: SBObject, zi = 1) => {
    const Icon = KIND_ICON[o.kind] || FileText;
    const isSel = selected.includes(o.id);
    const dim = matches ? !matches.has(o.id) : false;
    const group = desktop.groups.find((g) => g.id === o.groupId);
    return (
      <motion.div
        key={o.id}
        layout={view !== "free"}
        onPointerDown={(e) => startDrag(e, o)}
        onDoubleClick={() => o.href && navigate(o.href)}
        style={{
          left: o.x, top: o.y, width: o.w, height: o.collapsed ? 44 : o.h,
          transform: `rotate(${o.rotation}deg)`,
          borderColor: isSel ? "hsl(var(--primary))" : group?.color || (o.color ?? "hsl(var(--border))"),
          opacity: dim ? 0.25 : 1,
          zIndex: (o.pinned ? 5000 : 0) + zi,
        }}
        className={`absolute select-none overflow-hidden rounded-2xl border bg-card/85 shadow-sm backdrop-blur-md transition-shadow ${
          isSel ? "shadow-lg ring-2 ring-primary/40" : connectedTo.has(o.id) ? "ring-2 ring-primary/25" : ""
        } ${o.locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
      >
        <div className="flex items-center gap-1.5 border-b border-border/60 px-2 py-1.5" style={{ background: (group?.color || o.color || "") + "18" }}>
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 truncate text-[11.5px] font-medium">{o.title}</p>
          {o.pinned && <Pin className="h-3 w-3 text-primary" />}
          {o.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
          <button
            aria-label="Collapse"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => patchObject(o.id, { collapsed: !o.collapsed }, true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${o.collapsed ? "-rotate-90" : ""}`} />
          </button>
        </div>

        {!o.collapsed && (
          <div className="h-[calc(100%-30px)] w-full overflow-hidden">
            {o.kind === "widget" ? (
              <div onPointerDown={(e) => e.stopPropagation()} className="h-full w-full">
                <SBWidgetView object={o} onQuickCapture={(t) => spawn("sticky", { title: t.slice(0, 40), preview: t })} />
              </div>
            ) : (o.kind === "image" || o.kind === "capture") && o.preview?.startsWith("http") ? (
              <img src={o.preview} alt={o.title} loading="lazy" className="h-full w-full object-cover" />
            ) : o.kind === "pdf" ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
                <FileText className="h-7 w-7" />
                <p className="text-[10px]">PDF · double-click to open</p>
              </div>
            ) : (
              <p className="h-full overflow-hidden p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                {o.preview || "Empty — double-click to open."}
              </p>
            )}
          </div>
        )}

        {isSel && !o.locked && (
          <>
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                pointer.current = { mode: "resize", id: o.id, w: o.w, h: o.h, start: toCanvas(e.clientX, e.clientY) };
                stageRef.current?.setPointerCapture?.(e.pointerId);
              }}
              className="absolute bottom-0 right-0 h-6 w-6 cursor-se-resize touch-none rounded-tl-lg bg-primary/70"
            />
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                pointer.current = { mode: "rotate", id: o.id, cx: o.x + o.w / 2, cy: o.y + o.h / 2 };
                stageRef.current?.setPointerCapture?.(e.pointerId);
              }}
              className="absolute -top-2.5 left-1/2 h-5 w-5 -translate-x-1/2 cursor-grab touch-none rounded-full bg-primary/70"
            />
          </>
        )}
      </motion.div>
    );
  };

  /* ---------------- alternate views ---------------- */
  const listData = useMemo(() => {
    const objs = [...desktop.objects].filter((o) => (matches ? matches.has(o.id) : true));
    if (view === "timeline") objs.sort((a, b) => b.createdAt - a.createdAt);
    return objs;
  }, [desktop.objects, view, matches]);

  const inspector = desktop.objects.find((o) => o.id === selected[0]);

  const tools = (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Add to desktop</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" variant="outline" className="h-8 justify-start text-[11px]" onClick={() => spawn("sticky", { color: OBJECT_COLORS[2] })}>
            <StickyNote className="mr-1.5 h-3.5 w-3.5" /> Sticky
          </Button>
          <Button size="sm" variant="outline" className="h-8 justify-start text-[11px]" onClick={() => spawn("folder")}>
            <Boxes className="mr-1.5 h-3.5 w-3.5" /> Folder
          </Button>
          <Button size="sm" variant="outline" className="h-8 justify-start text-[11px]" onClick={() => {
            const url = window.prompt("Bookmark URL", "https://");
            if (url) spawn("bookmark", { title: url.replace(/^https?:\/\//, "").slice(0, 30), preview: url, href: url });
          }}>
            <Bookmark className="mr-1.5 h-3.5 w-3.5" /> Bookmark
          </Button>
          <Button size="sm" variant="outline" className="h-8 justify-start text-[11px]" onClick={() => spawn("project", { color: OBJECT_COLORS[4], title: "Project" })}>
            <Layers className="mr-1.5 h-3.5 w-3.5" /> Project
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Widgets</p>
        <div className="grid grid-cols-2 gap-1.5">
          {WIDGET_ITEMS.map((w) => (
            <Button key={w.id} size="sm" variant="ghost" className="h-8 justify-start text-[11px]"
              onClick={() => spawn("widget", { widget: w.id, title: w.label, w: w.w, h: w.h })}>
              {w.label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Bring in your knowledge</p>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => importFromCloud("notes")}>Notes</Button>
          <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => importFromCloud("files")}>Files</Button>
          <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => importFromCloud("captures")}>Captures</Button>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Organize</p>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={cleanWorkspace}><Wand2 className="mr-1 h-3.5 w-3.5" />Clean</Button>
          <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={() => doSort("type")}>Type</Button>
          <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={() => doSort("date")}>Date</Button>
          <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={() => doSort("color")}>Color</Button>
          <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={groupSelected}>Group</Button>
          <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={detectDuplicates}>Duplicates</Button>
          <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={detectOrphans}>Orphans</Button>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(["left", "hcenter", "right", "top", "vcenter", "bottom"] as const).map((m) => (
            <Button key={m} size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => doAlign(m)}>{m}</Button>
          ))}
        </div>
      </div>

      {inspector && (
        <div className="rounded-xl border border-border/70 p-2.5">
          <p className="mb-2 text-[11px] font-medium">Inspector</p>
          <Input value={inspector.title} onChange={(e) => patchObject(inspector.id, { title: e.target.value })} className="mb-2 h-8 text-[11px]" />
          <div className="grid grid-cols-2 gap-1.5">
            {(["x", "y", "w", "h", "rotation"] as const).map((f) => (
              <label key={f} className="text-[10px] text-muted-foreground">
                {f.toUpperCase()}
                <Input type="number" value={Math.round((inspector as any)[f])} className="h-7 text-[11px]"
                  onChange={(e) => patchObject(inspector.id, { [f]: Number(e.target.value) } as any)} />
              </label>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {OBJECT_COLORS.map((c) => (
              <button key={c} aria-label={`Color ${c}`} onClick={() => patchObject(inspector.id, { color: c }, true)}
                className="h-5 w-5 rounded-full border border-border" style={{ background: c }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => patchObject(inspector.id, { pinned: !inspector.pinned }, true)}>
              {inspector.pinned ? <PinOff className="mr-1 h-3.5 w-3.5" /> : <Pin className="mr-1 h-3.5 w-3.5" />}{inspector.pinned ? "Unpin" : "Pin"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => patchObject(inspector.id, { locked: !inspector.locked }, true)}>
              {inspector.locked ? <Unlock className="mr-1 h-3.5 w-3.5" /> : <Lock className="mr-1 h-3.5 w-3.5" />}{inspector.locked ? "Unlock" : "Lock"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={duplicateSelected}><Copy className="mr-1 h-3.5 w-3.5" />Duplicate</Button>
            <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive" onClick={removeSelected}><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</Button>
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Wallpaper</p>
        <div className="grid grid-cols-3 gap-1.5">
          {WALLPAPERS.map((w) => (
            <button key={w.id} onClick={() => commit((d) => ({ ...d, wallpaper: w.css }))}
              className="h-9 rounded-lg border border-border text-[10px]"
              style={{ background: w.css === "none" ? "hsl(var(--muted))" : w.css, backgroundSize: "16px 16px" }}>
              {w.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className={`flex h-[calc(100dvh-7rem)] min-h-[420px] flex-col gap-2 sm:h-[calc(100dvh-5rem)] ${focus ? "fixed inset-0 z-[100] h-dvh bg-background p-2" : ""}`}>
        {/* top bar */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Boxes className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {state.desktops.map((d) => (
              <button key={d.id} onClick={() => setState((s) => ({ ...s, activeId: d.id }))}
                onDoubleClick={() => {
                  const name = window.prompt("Rename desktop", d.name)?.trim();
                  if (name) setState((s) => ({ ...s, desktops: s.desktops.map((x) => (x.id === d.id ? { ...x, name } : x)) }));
                }}
                className={`shrink-0 rounded-full px-3 py-1 text-[11.5px] transition-colors ${
                  d.id === desktop.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}>
                {d.name}
              </button>
            ))}
            <button onClick={addDesktop} aria-label="New desktop" className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search desktop…" className="h-8 w-36 pl-7 text-[11px] md:w-52" />
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-[11px] lg:hidden">Tools</Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[76dvh] overflow-y-auto">
              <div className="pt-2">{tools}</div>
            </SheetContent>
          </Sheet>
        </div>

        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/70 bg-card/60 px-1.5 py-1 backdrop-blur">
          {([["free", LayoutGrid], ["grid", Grid3x3], ["timeline", Clock], ["gallery", Images], ["list", ListTree]] as const).map(([v, Icon]) => (
            <Button key={v} size="icon" variant={view === v ? "secondary" : "ghost"} className="h-7 w-7" aria-label={`${v} view`} onClick={() => setView(v as View)}>
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          <Button size="icon" variant={linkMode ? "secondary" : "ghost"} className="h-7 w-7" aria-label="Connect objects" onClick={() => { setLinkMode((l) => !l); setLinkFrom(null); }}>
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant={desktop.grid ? "secondary" : "ghost"} className="h-7 w-7" aria-label="Toggle grid snap" onClick={() => commit((d) => ({ ...d, grid: !d.grid }))}>
            <Grid3x3 className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Undo" onClick={undo}><Undo2 className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Redo" onClick={redo}><Redo2 className="h-3.5 w-3.5" /></Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Zoom out" onClick={() => setCamera({ zoom: Math.max(0.2, desktop.camera.zoom - 0.15) })}><ZoomOut className="h-3.5 w-3.5" /></Button>
          <span className="w-10 text-center text-[10px] tabular-nums text-muted-foreground">{Math.round(desktop.camera.zoom * 100)}%</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Zoom in" onClick={() => setCamera({ zoom: Math.min(2.5, desktop.camera.zoom + 0.15) })}><ZoomIn className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Fit to screen" onClick={fitToScreen}><Maximize2 className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant={minimap ? "secondary" : "ghost"} className="h-7 w-7" aria-label="Toggle minimap" onClick={() => setMinimap((m) => !m)}><Map className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Command palette" onClick={() => setPalette(true)}><Command className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant={focus ? "secondary" : "ghost"} className="h-7 w-7" aria-label="Focus mode" onClick={() => setFocus((f) => !f)}><Maximize2 className="h-3.5 w-3.5 rotate-45" /></Button>
          <span className="ml-auto hidden pr-1 text-[10px] text-muted-foreground sm:inline">saved offline</span>
        </div>

        <div className="flex min-h-0 flex-1 gap-2">
          {/* canvas */}
          <div
            ref={stageRef}
            data-stage-root
            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
            onPointerCancel={onStagePointerUp}
            className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-border/70"
            style={{
              background: desktop.wallpaper === "none" ? "hsl(var(--background))" : desktop.wallpaper,
              backgroundSize: desktop.wallpaper.includes("radial") ? "22px 22px" : undefined,
              touchAction: "none",
            }}
          >
            {view === "free" ? (
              <div
                data-stage
                className="absolute inset-0"
                style={{ transform: `translate(${desktop.camera.x}px, ${desktop.camera.y}px) scale(${desktop.camera.zoom})`, transformOrigin: "0 0" }}
              >
                {/* connections */}
                <svg className="pointer-events-none absolute -left-[5000px] -top-[5000px] h-[12000px] w-[12000px] overflow-visible">
                  <g transform="translate(5000,5000)">
                    {desktop.links.map((l) => {
                      const a = desktop.objects.find((o) => o.id === l.from);
                      const b = desktop.objects.find((o) => o.id === l.to);
                      if (!a || !b) return null;
                      const x1 = a.x + a.w / 2, y1 = a.y + a.h / 2, x2 = b.x + b.w / 2, y2 = b.y + b.h / 2;
                      const active = selected.includes(a.id) || selected.includes(b.id);
                      return (
                        <g key={l.id}>
                          <path d={`M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`}
                            fill="none" stroke={active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"} strokeOpacity={active ? 0.9 : 0.35} strokeWidth={active ? 2 : 1.4} />
                          {l.label && (
                            <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">{l.label}</text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>

                {[...desktop.objects].sort((a, b) => a.z - b.z).map((o, i) => renderObject(o, i + 1))}

                {lasso && (
                  <div className="pointer-events-none absolute rounded-md border border-primary/60 bg-primary/10"
                    style={{ left: lasso.x, top: lasso.y, width: lasso.w, height: lasso.h }} />
                )}
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className={
                  view === "gallery" ? "grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4"
                  : view === "grid" ? "grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 xl:grid-cols-5"
                  : "space-y-2 p-3"
                }>
                  {listData.map((o) => {
                    const Icon = KIND_ICON[o.kind] || FileText;
                    return (
                      <button key={o.id} onClick={() => setSelected([o.id])} onDoubleClick={() => o.href && navigate(o.href)}
                        className={`w-full rounded-xl border border-border/70 bg-card/70 p-2.5 text-left transition-colors hover:bg-muted/50 ${selected.includes(o.id) ? "ring-2 ring-primary/40" : ""}`}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <p className="min-w-0 flex-1 truncate text-[12px] font-medium">{o.title}</p>
                          {view === "timeline" && <span className="text-[10px] text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</span>}
                        </div>
                        {(view === "gallery" || view === "grid") && (o.kind === "image" || o.kind === "capture") && o.preview?.startsWith("http") ? (
                          <img src={o.preview} alt={o.title} loading="lazy" className="mt-2 h-28 w-full rounded-lg object-cover" />
                        ) : (
                          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{o.preview}</p>
                        )}
                      </button>
                    );
                  })}
                  {!listData.length && <p className="p-6 text-center text-[12px] text-muted-foreground">Nothing on this desktop yet.</p>}
                </div>
              </ScrollArea>
            )}

            {/* minimap */}
            {view === "free" && minimap && desktop.objects.length > 0 && (
              <div className="pointer-events-none absolute bottom-2 right-2 hidden h-28 w-40 overflow-hidden rounded-lg border border-border/70 bg-background/80 backdrop-blur sm:block">
                {(() => {
                  const b = boundsOf(desktop.objects);
                  const s = Math.min(150 / b.w, 100 / b.h);
                  return desktop.objects.map((o) => (
                    <div key={o.id} className="absolute rounded-[2px]"
                      style={{
                        left: 6 + (o.x - b.x) * s, top: 6 + (o.y - b.y) * s,
                        width: Math.max(3, o.w * s), height: Math.max(3, o.h * s),
                        background: selected.includes(o.id) ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.5)",
                      }} />
                  ));
                })()}
              </div>
            )}

            {linkMode && (
              <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] text-primary-foreground">
                {linkFrom ? "Now tap the target object" : "Tap the first object to connect"}
              </div>
            )}
          </div>

          {/* desktop tools (large screens) */}
          <aside className="hidden w-[300px] shrink-0 lg:block">
            <ScrollArea className="h-full rounded-2xl border border-border/70 bg-card/60 p-3 backdrop-blur">
              {tools}
            </ScrollArea>
          </aside>
        </div>
      </div>

      {/* command palette */}
      <Dialog open={palette} onOpenChange={setPalette}>
        <DialogContent className="max-w-md p-0">
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search objects or run a command…" className="h-11 rounded-none border-0 border-b text-[13px] focus-visible:ring-0" />
          <ScrollArea className="max-h-72">
            <div className="p-2">
              {[
                { label: "Clean workspace", run: cleanWorkspace },
                { label: "Fit to screen", run: fitToScreen },
                { label: "New sticky note", run: () => spawn("sticky", { color: OBJECT_COLORS[2] }) },
                { label: "Import notes", run: () => importFromCloud("notes") },
                { label: "Import files", run: () => importFromCloud("files") },
                { label: "Find duplicates", run: detectDuplicates },
                { label: "Find orphans", run: detectOrphans },
                { label: "New desktop", run: addDesktop },
              ]
                .filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
                .map((c) => (
                  <button key={c.label} onClick={() => { c.run(); setPalette(false); }}
                    className="block w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-muted">
                    {c.label}
                  </button>
                ))}
              {desktop.objects
                .filter((o) => query && o.title.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 8)
                .map((o) => (
                  <button key={o.id}
                    onClick={() => {
                      setSelected([o.id]);
                      const rect = stageRef.current?.getBoundingClientRect();
                      if (rect) setCamera({ zoom: 1, x: rect.width / 2 - (o.x + o.w / 2), y: rect.height / 2 - (o.y + o.h / 2) });
                      setPalette(false);
                    }}
                    className="block w-full truncate rounded-lg px-2.5 py-2 text-left text-[12.5px] text-muted-foreground hover:bg-muted">
                    Jump to · {o.title}
                  </button>
                ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
