import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  ImagePlus, Loader2, ArrowUp, X, Copy, Check, Download,
  Sparkles, Wand2,
} from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface GeneratedImage {
  id: string;
  prompt: string;
  url: string;
  timestamp: number;
}

interface ImageGeneratorProps {
  onInsert: (dataUrl: string, alt: string) => void;
}

const INSPIRATION_PROMPTS = [
  "A minimal hero gradient background in blue and purple",
  "A flat illustration of a person working on a laptop",
  "An abstract geometric pattern for a card background",
  "A sleek app icon with rounded corners",
  "A nature landscape photo for a banner",
  "A cute mascot character for a tech brand",
];

export function ImageGenerator({ onInsert }: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const generate = async (customPrompt?: string) => {
    const p = customPrompt || prompt.trim();
    if (!p || loading) return;
    setLoading(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/codrix-generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ prompt: p }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Generation failed");
      }
      const { imageUrl } = await resp.json();
      const newImg: GeneratedImage = {
        id: Math.random().toString(36).slice(2, 10),
        prompt: p,
        url: imageUrl,
        timestamp: Date.now(),
      };
      setImages(prev => [newImg, ...prev]);
      setPrompt("");
      toast.success("Image generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate image");
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = (img: GeneratedImage) => {
    onInsert(img.url, img.prompt);
    toast.success("Image tag inserted into code!");
  };

  const handleCopyUrl = (img: GeneratedImage) => {
    navigator.clipboard.writeText(img.url);
    setCopiedId(img.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Image URL copied!");
  };

  const handleDownload = (img: GeneratedImage) => {
    const a = document.createElement("a");
    a.href = img.url;
    a.download = `codrix-${img.id}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-1.5">
          <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">AI Image Generator</span>
        </div>
      </div>

      {/* Prompt Input */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 focus-within:border-ring transition-colors">
          <Wand2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            placeholder="Describe the image you want…"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === "Enter" && generate()}
            className="flex-1 bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
            disabled={loading}
          />
          <Button
            size="icon"
            className="h-6 w-6 rounded-md shrink-0"
            onClick={() => generate()}
            disabled={loading || !prompt.trim()}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUp className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Inspiration chips */}
      {images.length === 0 && !loading && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-muted-foreground font-medium mb-2 uppercase tracking-wider">Inspiration</p>
          <div className="flex flex-wrap gap-1.5">
            {INSPIRATION_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => { setPrompt(p); generate(p); }}
                className="text-[10px] px-2.5 py-1.5 rounded-md bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-border/50"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 py-6 flex flex-col items-center gap-3"
          >
            <div className="relative">
              <div className="h-16 w-16 rounded-xl bg-secondary/60 border border-border flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-muted-foreground animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                <Loader2 className="h-3 w-3 text-primary-foreground animate-spin" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Generating your image…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gallery */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        <AnimatePresence>
          {images.map((img) => (
            <motion.div
              key={img.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="group rounded-lg border border-border bg-card overflow-hidden"
            >
              <div className="relative">
                <img
                  src={img.url}
                  alt={img.prompt}
                  className="w-full h-auto max-h-48 object-cover"
                  loading="lazy"
                />
                {/* Overlay actions */}
                <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    className="h-7 rounded-md text-[10px] gap-1"
                    onClick={() => handleInsert(img)}
                  >
                    <ImagePlus className="h-3 w-3" /> Insert
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 rounded-md text-[10px] gap-1"
                    onClick={() => handleCopyUrl(img)}
                  >
                    {copiedId === img.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 w-7 rounded-md p-0"
                    onClick={() => handleDownload(img)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="px-3 py-2">
                <p className="text-[10px] text-muted-foreground truncate">{img.prompt}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
