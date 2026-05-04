import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineNotes } from "@/hooks/useOfflineNotes";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { NoteCard } from "@/components/notes/NoteCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, StickyNote, Search, Wifi, WifiOff, ListChecks } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Use offline-enabled notes hook
  const {
    notes,
    isLoading,
    isOfflineMode,
    createMutation,
    updateMutation,
    deleteMutation,
    autoSave,
  } = useOfflineNotes({ limit: 100, enableOffline: true });

  const filtered = notes.filter((n: any) => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const pinned = filtered.filter((n: any) => n.pinned);
  const unpinned = filtered.filter((n: any) => !n.pinned);

  const handleAutoSave = (data: { title: string; content: string; color: string }) => {
    if (!editingNote?.id) return;
    autoSave(editingNote.id, data);
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">Notes</h1>
            {isOfflineMode && (
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search notes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 rounded-xl bg-secondary/50 border border-border text-sm"
              />
            </div>
            <Button asChild variant="outline" size="sm" className="h-9 rounded-xl gap-1.5">
              <Link to="/note-folders"><ListChecks className="h-3.5 w-3.5" /> Task Folders</Link>
            </Button>
            <Button onClick={() => setIsCreating(true)} size="sm" className="h-9 rounded-xl gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {(isCreating || editingNote) && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mb-6">
              <NoteEditor
                note={editingNote}
                onSave={(data) => editingNote ? updateMutation.mutate({ id: editingNote.id, ...data }) : createMutation.mutate(data)}
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
              <div key={i} className="glass-card animate-pulse p-4 space-y-3"><div className="h-4 bg-muted rounded w-3/4" /><div className="h-3 bg-muted rounded w-full" /><div className="h-3 bg-muted rounded w-1/2" /></div>
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
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-2 px-1 font-medium">Pinned</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <AnimatePresence>
                    {pinned.map((note: any) => (
                      <NoteCard 
                        key={note.id} 
                        note={note} 
                        onEdit={() => setEditingNote(note)} 
                        onDelete={() => deleteMutation.mutate(note.id)} 
                        onTogglePin={() => updateMutation.mutate({ id: note.id, pinned: !note.pinned })} 
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
            {unpinned.length > 0 && (
              <div>
                {pinned.length > 0 && <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-2 px-1 font-medium">Others</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <AnimatePresence>
                    {unpinned.map((note: any) => (
                      <NoteCard 
                        key={note.id} 
                        note={note} 
                        onEdit={() => setEditingNote(note)} 
                        onDelete={() => deleteMutation.mutate(note.id)} 
                        onTogglePin={() => updateMutation.mutate({ id: note.id, pinned: !note.pinned })} 
                      />
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
