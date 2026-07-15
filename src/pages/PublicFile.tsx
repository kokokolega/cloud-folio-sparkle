import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, Copy, Code, FileText } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function PublicFile() {
  const { publicId } = useParams<{ publicId: string }>();

  const { data: file, isLoading } = useQuery({
    queryKey: ["public-file", publicId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_file_by_public_id", { _public_id: publicId! });
      if (error) throw error;
      return (data as any[])?.[0] ?? null;
    },
    enabled: !!publicId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">File not found</p>
      </div>
    );
  }

  const { data: urlData } = supabase.storage.from("user-files").getPublicUrl(file.storage_path);
  const publicUrl = urlData?.publicUrl;
  const embedUrl = `${window.location.origin}/embed/${file.public_id}`;
  const embedCode = file.type === "image"
    ? `<img src="${publicUrl}" alt="${file.name}" />`
    : `<iframe src="${embedUrl}" width="100%" height="600px" frameborder="0"></iframe>`;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        {/* Preview */}
        <div className="glass-card overflow-hidden mb-6">
          {file.type === "image" ? (
            <img src={publicUrl} alt={file.name} className="w-full max-h-[70vh] object-contain bg-muted/30" />
          ) : (
            <div className="flex items-center justify-center py-20 bg-muted/30">
              <FileText className="h-24 w-24 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Info & Actions */}
        <div className="glass-card p-5">
          <h1 className="text-lg font-semibold text-foreground mb-1">{file.name}</h1>
          <p className="text-sm text-muted-foreground mb-4">
            {(file.size / 1024 / 1024).toFixed(1)} MB · {file.type.toUpperCase()}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="rounded-xl"
              onClick={() => window.open(publicUrl, "_blank")}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              variant="secondary"
              className="rounded-xl"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl || "");
                toast.success("Direct link copied!");
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button
              variant="secondary"
              className="rounded-xl"
              onClick={() => {
                navigator.clipboard.writeText(embedCode);
                toast.success("Embed code copied!");
              }}
            >
              <Code className="h-4 w-4 mr-2" />
              Copy Embed
            </Button>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-secondary/50">
            <p className="text-xs text-muted-foreground mb-1">Embed Code</p>
            <code className="text-xs text-foreground break-all">{embedCode}</code>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
