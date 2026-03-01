import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface GroupChatProps {
  groupId: string;
}

export function GroupChat({ groupId }: GroupChatProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["group-messages", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_messages")
        .select("*, profiles:user_id(email)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["group-messages", groupId] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, queryClient]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("group_messages").insert({
        group_id: groupId,
        user_id: user!.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-messages", groupId] });
      setMessage("");
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate(message.trim());
  };

  return (
    <div className="flex flex-col h-[60vh]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No messages yet. Start the conversation!</p>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg: any) => {
              const isMe = msg.user_id === user?.id;
              const email = (msg as any).profiles?.email || "Unknown";
              const displayName = email.split("@")[0];
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <span className="text-[10px] text-muted-foreground mb-0.5 px-1">
                    {isMe ? "You" : displayName}
                  </span>
                  <div
                    className={`max-w-[75%] px-3 py-2 rounded-2xl text-[13px] ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted/50 text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[9px] text-muted-foreground/60 mt-0.5 px-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Input
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          className="h-10 rounded-xl text-[13px] bg-card border-border"
        />
        <Button
          size="icon"
          className="h-10 w-10 rounded-xl shrink-0"
          onClick={handleSend}
          disabled={!message.trim() || sendMutation.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
