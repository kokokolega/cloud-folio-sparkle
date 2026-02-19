import { useState } from "react";
import { MoreHorizontal, Trash2, Pencil, FolderInput, Link2, FileText, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface FileCardProps {
  file: {
    id: string;
    name: string;
    type: string;
    size: number;
    storage_path: string;
    public_id: string;
    created_at: string;
    folder_id?: string | null;
  };
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onMove?: (fileId: string, folderId: string | null) => void;
}

export function FileCard({ file, onDelete, onRename, onMove }: FileCardProps) {
  const [imgError, setImgError] = useState(false);
  const { user } = useAuth();

  const { data: urlData } = supabase.storage.from("user-files").getPublicUrl(file.storage_path);
  const publicUrl = urlData?.publicUrl;

  const shareUrl = `${window.location.origin}/file/${file.public_id}`;

  const { data: folders = [] } = useQuery({
    queryKey: ["folders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folders")
        .select("id, name")
        .eq("user_id", user!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied!");
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", file.id);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group glass-card overflow-hidden hover-scale cursor-grab active:cursor-grabbing"
    >
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.2 }}
    >
      {/* Preview */}
      <div className="aspect-[4/3] bg-muted/30 flex items-center justify-center overflow-hidden rounded-t-xl">
        {file.type === "image" && publicUrl && !imgError ? (
          <img
            src={publicUrl}
            alt={file.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            draggable={false}
          />
        ) : (
          <FileText className="h-10 w-10 text-muted-foreground/30" />
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-medium truncate text-foreground">{file.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {formatSize(file.size)} · {formatDate(file.created_at)}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-lg">
              <DropdownMenuItem onClick={copyLink} className="text-[13px]">
                <Link2 className="h-3.5 w-3.5 mr-2" />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(publicUrl, "_blank")} className="text-[13px]">
                <Download className="h-3.5 w-3.5 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRename(file.id, file.name)} className="text-[13px]">
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Rename
              </DropdownMenuItem>
              {onMove && folders.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-[13px]">
                    <FolderInput className="h-3.5 w-3.5 mr-2" />
                    Move to…
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="rounded-lg">
                    {file.folder_id && (
                      <DropdownMenuItem onClick={() => onMove(file.id, null)} className="text-[13px]">
                        Root (no folder)
                      </DropdownMenuItem>
                    )}
                    {folders
                      .filter((f) => f.id !== file.folder_id)
                      .map((folder) => (
                        <DropdownMenuItem
                          key={folder.id}
                          onClick={() => onMove(file.id, folder.id)}
                          className="text-[13px]"
                        >
                          {folder.name}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuItem onClick={() => onDelete(file.id)} className="text-destructive text-[13px]">
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
    </div>
  );
}
