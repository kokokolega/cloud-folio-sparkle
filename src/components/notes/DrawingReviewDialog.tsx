import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Download, ImagePlus, Type, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  imageDataUrl: string;
  initialHtml: string;
  onInsertText: (html: string) => void;
  onInsertImage: (dataUrl: string) => void;
}

const SIZE_KEY = "oltrid-drawing-review-size";

export function DrawingReviewDialog({ open, onOpenChange, imageDataUrl, initialHtml, onInsertText, onInsertImage }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(initialHtml);

  useEffect(() => {
    setHtml(initialHtml);
    if (editorRef.current) editorRef.current.innerHTML = initialHtml;
  }, [initialHtml, open]);

  // Restore last size
  useEffect(() => {
    if (!open || !wrapRef.current) return;
    try {
      const saved = JSON.parse(localStorage.getItem(SIZE_KEY) || "null");
      if (saved && wrapRef.current) {
        wrapRef.current.style.width = saved.w + "px";
        wrapRef.current.style.height = saved.h + "px";
      }
    } catch {}
  }, [open]);

  const persistSize = () => {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    localStorage.setItem(SIZE_KEY, JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height) }));
  };

  const insertText = () => {
    const current = editorRef.current?.innerHTML || html;
    onInsertText(current);
    toast.success("Inserted at cursor");
    onOpenChange(false);
  };

  const insertImageOnly = () => {
    onInsertImage(imageDataUrl);
    toast.success("Drawing added to note");
    onOpenChange(false);
  };

  const insertBoth = () => {
    onInsertImage(imageDataUrl);
    onInsertText(editorRef.current?.innerHTML || html);
    toast.success("Drawing + text inserted");
    onOpenChange(false);
  };

  const downloadDrawing = () => {
    const a = document.createElement("a");
    a.href = imageDataUrl;
    a.download = `drawing-${Date.now()}.png`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={wrapRef as any}
        onMouseUp={persistSize}
        className="p-0 overflow-hidden flex flex-col"
        style={{ resize: "both", width: "min(900px, 95vw)", height: "min(640px, 85vh)", maxWidth: "98vw", maxHeight: "95vh", minWidth: "520px", minHeight: "380px" }}
      >
        <VisuallyHidden>
          <DialogTitle>Review converted drawing</DialogTitle>
          <DialogDescription>Edit the OCR text before inserting it into your note</DialogDescription>
        </VisuallyHidden>

        <div className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between">
          <p className="text-sm font-semibold">Review & edit converted text</p>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={downloadDrawing}>
              <Download className="h-3.5 w-3.5" /> Download drawing
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onOpenChange(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-0 min-h-0">
          <div className="border-r border-border/50 bg-muted/30 overflow-auto p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Original drawing</p>
            <img src={imageDataUrl} alt="drawing" className="w-full rounded-lg border border-border bg-white" />
          </div>
          <div className="overflow-hidden flex flex-col">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 pt-3 pb-1 font-semibold">Converted text — edit freely</p>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setHtml((e.target as HTMLDivElement).innerHTML)}
              className="prose-editor flex-1 overflow-auto px-4 py-3 text-[13px] leading-relaxed outline-none focus:bg-background/50"
            />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border/50 flex items-center justify-end gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={insertImageOnly}>
            <ImagePlus className="h-3.5 w-3.5" /> Insert drawing
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={insertBoth}>
            <ImagePlus className="h-3.5 w-3.5" /> Drawing + text
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={insertText}>
            <Type className="h-3.5 w-3.5" /> Insert text only
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
