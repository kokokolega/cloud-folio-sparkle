import { useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NOTE_COLORS } from "@/pages/NotesPage";
import {
  X,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  List,
  ListOrdered,
  ListChecks,
  Heading2,
  Quote,
  Code,
  Minus,
  Undo,
  Redo,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AiToolbar } from "@/components/notes/AiToolbar";

interface NoteEditorProps {
  note?: { title: string; content: string; color: string } | null;
  onSave: (data: { title: string; content: string; color: string }) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function ToolbarButton({
  onClick,
  active,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
            active
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[11px]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function NoteEditor({ note, onSave, onCancel, isSaving }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title || "");
  const [color, setColor] = useState(note?.color || "default");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder: "Write your note…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Underline,
    ],
    content: note?.content || "",
    editorProps: {
      attributes: {
        class: "prose-editor min-h-[160px] outline-none text-[13px] leading-relaxed",
      },
    },
  });

  const colorConfig = NOTE_COLORS.find((c) => c.id === color) || NOTE_COLORS[0];

  const handleSave = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    const isEmpty = editor.isEmpty && !title.trim();
    if (isEmpty) return;
    onSave({ title, content: html, color });
  }, [editor, title, color, onSave]);

  if (!editor) return null;

  return (
    <div className={`rounded-xl border ${colorConfig.border} ${colorConfig.bg} shadow-sm overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <p className="text-[13px] font-medium text-foreground">
          {note ? "Edit note" : "New note"}
        </p>
        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Title */}
      <div className="px-4">
        <Input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-9 rounded-lg text-[14px] bg-transparent border-none shadow-none focus-visible:ring-0 px-0 font-semibold placeholder:font-normal"
          autoFocus
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-4 py-1.5 flex-wrap">
        <AiToolbar editor={editor} />
        <Separator orientation="vertical" className="h-4 mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          icon={Bold}
          label="Bold"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          icon={Italic}
          label="Italic"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          icon={UnderlineIcon}
          label="Underline"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          icon={Strikethrough}
          label="Strikethrough"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive("highlight")}
          icon={Highlighter}
          label="Highlight"
        />

        <Separator orientation="vertical" className="h-4 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          icon={Heading2}
          label="Heading"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          icon={List}
          label="Bullet list"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          icon={ListOrdered}
          label="Numbered list"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive("taskList")}
          icon={ListChecks}
          label="Checklist"
        />

        <Separator orientation="vertical" className="h-4 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          icon={Quote}
          label="Quote"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          icon={Code}
          label="Code block"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          icon={Minus}
          label="Divider"
        />

        <Separator orientation="vertical" className="h-4 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          icon={Undo}
          label="Undo"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          icon={Redo}
          label="Redo"
        />
      </div>

      {/* Editor content */}
      <div className="px-4 pb-2">
        <EditorContent editor={editor} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
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

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {editor.storage.characterCount?.characters?.() ?? ""} 
          </span>
          <Button
            size="sm"
            className="h-7 rounded-lg text-[12px] px-4"
            onClick={handleSave}
            disabled={isSaving || (editor.isEmpty && !title.trim())}
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
