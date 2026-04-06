import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send, Loader2, Smile, Trash2, Reply, X,
  FileText, Download, CornerDownRight, Mail
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Popover, PopoverContent, PopoverTrigger
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";

interface GroupChatProps {
  groupId: string;
}

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

export function GroupChat({ groupId }: GroupChatProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const [activeEmojiMsg, setActiveEmojiMsg] = useState<string | null>(null);
  const [profileView, setProfileView] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  

  // Fetch messages with reply info
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["group-messages", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_messages")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Fetch profiles for all user_ids
      const userIds = [...new Set(data.map((m: any) => m.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, display_name, avatar_url")
        .in("user_id", userIds);

      const profileMap: Record<string, { email: string; display_name: string | null; avatar_url: string | null }> = {};
      profiles?.forEach((p: any) => {
        profileMap[p.user_id] = { email: p.email || "Unknown", display_name: p.display_name, avatar_url: p.avatar_url };
      });

      // Fetch reply-to messages
      const replyIds = data.filter((m: any) => m.reply_to).map((m: any) => m.reply_to);
      let replyMap: Record<string, any> = {};
      if (replyIds.length > 0) {
        const { data: replies } = await supabase
          .from("group_messages")
          .select("id, content, user_id")
          .in("id", replyIds);
        replies?.forEach((r: any) => {
          const p = profileMap[r.user_id];
          replyMap[r.id] = { ...r, email: p?.email || "Unknown", display_name: p?.display_name };
        });
      }

      return data.map((m: any) => {
        const p = profileMap[m.user_id];
        return {
          ...m,
          email: p?.email || "Unknown",
          display_name: p?.display_name || null,
          avatar_url: p?.avatar_url || null,
          replyMessage: m.reply_to ? replyMap[m.reply_to] : null,
        };
      });
    },
    refetchInterval: 3000,
  });

  // Fetch reactions
  const { data: reactions = [] } = useQuery({
    queryKey: ["group-reactions", groupId],
    queryFn: async () => {
      const msgIds = messages.map((m: any) => m.id);
      if (msgIds.length === 0) return [];
      const { data, error } = await supabase
        .from("group_message_reactions")
        .select("*")
        .in("message_id", msgIds);
      if (error) throw error;
      return data;
    },
    enabled: messages.length > 0,
  });

  // Group reactions by message
  const reactionsByMessage = reactions.reduce((acc: any, r: any) => {
    if (!acc[r.message_id]) acc[r.message_id] = [];
    acc[r.message_id].push(r);
    return acc;
  }, {});

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["group-messages", groupId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_message_reactions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["group-reactions", groupId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, queryClient]);

  // Send message
  const sendMutation = useMutation({
    mutationFn: async ({ content, attachmentUrl, attachmentType }: { content: string; attachmentUrl?: string; attachmentType?: string }) => {
      const insertData: any = {
        group_id: groupId,
        user_id: user!.id,
        content,
      };
      if (replyTo) insertData.reply_to = replyTo.id;
      if (attachmentUrl) {
        insertData.attachment_url = attachmentUrl;
        insertData.attachment_type = attachmentType || "file";
      }
      const { error } = await supabase.from("group_messages").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-messages", groupId] });
      setMessage("");
      setReplyTo(null);
    },
  });

  // Delete message
  const deleteMutation = useMutation({
    mutationFn: async (msgId: string) => {
      const { error } = await supabase.from("group_messages").delete().eq("id", msgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-messages", groupId] });
      toast.success("Message deleted");
    },
  });

  // Add reaction
  const addReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      // Check if already reacted
      const existing = reactions.find(
        (r: any) => r.message_id === messageId && r.user_id === user!.id && r.emoji === emoji
      );
      if (existing) {
        const { error } = await supabase.from("group_message_reactions").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("group_message_reactions").insert({
          message_id: messageId,
          user_id: user!.id,
          emoji,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-reactions", groupId] });
      setActiveEmojiMsg(null);
    },
  });

  // File upload
  const handleFileUpload = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop();
    const path = `group-chat/${groupId}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("user-files").upload(path, file);
    if (uploadErr) { toast.error("Upload failed"); return; }
    const { data: urlData } = supabase.storage.from("user-files").getPublicUrl(path);
    const isImage = file.type.startsWith("image/");
    sendMutation.mutate({
      content: isImage ? `📷 ${file.name}` : `📎 ${file.name}`,
      attachmentUrl: urlData.publicUrl,
      attachmentType: isImage ? "image" : "file",
    });
  }, [groupId, sendMutation]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate({ content: message.trim() });
  };

  const getDisplayName = (email: string, name?: string | null) => name || email.split("@")[0];
  const getInitial = (email: string, name?: string | null) => (name?.[0] || email?.[0] || "U").toUpperCase();

  const renderAttachment = (msg: any) => {
    if (!msg.attachment_url) return null;
    if (msg.attachment_type === "image") {
      return (
        <img
          src={msg.attachment_url}
          alt="shared"
          className="rounded-lg max-w-[220px] max-h-[200px] object-cover mt-1 cursor-pointer"
          onClick={() => window.open(msg.attachment_url, "_blank")}
        />
      );
    }
    return (
      <a
        href={msg.attachment_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 mt-1 px-2 py-1.5 rounded-lg bg-background/50 text-xs hover:bg-background/80 transition-colors"
      >
        <FileText className="h-3.5 w-3.5" />
        <span className="truncate max-w-[140px]">File</span>
        <Download className="h-3 w-3 ml-auto" />
      </a>
    );
  };

  const renderReplyPreview = (msg: any) => {
    if (!msg.replyMessage) return null;
    return (
      <div className="flex items-start gap-1.5 mb-1 px-2 py-1 rounded-lg bg-background/30 border-l-2 border-primary/50 text-[11px]">
        <CornerDownRight className="h-3 w-3 mt-0.5 text-primary/60 shrink-0" />
        <div className="min-w-0">
          <span className="font-medium text-primary/80">{getDisplayName(msg.replyMessage.email, msg.replyMessage.display_name)}</span>
          <p className="text-muted-foreground truncate">{msg.replyMessage.content}</p>
        </div>
      </div>
    );
  };

  const renderReactions = (msgId: string) => {
    const msgReactions = reactionsByMessage[msgId];
    if (!msgReactions || msgReactions.length === 0) return null;

    // Group by emoji
    const grouped: Record<string, { count: number; hasUser: boolean }> = {};
    msgReactions.forEach((r: any) => {
      if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, hasUser: false };
      grouped[r.emoji].count++;
      if (r.user_id === user?.id) grouped[r.emoji].hasUser = true;
    });

    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {Object.entries(grouped).map(([emoji, data]) => (
          <button
            key={emoji}
            onClick={() => addReaction.mutate({ messageId: msgId, emoji })}
            className={`text-[11px] px-1.5 py-0.5 rounded-full border transition-colors ${
              data.hasUser
                ? "bg-primary/15 border-primary/30 text-foreground"
                : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {emoji} {data.count > 1 && data.count}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[60vh]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-4 space-y-2">
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
              const name = getDisplayName(msg.email, msg.display_name);
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isMe ? "flex-row-reverse" : "flex-row"} gap-2 group/msg`}
                >
                  {/* Avatar */}
                  {!isMe && (
                    <button onClick={() => setProfileView(msg)} className="shrink-0">
                      <Avatar className="h-7 w-7 mt-4">
                        {msg.avatar_url ? <AvatarImage src={msg.avatar_url} alt={name} /> : null}
                        <AvatarFallback className="text-[10px] bg-secondary">{getInitial(msg.email, msg.display_name)}</AvatarFallback>
                      </Avatar>
                    </button>
                  )}
                  <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-muted-foreground mb-0.5 px-1">
                    {isMe ? "You" : name}
                  </span>
                  <div className={`relative max-w-[75%] ${isMe ? "flex flex-row-reverse gap-1" : "flex flex-row gap-1"}`}>
                    <div
                      className={`px-3 py-2 rounded-2xl text-[13px] ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted/50 text-foreground rounded-bl-md"
                      }`}
                    >
                      {renderReplyPreview(msg)}
                      {msg.content}
                      {renderAttachment(msg)}
                    </div>
                    {/* Action buttons */}
                    <div className={`flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity`}>
                      {/* Reply */}
                      <button
                        onClick={() => setReplyTo(msg)}
                        className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted/50 text-muted-foreground"
                        title="Reply"
                      >
                        <Reply className="h-3 w-3" />
                      </button>
                      {/* Emoji */}
                      <Popover open={activeEmojiMsg === msg.id} onOpenChange={(open) => setActiveEmojiMsg(open ? msg.id : null)}>
                        <PopoverTrigger asChild>
                          <button className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted/50 text-muted-foreground" title="React">
                            <Smile className="h-3 w-3" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" side="top">
                          <div className="flex gap-1">
                            {EMOJI_LIST.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => addReaction.mutate({ messageId: msg.id, emoji })}
                                className="text-lg hover:scale-125 transition-transform p-0.5"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      {/* Delete (own only) */}
                      {isMe && (
                        <button
                          onClick={() => deleteMutation.mutate(msg.id)}
                          className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-destructive/10 text-destructive/60"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {renderReactions(msg.id)}
                  <span className="text-[9px] text-muted-foreground/60 mt-0.5 px-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Reply banner */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-muted/30 border border-border rounded-t-xl mt-2 px-3 py-2 flex items-center gap-2 overflow-hidden"
          >
            <Reply className="h-3.5 w-3.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-medium text-primary">{getDisplayName(replyTo.email)}</span>
              <p className="text-[11px] text-muted-foreground truncate">{replyTo.content}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="shrink-0">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className={`flex items-center gap-2 ${replyTo ? "" : "mt-3"}`}>
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

      {/* Member Profile Dialog */}
      <Dialog open={!!profileView} onOpenChange={(o) => !o && setProfileView(null)}>
        <DialogContent className="sm:max-w-xs rounded-2xl border-0 glass-card">
          <DialogHeader>
            <DialogTitle className="text-center">Member Profile</DialogTitle>
          </DialogHeader>
          {profileView && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Avatar className="h-20 w-20 border-2 border-border">
                {profileView.avatar_url ? <AvatarImage src={profileView.avatar_url} /> : null}
                <AvatarFallback className="text-2xl bg-secondary">
                  {getInitial(profileView.email, profileView.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="font-semibold text-foreground">
                  {profileView.display_name || profileView.email?.split("@")[0]}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center mt-1">
                  <Mail className="h-3 w-3" /> {profileView.email}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
