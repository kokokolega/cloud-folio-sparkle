import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FileCard } from "@/components/files/FileCard";
import { UploadDialog } from "@/components/upload/UploadDialog";

interface GroupFilesProps {
  groupId: string;
  searchQuery: string;
}

export function GroupFiles({ groupId, searchQuery }: GroupFilesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["group-files", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("files").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-files", groupId] });
      toast.success("File deleted");
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("files").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-files", groupId] });
      toast.success("File renamed");
    },
  });

  const filtered = files.filter((f: any) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setUploadOpen(true)} size="sm" className="rounded-xl gap-2">
          <Plus className="h-3.5 w-3.5" /> Upload File
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No files in this group yet</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((file: any) => (
            <FileCard
              key={file.id}
              file={file}
              onDelete={(id) => deleteMutation.mutate(id)}
              onRename={(id, name) => renameMutation.mutate({ id, name })}
            />
          ))}
        </div>
      )}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} groupId={groupId} />
    </div>
  );
}
