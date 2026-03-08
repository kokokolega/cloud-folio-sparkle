import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, isToday, isYesterday } from "date-fns";
import { MessageSquare, Plus, Trash2, Search, X, History, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatHistorySidebarProps {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  open: boolean;
  onClose: () => void;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d, yyyy");
}

export function ChatHistorySidebar({ activeId, onSelect, onNewChat, open, onClose }: ChatHistorySidebarProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    if (!user || !open) return;
    const load = async () => {
      const { data } = await supabase
        .from("ai_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(50);
      setConversations(data || []);
    };
    load();
  }, [user, open, activeId]);

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("ai_conversations").delete().eq("id", id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) onNewChat();
  };

  const startRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const saveRename = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!editingId || !editTitle.trim()) { setEditingId(null); return; }
    await supabase.from("ai_conversations").update({ title: editTitle.trim() }).eq("id", editingId);
    setConversations((prev) => prev.map((c) => c.id === editingId ? { ...c, title: editTitle.trim() } : c));
    setEditingId(null);
  };

  if (!open) return null;

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const grouped: Record<string, Conversation[]> = {};
  filtered.forEach((c) => {
    const key = formatDate(c.updated_at);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });

  return (
    <>
      {/* Mobile overlay */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />

      <div className="fixed md:relative inset-y-0 right-0 md:inset-y-auto left-auto z-50 md:z-auto w-72 md:w-full h-full bg-background/95 backdrop-blur-xl flex flex-col shrink-0 border-l md:border-l-0 border-border/30">
        {/* Header */}
        <div className="p-3 flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <History className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold text-foreground tracking-tight truncate">History</span>
          </div>
          <Button
            onClick={() => { onNewChat(); onClose(); }}
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
            title="New chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg md:hidden shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              placeholder="Search chats…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 rounded-xl bg-secondary/50 border-border/30 text-xs placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-ring/50"
            />
          </div>
        </div>

        {/* Conversations */}
        <ScrollArea className="flex-1">
          <div className="px-2 pb-2 space-y-0.5">
            <AnimatePresence>
              {Object.entries(grouped).map(([date, convos]) => (
                <div key={date}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 px-2 py-2 font-semibold">{date}</p>
                  {convos.map((c) => (
                    <motion.button
                      key={c.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      onClick={() => { if (editingId !== c.id) { onSelect(c.id); onClose(); } }}
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-xs transition-all duration-150 group",
                        activeId === c.id
                          ? "bg-secondary text-foreground font-medium"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      )}
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-40" />
                      {editingId === c.id ? (
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setEditingId(null); }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          className="flex-1 bg-secondary/80 border border-border/50 rounded-md px-1.5 py-0.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring/50 min-w-0"
                        />
                      ) : (
                        <span className="truncate flex-1">{c.title}</span>
                      )}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {editingId === c.id ? (
                          <button
                            onClick={(e) => saveRename(e)}
                            className="h-5 w-5 rounded-lg flex items-center justify-center hover:bg-primary/10 transition-all"
                          >
                            <Check className="h-3 w-3 text-primary" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => startRename(c.id, c.title, e)}
                            className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded-lg flex items-center justify-center hover:bg-secondary transition-all"
                          >
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                        <button
                          onClick={(e) => deleteConversation(c.id, e)}
                          className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-all"
                        >
                          <Trash2 className="h-3 w-3 text-destructive/70" />
                        </button>
                      </div>
                    </motion.button>
                  ))}
                </div>
              ))}
            </AnimatePresence>
            {filtered.length === 0 && (
              <div className="text-center py-10">
                <MessageSquare className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[11px] text-muted-foreground/50">
                  {searchQuery ? "No matching chats" : "No conversations yet"}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
