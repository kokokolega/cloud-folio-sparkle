import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Download, Loader as Loader2, CircleAlert as AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export interface ImageSearchItem {
  id: string;
  thumbnailUrl: string;
  imageUrl: string;
  sourceUrl: string;
  width: number;
  height: number;
  provider: string;
  attribution: string;
  alt: string;
}

interface Props {
  query: string;
  results: ImageSearchItem[];
  hasMore: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

export function ImageSearchResults({ query, results, hasMore, onLoadMore, loadingMore }: Props) {
  const [preview, setPreview] = useState<ImageSearchItem | null>(null);

  if (results.length === 0) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground py-3">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>No images found for "{query}". Try a different search.</span>
      </div>
    );
  }

  return (
    <div className="mt-2 mb-1">
      <p className="text-[12px] text-muted-foreground mb-2">
        Image results for <span className="font-medium text-foreground/80">"{query}"</span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {results.map((img, i) => (
          <motion.div
            key={img.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.25 }}
            className="group relative rounded-xl overflow-hidden border border-border/50 bg-card cursor-pointer"
            onClick={() => setPreview(img)}
          >
            <div className="aspect-[4/3] overflow-hidden bg-secondary/30">
              <img
                src={img.thumbnailUrl}
                alt={img.alt}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-[9px] text-white/90 truncate leading-tight">{img.attribution}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {hasMore && onLoadMore && (
        <div className="mt-3 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="h-8 gap-1.5 rounded-xl text-[12px]"
          >
            {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}

      {/* Full-size preview modal */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <VisuallyHidden>
            <DialogTitle>Image Preview</DialogTitle>
            <DialogDescription>{preview?.alt}</DialogDescription>
          </VisuallyHidden>
          {preview && (
            <div className="flex flex-col">
              <div className="bg-black/95 flex items-center justify-center max-h-[60vh] overflow-hidden">
                <img
                  src={preview.imageUrl}
                  alt={preview.alt}
                  className="max-w-full max-h-[60vh] object-contain"
                />
              </div>
              <div className="p-3 space-y-2">
                <p className="text-[12px] text-muted-foreground">{preview.attribution}</p>
                <p className="text-[11px] text-muted-foreground/70">
                  {preview.width} × {preview.height} px · {preview.provider}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-[12px] rounded-xl"
                    onClick={() => window.open(preview.sourceUrl, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Source
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-[12px] rounded-xl"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = preview.imageUrl;
                      a.download = `image-${preview.id}.jpg`;
                      a.target = "_blank";
                      a.click();
                    }}
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
