import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, isToday, isYesterday } from "date-fns";
import { MessageSquare, Plus, Trash2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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

      <div className="fixed md:relative inset-y-0 left-0 z-50 md:z-auto w-72 md:w-64 border-r border-border bg-sidebar flex flex-col shrink-0">
        <div className="p-3 flex items-center justify-between">
          <Button onClick={() => { onNewChat(); onClose(); }} size="sm" variant="outline" className="h-8 rounded-lg text-xs gap-1.5 flex-1 mr-2">
            <Plus className="h-3.5 w-3.5" /> New chat
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg md:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search chats…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 rounded-lg bg-sidebar-accent border-0 text-xs placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-2 pb-2 space-y-0.5">
            {Object.entries(grouped).map(([date, convos]) => (
              <div key={date}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-2 font-medium">{date}</p>
                {convos.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { onSelect(c.id); onClose(); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors group",
                      activeId === c.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    <span className="truncate flex-1">{c.title}</span>
                    <button
                      onClick={(e) => deleteConversation(c.id, e)}
                      className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center hover:bg-destructive/10 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-[11px] text-muted-foreground py-8">
                {searchQuery ? "No matching chats" : "No conversations yet"}
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
