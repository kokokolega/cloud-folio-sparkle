import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FileGrid } from "@/components/files/FileGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FolderPlus, FolderOpen, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function FoldersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

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

  const activeFolder = folders.find((f) => f.id === activeFolderId);

  return (
    <DashboardLayout searchQuery={searchQuery} onSearchChange={setSearchQuery}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {activeFolderId && (
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setActiveFolderId(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <h2 className="text-xl font-semibold text-foreground">
            {activeFolder ? activeFolder.name : "Folders"}
          </h2>
        </div>
        {!activeFolderId && (
          <Button onClick={() => setCreateOpen(true)} className="rounded-xl h-9 px-4" variant="secondary">
            <FolderPlus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
        )}
      </div>

      {activeFolderId ? (
        <FileGrid searchQuery={searchQuery} folderId={activeFolderId} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {folders.map((folder) => (
            <motion.div
              key={folder.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-5 hover-scale cursor-pointer flex flex-col items-center gap-3"
              onClick={() => setActiveFolderId(folder.id)}
            >
              <FolderOpen className="h-10 w-10 text-primary/70" />
              <p className="text-sm font-medium text-foreground text-center truncate w-full">{folder.name}</p>
            </motion.div>
          ))}
          {folders.length === 0 && (
            <div className="col-span-full flex flex-col items-center py-20 text-muted-foreground">
              <FolderOpen className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">No folders yet</p>
              <p className="text-sm mt-1">Create a folder to organize your files</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl border-0 glass-card">
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
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
              className="h-11 rounded-xl"
              autoFocus
            />
            <Button type="submit" className="w-full rounded-xl h-10">
              Create
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
