import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
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
      <div className="fixed left-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1.5 px-1.5 py-2.5 rounded-full bg-white/40 dark:bg-white/5 border border-white/30 dark:border-white/10 shadow-lg" style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}>
        {items.map((it) => {
          const isActive = active === it.id;
          return (
            <button
              key={it.id}
              onClick={it.onClick}
              title={it.label}
              className={cn(
                "h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110",
                isActive ? "bg-foreground/10 opacity-100" : active ? "opacity-40 hover:opacity-100" : "opacity-80 hover:opacity-100"
              )}
            >
              <it.icon className="h-4 w-4 text-foreground/70" strokeWidth={1.4} />
            </button>
          );
        })}
        {active === "tasks" && (
          <Link to="/note-folders" onClick={() => setActive(null)} className="text-[9px] text-muted-foreground mt-1 underline">Open</Link>
        )}
      </div>

      {/* Search expanded bar */}
      {active === "search" && (
        <div className="fixed left-16 top-1/2 -translate-y-1/2 z-30 w-64 expanded">
          <div className="relative rounded-full bg-white/60 dark:bg-white/10 border border-white/40 dark:border-white/15 shadow-lg" style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search notes…"
              className="pl-9 pr-8 h-9 rounded-full border-0 bg-transparent text-sm focus-visible:ring-0"
            />
            <button onClick={() => setActive(null)} className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full hover:bg-foreground/10 flex items-center justify-center">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Folders drawer */}
      <Sheet open={foldersOpen} onOpenChange={(o) => { setFoldersOpen(o); if (!o && active === "folders") setActive(null); }}>
        <SheetContent side="left" id="drawer" className="w-[280px] p-4">
          <NoteFolderTree
            selected={selectedFolder}
            onSelect={(id) => { onSelectFolder(id); setFoldersOpen(false); setActive(null); }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
