import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FileGrid } from "@/components/files/FileGrid";
import { NoteCard } from "@/components/notes/NoteCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StickyNote, Files, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";

export default function TrashPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: trashedNotes = [], isLoading: notesLoading } = useQuery({
    queryKey: ["trashed-notes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user!.id)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const restoreNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notes")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trashed-notes"] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note restored");
    },
  });

  const permanentDeleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trashed-notes"] });
      toast.success("Note permanently deleted");
    },
  });

  const filteredNotes = trashedNotes.filter(
    (n: any) => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout searchQuery={searchQuery} onSearchChange={setSearchQuery}>
      <h2 className="text-xl font-semibold text-foreground mb-6">Trash</h2>

      <Tabs defaultValue="files" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="files" className="gap-1.5 text-[13px]">
            <Files className="h-3.5 w-3.5" /> Files
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5 text-[13px]">
            <StickyNote className="h-3.5 w-3.5" /> Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          <FileGrid searchQuery={searchQuery} showDeleted />
        </TabsContent>

        <TabsContent value="notes">
          {notesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass-card animate-pulse p-4 space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-full" />
                </div>
              ))}
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <StickyNote className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-base font-medium">No deleted notes</p>
              <p className="text-sm mt-1 text-muted-foreground/70">Deleted notes will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <AnimatePresence>
                {filteredNotes.map((note: any) => (
                  <div key={note.id} className="relative group">
                    <NoteCard
                      note={note}
                      onEdit={() => {}}
                      onDelete={() => permanentDeleteNoteMutation.mutate(note.id)}
                      onTogglePin={() => {}}
                    />
                    <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-[11px] gap-1 rounded-lg"
                        onClick={() => restoreNoteMutation.mutate(note.id)}
                      >
                        <RotateCcw className="h-3 w-3" /> Restore
                      </Button>
                    </div>
                  </div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
