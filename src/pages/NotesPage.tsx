import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { NoteCard } from "@/components/notes/NoteCard";
import { Button } from "@/components/ui/button";
import { Plus, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

const NOTE_COLORS = [
  { id: "default", label: "Default", bg: "bg-card", border: "border-border" },
  { id: "yellow", label: "Yellow", bg: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-200 dark:border-yellow-800/40" },
  { id: "green", label: "Green", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800/40" },
  { id: "blue", label: "Blue", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800/40" },
  { id: "pink", label: "Pink", bg: "bg-pink-50 dark:bg-pink-950/30", border: "border-pink-200 dark:border-pink-800/40" },
  { id: "purple", label: "Purple", bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-800/40" },
];

export { NOTE_COLORS };

export default function NotesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (note: { title: string; content: string; color: string }) => {
      const { error } = await supabase.from("notes").insert({ ...note, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setIsCreating(false);
      toast.success("Note created");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; content?: string; color?: string; pinned?: boolean }) => {
      const { error } = await supabase.from("notes").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setEditingNote(null);
      toast.success("Note updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Soft-delete: move to trash
      const { error } = await supabase
        .from("notes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note moved to trash");
    },
  });

  const handleAutoSave = (data: { title: string; content: string; color: string }) => {
    if (!editingNote?.id) return;
    supabase.from("notes").update(data).eq("id", editingNote.id).then(({ error }) => {
      if (!error) {
        queryClient.invalidateQueries({ queryKey: ["notes"] });
      }
    });
  };

  const filtered = notes.filter(
    (n: any) => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const pinned = filtered.filter((n: any) => n.pinned);
  const unpinned = filtered.filter((n: any) => !n.pinned);

  return (
    <DashboardLayout searchQuery={searchQuery} onSearchChange={setSearchQuery}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Notes</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">{notes.length} {notes.length === 1 ? "note" : "notes"}</p>
          </div>
          <Button onClick={() => setIsCreating(true)} size="sm" className="h-8 rounded-lg text-[13px] gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Note
          </Button>
        </div>

        <AnimatePresence>
          {(isCreating || editingNote) && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mb-6">
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
                onAutoSave={editingNote ? handleAutoSave : undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-card animate-pulse p-4 space-y-3">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <StickyNote className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-base font-medium">No notes yet</p>
            <p className="text-sm mt-1 text-muted-foreground/70">Create your first note to get started</p>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <div className="mb-6">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-2 px-1">Pinned</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <AnimatePresence>
                    {pinned.map((note: any) => (
                      <NoteCard key={note.id} note={note} onEdit={() => setEditingNote(note)} onDelete={() => deleteMutation.mutate(note.id)} onTogglePin={() => updateMutation.mutate({ id: note.id, pinned: !note.pinned })} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
            {unpinned.length > 0 && (
              <div>
                {pinned.length > 0 && <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-2 px-1">Others</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <AnimatePresence>
                    {unpinned.map((note: any) => (
                      <NoteCard key={note.id} note={note} onEdit={() => setEditingNote(note)} onDelete={() => deleteMutation.mutate(note.id)} onTogglePin={() => updateMutation.mutate({ id: note.id, pinned: !note.pinned })} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
