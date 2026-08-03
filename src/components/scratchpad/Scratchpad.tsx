import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Code2,
  FileText,
  Image as ImageIcon,
  Link2,
  ListTodo,
  Mic,
  NotebookPen,
  Paperclip,
  Pin,
  PinOff,
  Plus,
  Send,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DEFAULT_SECTIONS,
  ScratchDoc,
  ScratchItem,
  itemToHtml,
  loadScratch,
  makeItem,
  readFileAsDataUrl,
  saveScratch,
  titleFor,
} from "@/lib/scratchpad";

const KIND_ICON: Record<string, any> = {
  text: FileText,
  link: Link2,
  todo: ListTodo,
  code: Code2,
  image: ImageIcon,
  file: Paperclip,
  voice: Mic,
};

export function Scratchpad() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState<ScratchDoc>(() => loadScratch());
  const [section, setSection] = useState(DEFAULT_SECTIONS[0]);
  const [draft, setDraft] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [recording, setRecording] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  /* persist instantly on every change */
  useEffect(() => saveScratch(doc), [doc]);

  /* global shortcut: ⌘/Ctrl + J */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = useMemo(
    () =>
      doc.items
        .filter((i) => i.section === section)
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt),
    [doc.items, section]
  );

  const addItem = useCallback(
    (item: ScratchItem) => setDoc((d) => ({ ...d, items: [item, ...d.items] })),
    []
  );

  const patchItem = (id: string, patch: Partial<ScratchItem>) =>
    setDoc((d) => ({
      ...d,
      items: d.items.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i)),
    }));

  const removeItem = (id: string) => setDoc((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));

  const commitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    addItem(makeItem({ content: text, section }));
    setDraft("");
  };

  const addFiles = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      try {
        const dataUrl = await readFileAsDataUrl(f);
        addItem(
          makeItem({
            content: f.name,
            section,
            kind: f.type.startsWith("image/") ? "image" : "file",
            dataUrl,
            fileName: f.name,
            mime: f.type,
          })
        );
      } catch {
        toast.error(`Could not read ${f.name}`);
      }
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
        const dataUrl = await readFileAsDataUrl(new File([blob], "voice-note.webm", { type: blob.type }));
        addItem(makeItem({ content: "Voice note", section, kind: "voice", dataUrl, fileName: "voice-note.webm" }));
      };
      mr.start();
      recorder.current = mr;
      setRecording(true);
    } catch {
      toast.error("Microphone permission denied");
    }
  };

  /* ---------------- convert ---------------- */

  const convert = async (item: ScratchItem, target: "note" | "task" | "card" | "folder") => {
    if (!user) return toast.error("Sign in to convert Scratchpad items");
    try {
      if (target === "task") {
        const { error } = await supabase.from("tasks").insert({ user_id: user.id, title: titleFor(item) });
        if (error) throw error;
        toast.success("Task created");
        return;
      }
      if (target === "folder") {
        const { error } = await supabase.from("folders").insert({ user_id: user.id, name: titleFor(item).slice(0, 40) });
        if (error) throw error;
        toast.success("Project folder created");
        return;
      }
      const { error } = await supabase.from("notes").insert({
        user_id: user.id,
        title: titleFor(item),
        content: itemToHtml(item),
      });
      if (error) throw error;
      toast.success(target === "card" ? "Note created — open Show as Cards to design it" : "Note created", {
        action: { label: "Open notes", onClick: () => navigate("/notes") },
      });
    } catch (e: any) {
      toast.error(e?.message || "Could not convert this item");
    }
  };

  const addSection = () => {
    const name = window.prompt("Section name")?.trim();
    if (!name || doc.sections.includes(name)) return;
    setDoc((d) => ({ ...d, sections: [...d.sections, name] }));
    setSection(name);
  };

  return (
    <>
      {/* launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open Scratchpad (Ctrl/⌘ + J)"
        title="Scratchpad · ⌘/Ctrl + J"
        className="fixed bottom-4 left-4 z-[80] flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-background/80 text-foreground shadow-lg backdrop-blur-xl transition-transform hover:scale-105 active:scale-95"
      >
        <NotebookPen className="h-[18px] w-[18px]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed inset-x-2 bottom-2 z-[85] flex h-[70dvh] flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/90 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:left-4 sm:bottom-16 sm:h-[min(560px,72dvh)] sm:w-[380px]"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
              else {
                const text = e.dataTransfer.getData("text/plain");
                if (text) addItem(makeItem({ content: text, section }));
              }
            }}
          >
            <header className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
              <NotebookPen className="h-4 w-4 text-muted-foreground" />
              <p className="flex-1 text-[13px] font-medium">Scratchpad</p>
              <span className="hidden text-[10px] text-muted-foreground sm:inline">saves offline</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Close scratchpad" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div className="flex items-center gap-1 overflow-x-auto border-b border-border/60 px-2 py-1.5">
              {doc.sections.map((s) => (
                <button
                  key={s}
                  onClick={() => setSection(s)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                    section === s ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {s}
                </button>
              ))}
              <button onClick={addSection} aria-label="Add section" className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className={`space-y-2 p-3 ${dragOver ? "opacity-60" : ""}`}>
                {items.length === 0 && (
                  <p className="py-8 text-center text-[12px] text-muted-foreground">
                    Drop files, paste links, or start typing. Nothing here is ever lost.
                  </p>
                )}
                {items.map((item) => {
                  const Icon = KIND_ICON[item.kind] ?? FileText;
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="group rounded-xl border border-border/70 bg-card/70 p-2.5"
                    >
                      <div className="flex items-start gap-2">
                        {item.kind === "todo" ? (
                          <button
                            onClick={() => patchItem(item.id, { done: !item.done })}
                            aria-label="Toggle done"
                            className="mt-0.5 text-muted-foreground hover:text-foreground"
                          >
                            {item.done ? <Check className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                          </button>
                        ) : (
                          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}

                        <div className="min-w-0 flex-1">
                          {item.kind === "image" && item.dataUrl ? (
                            <img src={item.dataUrl} alt={item.fileName || "Scratchpad image"} className="max-h-40 w-full rounded-lg object-cover" />
                          ) : item.kind === "voice" && item.dataUrl ? (
                            <audio controls src={item.dataUrl} className="w-full" />
                          ) : item.kind === "link" ? (
                            <a href={item.content} target="_blank" rel="noreferrer" className="break-all text-[12px] text-primary underline">
                              {item.content}
                            </a>
                          ) : item.kind === "code" ? (
                            <pre className="overflow-x-auto rounded-lg bg-muted/60 p-2 text-[11px]">{item.content}</pre>
                          ) : (
                            <p className={`whitespace-pre-wrap break-words text-[12px] ${item.done ? "line-through opacity-60" : ""}`}>
                              {item.content}
                            </p>
                          )}
                          {item.kind === "file" && item.dataUrl && (
                            <a href={item.dataUrl} download={item.fileName} className="mt-1 inline-block text-[11px] text-primary underline">
                              Download {item.fileName}
                            </a>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            onClick={() => patchItem(item.id, { pinned: !item.pinned })}
                            aria-label={item.pinned ? "Unpin" : "Pin"}
                            className={`p-1 ${item.pinned ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            {item.pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button aria-label="Convert item" className="p-1 text-muted-foreground hover:text-foreground">
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem className="text-[12px]" onClick={() => convert(item, "note")}>Convert to Note</DropdownMenuItem>
                              <DropdownMenuItem className="text-[12px]" onClick={() => convert(item, "task")}>Convert to Task</DropdownMenuItem>
                              <DropdownMenuItem className="text-[12px]" onClick={() => convert(item, "card")}>Convert to Card</DropdownMenuItem>
                              <DropdownMenuItem className="text-[12px]" onClick={() => convert(item, "folder")}>Convert to Project</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <button onClick={() => removeItem(item.id)} aria-label="Delete item" className="p-1 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex items-center gap-1.5 border-t border-border/60 p-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    commitDraft();
                  }
                }}
                placeholder="Dump a thought, link or to-do…"
                className="h-9 flex-1 text-[12px]"
              />
              <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Attach files" onClick={() => fileInput.current?.click()}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant={recording ? "destructive" : "ghost"}
                className="h-9 w-9"
                aria-label={recording ? "Stop recording" : "Record voice note"}
                onClick={toggleRecording}
              >
                <Mic className="h-4 w-4" />
              </Button>
              <Button size="icon" className="h-9 w-9" aria-label="Add to scratchpad" onClick={commitDraft}>
                <Send className="h-4 w-4" />
              </Button>
              <input
                ref={fileInput}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
