import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng, toJpeg, toSvg } from "html-to-image";
import JSZip from "jszip";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  Play,
  Printer,
  Ruler,
  Grid3X3,
  Sparkles,
  ImagePlus,
  Trash2,
  Plus,
  Settings2,
  X,
  Lock as LockIcon,
  Unlock,
} from "lucide-react";

import { CardSlide, capacityFor, parseNoteToSlides } from "@/lib/cardParser";
import {
  ASPECT_RATIOS,
  AspectId,
  BG_PATTERNS,
  CARD_THEMES,
  CardTheme,
  FONT_CHOICES,
  PatternId,
} from "@/lib/cardThemes";
import { CardSlideView } from "@/components/notes/CardSlideView";
import { DesignOverlay } from "@/components/notes/cards/DesignElementView";
import { CardDesignCanvas } from "@/components/notes/cards/CardDesignCanvas";
import { CardPresentMode } from "@/components/notes/cards/CardPresentMode";
import {
  AlignBar,
  AssetPanel,
  ComponentPanel,
  ElementLibraryPanel,
  InspectorPanel,
  LayerPanel,
  TemplatePanel,
} from "@/components/notes/cards/DesignPanels";
import {
  alignElements,
  Asset,
  CARD_TEMPLATES,
  cloneElement,
  createElement,
  DesignElement,
  DEFAULT_GLOBALS,
  ELEMENT_LIBRARY,
  GlobalStyles,
  Guide,
  instantiateComponent,
  loadAssets,
  loadComponents,
  loadDesign,
  SavedComponent,
  saveAssets,
  saveComponents,
  saveDesign,
  templateElements,
} from "@/lib/cardDesign";
import { rewriteForCards } from "@/lib/cardAi";
import { useIsMobile } from "@/hooks/use-mobile";


interface ShareCardsDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  note: { id?: string; title: string; content: string } | null;
}

const ACCENT_SWATCHES = ["#007AFF", "#111111", "#B14BFF", "#F59E0B", "#10B981", "#EF4444", "#38BDF8", "#EC4899"];

export function ShareCardsDialog({ open, onOpenChange, note }: ShareCardsDialogProps) {
  const noteKey = note?.id || "unsaved-note";

  const [themeId, setThemeId] = useState("apple");
  const [accent, setAccent] = useState("#007AFF");
  const [fontId, setFontId] = useState("inter");
  const [aspect, setAspect] = useState<AspectId>("4:5");
  const [pattern, setPattern] = useState<PatternId>("none");
  const [showLogo, setShowLogo] = useState(true);
  const [watermark, setWatermark] = useState("Oltrid");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [overrideContent, setOverrideContent] = useState<string | null>(null);
  const [previewWidth, setPreviewWidth] = useState(320);
  const [previewHeight, setPreviewHeight] = useState(480);

  // design layer
  const [designMode, setDesignMode] = useState(false);
  const [bySlide, setBySlide] = useState<Record<number, DesignElement[]>>({});
  const [guides, setGuides] = useState<Guide[]>([]);
  const [globals, setGlobals] = useState<GlobalStyles>(DEFAULT_GLOBALS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showRulers, setShowRulers] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [presenting, setPresenting] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [components, setComponents] = useState<SavedComponent[]>([]);
  const [order, setOrder] = useState<number[] | null>(null);
  const [panelTab, setPanelTab] = useState("style");
  const [panelOpen, setPanelOpen] = useState(false);
  const isMobile = useIsMobile();


  const previewBox = useRef<HTMLDivElement>(null);
  const exportRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const coverInput = useRef<HTMLInputElement>(null);

  const baseTheme = CARD_THEMES.find((t) => t.id === themeId) || CARD_THEMES[0];
  const font = FONT_CHOICES.find((f) => f.id === fontId) || FONT_CHOICES[0];
  const ratio = ASPECT_RATIOS.find((r) => r.id === aspect) || ASPECT_RATIOS[1];

  const theme: CardTheme = useMemo(() => {
    if (globals.print) {
      return {
        ...baseTheme,
        bg: "#FFFFFF",
        cardBg: "#FFFFFF",
        text: "#111111",
        muted: "#555555",
        border: "rgba(0,0,0,0.25)",
        accentSoft: "rgba(0,0,0,0.05)",
        codeBg: "#F4F4F4",
        glass: false,
        glow: false,
        radius: Math.round(baseTheme.radius * globals.radiusScale),
      };
    }
    return {
      ...baseTheme,
      bg: globals.bgOverride || baseTheme.bg,
      radius: Math.round(baseTheme.radius * globals.radiusScale),
    };
  }, [baseTheme, globals]);

  const effAccent = globals.print ? "#111111" : accent;
  const effPattern: PatternId = globals.print ? "none" : pattern;

  /* ---------------- load / persist design ---------------- */

  /** Hydration gate — never let the autosave effect overwrite a stored design
   *  with the initial (empty) state before the load effect has been applied. */
  const hydrated = useRef(false);

  useEffect(() => {
    if (!open) {
      hydrated.current = false;
      return;
    }
    const d = loadDesign(noteKey);
    setBySlide(d.bySlide);
    setGuides(d.guides);
    setGlobals(d.globals);
    setThemeId(d.style.themeId);
    setAccent(d.style.accent);
    setFontId(d.style.fontId);
    setAspect(d.style.aspect as AspectId);
    setPattern(d.style.pattern as PatternId);
    setShowLogo(d.style.showLogo);
    setWatermark(d.style.watermark);
    setCoverImage(d.style.coverImage);
    setAssets(loadAssets());
    setComponents(loadComponents());
    setCurrent(0);
    setSelectedIds([]);
    setOrder(null);
    setOverrideContent(null);
    hydrated.current = true;
  }, [open, noteKey]);

  // Debounced auto-save of the whole document (design + style).
  useEffect(() => {
    if (!open || !hydrated.current) return;
    const t = window.setTimeout(() => {
      saveDesign(noteKey, {
        bySlide,
        guides,
        globals,
        style: { themeId, accent, fontId, aspect, pattern, showLogo, watermark, coverImage },
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [open, noteKey, bySlide, guides, globals, themeId, accent, fontId, aspect, pattern, showLogo, watermark, coverImage]);


  /* ---------------- slides ---------------- */

  const capacity = useMemo(() => capacityFor(ratio.w, ratio.h, globals.textScale), [ratio, globals.textScale]);

  const baseSlides: CardSlide[] = useMemo(() => {
    if (!note) return [];
    return parseNoteToSlides({
      title: note.title,
      content: overrideContent ?? note.content,
      pointsPerSlide: capacity.pointsPerSlide,
      maxChars: capacity.maxChars,
    });
  }, [note, overrideContent, capacity]);

  const slides: CardSlide[] = useMemo(() => {
    if (!order) return baseSlides;
    return order.map((i, n) => ({ ...baseSlides[i % baseSlides.length], id: `o${n}-${baseSlides[i % baseSlides.length]?.id}` }));
  }, [baseSlides, order]);

  useEffect(() => {
    setOrder(null);
  }, [baseSlides.length]);

  useEffect(() => {
    if (current > slides.length - 1) setCurrent(0);
  }, [slides.length, current]);

  /* ---------------- preview sizing ---------------- */

  useEffect(() => {
    const el = previewBox.current;
    if (!el) return;
    const update = () => {
      setPreviewWidth(el.clientWidth);
      setPreviewHeight(el.clientHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, designMode]);

  const rulersOn = showRulers && !isMobile;
  const rulerPad = designMode && rulersOn ? 26 : 8;
  const fitScale = Math.min(
    (previewWidth - rulerPad) / ratio.w,
    (previewHeight - rulerPad) / ratio.h,
    1
  );
  const scale = Math.max(0.05, fitScale * zoom);


  /* ---------------- design helpers ---------------- */

  const elements = bySlide[current] ?? [];
  const selected = elements.filter((e) => selectedIds.includes(e.id));

  const setElements = useCallback(
    (els: DesignElement[]) => setBySlide((prev) => ({ ...prev, [current]: els })),
    [current]
  );

  const updateElement = (id: string, patch: Partial<DesignElement>) =>
    setElements(elements.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const insertElement = (kind: string) => {
    const item = ELEMENT_LIBRARY.find((i) => i.kind === kind);
    if (!item) return;
    const z = elements.length ? Math.max(...elements.map((e) => e.z)) + 1 : 1;
    // stagger new elements so they never land exactly on top of each other
    const offset = (elements.length % 5) * 28;
    const el = createElement(
      item,
      {
        x: Math.round(Math.min(Math.max(24, ratio.w / 2 - item.w / 2 + offset), ratio.w - item.w - 24)),
        y: Math.round(Math.min(Math.max(24, ratio.h / 2 - item.h / 2 + offset), ratio.h - item.h - 24)),
      },
      z
    );
    setElements([...elements, el]);
    setSelectedIds([el.id]);
    setDesignMode(true);
    setPanelTab("design");
    if (isMobile) setPanelOpen(false);
    toast.success(`${item.label} added`);
  };


  const duplicateSelection = useCallback(() => {
    if (!selected.length) return;
    let z = elements.length ? Math.max(...elements.map((e) => e.z)) : 0;
    const copies = selected.map((e) => cloneElement(e, 32, 32, ++z));
    setElements([...elements, ...copies]);
    setSelectedIds(copies.map((c) => c.id));
  }, [selected, elements, setElements]);

  const deleteSelection = useCallback(() => {
    if (!selected.length) return;
    setElements(elements.filter((e) => !selectedIds.includes(e.id) || e.locked));
    setSelectedIds([]);
  }, [selected, elements, selectedIds, setElements]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (!selected.length) return;
      setElements(
        elements.map((e) => (selectedIds.includes(e.id) && !e.locked ? { ...e, x: e.x + dx, y: e.y + dy } : e))
      );
    },
    [selected, elements, selectedIds, setElements]
  );

  const align = (op: any) => {
    const aligned = alignElements(selected, op, { w: ratio.w, h: ratio.h });
    const map = new Map(aligned.map((a) => [a.id, a]));
    setElements(elements.map((e) => map.get(e.id) ?? e));
  };

  const reorderLayer = (id: string, dir: -1 | 1) => {
    const sorted = [...elements].sort((a, b) => a.z - b.z);
    const idx = sorted.findIndex((e) => e.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= sorted.length) return;
    const z1 = sorted[idx].z;
    sorted[idx] = { ...sorted[idx], z: sorted[swap].z };
    sorted[swap] = { ...sorted[swap], z: z1 };
    setElements(sorted);
  };

  const applyTemplate = (id: string) => {
    const t = CARD_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setThemeId(t.themeId);
    setAccent(t.accent);
    setFontId(t.fontId);
    setPattern(t.pattern as PatternId);
    setGlobals((g) => ({ ...g, ...t.globals }));
    setBySlide((prev) => ({ ...prev, 0: templateElements(t) }));
    setCurrent(0);
    toast.success(`${t.label} template applied`);
  };

  const addAssets = (files: FileList) => {
    const next: Asset[] = [];
    let pending = files.length;
    Array.from(files).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        next.push({ id: `a-${Date.now()}-${f.name}`, name: f.name, dataUrl: reader.result as string, addedAt: Date.now() });
        if (--pending === 0) {
          const merged = [...next, ...assets];
          setAssets(merged);
          saveAssets(merged);
          toast.success("Added to your asset library");
        }
      };
      reader.readAsDataURL(f);
    });
  };

  const useAsset = (a: Asset) => {
    const item = ELEMENT_LIBRARY.find((i) => i.kind === "image")!;
    const z = elements.length ? Math.max(...elements.map((e) => e.z)) + 1 : 1;
    const el = createElement(item, { x: 200, y: 300 }, z);
    el.props.src = a.dataUrl;
    el.name = a.name;
    setElements([...elements, el]);
    setSelectedIds([el.id]);
    setDesignMode(true);
  };

  const saveComponent = (name: string) => {
    const c: SavedComponent = { id: `c-${Date.now()}`, name, elements: selected, createdAt: Date.now() };
    const merged = [c, ...components];
    setComponents(merged);
    saveComponents(merged);
    toast.success(`Saved “${name}” to your components`);
  };

  const insertComponent = (c: SavedComponent) => {
    const z = elements.length ? Math.max(...elements.map((e) => e.z)) + 1 : 1;
    const added = instantiateComponent(c, z);
    setElements([...elements, ...added]);
    setSelectedIds(added.map((a) => a.id));
    setDesignMode(true);
  };

  /* ---------------- page navigator ---------------- */

  const ensureOrder = () => order ?? baseSlides.map((_, i) => i);

  const duplicateCard = (i: number) => {
    const o = ensureOrder();
    const next = [...o.slice(0, i + 1), o[i], ...o.slice(i + 1)];
    setOrder(next);
    setBySlide((prev) => {
      const shifted: Record<number, DesignElement[]> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const idx = Number(k);
        shifted[idx > i ? idx + 1 : idx] = v;
      });
      if (prev[i]) shifted[i + 1] = prev[i].map((e) => cloneElement(e, 0, 0, e.z));
      return shifted;
    });
    setCurrent(i + 1);
  };

  const deleteCard = (i: number) => {
    const o = ensureOrder();
    if (o.length <= 1) return;
    setOrder(o.filter((_, n) => n !== i));
    setBySlide((prev) => {
      const shifted: Record<number, DesignElement[]> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const idx = Number(k);
        if (idx === i) return;
        shifted[idx > i ? idx - 1 : idx] = v;
      });
      return shifted;
    });
    setCurrent((c) => Math.max(0, Math.min(c, o.length - 2)));
  };

  const moveCard = (from: number, to: number) => {
    const o = ensureOrder();
    if (to < 0 || to >= o.length) return;
    const next = [...o];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
    setBySlide((prev) => {
      const a = prev[from];
      const b = prev[to];
      return { ...prev, [from]: b ?? [], [to]: a ?? [] };
    });
    setCurrent(to);
  };

  /* ---------------- render config ---------------- */

  const cfgFor = (index: number) => ({
    theme,
    accent: effAccent,
    fontHeading: font.heading,
    fontBody: font.body,
    pattern: effPattern,
    showLogo,
    watermark,
    width: ratio.w,
    height: ratio.h,
    coverImage,
    index,
    total: slides.length,
    textScale: globals.textScale,
    spacingScale: globals.spacingScale,
  });

  const overlayCtx = {
    theme,
    accent: effAccent,
    fontHeading: font.heading,
    fontBody: font.body,
    u: ratio.w / 1080,
  };

  const renderSlide = (i: number) => (
    <CardSlideView
      slide={slides[i]}
      cfg={cfgFor(i)}
      overlay={<DesignOverlay elements={bySlide[i] ?? []} ctx={overlayCtx} />}
    />
  );

  /* ---------------- export ---------------- */

  const slugBase =
    (note?.title || "oltrid-note").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "oltrid-note";

  /** Fonts + images must be settled or the export won't match the preview. */
  const waitForPaint = async () => {
    try {
      await (document as any).fonts?.ready;
    } catch {
      /* ignore */
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
  };

  const renderNode = async (node: HTMLElement, format: "png" | "jpg" | "svg") => {
    const opts = {
      cacheBust: true,
      pixelRatio: 2,
      width: ratio.w,
      height: ratio.h,
      style: { opacity: "1", transform: "none" },
    };
    // First pass warms the image cache, second pass renders it identically to the preview.
    if (format === "png") {
      await toPng(node, opts);
      return toPng(node, opts);
    }
    if (format === "jpg") {
      const jpgOpts = { ...opts, quality: 0.96, backgroundColor: "#ffffff" };
      await toJpeg(node, jpgOpts);
      return toJpeg(node, jpgOpts);
    }
    await toSvg(node, opts);
    return toSvg(node, opts);
  };

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  const exportOne = async (format: "png" | "jpg" | "svg") => {
    const slide = slides[current];
    const node = exportRefs.current[slide.id];
    if (!node) return toast.error("Card is still rendering — try again in a moment");
    setExporting(true);
    try {
      await waitForPaint();
      const url = await renderNode(node, format);
      downloadDataUrl(url, `${slugBase}-${current + 1}.${format}`);
      toast.success(`Card ${current + 1} exported as ${format.toUpperCase()}`);
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const exportAll = useCallback(
    async (format: "png" | "jpg" | "svg") => {
      setExporting(true);
      try {
        await waitForPaint();
        const zip = new JSZip();
        for (let i = 0; i < slides.length; i++) {
          const node = exportRefs.current[slides[i].id];
          if (!node) continue;
          const url = await renderNode(node, format);
          const base64 = url.startsWith("data:image/svg") ? null : url.split(",")[1];
          if (base64) {
            zip.file(`${slugBase}-${String(i + 1).padStart(2, "0")}.${format}`, base64, { base64: true });
          } else {
            zip.file(`${slugBase}-${String(i + 1).padStart(2, "0")}.svg`, decodeURIComponent(url.split(",")[1]));
          }
        }
        const blob = await zip.generateAsync({ type: "blob" });
        const objUrl = URL.createObjectURL(blob);
        downloadDataUrl(objUrl, `${slugBase}-cards.zip`);
        URL.revokeObjectURL(objUrl);
        toast.success(`${slides.length} cards exported`);
      } catch (e: any) {
        toast.error(e?.message || "Export failed");
      } finally {
        setExporting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slides, ratio, slugBase]
  );

  /** Pixel-perfect PDF: one page per card, page size = the card's own ratio. */
  const exportPdf = useCallback(
    async (onlyCurrent = false) => {
      setExporting(true);
      try {
        await waitForPaint();
        const { jsPDF } = await import("jspdf");
        const list = onlyCurrent ? [slides[current]] : slides;
        const pdf = new jsPDF({
          orientation: ratio.w >= ratio.h ? "landscape" : "portrait",
          unit: "px",
          format: [ratio.w, ratio.h],
          compress: true,
        });
        let page = 0;
        for (const s of list) {
          const node = exportRefs.current[s.id];
          if (!node) continue;
          const url = await renderNode(node, "png");
          if (page > 0) pdf.addPage([ratio.w, ratio.h], ratio.w >= ratio.h ? "landscape" : "portrait");
          pdf.addImage(url, "PNG", 0, 0, ratio.w, ratio.h, undefined, "FAST");
          page++;
        }
        if (!page) throw new Error("Nothing to export yet");
        pdf.save(onlyCurrent ? `${slugBase}-${current + 1}.pdf` : `${slugBase}-cards.pdf`);
        toast.success(`PDF exported (${page} page${page > 1 ? "s" : ""})`);
      } catch (e: any) {
        toast.error(e?.message || "PDF export failed");
      } finally {
        setExporting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slides, current, ratio, slugBase]
  );


  const printCards = async () => {
    setExporting(true);
    try {
      const images: string[] = [];
      for (const s of slides) {
        const node = exportRefs.current[s.id];
        if (node) images.push(await toPng(node, { cacheBust: true, pixelRatio: 2, width: ratio.w, height: ratio.h }));
      }
      const w = window.open("", "_blank");
      if (!w) return toast.error("Allow pop-ups to print");
      w.document.write(
        `<html><head><title>${slugBase}</title><style>
          @page { margin: 12mm; }
          body { margin:0; background:#fff; }
          img { width:100%; page-break-after:always; break-after:page; display:block; }
          img:last-child { page-break-after:auto; }
        </style></head><body>${images.map((s) => `<img src="${s}" />`).join("")}</body></html>`
      );
      w.document.close();
      setTimeout(() => w.print(), 600);
    } catch (e: any) {
      toast.error(e?.message || "Print failed");
    } finally {
      setExporting(false);
    }
  };

  /* ---------------- shortcuts ---------------- */

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelection();
      } else if (mod && e.key.toLowerCase() === "l") {
        e.preventDefault();
        selected.forEach((s) => updateElement(s.id, { locked: !s.locked }));
      } else if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        exportAll("png");
      } else if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoom((z) => Math.min(4, z + 0.15));
      } else if (mod && e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(0.25, z - 0.15));
      } else if (mod && e.key === "0") {
        e.preventDefault();
        setZoom(1);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selected.length) {
          e.preventDefault();
          deleteSelection();
        }
      } else if (e.key.startsWith("Arrow")) {
        if (!selected.length) return;
        e.preventDefault();
        const step = e.shiftKey ? 20 : 2;
        nudge(
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0
        );
      } else if (e.key === "F5") {
        e.preventDefault();
        setPresenting(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selected, duplicateSelection, deleteSelection, nudge, exportAll]);

  /* ---------------- AI (optional) ---------------- */

  const runAi = async (mode: "summarize_social" | "rewrite_audience" | "better_carousel") => {
    if (!note) return;
    setAiBusy(mode);
    try {
      const html = await rewriteForCards(mode, overrideContent ?? note.content);
      setOverrideContent(html);
      setCurrent(0);
      toast.success("Carousel regenerated with AI");
    } catch (e: any) {
      toast.error(e?.message || "AI request failed");
    } finally {
      setAiBusy(null);
    }
  };

  const onCoverPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCoverImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  if (!note) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[100vw] max-w-[min(1240px,100vw)] h-[100dvh] sm:h-[92dvh] sm:w-[96vw] p-0 gap-0 overflow-hidden rounded-none sm:rounded-2xl">
          <VisuallyHidden>
            <DialogTitle>Share as beautiful cards</DialogTitle>
            <DialogDescription>Turn this note into a shareable carousel</DialogDescription>
          </VisuallyHidden>

          <div className="relative flex h-full min-h-0 flex-col md:flex-row">
            {/* Stage */}
            <div className="flex min-h-0 flex-1 flex-col bg-muted/40 p-2 sm:p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-[13px] font-medium text-foreground">Show as Cards</p>
                  <span className="hidden text-[11px] text-muted-foreground sm:inline">
                    {slides.length} cards · {ratio.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button size="sm" variant={designMode ? "default" : "outline"} className="h-7 px-2 text-[11px]" onClick={() => setDesignMode((d) => !d)}>
                    {designMode ? "Editing" : "Edit"}
                  </Button>
                  {!isMobile && (
                    <>
                      <Button size="icon" variant="outline" className="h-7 w-7" aria-label="Toggle rulers" onClick={() => setShowRulers((v) => !v)}>
                        <Ruler className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-7 w-7" aria-label="Toggle grid" onClick={() => setShowGrid((v) => !v)}>
                        <Grid3X3 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <Button size="icon" variant="outline" className="h-7 w-7" aria-label="Present" onClick={() => setPresenting(true)}>
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-7 w-7" aria-label="Print" onClick={printCards} disabled={exporting}>
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                  {isMobile && (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setPanelOpen(true)}>
                      <Settings2 className="mr-1 h-3.5 w-3.5" /> Tools
                    </Button>
                  )}
                </div>
              </div>

              {designMode && (
                <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1">
                  <AlignBar disabled={!selected.length} onAlign={align} />
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Zoom</span>
                    <Slider className="w-20 sm:w-24" value={[zoom * 100]} min={25} max={300} step={5} onValueChange={([v]) => setZoom(v / 100)} />
                  </div>
                </div>
              )}

              <div ref={previewBox} className="flex min-h-[190px] flex-1 items-center justify-center overflow-auto p-1">
                {slides[current] && (
                  designMode ? (
                    <CardDesignCanvas
                      width={ratio.w}
                      height={ratio.h}
                      scale={scale}
                      elements={elements}
                      selectedIds={selectedIds}
                      guides={guides}
                      showRulers={rulersOn}
                      showGrid={showGrid}
                      onSelect={setSelectedIds}
                      onChange={(els) => setElements(els)}
                      onGuidesChange={setGuides}
                      onEdit={() => {
                        setPanelTab("design");
                        if (isMobile) setPanelOpen(true);
                      }}
                    >
                      {renderSlide(current)}
                    </CardDesignCanvas>
                  ) : (
                    <div className="shrink-0 overflow-hidden rounded-lg shadow-xl" style={{ width: ratio.w * scale, height: ratio.h * scale }}>
                      <div style={{ width: ratio.w, height: ratio.h, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                        {renderSlide(current)}
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Selection quick actions — essential on touch devices */}
              {designMode && selected.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-background/80 p-1.5 backdrop-blur">
                  <span className="px-1 text-[11px] text-muted-foreground">{selected.length} selected</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Duplicate selection" onClick={duplicateSelection}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Bring forward" onClick={() => selected.forEach((s) => reorderLayer(s.id, 1))}><ChevronRight className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Send backward" onClick={() => selected.forEach((s) => reorderLayer(s.id, -1))}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Toggle lock" onClick={() => selected.forEach((s) => updateElement(s.id, { locked: !s.locked }))}>
                    {selected[0].locked ? <LockIcon className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label="Delete selection" onClick={deleteSelection}><Trash2 className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" className="ml-auto h-7 px-2 text-[11px]" onClick={() => { setPanelTab("design"); setPanelOpen(true); }}>
                    Edit properties
                  </Button>
                </div>
              )}

              {/* Page navigator */}
              <div className="mt-2 flex shrink-0 items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-full" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0} aria-label="Previous card">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
                  {slides.map((s, i) => (
                    <div key={s.id} className="group relative shrink-0">
                      <button
                        onClick={() => {
                          setCurrent(i);
                          setSelectedIds([]);
                        }}
                        className={`overflow-hidden rounded-md border transition-all ${i === current ? "border-primary ring-2 ring-primary/30" : "border-border opacity-70 hover:opacity-100"}`}
                        style={{ width: 48, height: (48 * ratio.h) / ratio.w }}
                        aria-label={`Card ${i + 1}`}
                      >
                        <div style={{ width: ratio.w, height: ratio.h, transform: `scale(${48 / ratio.w})`, transformOrigin: "top left" }}>
                          {renderSlide(i)}
                        </div>
                      </button>
                      <div className="absolute inset-x-0 -bottom-0.5 flex justify-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                        <button onClick={() => duplicateCard(i)} aria-label="Duplicate card" className="rounded bg-background/90 p-0.5 shadow"><Copy className="h-2.5 w-2.5" /></button>
                        <button onClick={() => moveCard(i, i - 1)} aria-label="Move card left" className="rounded bg-background/90 p-0.5 shadow"><ChevronLeft className="h-2.5 w-2.5" /></button>
                        <button onClick={() => moveCard(i, i + 1)} aria-label="Move card right" className="rounded bg-background/90 p-0.5 shadow"><ChevronRight className="h-2.5 w-2.5" /></button>
                        <button onClick={() => deleteCard(i)} aria-label="Delete card" className="rounded bg-background/90 p-0.5 text-destructive shadow"><Trash2 className="h-2.5 w-2.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-full" onClick={() => setCurrent((c) => Math.min(slides.length - 1, c + 1))} disabled={current >= slides.length - 1} aria-label="Next card">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Mobile scrim */}
            {isMobile && panelOpen && (
              <button aria-label="Close tools" className="absolute inset-0 z-20 bg-black/30" onClick={() => setPanelOpen(false)} />
            )}

            {/* Controls */}
            <div
              className={`flex min-h-0 flex-col border-border bg-background md:relative md:inset-auto md:h-auto md:w-[290px] lg:w-[350px] md:translate-y-0 md:border-l md:shadow-none ${
                isMobile
                  ? `absolute inset-x-0 bottom-0 z-30 h-[76dvh] rounded-t-2xl border-t shadow-2xl transition-transform duration-300 ${panelOpen ? "translate-y-0" : "translate-y-full"}`
                  : "w-full border-t md:border-t-0"
              }`}
            >
              {isMobile && (
                <div className="flex items-center justify-between px-3 pt-2">
                  <div className="mx-auto h-1 w-10 rounded-full bg-border" />
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Close tools" onClick={() => setPanelOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <Tabs value={panelTab} onValueChange={setPanelTab} className="flex min-h-0 flex-1 flex-col">

                <TabsList className="mx-3 mt-3 grid h-8 w-[calc(100%-1.5rem)] grid-cols-4">
                  <TabsTrigger value="style" className="text-[10.5px] sm:text-[11px]">Style</TabsTrigger>
                  <TabsTrigger value="design" className="text-[10.5px] sm:text-[11px]">Design</TabsTrigger>
                  <TabsTrigger value="layers" className="text-[10.5px] sm:text-[11px]">Layers</TabsTrigger>
                  <TabsTrigger value="library" className="text-[10.5px] sm:text-[11px]">Library</TabsTrigger>
                </TabsList>

                <ScrollArea className="min-h-0 flex-1">
                  {/* STYLE */}
                  <TabsContent value="style" className="m-0 space-y-4 px-4 py-3">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Templates</Label>
                      <div className="mt-2">
                        <TemplatePanel onApply={applyTemplate} />
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-muted-foreground">Theme</Label>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {CARD_THEMES.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setThemeId(t.id)}
                            className={`rounded-lg border p-1.5 text-left transition-all hover:scale-[1.03] ${themeId === t.id ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                          >
                            <div className="mb-1 h-9 rounded-md" style={{ background: t.bg }} />
                            <span className="text-[10px] leading-none text-muted-foreground">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-muted-foreground">Accent color</Label>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {ACCENT_SWATCHES.map((c) => (
                          <button
                            key={c}
                            aria-label={`Accent ${c}`}
                            onClick={() => setAccent(c)}
                            className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${accent === c ? "ring-2 ring-primary ring-offset-1" : ""}`}
                            style={{ background: c }}
                          />
                        ))}
                        <input type="color" aria-label="Custom accent color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-6 w-8 rounded border border-border bg-transparent" />
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-muted-foreground">Typography</Label>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {FONT_CHOICES.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => setFontId(f.id)}
                            className={`rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${fontId === f.id ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}
                            style={{ fontFamily: f.heading }}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-muted-foreground">Background pattern</Label>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {BG_PATTERNS.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setPattern(p.id)}
                            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${pattern === p.id ? "border-primary bg-primary/5" : "border-border text-muted-foreground"}`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Global styling */}
                    <div className="space-y-3 border-t border-border pt-3">
                      <p className="text-[11px] font-medium">Global styling · applies to every card</p>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Text scale · {globals.textScale.toFixed(2)}x</Label>
                        <Slider className="mt-2" value={[globals.textScale * 100]} min={70} max={140} step={1} onValueChange={([v]) => setGlobals((g) => ({ ...g, textScale: v / 100 }))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Spacing · {globals.spacingScale.toFixed(2)}x</Label>
                        <Slider className="mt-2" value={[globals.spacingScale * 100]} min={60} max={160} step={1} onValueChange={([v]) => setGlobals((g) => ({ ...g, spacingScale: v / 100 }))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Corner radius · {globals.radiusScale.toFixed(2)}x</Label>
                        <Slider className="mt-2" value={[globals.radiusScale * 100]} min={0} max={200} step={5} onValueChange={([v]) => setGlobals((g) => ({ ...g, radiusScale: v / 100 }))} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-[12px]">Background override</Label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            aria-label="Background override"
                            value={globals.bgOverride || "#ffffff"}
                            onChange={(e) => setGlobals((g) => ({ ...g, bgOverride: e.target.value }))}
                            className="h-6 w-8 rounded border border-border bg-transparent"
                          />
                          {globals.bgOverride && (
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setGlobals((g) => ({ ...g, bgOverride: null }))}>
                              Reset
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-[12px]">Print-friendly mode</Label>
                        <Switch checked={globals.print} onCheckedChange={(v) => setGlobals((g) => ({ ...g, print: v }))} />
                      </div>
                    </div>

                    {/* Layout */}
                    <div className="space-y-3 border-t border-border pt-3">
                      <Label className="text-[11px] text-muted-foreground">Aspect ratio</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {ASPECT_RATIOS.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => setAspect(r.id)}
                            className={`rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${aspect === r.id ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-[12px]">Show Oltrid logo</Label>
                        <Switch checked={showLogo} onCheckedChange={setShowLogo} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground">Watermark</Label>
                        <Input value={watermark} onChange={(e) => setWatermark(e.target.value)} placeholder="@yourhandle" className="h-8 text-[12px]" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground">Cover image</Label>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="h-8 flex-1 text-[11px]" onClick={() => coverInput.current?.click()}>
                            <ImagePlus className="mr-1.5 h-3.5 w-3.5" /> {coverImage ? "Replace" : "Upload"}
                          </Button>
                          {coverImage && (
                            <Button variant="ghost" size="sm" className="h-8 text-[11px]" onClick={() => setCoverImage(null)}>
                              Remove
                            </Button>
                          )}
                        </div>
                        <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={onCoverPick} />
                      </div>
                    </div>
                  </TabsContent>

                  {/* DESIGN */}
                  <TabsContent value="design" className="m-0 space-y-4 px-4 py-3">
                    <ElementLibraryPanel onInsert={insertElement} />
                    <div className="border-t border-border pt-3">
                      <p className="mb-2 text-[11px] font-medium">Inspector</p>
                      <InspectorPanel
                        element={selected[0] ?? null}
                        onUpdate={(patch) => selected[0] && updateElement(selected[0].id, patch)}
                        onDuplicate={duplicateSelection}
                        onDelete={deleteSelection}
                        onSaveComponent={() => {
                          if (!selected.length) return;
                          saveComponent(selected[0].name);
                        }}
                      />
                    </div>
                  </TabsContent>

                  {/* LAYERS */}
                  <TabsContent value="layers" className="m-0 space-y-3 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium">Card {current + 1} layers</p>
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => insertElement("text")}>
                        <Plus className="mr-1 h-3 w-3" /> Text
                      </Button>
                    </div>
                    <LayerPanel
                      elements={elements}
                      selectedIds={selectedIds}
                      onSelect={setSelectedIds}
                      onUpdate={updateElement}
                      onReorder={reorderLayer}
                      onDelete={(id) => setElements(elements.filter((e) => e.id !== id))}
                    />
                    <div className="border-t border-border pt-3">
                      <p className="mb-2 text-[11px] font-medium">Guides</p>
                      <p className="text-[11px] text-muted-foreground">
                        Drag from a ruler to add a guide. Double-click a guide to remove it.
                      </p>
                      {guides.length > 0 && (
                        <Button size="sm" variant="ghost" className="mt-2 h-7 text-[11px]" onClick={() => setGuides([])}>
                          Clear {guides.length} guides
                        </Button>
                      )}
                    </div>
                    <div className="border-t border-border pt-3 text-[11px] text-muted-foreground">
                      <p className="mb-1 font-medium text-foreground">Shortcuts</p>
                      <p>⌘/Ctrl + D duplicate · ⌘/Ctrl + L lock · ⌘/Ctrl + E export all</p>
                      <p>⌘/Ctrl + ± zoom · arrows nudge · shift+arrows big nudge · F5 present</p>
                    </div>
                  </TabsContent>

                  {/* LIBRARY */}
                  <TabsContent value="library" className="m-0 space-y-4 px-4 py-3">
                    <div>
                      <p className="mb-2 text-[11px] font-medium">Reusable components</p>
                      <ComponentPanel
                        components={components}
                        canSave={selected.length > 0}
                        onSave={saveComponent}
                        onInsert={insertComponent}
                        onRemove={(id) => {
                          const next = components.filter((c) => c.id !== id);
                          setComponents(next);
                          saveComponents(next);
                        }}
                      />
                    </div>
                    <div className="border-t border-border pt-3">
                      <p className="mb-2 text-[11px] font-medium">Asset library</p>
                      <AssetPanel
                        assets={assets}
                        onAdd={addAssets}
                        onUse={useAsset}
                        onRemove={(id) => {
                          const next = assets.filter((a) => a.id !== id);
                          setAssets(next);
                          saveAssets(next);
                        }}
                      />
                    </div>
                    <div className="space-y-2 border-t border-border pt-3">
                      <p className="text-[11px] font-medium">AI rewrite (optional, uses credits)</p>
                      {[
                        { id: "summarize_social", label: "Summarize for Social" },
                        { id: "rewrite_audience", label: "Rewrite for Audience" },
                        { id: "better_carousel", label: "Generate Better Carousel" },
                      ].map((a) => (
                        <Button key={a.id} variant="outline" className="h-9 w-full justify-start text-[12px]" disabled={!!aiBusy} onClick={() => runAi(a.id as any)}>
                          {aiBusy === a.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
                          {a.label}
                        </Button>
                      ))}
                      {overrideContent && (
                        <Button variant="ghost" className="h-8 w-full text-[11px]" onClick={() => setOverrideContent(null)}>
                          Reset to original note
                        </Button>
                      )}
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>

              <div className="flex flex-wrap gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-9 flex-1 text-[12px]" disabled={exporting}>
                      {exporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                      This card
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-36">
                    <DropdownMenuItem onClick={() => exportOne("png")} className="text-[12px]">PNG</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportOne("jpg")} className="text-[12px]">JPG</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportOne("svg")} className="text-[12px]">SVG</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="h-9 flex-1 text-[12px]" disabled={exporting}>
                      {exporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                      All cards
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => exportAll("png")} className="text-[12px]">PNG (.zip)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportAll("jpg")} className="text-[12px]">JPG (.zip)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportAll("svg")} className="text-[12px]">SVG (.zip)</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Offscreen full-resolution render targets used for export */}
          <div style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none", opacity: 0 }} aria-hidden>
            {slides.map((s, i) => (
              <div key={s.id} ref={(el) => (exportRefs.current[s.id] = el)}>
                {renderSlide(i)}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {presenting && (
        <CardPresentMode
          count={slides.length}
          start={current}
          ratio={{ w: ratio.w, h: ratio.h }}
          render={renderSlide}
          onClose={() => setPresenting(false)}
        />
      )}
    </>
  );
}
