import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Search, Folder, Inbox, ListChecks, X } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NoteFolderTree } from "@/components/notes/NoteFolderTree";

interface Props {
  selectedFolder: string | null | "all";
  onSelectFolder: (id: string | null | "all") => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
}

type Tool = "search" | "folders" | "all" | "tasks" | null;

export function NotesFloatingSidebar({ selectedFolder, onSelectFolder, searchQuery, onSearchChange }: Props) {
  const [active, setActive] = useState<Tool>(null);
  const [foldersOpen, setFoldersOpen] = useState(false);

  const items: { id: Tool; icon: any; label: string; onClick: () => void }[] = [
    { id: "search", icon: Search, label: "Search", onClick: () => setActive(active === "search" ? null : "search") },
    { id: "folders", icon: Folder, label: "Folders", onClick: () => { setActive("folders"); setFoldersOpen(true); } },
    { id: "all", icon: Inbox, label: "All Notes", onClick: () => { setActive("all"); onSelectFolder("all"); } },
    { id: "tasks", icon: ListChecks, label: "Tasks", onClick: () => setActive("tasks") },
  ];

  return (
    <>
      <div
        className="fixed right-2 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1 px-1 py-2 rounded-full bg-white/40 dark:bg-white/5 border border-white/30 dark:border-white/10 shadow-lg"
        style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
      >
        {items.map((it) => {
          const isActive = active === it.id;
          const trigger = (
            <button
              key={it.id}
              onClick={it.onClick}
              title={it.label}
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110",
                isActive ? "bg-foreground/10 opacity-100" : active ? "opacity-40 hover:opacity-100" : "opacity-80 hover:opacity-100"
              )}
            >
              <it.icon className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
            </button>
          );
          if (it.id === "folders") {
            return (
              <Popover key={it.id} open={foldersOpen} onOpenChange={(o) => { setFoldersOpen(o); if (!o && active === "folders") setActive(null); }}>
                <PopoverTrigger asChild>{trigger}</PopoverTrigger>
                <PopoverContent side="left" align="center" className="w-[260px] p-3 max-h-[70vh] overflow-y-auto">
                  <NoteFolderTree
                    selected={selectedFolder}
                    onSelect={(id) => { onSelectFolder(id); setFoldersOpen(false); setActive(null); }}
                  />
                </PopoverContent>
              </Popover>
            );
          }
          return trigger;
        })}
        {active === "tasks" && (
          <Link to="/note-folders" onClick={() => setActive(null)} className="text-[9px] text-muted-foreground mt-1 underline">Open</Link>
        )}
      </div>

      {/* Search expanded bar (to the left of sidebar) */}
      {active === "search" && (
        <div className="fixed right-14 top-1/2 -translate-y-1/2 z-30 w-56">
          <div className="relative rounded-full bg-white/60 dark:bg-white/10 border border-white/40 dark:border-white/15 shadow-lg" style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search notes…"
              className="pl-9 pr-8 h-8 rounded-full border-0 bg-transparent text-xs focus-visible:ring-0"
            />
            <button onClick={() => setActive(null)} className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full hover:bg-foreground/10 flex items-center justify-center">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
