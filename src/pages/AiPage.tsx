import { useState, useRef, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useGuestMode } from "@/hooks/useGuestMode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Send,
  Loader2,
  Sparkles,
  StickyNote,
  FileDown,
  User,
  Bot,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Clock,
} from "lucide-react";
import { VoiceInput } from "@/components/ai/VoiceInput";
import { ChatHistorySidebar } from "@/components/ai/ChatHistorySidebar";
import { NoteMentionDropdown } from "@/components/ai/NoteMentionDropdown";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "Create a note about project planning tips",
  "Make a presentation on time management",
  "Suggest a folder structure for a web project",
  "Write a study note about React hooks",
  "Create a meeting agenda template",
  "Make a presentation about startup ideas",
];

function parseNoteMarker(content: string) {
  const match = content.match(/<!--FYLIX_NOTE:(.*?)-->/);
  if (!match) return null;
  try { return JSON.parse(match[1]) as { title: string }; } catch { return null; }
}

function parsePresentationMarker(content: string) {
  const match = content.match(/<!--FYLIX_PRESENTATION:(.*?)-->/);
  if (!match) return null;
  try { return JSON.parse(match[1]) as { title: string }; } catch { return null; }
}

function stripMarkers(content: string) {
  return content.replace(/<!--FYLIX_NOTE:.*?-->/g, "").replace(/<!--FYLIX_PRESENTATION:.*?-->/g, "").trim();
}

export default function AiPage() {
  const { user } = useAuth();
  const { isGuest, guestExpired, guestMinutesLeft, startGuestSession } = useGuestMode();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [historySidebarOpen, setHistorySidebarOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAuthenticated = !!user;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle @mention detection
  const handleInputChange = (value: string) => {
    setInput(value);
    const atIndex = value.lastIndexOf("@");
    if (atIndex >= 0 && (atIndex === 0 || value[atIndex - 1] === " ")) {
      const query = value.slice(atIndex + 1);
      if (!query.includes(" ") || query.length < 30) {
        setMentionQuery(query);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const handleMentionSelect = (note: { id: string; title: string; content: string }) => {
    const atIndex = input.lastIndexOf("@");
    const before = input.slice(0, atIndex);
    const noteContext = `[Note: ${note.title}]\n${note.content.replace(/<[^>]*>/g, "").slice(0, 500)}\n\n`;
    setInput(before + noteContext);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  // Save conversation to DB
  const saveConversation = useCallback(async (msgs: Msg[], convId: string | null) => {
    if (!user || msgs.length < 2) return convId;
    try {
      if (!convId) {
        const title = msgs[0].content.slice(0, 60) || "New Chat";
        const { data } = await supabase.from("ai_conversations").insert({ user_id: user.id, title }).select("id").single();
        if (data) {
          convId = data.id;
          setActiveConversationId(convId);
        }
      }
      if (convId) {
        // Save the last 2 messages (user + assistant)
        const last2 = msgs.slice(-2);
        for (const msg of last2) {
          await supabase.from("ai_messages").insert({
            conversation_id: convId,
            role: msg.role,
            content: msg.content,
          });
        }
      }
    } catch (e) {
      console.error("Failed to save conversation:", e);
    }
    return convId;
  }, [user]);

  const loadConversation = useCallback(async (id: string) => {
    const { data } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(data as Msg[]);
      setActiveConversationId(id);
    }
  }, []);

  const streamChat = useCallback(async (allMessages: Msg[]) => {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ messages: allMessages }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "AI request failed" }));
      throw new Error(err.error || `AI request failed (${resp.status})`);
    }

    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") break;
        try {
          const parsed = JSON.parse(json);
          const c = parsed.choices?.[0]?.delta?.content;
          if (c) {
            full += c;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: full } : m);
              }
              return [...prev, { role: "assistant", content: full }];
            });
          }
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }
    return full;
  }, []);

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;

    const userMsg: Msg = { role: "user", content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setShowMentions(false);
    setIsLoading(true);

    try {
      await streamChat(newMessages);
      // Save to DB after response completes
      if (isAuthenticated) {
        setMessages((current) => {
          saveConversation(current, activeConversationId);
          return current;
        });
      }
    } catch (e: any) {
      toast.error(e.message || "AI request failed");
    } finally {
      setIsLoading(false);
    }
  };

  const saveAsNote = async (content: string) => {
    if (!user) { toast.error("Sign up to save notes"); return; }
    const marker = parseNoteMarker(content);
    const title = marker?.title || "AI Generated Note";
    const cleanContent = stripMarkers(content);
    try {
      const { error } = await supabase.from("notes").insert({ title, content: cleanContent, color: "blue", user_id: user.id });
      if (error) throw error;
      toast.success("Note saved successfully!");
    } catch (e: any) {
      toast.error("Failed to save note: " + e.message);
    }
  };

  const saveAsPdf = (content: string) => {
    const marker = parsePresentationMarker(content);
    const title = marker?.title || "AI Presentation";
    const cleanContent = stripMarkers(content);
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Please allow popups"); return; }
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a2e; } .slide { page-break-after: always; padding: 60px 80px; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; } h1 { font-size: 2.5em; margin-bottom: 0.5em; color: #1e40af; } h2 { font-size: 1.8em; margin-bottom: 0.5em; color: #3b82f6; } p { font-size: 1.2em; line-height: 1.6; margin: 0.5em 0; } ul, ol { font-size: 1.1em; padding-left: 1.5em; margin: 0.5em 0; } li { margin: 0.4em 0; line-height: 1.5; } @media print { .slide { min-height: auto; height: 100vh; } }</style></head><body>${cleanContent}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const clearChat = () => {
    setMessages([]);
    setActiveConversationId(null);
  };

  const handleNewChat = () => {
    setMessages([]);
    setActiveConversationId(null);
  };

  // Guest expired state
  if (guestExpired && !user) {
    return (
      <DashboardLayout searchQuery={searchQuery} onSearchChange={setSearchQuery}>
        <div className="max-w-md mx-auto mt-20 text-center space-y-4">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold text-foreground">Guest Session Expired</h2>
          <p className="text-sm text-muted-foreground">Your 1-hour guest session has ended. Sign up to continue using Fylix AI with all features.</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate("/auth")} className="rounded-xl">Sign up / Login</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout searchQuery={searchQuery} onSearchChange={setSearchQuery}>
      <div className="max-w-5xl mx-auto h-[calc(100vh-120px)] flex">
        {/* Chat history sidebar */}
        {isAuthenticated && (
          <ChatHistorySidebar
            activeId={activeConversationId}
            onSelect={loadConversation}
            onNewChat={handleNewChat}
            open={historySidebarOpen}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {isAuthenticated && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setHistorySidebarOpen(!historySidebarOpen)}
                >
                  {historySidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                </Button>
              )}
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Fylix AI</h1>
                <p className="text-[12px] text-muted-foreground">
                  {isGuest && !user
                    ? `Guest mode · ${guestMinutesLeft} min left`
                    : "Create notes, presentations, organize files — just ask"}
                </p>
              </div>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearChat} className="h-8 gap-1.5 text-[12px] text-muted-foreground">
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>

          {/* Chat area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-1">What can I help you with?</h2>
                <p className="text-[13px] text-muted-foreground mb-6 text-center max-w-md">
                  I can create notes, generate presentations, organize your files, and much more. Type @ to reference a note.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {QUICK_PROMPTS.map((p) => (
                    <button key={p} onClick={() => send(p)} className="text-left text-[12px] px-3 py-2.5 rounded-lg border border-border bg-background hover:bg-accent transition-colors text-foreground">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => {
                  const isUser = msg.role === "user";
                  const noteMarker = !isUser ? parseNoteMarker(msg.content) : null;
                  const presentationMarker = !isUser ? parsePresentationMarker(msg.content) : null;
                  const displayContent = stripMarkers(msg.content);

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {!isUser && (
                        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className={`max-w-[80%] ${isUser ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5" : "bg-muted/50 rounded-2xl rounded-bl-md px-4 py-2.5"}`}>
                        {isUser ? (
                          <p className="text-[13px] leading-relaxed">{msg.content}</p>
                        ) : (
                          <>
                            <div className="text-[13px] leading-relaxed prose-editor" dangerouslySetInnerHTML={{ __html: displayContent }} />
                            {(noteMarker || presentationMarker) && (
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                                {noteMarker && (
                                  <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5 rounded-lg" onClick={() => saveAsNote(msg.content)}>
                                    <StickyNote className="h-3 w-3" /> Save as Note
                                  </Button>
                                )}
                                {presentationMarker && (
                                  <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5 rounded-lg" onClick={() => saveAsPdf(msg.content)}>
                                    <FileDown className="h-3 w-3" /> Save as PDF
                                  </Button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {isUser && (
                        <div className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
                {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted/50 rounded-2xl rounded-bl-md px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>

          {/* Input */}
          <div className="mt-3 relative">
            <NoteMentionDropdown
              query={mentionQuery}
              onSelect={handleMentionSelect}
              visible={showMentions && isAuthenticated}
            />
            <div className="flex items-center gap-2">
              <VoiceInput
                onTranscript={(text) => {
                  setInput(text);
                  setTimeout(() => send(text), 100);
                }}
                disabled={isLoading}
              />
              <Input
                ref={inputRef}
                placeholder={isAuthenticated ? "Ask AI… Type @ to reference a note" : "Ask AI anything…"}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                disabled={isLoading}
                className="h-10 rounded-xl text-[13px] bg-card border-border"
              />
              <Button
                size="icon"
                className="h-10 w-10 rounded-xl shrink-0"
                onClick={() => send()}
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
