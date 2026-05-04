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
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  const deleteFolder = useMutation({
    mutationFn: async (folderId: string) => {
      // Move files in folder out
      await supabase.from("files").update({ folder_id: null }).eq("folder_id", folderId);
      await supabase.from("notes").update({ folder_id: null }).eq("folder_id", folderId);
      const { error } = await supabase.from("folders").delete().eq("id", folderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setDeleteId(null);
      toast.success("Folder deleted");
    },
    onError: (e: any) => toast.error(e.message),
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
              className={`glass-card p-5 hover-scale cursor-pointer flex flex-col items-center gap-3 transition-all relative group ${
                dragOverId === folder.id ? "ring-2 ring-primary/40 bg-primary/5" : ""
              }`}
              onClick={() => setActiveFolderId(folder.id)}
              onDrop={(e) => handleDrop(e, folder.id)}
              onDragOver={(e) => handleDragOver(e, folder.id)}
              onDragLeave={() => setDragOverId(null)}
            >
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-1.5 right-1.5 h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); setDeleteId(folder.id); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
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

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this folder?</AlertDialogTitle>
            <AlertDialogDescription>
              Files and notes inside will be moved out of the folder, not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteFolder.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}