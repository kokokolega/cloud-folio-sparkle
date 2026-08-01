import { useEffect, useMemo, useRef, useState } from "react";
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
  Download,
  Loader2,
  Sparkles,
  ImagePlus,
  X,
} from "lucide-react";
import { CardSlide, parseNoteToSlides } from "@/lib/cardParser";
import {
  ASPECT_RATIOS,
  AspectId,
  BG_PATTERNS,
  CARD_THEMES,
  FONT_CHOICES,
  PatternId,
} from "@/lib/cardThemes";
import { CardSlideView } from "@/components/notes/CardSlideView";
import { rewriteForCards } from "@/lib/cardAi";

interface ShareCardsDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  note: { id?: string; title: string; content: string } | null;
}

const ACCENT_SWATCHES = ["#007AFF", "#111111", "#B14BFF", "#F59E0B", "#10B981", "#EF4444", "#38BDF8", "#EC4899"];

export function ShareCardsDialog({ open, onOpenChange, note }: ShareCardsDialogProps) {
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

  const previewBox = useRef<HTMLDivElement>(null);
  const exportRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const coverInput = useRef<HTMLInputElement>(null);

  const theme = CARD_THEMES.find((t) => t.id === themeId) || CARD_THEMES[0];
  const font = FONT_CHOICES.find((f) => f.id === fontId) || FONT_CHOICES[0];
  const ratio = ASPECT_RATIOS.find((r) => r.id === aspect) || ASPECT_RATIOS[1];

  useEffect(() => {
    if (!open) return;
    setCurrent(0);
    setOverrideContent(null);
  }, [open, note?.id]);

  useEffect(() => {
    const el = previewBox.current;
    if (!el) return;
    const update = () => setPreviewWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const slides: CardSlide[] = useMemo(() => {
    if (!note) return [];
    return parseNoteToSlides({
      title: note.title,
      content: overrideContent ?? note.content,
      pointsPerSlide: aspect === "16:9" ? 3 : 4,
    });
  }, [note, overrideContent, aspect]);

  useEffect(() => {
    if (current > slides.length - 1) setCurrent(0);
  }, [slides.length, current]);

  const cfgFor = (index: number) => ({
    theme,
    accent,
    fontHeading: font.heading,
    fontBody: font.body,
    pattern,
    showLogo,
    watermark,
    width: ratio.w,
    height: ratio.h,
    coverImage,
    index,
    total: slides.length,
  });

  const scale = Math.min(previewWidth / ratio.w, 1);

  const slugBase = (note?.title || "oltrid-note").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "oltrid-note";

  const renderNode = async (node: HTMLElement, format: "png" | "jpg" | "svg") => {
    const opts = { cacheBust: true, pixelRatio: 2, width: ratio.w, height: ratio.h };
    if (format === "png") return toPng(node, opts);
    if (format === "jpg") return toJpeg(node, { ...opts, quality: 0.95, backgroundColor: "#ffffff" });
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
    if (!node) return;
    setExporting(true);
    try {
      const url = await renderNode(node, format);
      downloadDataUrl(url, `${slugBase}-${current + 1}.${format}`);
      toast.success(`Slide ${current + 1} exported as ${format.toUpperCase()}`);
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const exportAll = async (format: "png" | "jpg" | "svg") => {
    setExporting(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) {
        const node = exportRefs.current[slides[i].id];
        if (!node) continue;
        const url = await renderNode(node, format);
        const base64 = url.startsWith("data:image/svg")
          ? null
          : url.split(",")[1];
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
  };

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(1100px,96vw)] w-full h-[92vh] sm:h-[88vh] p-0 gap-0 overflow-hidden rounded-2xl">
        <VisuallyHidden>
          <DialogTitle>Share as beautiful cards</DialogTitle>
          <DialogDescription>Turn this note into a shareable carousel</DialogDescription>
        </VisuallyHidden>

        <div className="flex flex-col md:flex-row h-full min-h-0">
          {/* Preview */}
          <div className="flex-1 min-h-0 flex flex-col bg-muted/40 p-3 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-medium text-foreground">Share as Cards</p>
              <p className="text-[11px] text-muted-foreground">
                {slides.length} slides · {ratio.label}
              </p>
            </div>

            <div ref={previewBox} className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
              {slides[current] && (
                <div
                  className="shadow-xl rounded-lg overflow-hidden shrink-0"
                  style={{
                    width: ratio.w * scale,
                    height: ratio.h * scale,
                    maxHeight: "100%",
                  }}
                >
                  <div
                    style={{
                      width: ratio.w,
                      height: ratio.h,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <CardSlideView slide={slides[current]} cfg={cfgFor(current)} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 mt-3">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-[55%] px-1">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    aria-label={`Go to slide ${i + 1}`}
                    onClick={() => setCurrent(i)}
                    className={`h-1.5 rounded-full transition-all ${i === current ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
                  />
                ))}
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setCurrent((c) => Math.min(slides.length - 1, c + 1))} disabled={current >= slides.length - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Controls */}
          <div className="w-full md:w-[340px] border-t md:border-t-0 md:border-l border-border flex flex-col min-h-0 max-h-[46vh] md:max-h-none">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
              <span className="text-[12px] font-medium">Customize</span>
            </div>

            <Tabs defaultValue="style" className="flex-1 min-h-0 flex flex-col">
              <TabsList className="mx-3 mt-3 grid grid-cols-3 h-8">
                <TabsTrigger value="style" className="text-[11px]">Style</TabsTrigger>
                <TabsTrigger value="layout" className="text-[11px]">Layout</TabsTrigger>
                <TabsTrigger value="ai" className="text-[11px]">AI</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 min-h-0">
                <TabsContent value="style" className="px-4 py-3 space-y-4 m-0">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Theme</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {CARD_THEMES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setThemeId(t.id)}
                          className={`rounded-lg border p-1.5 text-left transition-all hover:scale-[1.03] ${themeId === t.id ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                        >
                          <div className="h-9 rounded-md mb-1" style={{ background: t.bg }} />
                          <span className="text-[10px] text-muted-foreground leading-none">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Accent color</Label>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {ACCENT_SWATCHES.map((c) => (
                        <button
                          key={c}
                          aria-label={`Accent ${c}`}
                          onClick={() => setAccent(c)}
                          className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${accent === c ? "ring-2 ring-primary ring-offset-1" : ""}`}
                          style={{ background: c }}
                        />
                      ))}
                      <input
                        type="color"
                        aria-label="Custom accent color"
                        value={accent}
                        onChange={(e) => setAccent(e.target.value)}
                        className="h-6 w-8 rounded border border-border bg-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">Typography</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
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
                    <div className="flex flex-wrap gap-1.5 mt-2">
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
                </TabsContent>

                <TabsContent value="layout" className="px-4 py-3 space-y-4 m-0">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Aspect ratio</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
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
                      <Button variant="outline" size="sm" className="h-8 text-[11px] flex-1" onClick={() => coverInput.current?.click()}>
                        <ImagePlus className="h-3.5 w-3.5 mr-1.5" /> {coverImage ? "Replace" : "Upload"}
                      </Button>
                      {coverImage && (
                        <Button variant="ghost" size="sm" className="h-8 text-[11px]" onClick={() => setCoverImage(null)}>
                          Remove
                        </Button>
                      )}
                    </div>
                    <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={onCoverPick} />
                  </div>
                </TabsContent>

                <TabsContent value="ai" className="px-4 py-3 space-y-3 m-0">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Cards are generated instantly without AI. Use these only when you want the copy rewritten — they consume AI credits.
                  </p>
                  {[
                    { id: "summarize_social", label: "Summarize for Social" },
                    { id: "rewrite_audience", label: "Rewrite for Audience" },
                    { id: "better_carousel", label: "Generate Better Carousel" },
                  ].map((a) => (
                    <Button
                      key={a.id}
                      variant="outline"
                      className="w-full h-9 justify-start text-[12px]"
                      disabled={!!aiBusy}
                      onClick={() => runAi(a.id as any)}
                    >
                      {aiBusy === a.id ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-2" />}
                      {a.label}
                    </Button>
                  ))}
                  {overrideContent && (
                    <Button variant="ghost" className="w-full h-8 text-[11px]" onClick={() => setOverrideContent(null)}>
                      Reset to original note
                    </Button>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>

            <div className="border-t border-border p-3 flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex-1 h-9 text-[12px]" disabled={exporting}>
                    {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                    This slide
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
                  <Button className="flex-1 h-9 text-[12px]" disabled={exporting}>
                    {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
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
              <CardSlideView slide={s} cfg={cfgFor(i)} />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
