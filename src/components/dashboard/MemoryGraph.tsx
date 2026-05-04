import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Brain, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface MemoryNode {
  id: string;
  key: string;
  value: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemoryGraph({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [memories, setMemories] = useState<MemoryNode[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });

  useEffect(() => {
    if (!open || !user) return;
    supabase.from("ai_memory").select("id, key, value").eq("user_id", user.id).then(({ data }) => {
      if (data) setMemories(data);
    });
  }, [open, user]);

  useEffect(() => {
    if (!svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
  }, [open, memories.length]);

  const handleDelete = async (id: string, key: string) => {
    const { error } = await supabase.from("ai_memory").delete().eq("id", id);
    if (error) return toast.error("Failed to delete");
    setMemories(prev => prev.filter(m => m.id !== id));
    toast.success(`Forgot "${key}"`);
  };

  const cx = size.w / 2;
  const cy = size.h / 2;
  const radius = Math.min(size.w, size.h) / 2 - 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" /> Memory Graph — The map of your life
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-background to-secondary/20">
          {memories.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <Brain className="h-12 w-12 opacity-20 mb-3" />
              <p className="text-sm">No memories yet.</p>
              <p className="text-xs mt-1">Tell Oltrid AI something to remember.</p>
            </div>
          ) : (
            <svg ref={svgRef} className="w-full h-full">
              {/* Connections */}
              {memories.map((_, i) => {
                const angle = (i / memories.length) * Math.PI * 2 - Math.PI / 2;
                const x = cx + Math.cos(angle) * radius;
                const y = cy + Math.sin(angle) * radius;
                return (
                  <line key={`l-${i}`} x1={cx} y1={cy} x2={x} y2={y}
                    stroke="hsl(var(--primary))" strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="3 3" />
                );
              })}
              {/* Center node */}
              <circle cx={cx} cy={cy} r="36" fill="hsl(var(--primary))" />
              <text x={cx} y={cy + 4} textAnchor="middle" fill="hsl(var(--primary-foreground))" fontSize="12" fontWeight="600">YOU</text>

              {/* Memory nodes */}
              {memories.map((m, i) => {
                const angle = (i / memories.length) * Math.PI * 2 - Math.PI / 2;
                const x = cx + Math.cos(angle) * radius;
                const y = cy + Math.sin(angle) * radius;
                return (
                  <g key={m.id} className="cursor-pointer" onClick={() => handleDelete(m.id, m.key)}>
                    <circle cx={x} cy={y} r="44" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeOpacity="0.5" strokeWidth="2" />
                    <foreignObject x={x - 40} y={y - 30} width="80" height="60">
                      <div className="w-full h-full flex flex-col items-center justify-center text-center p-1">
                        <p className="text-[10px] font-semibold text-foreground truncate w-full">{m.key}</p>
                        <p className="text-[9px] text-muted-foreground line-clamp-2 mt-0.5">{m.value}</p>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
        {memories.length > 0 && (
          <div className="border-t border-border/50 p-3 max-h-40 overflow-y-auto">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">All memories ({memories.length}) — click to forget</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {memories.map(m => (
                <div key={m.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-secondary/40 group">
                  <Brain className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate">{m.key}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{m.value}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleDelete(m.id, m.key)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
