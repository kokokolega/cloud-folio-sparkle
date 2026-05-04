import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FileGrid } from "@/components/files/FileGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FolderPlus, FolderOpen, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function FoldersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const { data: folders = [] } = useQuery({
    queryKey: ["folders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("folders").insert({
        user_id: user!.id,
        name,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setCreateOpen(false);
      setFolderName("");
      toast.success("Folder created");
    },
  });

  const moveToFolder = useMutation({
    mutationFn: async ({ fileId, folderId }: { fileId: string; folderId: string }) => {
      const { error } = await supabase
        .from("files")
        .update({ folder_id: folderId })
        .eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success("File moved to folder");
    },
  });

  const handleDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverId(null);
    const fileId = e.dataTransfer.getData("text/plain");
    if (fileId) {
      moveToFolder.mutate({ fileId, folderId });
    }
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(folderId);
  };

  const activeFolder = folders.find((f) => f.id === activeFolderId);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {activeFolderId && (
            <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => setActiveFolderId(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <h2 className="text-lg font-semibold text-foreground">
            {activeFolder ? activeFolder.name : "Folders"}
          </h2>
        </div>
        {!activeFolderId && (
          <Button onClick={() => setCreateOpen(true)} className="rounded-lg h-9 px-4 text-[13px]" variant="secondary">
            <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
            New Folder
          </Button>
        )}
      </div>

      {activeFolderId ? (
        <FileGrid searchQuery={searchQuery} folderId={activeFolderId} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {folders.map((folder) => (
            <motion.div
              key={folder.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`glass-card p-5 hover-scale cursor-pointer flex flex-col items-center gap-3 transition-all ${
                dragOverId === folder.id ? "ring-2 ring-primary/40 bg-primary/5" : ""
              }`}
              onClick={() => setActiveFolderId(folder.id)}
              onDrop={(e) => handleDrop(e, folder.id)}
              onDragOver={(e) => handleDragOver(e, folder.id)}
              onDragLeave={() => setDragOverId(null)}
            >
              <FolderOpen className="h-9 w-9 text-primary/60" />
              <p className="text-[13px] font-medium text-foreground text-center truncate w-full">{folder.name}</p>
            </motion.div>
          ))}
          {folders.length === 0 && (
            <div className="col-span-full flex flex-col items-center py-24 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-base font-medium">No folders yet</p>
              <p className="text-sm mt-1 text-muted-foreground/70">Create a folder to organize your files</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base">Create Folder</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (folderName.trim()) createFolder.mutate(folderName.trim());
            }}
            className="space-y-4"
          >
            <Input
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="h-10 rounded-lg"
              autoFocus
            />
            <Button type="submit" className="w-full rounded-lg h-9 text-[13px]">
              Create
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}