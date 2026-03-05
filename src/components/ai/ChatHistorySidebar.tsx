import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, isToday, isYesterday } from "date-fns";
import { MessageSquare, Plus, Trash2, Calendar as CalendarIcon, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!user || !open) return;
    const load = async () => {
      let query = supabase
        .from("ai_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (calendarDate) {
        const start = new Date(calendarDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(calendarDate);
        end.setHours(23, 59, 59, 999);
        query = query.gte("updated_at", start.toISOString()).lte("updated_at", end.toISOString());
      }

      const { data } = await query;
      setConversations(data || []);
    };
    load();
  }, [user, open, activeId, calendarDate]);

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("ai_conversations").delete().eq("id", id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) onNewChat();
  };

  const clearDateFilter = () => setCalendarDate(undefined);

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
      <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />

      {/* Sidebar */}
      <div className={cn(
        "fixed md:relative inset-y-0 left-0 z-50 md:z-auto w-72 md:w-64 border-r border-border bg-card flex flex-col shrink-0 transition-transform duration-200",
        "md:translate-x-0"
      )}>
        {/* Header */}
        <div className="p-3 border-b border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-foreground">Chat History</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg md:hidden" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={onNewChat} className="w-full h-9 rounded-lg text-[13px] gap-2 justify-start" variant="outline">
            <Plus className="h-4 w-4" /> New Chat
          </Button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search chats…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 rounded-lg bg-muted/60 border-0 text-[12px] placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>

        {/* Calendar filter */}
        <div className="px-3 py-2 border-b border-border/50 flex items-center gap-2">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant={calendarDate ? "secondary" : "ghost"} size="sm" className="h-7 text-[11px] gap-1.5 rounded-lg flex-1 justify-start">
                <CalendarIcon className="h-3.5 w-3.5" />
                {calendarDate ? format(calendarDate, "MMM d, yyyy") : "Filter by date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={calendarDate} onSelect={(d) => { setCalendarDate(d); setCalendarOpen(false); }} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {calendarDate && (
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg shrink-0" onClick={clearDateFilter}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {Object.entries(grouped).map(([date, convos]) => (
              <div key={date}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5 font-medium">{date}</p>
                {convos.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-[12px] transition-colors group",
                      activeId === c.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
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
                {searchQuery ? "No matching chats" : calendarDate ? "No conversations on this date" : "No conversations yet"}
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
