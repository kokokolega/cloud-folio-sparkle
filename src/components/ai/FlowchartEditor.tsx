import { useState, useEffect, useRef } from "react";
import mermaid from "mermaid";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, Download, RefreshCw } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialChart: string;
  onSave?: (chart: string) => void;
}

export function FlowchartEditor({ open, onOpenChange, initialChart, onSave }: Props) {
  const [chart, setChart] = useState(initialChart);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const idRef = useRef(`flowchart-edit-${Math.random().toString(36).slice(2)}`);

  useEffect(() => { setChart(initialChart); }, [initialChart, open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      try {
        const { svg } = await mermaid.render(idRef.current + Date.now(), chart);
        setSvg(svg); setError("");
      } catch (e: any) {
        setError(e.message || "Invalid diagram syntax");
      }
    }, 300);
    return () => clearTimeout(t);
  }, [chart, open]);

  const handleDownload = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `flowchart-${Date.now()}.svg`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[85vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 border-b border-border/50 flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-base">Edit Flowchart</DialogTitle>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={handleDownload} className="h-8 rounded-lg gap-1.5">
              <Download className="h-3.5 w-3.5" /> SVG
            </Button>
            {onSave && (
              <Button size="sm" onClick={() => { onSave(chart); onOpenChange(false); }} className="h-8 rounded-lg gap-1.5">
                <Save className="h-3.5 w-3.5" /> Save
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
          <div className="border-r border-border/50 flex flex-col">
            <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/30">Mermaid source</div>
            <Textarea
              value={chart}
              onChange={(e) => setChart(e.target.value)}
              className="flex-1 rounded-none border-0 font-mono text-[12px] resize-none focus-visible:ring-0"
              placeholder="graph TD&#10;  A[Start] --> B[End]"
            />
          </div>
          <div className="flex flex-col bg-card">
            <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/30 flex items-center justify-between">
              Live preview
              {error && <span className="text-destructive normal-case tracking-normal text-[10px]">{error}</span>}
            </div>
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center [&>svg]:max-w-full [&>svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: error ? "" : svg }} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
