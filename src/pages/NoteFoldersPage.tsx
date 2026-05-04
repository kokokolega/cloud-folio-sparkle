import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderPlus, FolderOpen, ArrowLeft, Plus, Trash2, ChevronRight, ChevronDown, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const PRIORITIES = [
  { value: "low", label: "Low", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  { value: "medium", label: "Medium", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  { value: "high", label: "High", color: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30" },
];

interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: string;
  parent_id: string | null;
  folder_id: string | null;
}

export default function NoteFoldersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [subtaskParent, setSubtaskParent] = useState<string | null>(null);
  const [subtaskInput, setSubtaskInput] = useState("");

  const { data: folders = [] } = useQuery({
    queryKey: ["note-folders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("folders").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["folder-tasks", activeFolderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("folder_id", activeFolderId!).order("created_at", { ascending: true });
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!activeFolderId,
  });

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("folders").insert({ user_id: user!.id, name });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["note-folders"] }); setCreateOpen(false); setFolderName(""); toast.success("Folder created"); },
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("tasks").delete().eq("folder_id", id);
      const { error } = await supabase.from("folders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["note-folders"] }); toast.success("Folder deleted"); },
  });

  const addTask = useMutation({
    mutationFn: async ({ title, priority, parent_id }: { title: string; priority: string; parent_id?: string | null }) => {
      const { error } = await supabase.from("tasks").insert({
        user_id: user!.id, title, priority, folder_id: activeFolderId, parent_id: parent_id ?? null, completed: false,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folder-tasks", activeFolderId] }),
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("tasks").update({ completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folder-tasks", activeFolderId] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("tasks").delete().eq("parent_id", id);
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folder-tasks", activeFolderId] }),
  });

  const activeFolder = folders.find(f => f.id === activeFolderId);
  const rootTasks = tasks.filter(t => !t.parent_id);
  const sortedRoots = [...rootTasks].sort((a, b) => {
    const order: any = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
  });

  const toggleExpand = (id: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {activeFolderId && (
              <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => setActiveFolderId(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <ListChecks className="h-5 w-5" /> {activeFolder ? activeFolder.name : "Task Folders"}
            </h1>
          </div>
          {!activeFolderId && (
            <Button onClick={() => setCreateOpen(true)} size="sm" className="rounded-xl gap-1.5">
              <FolderPlus className="h-3.5 w-3.5" /> New Folder
            </Button>
          )}
        </div>

        {!activeFolderId ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {folders.map(folder => (
              <motion.div key={folder.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 cursor-pointer hover-scale flex flex-col items-center gap-3 relative group"
                onClick={() => setActiveFolderId(folder.id)}>
                <Button size="icon" variant="ghost"
                  className="absolute top-1.5 right-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${folder.name}" and all its tasks?`)) deleteFolder.mutate(folder.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <FolderOpen className="h-9 w-9 text-primary/60" />
                <p className="text-[13px] font-medium text-center truncate w-full">{folder.name}</p>
              </motion.div>
            ))}
            {folders.length === 0 && (
              <div className="col-span-full flex flex-col items-center py-24 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-base font-medium">No task folders yet</p>
                <p className="text-sm mt-1">Create a folder to organize tasks and subtasks by priority</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Add task */}
            <div className="glass-card p-3 flex gap-2 items-center">
              <Input
                placeholder="Add a task..."
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newTask.trim()) { addTask.mutate({ title: newTask.trim(), priority: newTaskPriority }); setNewTask(""); } }}
                className="h-9 rounded-lg"
              />
              <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                <SelectTrigger className="w-28 h-9 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="icon" className="h-9 w-9 rounded-lg shrink-0"
                onClick={() => { if (newTask.trim()) { addTask.mutate({ title: newTask.trim(), priority: newTaskPriority }); setNewTask(""); } }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Tasks grouped by priority */}
            <div className="space-y-2">
              <AnimatePresence>
                {sortedRoots.map(task => {
                  const subs = tasks.filter(t => t.parent_id === task.id);
                  const expanded = expandedTasks.has(task.id);
                  const priority = PRIORITIES.find(p => p.value === task.priority) || PRIORITIES[1];
                  return (
                    <motion.div key={task.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass-card overflow-hidden">
                      <div className="flex items-center gap-2 p-3 group">
                        <button onClick={() => toggleExpand(task.id)} className="text-muted-foreground hover:text-foreground p-0.5">
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        <Checkbox checked={task.completed} onCheckedChange={(v) => toggleTask.mutate({ id: task.id, completed: !!v })} />
                        <span className={`flex-1 text-sm ${task.completed ? "line-through text-muted-foreground" : ""}`}>{task.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${priority.color}`}>{priority.label}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                          onClick={() => { setSubtaskParent(task.id); setExpandedTasks(prev => new Set(prev).add(task.id)); }}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-destructive"
                          onClick={() => deleteTask.mutate(task.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {expanded && (
                        <div className="pl-10 pr-3 pb-2 space-y-1.5 border-t border-border/30">
                          {subs.map(sub => (
                            <div key={sub.id} className="flex items-center gap-2 py-1.5 group/sub">
                              <Checkbox checked={sub.completed} onCheckedChange={(v) => toggleTask.mutate({ id: sub.id, completed: !!v })} />
                              <span className={`flex-1 text-[13px] ${sub.completed ? "line-through text-muted-foreground" : ""}`}>{sub.title}</span>
                              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover/sub:opacity-100 hover:text-destructive"
                                onClick={() => deleteTask.mutate(sub.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          {subtaskParent === task.id ? (
                            <div className="flex gap-1.5 pt-1">
                              <Input autoFocus value={subtaskInput} onChange={(e) => setSubtaskInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && subtaskInput.trim()) {
                                    addTask.mutate({ title: subtaskInput.trim(), priority: task.priority, parent_id: task.id });
                                    setSubtaskInput(""); setSubtaskParent(null);
                                  } else if (e.key === "Escape") { setSubtaskParent(null); setSubtaskInput(""); }
                                }}
                                placeholder="Subtask…" className="h-7 text-[13px] rounded-md" />
                            </div>
                          ) : (
                            <button onClick={() => setSubtaskParent(task.id)} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 py-1">
                              <Plus className="h-3 w-3" /> Add subtask
                            </button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {rootTasks.length === 0 && (
                <div className="text-center py-12 text-sm text-muted-foreground">No tasks yet — add one above to get started.</div>
              )}
            </div>
          </div>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-sm rounded-xl">
            <DialogHeader><DialogTitle className="text-base">Create Task Folder</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (folderName.trim()) createFolder.mutate(folderName.trim()); }} className="space-y-4">
              <Input placeholder="Folder name" value={folderName} onChange={(e) => setFolderName(e.target.value)} className="h-10 rounded-lg" autoFocus />
              <Button type="submit" className="w-full rounded-lg h-9 text-[13px]">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
