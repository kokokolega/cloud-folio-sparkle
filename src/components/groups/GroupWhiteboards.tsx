import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { WhiteboardCanvas } from "@/components/whiteboard/WhiteboardCanvas";

interface GroupWhiteboardsProps {
  groupId: string;
}

export function GroupWhiteboards({ groupId }: GroupWhiteboardsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeBoard, setActiveBoard] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ["group-whiteboards", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whiteboards")
        .select("*")
        .eq("group_id", groupId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("whiteboards")
        .insert({ name, user_id: user!.id, group_id: groupId, data: {} })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["group-whiteboards", groupId] });
      setActiveBoard(data.id);
      setCreateOpen(false);
      setNewName("");
      toast.success("Whiteboard created!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whiteboards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-whiteboards", groupId] });
      toast.success("Whiteboard deleted");
    },
  });

  const activeBoardData = boards.find((b: any) => b.id === activeBoard);

  if (activeBoard && activeBoardData) {
    return (
      <WhiteboardCanvas
        boardId={activeBoard}
        boardName={activeBoardData.name}
        initialData={activeBoardData.data}
        onBack={() => {
          setActiveBoard(null);
          queryClient.invalidateQueries({ queryKey: ["group-whiteboards", groupId] });
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setCreateOpen(true)} size="sm" className="rounded-xl gap-2">
          <Plus className="h-3.5 w-3.5" /> New Whiteboard
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : boards.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No whiteboards in this group yet</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {boards.map((board: any) => (
              <motion.div
                key={board.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card p-4 cursor-pointer hover:border-primary/30 transition-colors group"
                onClick={() => setActiveBoard(board.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-foreground text-sm">{board.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(board.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(board.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <div className="mt-3 h-20 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-center">
                  <Pencil className="h-5 w-5 text-muted-foreground/30" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Whiteboard</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Whiteboard name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newName.trim() && createMutation.mutate(newName.trim())}
          />
          <DialogFooter>
            <Button
              onClick={() => createMutation.mutate(newName.trim())}
              disabled={!newName.trim() || createMutation.isPending}
              className="rounded-xl"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
