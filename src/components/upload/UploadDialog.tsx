import { useCallback, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, CheckCircle2, X, FileImage, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQueryClient } from "@tanstack/react-query";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string | null;
  groupId?: string | null;
}

export function UploadDialog({ open, onOpenChange, folderId, groupId }: UploadDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_SIZE
    );
    if (dropped.length === 0) {
      toast.error("Only JPG, PNG, WEBP, and PDF files under 10MB are allowed");
      return;
    }
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files).filter(
      (f) => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_SIZE
    );
    if (selected.length === 0) {
      toast.error("Only JPG, PNG, WEBP, and PDF files under 10MB are allowed");
      return;
    }
    setFiles((prev) => [...prev, ...selected]);
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleUpload = async () => {
    if (!user || files.length === 0) return;
    setUploading(true);
    setProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop();
        const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

        const { error: storageError } = await supabase.storage
          .from("user-files")
          .upload(storagePath, file);

        if (storageError) throw storageError;

        const fileType = file.type === "application/pdf" ? "pdf" : "image";

        const { error: dbError } = await supabase.from("files").insert({
          user_id: user.id,
          folder_id: folderId || null,
          group_id: groupId || null,
          name: file.name,
          type: fileType,
          size: file.size,
          storage_path: storagePath,
        });

        if (dbError) throw dbError;

        setProgress(((i + 1) / files.length) * 100);
      }

      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setTimeout(() => {
        setFiles([]);
        setDone(false);
        setProgress(0);
        onOpenChange(false);
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFiles([]);
      setDone(false);
      setProgress(0);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl border-0 glass-card">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Upload Files</DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-10"
            >
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <p className="text-foreground font-medium">Upload complete!</p>
            </motion.div>
          ) : (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Drop zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag & drop files here, or <span className="text-primary font-medium">browse</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP, PDF — Max 10MB</p>
                <input
                  id="file-input"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  multiple
                  onChange={handleSelect}
                  className="hidden"
                />
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                  {files.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/50"
                    >
                      {file.type === "application/pdf" ? (
                        <FileText className="h-4 w-4 text-red-500 shrink-0" />
                      ) : (
                        <FileImage className="h-4 w-4 text-primary shrink-0" />
                      )}
                      <span className="text-sm truncate flex-1 text-foreground">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(1)}MB
                      </span>
                      <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Progress */}
              {uploading && (
                <div className="mt-4">
                  <Progress value={progress} className="h-2 rounded-full" />
                </div>
              )}

              {/* Upload button */}
              {files.length > 0 && !uploading && (
                <Button
                  onClick={handleUpload}
                  className="w-full mt-4 h-11 rounded-xl bg-primary hover:bg-primary/90 glow-primary"
                >
                  Upload {files.length} file{files.length > 1 ? "s" : ""}
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
