import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Brain, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";

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
  const [selected, setSelected] = useState<MemoryNode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MemoryNode | null>(null);
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
    if (error) return toast.error("Failed to forget");
    setMemories(prev => prev.filter(m => m.id !== id));
    if (selected?.id === id) setSelected(null);
    toast.success(`Forgotten: "${key}"`, { description: "This memory has been removed permanently." });
  };

  const downloadPdf = () => {
    if (memories.length === 0) {
      toast.error("No memories to download");
      return;
    }
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 56;
    let y = margin;

    // Cover
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(36);
    doc.text("Oltrid", margin, 140);
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 200, 230);
    doc.text("The Map of Your Memory", margin, 168);

    doc.setFontSize(11);
    doc.setTextColor(140, 160, 190);
    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    doc.text(`Generated ${dateStr}  ·  ${memories.length} memories`, margin, pageHeight - 60);

    // Decorative line
    doc.setDrawColor(80, 120, 200);
    doc.setLineWidth(1.5);
    doc.line(margin, 200, pageWidth - margin, 200);

    // New page for memories
    doc.addPage();
    doc.setFillColor(252, 250, 249);
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    y = margin;
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Your Memories", margin, y);
    y += 30;
    doc.setDrawColor(0, 122, 255);
    doc.setLineWidth(2);
    doc.line(margin, y, margin + 60, y);
    y += 30;

    memories.forEach((m, i) => {
      if (y > pageHeight - 100) {
        doc.addPage();
        doc.setFillColor(252, 250, 249);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
        y = margin;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(0, 122, 255);
      doc.text(`${String(i + 1).padStart(2, "0")}`, margin, y);
      doc.setTextColor(15, 23, 42);
      doc.text(m.key, margin + 32, y);
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(60, 70, 90);
      const lines = doc.splitTextToSize(m.value, pageWidth - margin * 2 - 32);
      lines.forEach((line: string) => {
        if (y > pageHeight - 60) {
          doc.addPage();
          doc.setFillColor(252, 250, 249);
          doc.rect(0, 0, pageWidth, pageHeight, "F");
          y = margin;
        }
        doc.text(line, margin + 32, y);
        y += 15;
      });
      y += 14;
      doc.setDrawColor(230, 230, 235);
      doc.setLineWidth(0.5);
      doc.line(margin, y - 6, pageWidth - margin, y - 6);
      y += 8;
    });

    // Footer page
    doc.addPage();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(14);
    const closing = "॥ Oltrid last memory main ॥";
    doc.text(closing, pageWidth / 2, pageHeight / 2, { align: "center" });

    doc.save(`oltrid-memories-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Memory PDF downloaded", { description: "Your beautiful memory archive is ready." });
  };

  const cx = size.w / 2;
  const cy = size.h / 2;
  const radius = Math.min(size.w, size.h) / 2 - 100;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl h-[80vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 border-b border-border/50 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-primary" /> Memory Graph — The map of your life
            </DialogTitle>
            <Button size="sm" variant="outline" className="gap-1.5 h-8 mr-8" onClick={downloadPdf}>
              <Download className="h-3.5 w-3.5" /> Download PDF
            </Button>
          </DialogHeader>
          <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-background to-secondary/20">
            {memories.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                <Brain className="h-12 w-12 opacity-20 mb-3" />
                <p className="text-sm">No memories yet ॥</p>
                <p className="text-xs mt-1">Tell Oltrid AI something to remember ॥</p>
              </div>
            ) : (
              <svg ref={svgRef} className="w-full h-full" role="img" aria-label="Memory graph">
                {memories.map((_, i) => {
                  const angle = (i / memories.length) * Math.PI * 2 - Math.PI / 2;
                  const x = cx + Math.cos(angle) * radius;
                  const y = cy + Math.sin(angle) * radius;
                  return (
                    <motion.line
                      key={`l-${i}`}
                      x1={cx} y1={cy}
                      initial={{ x2: cx, y2: cy, opacity: 0 }}
                      animate={{ x2: x, y2: y, opacity: 0.3 }}
                      transition={{ duration: 0.6, delay: i * 0.04, ease: "easeOut" }}
                      stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="3 3"
                    />
                  );
                })}
                <motion.circle
                  cx={cx} cy={cy} r="36" fill="hsl(var(--primary))"
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                />
                <text x={cx} y={cy + 4} textAnchor="middle" fill="hsl(var(--primary-foreground))" fontSize="12" fontWeight="600" pointerEvents="none">YOU</text>

                {memories.map((m, i) => {
                  const angle = (i / memories.length) * Math.PI * 2 - Math.PI / 2;
                  const x = cx + Math.cos(angle) * radius;
                  const y = cy + Math.sin(angle) * radius;
                  const isSelected = selected?.id === m.id;
                  return (
                    <motion.g
                      key={m.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.2 + i * 0.05 }}
                      whileHover={{ scale: 1.08 }}
                      style={{ cursor: "pointer", transformOrigin: `${x}px ${y}px` }}
                      onClick={() => setSelected(m)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Memory: ${m.key}. Press Enter to view options.`}
                    >
                      <circle cx={x} cy={y} r="44"
                        fill="hsl(var(--card))"
                        stroke="hsl(var(--primary))"
                        strokeOpacity={isSelected ? "1" : "0.5"}
                        strokeWidth={isSelected ? "3" : "2"}
                      />
                      <foreignObject x={x - 40} y={y - 30} width="80" height="60" pointerEvents="none">
                        <div className="w-full h-full flex flex-col items-center justify-center text-center p-1">
                          <p className="text-[10px] font-semibold text-foreground truncate w-full">{m.key}</p>
                          <p className="text-[9px] text-muted-foreground line-clamp-2 mt-0.5">{m.value}</p>
                        </div>
                      </foreignObject>
                    </motion.g>
                  );
                })}
              </svg>
            )}

            <AnimatePresence>
              {selected && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card border border-border rounded-2xl shadow-lg p-4 max-w-md w-[90%]"
                >
                  <div className="flex items-start gap-3">
                    <Brain className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{selected.key}</p>
                      <p className="text-xs text-muted-foreground mt-1">{selected.value}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(null)}>Close</Button>
                      <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={() => setConfirmDelete(selected)}>
                        <Trash2 className="h-3 w-3" /> Forget
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {memories.length > 0 && (
            <div className="border-t border-border/50 p-3 max-h-40 overflow-y-auto">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">All memories ({memories.length})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {memories.map(m => (
                  <motion.div
                    key={m.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-secondary/40 group hover:bg-secondary/70 transition-colors"
                  >
                    <button onClick={() => setSelected(m)} className="flex items-start gap-2 flex-1 min-w-0 text-left" aria-label={`Select memory ${m.key}`}>
                      <Brain className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate">{m.key}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{m.value}</p>
                      </div>
                    </button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 opacity-60 hover:opacity-100" onClick={() => setConfirmDelete(m)} aria-label={`Forget memory ${m.key}`}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget this memory?</AlertDialogTitle>
            <AlertDialogDescription>
              Oltrid will permanently forget <span className="font-semibold text-foreground">"{confirmDelete?.key}"</span>. This cannot be undone ॥
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) handleDelete(confirmDelete.id, confirmDelete.key);
                setConfirmDelete(null);
              }}
            >
              Forget
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
