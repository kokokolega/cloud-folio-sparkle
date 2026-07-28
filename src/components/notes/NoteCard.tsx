import { MoreHorizontal, Pin, PinOff, Pencil, Trash2, LayoutGrid } from "lucide-react";
import { NOTE_COLORS } from "@/pages/NotesPage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface NoteCardProps {
  note: {
    id: string;
    title: string;
    content: string;
    color: string;
    pinned: boolean;
    updated_at: string;
  };
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onShareCards?: () => void;
}

export function NoteCard({ note, onEdit, onDelete, onTogglePin, onShareCards }: NoteCardProps) {
  const colorConfig = NOTE_COLORS.find((c) => c.id === note.color) || NOTE_COLORS[0];

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  // Strip HTML for preview text
  const plainText = note.content
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={`group rounded-xl border ${colorConfig.border} ${colorConfig.bg} p-4 cursor-pointer hover:shadow-md transition-shadow`}
      onClick={onEdit}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          {note.title && (
            <h3 className="text-[13px] font-semibold text-foreground truncate">{note.title}</h3>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {note.pinned && <Pin className="h-3 w-3 text-muted-foreground" />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 rounded-lg">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin(); }} className="text-[13px]">
                {note.pinned ? <PinOff className="h-3.5 w-3.5 mr-2" /> : <Pin className="h-3.5 w-3.5 mr-2" />}
                {note.pinned ? "Unpin" : "Pin"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-[13px]">
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              {onShareCards && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShareCards(); }} className="text-[13px]">
                  <LayoutGrid className="h-3.5 w-3.5 mr-2" />
                  Share as Cards
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-destructive text-[13px]">
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {plainText && (
        <p className="text-[12px] text-muted-foreground line-clamp-4 leading-relaxed">
          {plainText}
        </p>
      )}

      <p className="text-[10px] text-muted-foreground/60 mt-3">{formatDate(note.updated_at)}</p>
    </motion.div>
  );
}
