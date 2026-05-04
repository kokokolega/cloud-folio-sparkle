import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Button } from "@/components/ui/button";
import { Download, Maximize2, Pencil } from "lucide-react";
import { FlowchartEditor } from "./FlowchartEditor";

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
});

interface MermaidDiagramProps {
  chart: string;
}

export function MermaidDiagram({ chart: initialChart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState(initialChart);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [editing, setEditing] = useState(false);
  const id = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);

  useEffect(() => { setChart(initialChart); }, [initialChart]);

  useEffect(() => {
    const render = async () => {
      try {
        const { svg } = await mermaid.render(id.current, chart);
        setSvg(svg);
        setError("");
      } catch (e: any) {
        setError(e.message || "Failed to render diagram");
        // Clean up any error elements mermaid may have added
        const errorEl = document.getElementById("d" + id.current);
        if (errorEl) errorEl.remove();
      }
    };
    render();
  }, [chart]);

  const handleDownload = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagram-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="my-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-[11px] text-destructive">
        Diagram error: {error}
      </div>
    );
  }

  return (
    <>
      <div className="my-3 rounded-xl border border-border bg-background p-4 relative group cursor-zoom-in" onClick={() => setFullscreen(true)}>
        <div
          ref={containerRef}
          className="overflow-x-auto [&>svg]:max-w-full [&>svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => setEditing(true)} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={handleDownload} title="Download SVG">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => setFullscreen(true)} title="Fullscreen">
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-8" onClick={() => setFullscreen(false)}>
          <div className="w-[95vw] h-[90vh] overflow-auto bg-card rounded-2xl border border-border p-8 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex-1 flex items-center justify-center overflow-auto [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[75vh]" dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="flex justify-center mt-4 gap-2">
              <Button variant="outline" size="sm" onClick={() => { setFullscreen(false); setEditing(true); }}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Download SVG
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setFullscreen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      <FlowchartEditor open={editing} onOpenChange={setEditing} initialChart={chart} onSave={(c) => setChart(c)} />
    </>
  );
}
