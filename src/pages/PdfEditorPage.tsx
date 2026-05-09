import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rnd } from "react-rnd";
import { PDFDocument, rgb, StandardFonts, degrees, PageSizes } from "pdf-lib";
import { toast } from "sonner";
import { Upload, Download, Type, Square, Circle as CircleIcon, Trash2, Plus, Loader2, ChevronLeft, ChevronRight, RotateCw, Image as ImageIcon, FilePlus, Save, Play, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// pdfjs setup
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite worker import
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfjsWorker;

type OverlayType = "text" | "rect" | "ellipse" | "image";

interface Overlay {
  id: string;
  page: number;
  type: OverlayType;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  color: string; // hex
  fontSize: number;
  imageData?: string; // dataURL for image overlays
}

interface PageInfo {
  width: number;  // PDF units
  height: number; // PDF units
  rotation: number;
}

const COLORS = ["#000000", "#dc2626", "#2563eb", "#16a34a", "#f59e0b", "#9333ea", "#ffffff"];

function uid() { return Math.random().toString(36).slice(2, 9); }

export default function PdfEditorPage() {
  const { user } = useAuth();
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfName, setPdfName] = useState("document.pdf");
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [tool, setTool] = useState<OverlayType>("text");
  const [color, setColor] = useState("#000000");
  const [fontSize, setFontSize] = useState(16);
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingToFiles, setSavingToFiles] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [presenting, setPresenting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const renderScale = 1.5; // canvas resolution multiplier

  const loadPdf = async (file: File) => {
    setRendering(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      setPdfBytes(buf);
      setPdfName(file.name);
      setOverlays([]);
      setCurrentPage(0);

      const pdf = await pdfjsLib.getDocument({ data: buf.slice() }).promise;
      const newPages: PageInfo[] = [];
      const newImages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvas, canvasContext: ctx, viewport } as any).promise;
        newImages.push(canvas.toDataURL("image/png"));
        const baseVp = page.getViewport({ scale: 1 });
        newPages.push({ width: baseVp.width, height: baseVp.height, rotation: page.rotate || 0 });
      }
      setPages(newPages);
      setPageImages(newImages);
      toast.success(`Loaded ${newPages.length} page${newPages.length === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error(e.message || "Could not open PDF");
    } finally {
      setRendering(false);
    }
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    if (!canvasWrapRef.current) return;
    if (tool === "image") return; // images added via file picker
    const rect = canvasWrapRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    if ((e.target as HTMLElement).closest(".overlay-item")) return;
    const def: Overlay = {
      id: uid(),
      page: currentPage,
      type: tool,
      x, y,
      w: tool === "text" ? 220 : 120,
      h: tool === "text" ? 40 : 80,
      text: tool === "text" ? "New text" : undefined,
      color,
      fontSize,
    };
    setOverlays((p) => [...p, def]);
  };

  const onPickImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxW = 220;
        const ratio = img.height / img.width;
        const w = Math.min(maxW, img.width);
        const h = w * ratio;
        setOverlays((p) => [...p, {
          id: uid(),
          page: currentPage,
          type: "image",
          x: 40, y: 40, w, h,
          color: "#000000",
          fontSize: 12,
          imageData: dataUrl,
        }]);
        toast.success("Image added — drag to position");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const updateOverlay = (id: string, patch: Partial<Overlay>) => {
    setOverlays((p) => p.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };
  const deleteOverlay = (id: string) => setOverlays((p) => p.filter((o) => o.id !== id));

  const exportPdf = async () => {
    if (!pdfBytes) return;
    setExporting(true);
    try {
      const doc = await PDFDocument.load(pdfBytes);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const docPages = doc.getPages();

      // Canvas displayed dimensions per page = pages[i].width * renderScale (px)
      for (const ov of overlays) {
        const pdfPage = docPages[ov.page];
        if (!pdfPage) continue;
        const info = pages[ov.page];
        const displayedW = info.width * renderScale;
        const displayedH = info.height * renderScale;
        const scaleX = info.width / displayedW;
        const scaleY = info.height / displayedH;

        // pdf-lib origin: bottom-left, so flip Y
        const xPdf = ov.x * scaleX;
        const yPdfTop = ov.y * scaleY; // distance from top
        const wPdf = ov.w * scaleX;
        const hPdf = ov.h * scaleY;
        const yPdfBottom = info.height - yPdfTop - hPdf;

        const c = hexToRgb(ov.color);
        const colorObj = rgb(c.r / 255, c.g / 255, c.b / 255);

        if (ov.type === "text" && ov.text) {
          const size = ov.fontSize * scaleX;
          // baseline near top of bbox
          pdfPage.drawText(ov.text, {
            x: xPdf,
            y: info.height - yPdfTop - size,
            size,
            font,
            color: colorObj,
          });
        } else if (ov.type === "rect") {
          pdfPage.drawRectangle({
            x: xPdf, y: yPdfBottom, width: wPdf, height: hPdf,
            borderColor: colorObj, borderWidth: 1.5, color: undefined,
          });
        } else if (ov.type === "ellipse") {
          pdfPage.drawEllipse({
            x: xPdf + wPdf / 2,
            y: yPdfBottom + hPdf / 2,
            xScale: wPdf / 2,
            yScale: hPdf / 2,
            borderColor: colorObj,
            borderWidth: 1.5,
          });
        } else if (ov.type === "image" && ov.imageData) {
          const isPng = ov.imageData.startsWith("data:image/png");
          const b64 = ov.imageData.split(",")[1] || "";
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const embedded = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          pdfPage.drawImage(embedded, { x: xPdf, y: yPdfBottom, width: wPdf, height: hPdf });
        }
      }

      const out = await doc.save();
      const blob = new Blob([out as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = pdfName.replace(/\.pdf$/i, "") + "-edited.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported edited PDF ॥");
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const rotateCurrent = async () => {
    if (!pdfBytes) return;
    const doc = await PDFDocument.load(pdfBytes);
    const page = doc.getPages()[currentPage];
    const cur = page.getRotation().angle;
    page.setRotation(degrees((cur + 90) % 360));
    const out = await doc.save();
    setPdfBytes(out);
    // re-render
    const file = new File([out as BlobPart], pdfName, { type: "application/pdf" });
    await loadPdf(file);
  };

  const pageOverlays = overlays.filter((o) => o.page === currentPage);
  const currentImg = pageImages[currentPage];
  const info = pages[currentPage];
  const displayW = info ? info.width * renderScale * zoom : 0;
  const displayH = info ? info.height * renderScale * zoom : 0;

  return (
    <DashboardLayout noPadding>
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="border-b border-border/50 px-4 py-2.5 flex items-center gap-2 flex-wrap bg-background/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Open PDF
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && loadPdf(e.target.files[0])}
            />
            {pdfBytes && (
              <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={exportPdf} disabled={exporting}>
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Export
              </Button>
            )}
          </div>

          {pdfBytes && (
            <>
              <div className="h-5 w-px bg-border mx-1" />
              <div className="flex items-center gap-1">
                <Button size="sm" variant={tool === "text" ? "secondary" : "ghost"} className="h-8 gap-1.5 text-xs" onClick={() => setTool("text")}>
                  <Type className="h-3.5 w-3.5" /> Text
                </Button>
                <Button size="sm" variant={tool === "rect" ? "secondary" : "ghost"} className="h-8 gap-1.5 text-xs" onClick={() => setTool("rect")}>
                  <Square className="h-3.5 w-3.5" /> Box
                </Button>
                <Button size="sm" variant={tool === "ellipse" ? "secondary" : "ghost"} className="h-8 gap-1.5 text-xs" onClick={() => setTool("ellipse")}>
                  <CircleIcon className="h-3.5 w-3.5" /> Ellipse
                </Button>
                <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => imageRef.current?.click()}>
                  <ImageIcon className="h-3.5 w-3.5" /> Image
                </Button>
                <input
                  ref={imageRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => { onPickImage(e.target.files?.[0]); if (e.target) e.target.value = ""; }}
                />
              </div>
              <div className="h-5 w-px bg-border mx-1" />
              <div className="flex items-center gap-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`h-6 w-6 rounded-full border-2 transition-all ${color === c ? "ring-2 ring-primary ring-offset-1 scale-110" : "border-border"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="h-5 w-px bg-border mx-1" />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Size</span>
                <Input type="number" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value) || 16)} className="h-7 w-16 text-xs" min={8} max={96} />
              </div>
              <div className="h-5 w-px bg-border mx-1" />
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={rotateCurrent}>
                <RotateCw className="h-3.5 w-3.5" /> Rotate page
              </Button>
              <div className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>−</Button>
                <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}>+</Button>
              </div>
            </>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex">
          {/* Thumbnails */}
          {pageImages.length > 0 && (
            <div className="w-32 border-r border-border/50 overflow-y-auto bg-muted/20 p-2 space-y-2 shrink-0">
              {pageImages.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={`w-full block rounded-md overflow-hidden border-2 transition-all ${i === currentPage ? "border-primary shadow-md" : "border-transparent hover:border-border"}`}
                >
                  <img src={src} alt={`page ${i + 1}`} className="w-full bg-white" />
                  <div className="text-[10px] text-center py-1 text-muted-foreground bg-card">{i + 1}</div>
                </button>
              ))}
            </div>
          )}

          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-muted/30 p-6 flex items-start justify-center">
            {!pdfBytes ? (
              <div className="text-center text-muted-foreground mt-32">
                <Upload className="h-12 w-12 mx-auto opacity-30 mb-3" />
                <p className="text-sm">Open a PDF to start editing</p>
                <p className="text-xs mt-1">Add text boxes, shapes, rotate pages, then export.</p>
              </div>
            ) : rendering ? (
              <div className="mt-32"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : (
              <div
                ref={canvasWrapRef}
                onClick={onCanvasClick}
                className="relative shadow-xl bg-white"
                style={{ width: displayW, height: displayH, cursor: "crosshair" }}
              >
                {currentImg && (
                  <img src={currentImg} alt="" className="absolute inset-0 w-full h-full pointer-events-none select-none" draggable={false} />
                )}
                {pageOverlays.map((o) => (
                  <Rnd
                    key={o.id}
                    className="overlay-item"
                    size={{ width: o.w * zoom, height: o.h * zoom }}
                    position={{ x: o.x * zoom, y: o.y * zoom }}
                    onDragStop={(_, d) => updateOverlay(o.id, { x: d.x / zoom, y: d.y / zoom })}
                    onResizeStop={(_, __, ref, ___, pos) =>
                      updateOverlay(o.id, {
                        w: parseFloat(ref.style.width) / zoom,
                        h: parseFloat(ref.style.height) / zoom,
                        x: pos.x / zoom,
                        y: pos.y / zoom,
                      })
                    }
                    bounds="parent"
                    style={{ border: o.type === "image" ? "1.5px dashed rgba(0,0,0,0.2)" : `1.5px ${o.type === "text" ? "dashed" : "solid"} ${o.color}`, borderRadius: o.type === "ellipse" ? "50%" : 4 }}
                  >
                    <div className="relative w-full h-full group">
                      {o.type === "text" ? (
                        <textarea
                          value={o.text}
                          onChange={(e) => updateOverlay(o.id, { text: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full h-full bg-transparent outline-none resize-none p-1"
                          style={{ color: o.color, fontSize: o.fontSize * zoom, lineHeight: 1.2 }}
                        />
                      ) : o.type === "image" && o.imageData ? (
                        <img src={o.imageData} alt="" draggable={false} className="w-full h-full object-contain pointer-events-none select-none" />
                      ) : null}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteOverlay(o.id); }}
                        className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs shadow"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </Rnd>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Page nav */}
        {pdfBytes && pages.length > 1 && (
          <div className="border-t border-border/50 px-4 py-2 flex items-center justify-center gap-2 bg-background/80">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">{currentPage + 1} / {pages.length}</span>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function hexToRgb(hex: string) {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(v, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
