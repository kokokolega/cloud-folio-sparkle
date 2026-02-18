import { useState } from "react";
import { MoreHorizontal, Trash2, Pencil, FolderInput, Link2, FileText, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  };
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export function FileCard({ file, onDelete, onRename }: FileCardProps) {
  const [imgError, setImgError] = useState(false);

  const { data: urlData } = supabase.storage.from("user-files").getPublicUrl(file.storage_path);
  const publicUrl = urlData?.publicUrl;

  const shareUrl = `${window.location.origin}/file/${file.public_id}`;

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
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group glass-card overflow-hidden hover-scale cursor-pointer"
    >
      {/* Preview */}
      <div className="aspect-[4/3] bg-muted/50 flex items-center justify-center overflow-hidden rounded-t-[1rem]">
        {file.type === "image" && publicUrl && !imgError ? (
          <img
            src={publicUrl}
            alt={file.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <FileText className="h-12 w-12 text-muted-foreground/40" />
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatSize(file.size)} · {formatDate(file.created_at)}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl">
              <DropdownMenuItem onClick={copyLink}>
                <Link2 className="h-4 w-4 mr-2" />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(publicUrl, "_blank")}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRename(file.id, file.name)}>
                <Pencil className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(file.id)} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  );
}
