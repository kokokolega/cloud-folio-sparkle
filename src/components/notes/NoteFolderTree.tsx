import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronDown, Folder, FolderPlus, MoreHorizontal, Pencil, Trash2, Inbox } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FolderRow { id: string; name: string; parent_id: string | null; }

interface Props {
  selected: string | null | "all";
  onSelect: (id: string | null | "all") => void;
}

export function NoteFolderTree({ selected, onSelect }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [creatingUnder, setCreatingUnder] = useState<string | null | undefined>(undefined);
  const [newName, setNewName] = useState("");

  const { data: folders = [] } = useQuery({
    queryKey: ["note-folders", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("folders")
        .select("id, name, parent_id")
        .eq("user_id", user.id)
        .is("group_id", null)
        .order("name");
      if (error) throw error;
      return (data || []) as FolderRow[];
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async ({ name, parent_id }: { name: string; parent_id: string | null }) => {
      if (!user) throw new Error("auth");
      const { error } = await supabase.from("folders").insert({ name, parent_id, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["note-folders"] }); toast.success("Folder created"); setNewName(""); setCreatingUnder(undefined); },
    onError: (e: any) => toast.error(e.message),
  });

  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("folders").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["note-folders"] }); setRenameId(null); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("folders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["note-folders"] }); toast.success("Folder deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const childrenOf = (pid: string | null) => folders.filter(f => f.parent_id === pid);

  const renderNode = (f: FolderRow, depth: number) => {
    const kids = childrenOf(f.id);
    const isOpen = expanded[f.id] ?? false;
    const isSel = selected === f.id;
    return (
      <div key={f.id}>
        <div
          className={cn(
            "group flex items-center gap-1 px-1.5 py-1 rounded-md text-[13px] cursor-pointer hover:bg-accent/60",
            isSel && "bg-accent text-foreground"
          )}
          style={{ paddingLeft: 4 + depth * 12 }}
          onClick={() => onSelect(f.id)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded({ ...expanded, [f.id]: !isOpen }); }}
            className="h-4 w-4 flex items-center justify-center text-muted-foreground"
          >
            {kids.length > 0 ? (isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : <span className="h-3 w-3" />}
          </button>
          <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {renameId === f.id ? (
            <Input
              value={renameValue}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => renameValue.trim() && rename.mutate({ id: f.id, name: renameValue.trim() })}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenameId(null); }}
              className="h-6 text-[12px] py-0 px-1"
            />
          ) : (
            <span className="truncate flex-1">{f.name}</span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded hover:bg-muted flex items-center justify-center">
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              <DropdownMenuItem onClick={() => { setCreatingUnder(f.id); setExpanded({ ...expanded, [f.id]: true }); }}>
                <FolderPlus className="h-3 w-3 mr-2" /> New subfolder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setRenameId(f.id); setRenameValue(f.name); }}>
                <Pencil className="h-3 w-3 mr-2" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { if (confirm("Delete folder? Notes inside will become unfiled.")) remove.mutate(f.id); }} className="text-destructive">
                <Trash2 className="h-3 w-3 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {isOpen && (
          <div>
            {kids.map(k => renderNode(k, depth + 1))}
            {creatingUnder === f.id && (
              <div className="flex items-center gap-1 py-1" style={{ paddingLeft: 4 + (depth + 1) * 12 + 16 }}>
                <Input
                  autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="Folder name"
                  onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) create.mutate({ name: newName.trim(), parent_id: f.id }); if (e.key === "Escape") { setCreatingUnder(undefined); setNewName(""); } }}
                  onBlur={() => { if (!newName.trim()) setCreatingUnder(undefined); }}
                  className="h-6 text-[12px] py-0 px-1.5"
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1 text-foreground">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1.5">Folders</p>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setCreatingUnder(null)} title="New folder">
          <FolderPlus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div
        className={cn("flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] cursor-pointer hover:bg-accent/60", selected === "all" && "bg-accent")}
        onClick={() => onSelect("all")}
      >
        <Inbox className="h-3.5 w-3.5 text-muted-foreground" /> All notes
      </div>
      <div
        className={cn("flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] cursor-pointer hover:bg-accent/60", selected === null && "bg-accent")}
        onClick={() => onSelect(null)}
      >
        <Folder className="h-3.5 w-3.5 text-muted-foreground" /> Unfiled
      </div>

      <div className="pt-1">
        {childrenOf(null).map(f => renderNode(f, 0))}
        {creatingUnder === null && (
          <div className="flex items-center gap-1 py-1 px-1.5">
            <Input
              autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Folder name"
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) create.mutate({ name: newName.trim(), parent_id: null }); if (e.key === "Escape") { setCreatingUnder(undefined); setNewName(""); } }}
              onBlur={() => { if (!newName.trim()) setCreatingUnder(undefined); }}
              className="h-6 text-[12px] py-0 px-1.5"
            />
          </div>
        )}
      </div>
    </div>
  );
}
