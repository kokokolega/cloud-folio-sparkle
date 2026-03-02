import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StickyNote } from "lucide-react";

interface Note {
  id: string;
  title: string;
  content: string;
}

interface NoteMentionDropdownProps {
  query: string; // text after @
  onSelect: (note: Note) => void;
  visible: boolean;
}

export function NoteMentionDropdown({ query, onSelect, visible }: NoteMentionDropdownProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    if (!visible || !user) return;
    const fetchNotes = async () => {
      let q = supabase
        .from("notes")
        .select("id, title, content")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(8);
      if (query) {
        q = q.ilike("title", `%${query}%`);
      }
      const { data } = await q;
      setNotes(data || []);
    };
    fetchNotes();
  }, [query, visible, user]);

  if (!visible || notes.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 mb-1 w-80 max-h-48 overflow-y-auto rounded-xl border border-border bg-popover shadow-lg z-50">
      {notes.map((note) => (
        <button
          key={note.id}
          onClick={() => onSelect(note)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors text-sm"
        >
          <StickyNote className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate font-medium text-foreground">{note.title || "Untitled"}</span>
        </button>
      ))}
    </div>
  );
}
