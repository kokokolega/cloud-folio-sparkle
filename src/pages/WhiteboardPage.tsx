import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
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

export default function WhiteboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeBoard, setActiveBoard] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ["whiteboards", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whiteboards")
        .select("*")
        .eq("user_id", user!.id)
        .is("group_id", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("whiteboards")
        .insert({ name, user_id: user!.id, data: {} })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["whiteboards"] });
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
      queryClient.invalidateQueries({ queryKey: ["whiteboards"] });
      toast.success("Whiteboard deleted");
    },
  });

  const filtered = boards.filter((b: any) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeBoardData = boards.find((b: any) => b.id === activeBoard);

  if (activeBoard && activeBoardData) {
    return (
      <WhiteboardCanvas
        boardId={activeBoard}
        boardName={activeBoardData.name}
        initialData={activeBoardData.data}
        onBack={() => {
          setActiveBoard(null);
          queryClient.invalidateQueries({ queryKey: ["whiteboards"] });
        }}
      />
    );
  }

  return (
    <DashboardLayout searchQuery={searchQuery} onSearchChange={setSearchQuery}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground">Whiteboards</h2>
        <Button onClick={() => setCreateOpen(true)} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" /> New Whiteboard
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Pencil className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No whiteboards yet</p>
          <Button variant="outline" className="mt-3 rounded-xl" onClick={() => setCreateOpen(true)}>
            Create your first whiteboard
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((board: any) => (
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
                <div className="mt-3 h-24 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-center">
                  <Pencil className="h-6 w-6 text-muted-foreground/30" />
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
    </DashboardLayout>
  );
}
