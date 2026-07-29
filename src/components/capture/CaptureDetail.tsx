import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Copy,
  Languages,
  Search,
  StickyNote,
  ListTodo,
  Layers,
  X,
  FolderInput,
  Download,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import {
  learnFromCorrection,
  ensureFolderPath,
  relatedCaptures,
  type CaptureRow,
} from "@/lib/smartCapture/pipeline";

const db = supabase as any;

const publicUrl = (path: string) =>
  supabase.storage.from("user-files").getPublicUrl(path).data.publicUrl;

const formatSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

interface Props {
  capture: CaptureRow | null;
  all: CaptureRow[];
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
  onSelect: (c: CaptureRow) => void;
}

export function CaptureDetail({ capture, all, onOpenChange, onChanged, onSelect }: Props) {
  const { user } = useAuth();
  const [selection, setSelection] = useState("");
  const [moveCategory, setMoveCategory] = useState("");
  const [moveSub, setMoveSub] = useState("");
  const [busy, setBusy] = useState(false);

  const related = useMemo(() => (capture ? relatedCaptures(capture, all) : []), [capture, all]);

  if (!capture) return null;

  const pickSelection = () => {
    const text = window.getSelection()?.toString().trim() ?? "";
    if (text) setSelection(text);
  };

  const act = async (kind: string) => {
    const text = selection.trim();
    if (!text) return;
    if (kind === "copy") {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } else if (kind === "translate") {
      window.open(`https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(text)}&op=translate`, "_blank", "noopener");
    } else if (kind === "search") {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(text)}`, "_blank", "noopener");
    } else if (kind === "note" && user) {
      await db.from("notes").insert({
        user_id: user.id,
        title: capture.title,
        content: `<p>${text.replace(/\n/g, "<br/>")}</p>`,
      });
      toast.success("Note created");
    } else if (kind === "task" && user) {
      await db.from("tasks").insert({ user_id: user.id, title: text.slice(0, 120) });
      toast.success("Task created");
    } else if (kind === "flashcard" && user) {
      await db.from("notes").insert({
        user_id: user.id,
        title: `Flashcard · ${capture.title}`,
        content: `<h3>Q</h3><p>${capture.title}</p><h3>A</h3><p>${text.replace(/\n/g, "<br/>")}</p>`,
      });
      toast.success("Flashcard created");
    }
  };

  const applyMove = async () => {
    if (!user || !moveCategory.trim()) return;
    setBusy(true);
    try {
      const category = moveCategory.trim();
      const subfolder = moveSub.trim() || "General";
      const folderId = await ensureFolderPath(user.id, ["Smart Capture", category, subfolder]);
      await db
        .from("captures")
        .update({ category, subfolder, folder_id: folderId, status: "organized", confidence: 100 })
        .eq("id", capture.id);
      if (capture.file_id) await db.from("files").update({ folder_id: folderId }).eq("id", capture.file_id);
      await learnFromCorrection(user.id, capture, category, subfolder);
      toast.success(`Moved to ${category} → ${subfolder}. Oltrid will remember this.`);
      setMoveCategory("");
      setMoveSub("");
      onChanged();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Could not move capture");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    await db.from("captures").delete().eq("id", capture.id);
    if (capture.file_id) await db.from("files").update({ deleted_at: new Date().toISOString() }).eq("id", capture.file_id);
    toast.success("Capture removed");
    setBusy(false);
    onChanged();
    onOpenChange(false);
  };

  const confidenceLabel =
    capture.confidence >= 85 ? "Very confident" : capture.confidence >= 60 ? "Likely correct" : "Needs review";

  return (
    <Dialog open={!!capture} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-4xl h-[92dvh] md:h-[85vh] p-0 gap-0 rounded-2xl overflow-hidden glass-card border-0">
        <div className="flex h-full flex-col md:flex-row">
          {/* Image */}
          <div className="relative md:w-1/2 shrink-0 bg-muted/40 flex items-center justify-center p-3 md:p-6 max-h-[35dvh] md:max-h-none">
            <img
              src={publicUrl(capture.storage_path)}
              alt={capture.title}
              className="max-h-full max-w-full rounded-xl object-contain shadow-sm"
            />
            <button
              onClick={() => onOpenChange(false)}
              className="absolute right-3 top-3 rounded-full bg-background/80 p-1.5 text-muted-foreground backdrop-blur hover:text-foreground md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Info */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 md:p-6 space-y-5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base md:text-lg font-semibold text-foreground break-words">{capture.title}</h2>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {capture.category} › {capture.subfolder} · {new Date(capture.captured_at).toLocaleString()} ·{" "}
                    {formatSize(capture.size)}
                  </p>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="hidden md:block rounded-full p-1.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                  <span>Confidence · {confidenceLabel}</span>
                  <span>{capture.confidence}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${capture.confidence}%` }}
                    className={`h-full rounded-full ${
                      capture.confidence >= 85 ? "bg-emerald-500" : capture.confidence >= 60 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                  />
                </div>
              </div>

              {capture.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {capture.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="rounded-full text-[11px] font-normal">
                      #{t}
                    </Badge>
                  ))}
                </div>
              )}

              {/* OCR text with highlight actions */}
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                  Detected text — select any part for actions
                </p>
                <div
                  onMouseUp={pickSelection}
                  onTouchEnd={pickSelection}
                  className="max-h-52 overflow-y-auto whitespace-pre-wrap rounded-xl bg-secondary/40 p-3 text-[12.5px] leading-relaxed text-foreground selection:bg-primary/25"
                >
                  {capture.ocr_text?.trim() || "No text detected in this image."}
                </div>
                {selection && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      { k: "copy", icon: Copy, label: "Copy" },
                      { k: "translate", icon: Languages, label: "Translate" },
                      { k: "search", icon: Search, label: "Search" },
                      { k: "note", icon: StickyNote, label: "Note" },
                      { k: "task", icon: ListTodo, label: "Task" },
                      { k: "flashcard", icon: Layers, label: "Flashcard" },
                    ].map(({ k, icon: Icon, label }) => (
                      <Button key={k} size="sm" variant="secondary" className="h-7 rounded-full text-[11px]" onClick={() => act(k)}>
                        <Icon className="mr-1 h-3 w-3" /> {label}
                      </Button>
                    ))}
                  </motion.div>
                )}
              </div>

              {related.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-2">Related captures</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {related.map(({ capture: r }) => (
                      <button
                        key={r.id}
                        onClick={() => onSelect(r)}
                        className="group overflow-hidden rounded-lg border border-border text-left"
                      >
                        <img src={publicUrl(r.storage_path)} alt={r.title} className="aspect-square w-full object-cover" />
                        <span className="block truncate px-1.5 py-1 text-[10px] text-muted-foreground">{r.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs">
                      <FolderInput className="mr-1.5 h-3.5 w-3.5" /> Move
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 rounded-xl space-y-2">
                    <p className="text-[11px] text-muted-foreground">Oltrid learns from your correction.</p>
                    <Input
                      placeholder="Category (e.g. Programming)"
                      value={moveCategory}
                      onChange={(e) => setMoveCategory(e.target.value)}
                      className="h-8 text-xs rounded-lg"
                    />
                    <Input
                      placeholder="Folder (e.g. React)"
                      value={moveSub}
                      onChange={(e) => setMoveSub(e.target.value)}
                      className="h-8 text-xs rounded-lg"
                    />
                    <Button size="sm" className="w-full h-8 rounded-lg text-xs" disabled={busy} onClick={applyMove}>
                      Move & remember
                    </Button>
                  </PopoverContent>
                </Popover>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg text-xs"
                  onClick={() => window.open(publicUrl(capture.storage_path), "_blank", "noopener")}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                </Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs text-destructive" disabled={busy} onClick={remove}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
