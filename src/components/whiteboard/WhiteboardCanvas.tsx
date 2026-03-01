import { useCallback, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/hooks/useTheme";
import "@excalidraw/excalidraw/index.css";

interface WhiteboardCanvasProps {
  boardId: string;
  boardName: string;
  initialData: any;
  onBack: () => void;
}

export function WhiteboardCanvas({ boardId, boardName, initialData, onBack }: WhiteboardCanvasProps) {
  const [excalidrawData, setExcalidrawData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const { theme } = useTheme();

  const handleChange = useCallback((elements: any, appState: any) => {
    setExcalidrawData({ elements, appState: { ...appState, collaborators: undefined } });
  }, []);

  const handleSave = async () => {
    if (!excalidrawData) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("whiteboards")
        .update({ data: excalidrawData })
        .eq("id", boardId);
      if (error) throw error;
      toast.success("Whiteboard saved!");
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const initial = initialData?.elements
    ? { elements: initialData.elements, appState: initialData.appState }
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 rounded-lg">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-sm font-medium text-foreground">{boardName}</h2>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="rounded-xl gap-2">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
      </div>
      <div className="flex-1">
        <Excalidraw
          initialData={initial}
          onChange={handleChange}
          theme={theme === "dark" ? "dark" : "light"}
        />
      </div>
    </div>
  );
}
