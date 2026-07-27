import { useState, useCallback, useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import ImageResize from 'tiptap-extension-resize-image';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NOTE_COLORS } from "@/pages/NotesPage";
import {
  X, Bold, Italic, Underline as UnderlineIcon, Strikethrough, Highlighter,
  List, ListOrdered, ListChecks, Heading2, Quote, Code, Minus, Undo, Redo, Check, Loader2,
  ImagePlus, Maximize2, Minimize2, History,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AiToolbar } from "@/components/notes/AiToolbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ScrollArea } from "@/components/ui/scroll-area";


interface NoteEditorProps {
  note?: { id?: string; title: string; content: string; color: string } | null;
  onSave: (data: { title: string; content: string; color: string }) => void;
  onCancel: () => void;
  isSaving: boolean;
  onAutoSave?: (data: { title: string; content: string; color: string }) => void;
}

function ToolbarButton({ onClick, active, icon: Icon, label }: { onClick: () => void; active?: boolean; icon: React.ElementType; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={onClick} className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
          <Icon className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[11px]">{label}</TooltipContent>
    </Tooltip>
  );
}

interface VersionEntry {
  title: string;
  content: string;
  color: string;
  timestamp: string;
}

export function NoteEditor({ note, onSave, onCancel, isSaving, onAutoSave }: NoteEditorProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState(note?.title || "");
  const [color, setColor] = useState(note?.color || "default");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isExistingNote = !!note?.id;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [drawingOpen, setDrawingOpen] = useState(false);
  
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Placeholder.configure({ placeholder: "Write your note…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Underline,
      ImageResize,
    ],
    content: note?.content || "",
    editorProps: {
      attributes: {
        class: "prose-editor min-h-[160px] outline-none text-[13px] leading-relaxed",
      },
    },
    onUpdate: () => {
      if (isExistingNote && onAutoSave) {
        triggerAutoSave();
      }
    },
  });

  // Track versions on auto-save
  const addVersion = useCallback(() => {
    if (!editor || !isExistingNote) return;
    const html = editor.getHTML();
    setVersions(prev => {
      const entry: VersionEntry = { title, content: html, color, timestamp: new Date().toISOString() };
      const updated = [entry, ...prev].slice(0, 50); // keep last 50 versions (up to ~10 days)
      return updated;
    });
  }, [editor, title, color, isExistingNote]);

  const triggerAutoSave = useCallback(() => {
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (!editor) return;
      addVersion();
      const html = editor.getHTML();
      setAutoSaveStatus("saving");
      onAutoSave?.({ title, content: html, color });
      setTimeout(() => setAutoSaveStatus("saved"), 500);
      setTimeout(() => setAutoSaveStatus("idle"), 2500);
    }, 2000);
  }, [editor, title, color, onAutoSave, addVersion]);

  useEffect(() => {
    if (isExistingNote && onAutoSave) {
      triggerAutoSave();
    }
  }, [title, color]);

  useEffect(() => {
    return () => clearTimeout(autoSaveTimerRef.current);
  }, []);

  const restoreVersion = (v: VersionEntry) => {
    if (!editor) return;
    setTitle(v.title);
    setColor(v.color);
    editor.commands.setContent(v.content);
    setShowVersions(false);
    toast.success("Version restored");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/note-img-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("user-files").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("user-files").getPublicUrl(path);
      editor.chain().focus().insertContent(`<img src="${urlData.publicUrl}" />`).run();
      toast.success("Image added");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const colorConfig = NOTE_COLORS.find((c) => c.id === color) || NOTE_COLORS[0];

  const handleSave = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    const isEmpty = editor.isEmpty && !title.trim();
    if (isEmpty) return;
    onSave({ title, content: html, color });
  }, [editor, title, color, onSave]);

  if (!editor) return null;

  const editorUI = (
    <div className={`rounded-xl border ${colorConfig.border} ${colorConfig.bg} shadow-sm overflow-hidden ${isFullscreen ? "h-full flex flex-col" : ""}`}>
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <p className="text-[13px] font-medium text-foreground">
          {note ? "Edit note" : "New note"}
        </p>
        <div className="flex items-center gap-2">
          {isExistingNote && autoSaveStatus !== "idle" && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              {autoSaveStatus === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>}
              {autoSaveStatus === "saved" && <><Check className="h-3 w-3 text-primary" /> Saved ✓</>}
            </span>
          )}
          {isExistingNote && versions.length > 0 && (
            <ToolbarButton onClick={() => setShowVersions(true)} icon={History} label="Version History" />
          )}
          <ToolbarButton onClick={() => setIsFullscreen(!isFullscreen)} icon={isFullscreen ? Minimize2 : Maximize2} label={isFullscreen ? "Exit fullscreen" : "Fullscreen"} />
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="px-4">
        <Input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-9 rounded-lg text-[14px] bg-transparent border-none shadow-none focus-visible:ring-0 px-0 font-semibold placeholder:font-normal"
          autoFocus
        />
      </div>

      <div className="flex items-center gap-0.5 px-4 py-1.5 flex-wrap">
        <AiToolbar editor={editor} />
        <Separator orientation="vertical" className="h-4 mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} icon={Bold} label="Bold" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} icon={Italic} label="Italic" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} icon={UnderlineIcon} label="Underline" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} icon={Strikethrough} label="Strikethrough" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} icon={Highlighter} label="Highlight" />
        <Separator orientation="vertical" className="h-4 mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} icon={Heading2} label="Heading" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} icon={List} label="Bullet list" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} icon={ListOrdered} label="Numbered list" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} icon={ListChecks} label="Checklist" />
        <Separator orientation="vertical" className="h-4 mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} icon={Quote} label="Quote" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} icon={Code} label="Code block" />
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} icon={Minus} label="Divider" />
        <Separator orientation="vertical" className="h-4 mx-1" />
        <ToolbarButton
          onClick={() => imageInputRef.current?.click()}
          icon={uploadingImage ? Loader2 : ImagePlus}
          label="Add image"
          active={uploadingImage}
        />
        <ToolbarButton
          onClick={() => setDrawingOpen(true)}
          icon={PenTool}
          label="Sketch / draw"
        />
        <Separator orientation="vertical" className="h-4 mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} icon={Undo} label="Undo" />
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} icon={Redo} label="Redo" />
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      <div className={`px-4 pb-2 ${isFullscreen ? "flex-1 overflow-y-auto" : ""}`}>
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          {NOTE_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => setColor(c.id)}
              title={c.label}
              className={`h-5 w-5 rounded-full border-2 transition-all ${
                c.id === "default" ? "bg-card border-border"
                : c.id === "yellow" ? "bg-yellow-300 dark:bg-yellow-700 border-yellow-400"
                : c.id === "green" ? "bg-emerald-300 dark:bg-emerald-700 border-emerald-400"
                : c.id === "blue" ? "bg-blue-300 dark:bg-blue-700 border-blue-400"
                : c.id === "pink" ? "bg-pink-300 dark:bg-pink-700 border-pink-400"
                : "bg-violet-300 dark:bg-violet-700 border-violet-400"
              } ${color === c.id ? "ring-2 ring-primary ring-offset-1 scale-110" : ""}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" className="h-7 rounded-lg text-[12px] px-4" onClick={handleSave} disabled={isSaving || (editor.isEmpty && !title.trim())}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Version History Dialog */}
      <DrawingPad
        open={drawingOpen}
        onOpenChange={setDrawingOpen}
        onInsert={(html) => editor.chain().focus().insertContent(html).run()}
        onInsertImage={(dataUrl) => editor.chain().focus().insertContent(`<img src="${dataUrl}" />`).run()}
      />
      <Dialog open={showVersions} onOpenChange={setShowVersions}>
        <DialogContent className="sm:max-w-md max-h-[70vh]">
          <VisuallyHidden>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>Previous versions of this note</DialogDescription>
          </VisuallyHidden>
          <div className="space-y-1 mb-3">
            <h3 className="text-sm font-semibold text-foreground">Version History</h3>
            <p className="text-[11px] text-muted-foreground">Click a version to restore it</p>
          </div>
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-2 pr-2">
              {versions.map((v, i) => (
                <button
                  key={i}
                  onClick={() => restoreVersion(v)}
                  className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-foreground truncate">{v.title || "Untitled"}</span>
                    <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                      {new Date(v.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {v.content.replace(/<[^>]*>/g, "").slice(0, 100)}
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background p-4 md:p-8">
        {editorUI}
      </div>
    );
  }

  return editorUI;
}
