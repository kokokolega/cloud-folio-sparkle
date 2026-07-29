import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader as Loader2, Wand as Wand2, Download, Upload, X, Image as ImageIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase, SUPABASE_URL_VALUE as SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY_VALUE as SUPABASE_KEY } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface Generated {
  url: string;
  prompt: string;
}

export function ImageStudio({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [refImage, setRefImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Generated[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickFile = (f?: File) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast.error("Image too large (max 8MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => setRefImage(reader.result as string);
    reader.readAsDataURL(f);
  };

  const generate = async () => {
    if (!prompt.trim()) { toast.error("Enter a prompt"); return; }
    setBusy(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ prompt, imageBase64: refImage || undefined }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.imageUrl) throw new Error(data.error || "No image returned");
      setResults((p) => [{ url: data.imageUrl, prompt }, ...p]);
      toast.success("Image ready ॥");
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  const download = (url: string, name = `oltrid-${Date.now()}.png`) => {
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
  };

  const saveToFiles = async (url: string) => {
    if (!user) { toast.error("Sign in to save"); return; }
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], `ai-image-${Date.now()}.png`, { type: "image/png" });
      const path = `${user.id}/${file.name}`;
      const { error } = await supabase.storage.from("user-files").upload(path, file);
      if (error) throw error;
      await supabase.from("files").insert({
        name: file.name, storage_path: path, type: file.type, size: file.size, user_id: user.id,
      });
      toast.success("Saved to Files");
    } catch (e: any) { toast.error(e.message); }
  };

  const useAsReference = (url: string) => {
    setRefImage(url);
    toast.success("Loaded as reference — edit prompt and Generate");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl h-[90vh] p-0 overflow-hidden flex flex-col">
        <VisuallyHidden>
          <DialogTitle>Image Studio</DialogTitle>
          <DialogDescription>Generate and edit images with AI</DialogDescription>
        </VisuallyHidden>
        <div className="px-4 sm:px-5 py-3 border-b border-border/50 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Image Studio</p>
          <span className="text-[11px] text-muted-foreground ml-1 hidden sm:inline">Generate · Edit · Download</span>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[300px_1fr]">
          <div className="md:border-r border-b md:border-b-0 border-border/50 p-4 space-y-3 overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Prompt</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A serene Himalayan valley at sunrise, cinematic, ultra-detailed…"
                rows={5}
                className="text-[13px] resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reference (optional)</label>
              {refImage ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img src={refImage} alt="ref" className="w-full h-32 object-cover" />
                  <button onClick={() => setRefImage(null)} className="absolute top-1 right-1 h-6 w-6 rounded-md bg-background/90 flex items-center justify-center hover:bg-background">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} className="w-full h-20 border border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                  <Upload className="h-4 w-4" />
                  <span className="text-[11px]">Upload to edit</span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />
            </div>

            <Button onClick={generate} disabled={busy} className="w-full gap-1.5 h-9 rounded-xl">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {busy ? "Generating…" : refImage ? "Edit image" : "Generate"}
            </Button>

            <p className="text-[10px] text-muted-foreground/70 leading-relaxed pt-1">
              Tip: For edits, upload a reference and describe the change. Click any result to reuse as a reference.
            </p>
          </div>

          <div className="overflow-y-auto p-4">
            {results.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/70">
                <ImageIcon className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">No images yet</p>
                <p className="text-[12px] mt-1">Describe what you want and click Generate</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.map((r, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-border bg-card">
                    <img src={r.url} alt={r.prompt} className="w-full aspect-square object-cover" />
                    <div className="p-2 space-y-2">
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{r.prompt}</p>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 flex-1 text-[11px] gap-1" onClick={() => download(r.url)}>
                          <Download className="h-3 w-3" /> Download
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 flex-1 text-[11px] gap-1" onClick={() => useAsReference(r.url)}>
                          <Wand2 className="h-3 w-3" /> Edit
                        </Button>
                        {user && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" onClick={() => saveToFiles(r.url)}>
                            Save
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
