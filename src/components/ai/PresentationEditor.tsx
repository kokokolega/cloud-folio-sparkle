import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, X, Eye, Code as CodeIcon } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialContent: string;
  title?: string;
  onSave: (content: string) => void;
}

export function PresentationEditor({ open, onOpenChange, initialContent, title = "Edit Presentation", onSave }: Props) {
  const [content, setContent] = useState(initialContent);
  const [view, setView] = useState<"edit" | "preview">("edit");

  useEffect(() => { setContent(initialContent); }, [initialContent, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 border-b border-border/50 flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-base">{title}</DialogTitle>
          <div className="flex items-center gap-1">
            <Button size="sm" variant={view === "edit" ? "secondary" : "ghost"} onClick={() => setView("edit")} className="h-8 rounded-lg gap-1.5">
              <CodeIcon className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button size="sm" variant={view === "preview" ? "secondary" : "ghost"} onClick={() => setView("preview")} className="h-8 rounded-lg gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Preview
            </Button>
            <Button size="sm" onClick={() => { onSave(content); onOpenChange(false); }} className="h-8 rounded-lg gap-1.5 ml-2">
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {view === "edit" ? (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-full w-full rounded-none border-0 font-mono text-[13px] resize-none focus-visible:ring-0"
              placeholder="Edit your HTML / slide content..."
            />
          ) : (
            <div className="h-full overflow-auto p-8 bg-card">
              <div className="prose prose-sm max-w-none prose-editor [&_.slide]:my-8 [&_.slide]:p-8 [&_.slide]:rounded-2xl [&_.slide]:border [&_.slide]:border-border [&_.slide]:bg-background [&_.slide]:shadow-sm" dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
