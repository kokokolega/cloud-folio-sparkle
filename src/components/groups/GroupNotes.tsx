import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { NoteCard } from "@/components/notes/NoteCard";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface GroupNotesProps {
  groupId: string;
  searchQuery: string;
}

export function GroupNotes({ groupId, searchQuery }: GroupNotesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingNote, setEditingNote] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["group-notes", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("group_id", groupId)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (n: { title: string; content: string; color: string }) => {
      const { error } = await supabase.from("notes").insert({
        ...n,
        user_id: user!.id,
        group_id: groupId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-notes", groupId] });
      setIsCreating(false);
      toast.success("Note created!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (update: any) => {
      const { id, ...rest } = update;
      const { error } = await supabase.from("notes").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-notes", groupId] });
      setEditingNote(null);
      toast.success("Note updated!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-notes", groupId] });
      toast.success("Note deleted");
    },
  });

  const filtered = notes.filter((n: any) =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const editorOpen = isCreating || !!editingNote;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setIsCreating(true)} size="sm" className="rounded-xl gap-2">
          <Plus className="h-3.5 w-3.5" /> New Note
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No notes in this group yet</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((note: any) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={() => setEditingNote(note)}
              onDelete={() => deleteMutation.mutate(note.id)}
              onTogglePin={() => updateMutation.mutate({ id: note.id, pinned: !note.pinned })}
            />
          ))}
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={(o) => { if (!o) { setIsCreating(false); setEditingNote(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <NoteEditor
            note={editingNote}
            onSave={(data) => {
              if (editingNote) {
                updateMutation.mutate({ id: editingNote.id, ...data });
              } else {
                createMutation.mutate(data);
              }
            }}
            onCancel={() => { setIsCreating(false); setEditingNote(null); }}
            isSaving={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
