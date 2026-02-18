import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FileCard } from "./FileCard";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Files } from "lucide-react";

interface FileGridProps {
  searchQuery: string;
  typeFilter?: "image" | "pdf";
  showDeleted?: boolean;
  folderId?: string | null;
  sortBy?: string;
}

export function FileGrid({ searchQuery, typeFilter, showDeleted = false, folderId, sortBy = "newest" }: FileGridProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [renameDialog, setRenameDialog] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState("");

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["files", user?.id, typeFilter, showDeleted, folderId],
    queryFn: async () => {
      let query = supabase
        .from("files")
        .select("*")
        .eq("user_id", user!.id);

      if (showDeleted) {
        query = query.not("deleted_at", "is", null);
      } else {
        query = query.is("deleted_at", null);
      }

      if (typeFilter) {
        query = query.eq("type", typeFilter);
      }

      if (folderId) {
        query = query.eq("folder_id", folderId);
      } else if (!showDeleted && !typeFilter) {
        // Show root files only when not filtering
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const sortedFiles = [...files].sort((a, b) => {
    switch (sortBy) {
      case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "size": return b.size - a.size;
      case "name": return a.name.localeCompare(b.name);
      default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const filtered = sortedFiles.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (showDeleted) {
        // Permanent delete
        const file = files.find((f) => f.id === id);
        if (file) {
          await supabase.storage.from("user-files").remove([file.storage_path]);
          const { error } = await supabase.from("files").delete().eq("id", id);
          if (error) throw error;
        }
      } else {
        // Soft delete
        const { error } = await supabase
          .from("files")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success(showDeleted ? "Permanently deleted" : "Moved to trash");
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("files").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setRenameDialog(null);
      toast.success("File renamed");
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("files")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success("File restored");
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="glass-card animate-pulse">
            <div className="aspect-[4/3] bg-muted/50 rounded-t-[1rem]" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Files className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg font-medium">{showDeleted ? "Trash is empty" : "No files yet"}</p>
        <p className="text-sm mt-1">{showDeleted ? "Deleted files will appear here" : "Upload your first file to get started"}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <AnimatePresence>
          {filtered.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onDelete={(id) => deleteMutation.mutate(id)}
              onRename={(id, name) => {
                setRenameDialog({ id, name });
                setNewName(name);
              }}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Rename dialog */}
      <Dialog open={!!renameDialog} onOpenChange={() => setRenameDialog(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl border-0 glass-card">
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (renameDialog) renameMutation.mutate({ id: renameDialog.id, name: newName });
            }}
            className="space-y-4"
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-11 rounded-xl"
              autoFocus
            />
            <Button type="submit" className="w-full rounded-xl h-10">
              Rename
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
