import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NOTE_COLORS } from "@/pages/NotesPage";
import { X } from "lucide-react";

interface NoteEditorProps {
  note?: { title: string; content: string; color: string } | null;
  onSave: (data: { title: string; content: string; color: string }) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function NoteEditor({ note, onSave, onCancel, isSaving }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  const [color, setColor] = useState(note?.color || "default");

  const colorConfig = NOTE_COLORS.find((c) => c.id === color) || NOTE_COLORS[0];

  return (
    <div className={`rounded-xl border ${colorConfig.border} ${colorConfig.bg} p-4 shadow-sm`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-medium text-foreground">
          {note ? "Edit note" : "New note"}
        </p>
        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-9 rounded-lg text-[13px] mb-2 bg-transparent border-none shadow-none focus-visible:ring-0 px-0 font-semibold placeholder:font-normal"
        autoFocus
      />

      <Textarea
        placeholder="Write your note…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[120px] rounded-lg text-[12px] bg-transparent border-none shadow-none focus-visible:ring-0 px-0 resize-none leading-relaxed"
      />

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          {NOTE_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => setColor(c.id)}
              title={c.label}
              className={`h-5 w-5 rounded-full border-2 transition-all ${
                c.id === "default"
                  ? "bg-card border-border"
                  : c.id === "yellow"
                  ? "bg-yellow-300 dark:bg-yellow-700 border-yellow-400"
                  : c.id === "green"
                  ? "bg-emerald-300 dark:bg-emerald-700 border-emerald-400"
                  : c.id === "blue"
                  ? "bg-blue-300 dark:bg-blue-700 border-blue-400"
                  : c.id === "pink"
                  ? "bg-pink-300 dark:bg-pink-700 border-pink-400"
                  : "bg-violet-300 dark:bg-violet-700 border-violet-400"
              } ${color === c.id ? "ring-2 ring-primary ring-offset-1 scale-110" : ""}`}
            />
          ))}
        </div>

        <Button
          size="sm"
          className="h-7 rounded-lg text-[12px] px-4"
          onClick={() => onSave({ title, content, color })}
          disabled={isSaving || (!title.trim() && !content.trim())}
        >
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
