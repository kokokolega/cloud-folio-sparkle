import { useState, useRef, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useGuestMode } from "@/hooks/useGuestMode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Send, Loader2, Sparkles, StickyNote, FileDown, User, Bot, Trash2,
  PanelLeftClose, PanelLeftOpen, Clock, Globe, Paperclip, Download,
  GitBranch, LayoutDashboard, X,
} from "lucide-react";
import { VoiceInput } from "@/components/ai/VoiceInput";
import { ChatHistorySidebar } from "@/components/ai/ChatHistorySidebar";
import { NoteMentionDropdown } from "@/components/ai/NoteMentionDropdown";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MermaidDiagram } from "@/components/ai/MermaidDiagram";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type Msg = { role: "user" | "assistant"; content: string; attachments?: FileAttachment[] };

interface FileAttachment {
  name: string;
  type: string;
  content: string; // base64 or text content
}

const QUICK_PROMPTS = [
  "Create a note about project planning tips",
  "Make a presentation on time management",
  "Draw a flowchart for user onboarding",
  "Create a mind map about web development",
  "Search the web for latest AI trends",
  "Generate a diagram of a REST API architecture",
];

function parseNoteMarker(content: string) {
  const match = content.match(/<!--OLTRID_NOTE:(.*?)-->/);
  if (!match) {
    const oldMatch = content.match(/<!--FYLIX_NOTE:(.*?)-->/);
    if (!oldMatch) return null;
    try { return JSON.parse(oldMatch[1]) as { title: string }; } catch { return null; }
  }
  try { return JSON.parse(match[1]) as { title: string }; } catch { return null; }
}

function parsePresentationMarker(content: string) {
  const match = content.match(/<!--OLTRID_PRESENTATION:(.*?)-->/);
  if (!match) {
    const oldMatch = content.match(/<!--FYLIX_PRESENTATION:(.*?)-->/);
    if (!oldMatch) return null;
    try { return JSON.parse(oldMatch[1]) as { title: string }; } catch { return null; }
  }
  try { return JSON.parse(match[1]) as { title: string }; } catch { return null; }
}

function stripMarkers(content: string) {
  return content
    .replace(/<!--OLTRID_NOTE:.*?-->/g, "")
    .replace(/<!--OLTRID_PRESENTATION:.*?-->/g, "")
    .replace(/<!--FYLIX_NOTE:.*?-->/g, "")
    .replace(/<!--FYLIX_PRESENTATION:.*?-->/g, "")
    .trim();
}

function extractMermaidBlocks(content: string): { before: string; mermaid: string; after: string }[] {
  const regex = /```mermaid\s*\n([\s\S]*?)```/g;
  const parts: { before: string; mermaid: string; after: string }[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    parts.push({ before, mermaid: match[1].trim(), after: "" });
    lastIndex = match.index + match[0].length;
  }
  
  if (parts.length === 0) return [];
  parts[parts.length - 1].after = content.slice(lastIndex);
  return parts;
}

export default function AiPage() {
  const { user } = useAuth();
  const { isGuest, guestExpired, guestMinutesLeft } = useGuestMode();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historySidebarOpen, setHistorySidebarOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAuthenticated = !!user;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newAttachments: FileAttachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }
      
      try {
        const content = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          if (file.type.startsWith("text/") || file.name.match(/\.(txt|md|json|csv|xml|html|css|js|ts|jsx|tsx|py|java|c|cpp|h|yml|yaml)$/i)) {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsText(file);
          } else {
            reader.onload = () => {
              const base64 = (reader.result as string).split(",")[1];
              resolve(base64);
            };
            reader.readAsDataURL(file);
          }
        });
        
        newAttachments.push({ name: file.name, type: file.type, content });
      } catch {
        toast.error(`Failed to read ${file.name}`);
      }
    }
    
    setAttachedFiles(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

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
      body: JSON.stringify({ 
        messages: allMessages.map(m => ({ role: m.role, content: m.content })),
        webSearch: webSearchEnabled,
      }),
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
  }, [webSearchEnabled]);

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;

    // Build content with file attachments context
    let fullContent = msg;
    if (attachedFiles.length > 0) {
      const fileContext = attachedFiles.map(f => {
        if (f.type.startsWith("text/") || f.name.match(/\.(txt|md|json|csv|xml|html|css|js|ts)$/i)) {
          return `[Attached file: ${f.name}]\n${f.content.slice(0, 5000)}`;
        }
        return `[Attached file: ${f.name} (${f.type})]`;
      }).join("\n\n");
      fullContent = `${fileContext}\n\n${msg}`;
    }

    if (webSearchEnabled) {
      fullContent = `[Web Search Mode] ${fullContent}`;
    }

    const userMsg: Msg = { role: "user", content: fullContent, attachments: attachedFiles.length > 0 ? [...attachedFiles] : undefined };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setAttachedFiles([]);
    setShowMentions(false);
    setIsLoading(true);

    try {
      await streamChat(newMessages);
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

  const saveResponseAsFile = async (content: string) => {
    if (!user) { toast.error("Sign up to save files"); return; }
    const cleanContent = stripMarkers(content);
    const blob = new Blob([cleanContent], { type: "text/html" });
    const path = `${user.id}/ai-output-${Date.now()}.html`;
    try {
      const { error } = await supabase.storage.from("user-files").upload(path, blob);
      if (error) throw error;
      await supabase.from("files").insert({
        name: `AI Output ${new Date().toLocaleDateString()}.html`,
        type: "text/html",
        size: blob.size,
        storage_path: path,
        user_id: user.id,
      });
      toast.success("Saved to All Files!");
    } catch (e: any) {
      toast.error("Failed to save: " + e.message);
    }
  };

  const downloadContent = (content: string) => {
    const cleanContent = stripMarkers(content);
    const blob = new Blob([cleanContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oltrid-output-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearChat = () => {
    setMessages([]);
    setActiveConversationId(null);
  };

  const handleNewChat = () => {
    setMessages([]);
    setActiveConversationId(null);
  };

  if (guestExpired && !user) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto mt-20 text-center space-y-4">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold text-foreground">Guest Session Expired</h2>
          <p className="text-sm text-muted-foreground">Your 1-hour guest session has ended. Sign up to continue using Oltrid AI with all features.</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate("/auth")} className="rounded-xl">Sign up / Login</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-80px)] flex">
        {isAuthenticated && (
          <ChatHistorySidebar
            activeId={activeConversationId}
            onSelect={loadConversation}
            onNewChat={handleNewChat}
            open={historySidebarOpen}
            onClose={() => setHistorySidebarOpen(false)}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
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
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground leading-tight">Oltrid AI</h1>
                {isGuest && !user && (
                  <p className="text-[11px] text-muted-foreground">
                    Guest · {guestMinutesLeft} min left
                  </p>
                )}
              </div>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearChat} className="h-7 gap-1.5 text-[11px] text-muted-foreground">
                <Trash2 className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>

          {/* Chat area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-xl border border-border bg-card/50 p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-1">What can I help you with?</h2>
                <p className="text-[12px] text-muted-foreground mb-6 text-center max-w-md">
                  Notes, presentations, diagrams, flowcharts, mind maps, web search & more. Type @ to reference a note.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 w-full max-w-2xl">
                  {QUICK_PROMPTS.map((p) => (
                    <button key={p} onClick={() => send(p)} className="text-left text-[11px] px-3 py-2.5 rounded-lg border border-border bg-background hover:bg-accent transition-colors text-foreground">
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
                  const mermaidBlocks = !isUser ? extractMermaidBlocks(displayContent) : [];

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
                      <div className={`max-w-[85%] ${isUser ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5" : "bg-muted/50 rounded-2xl rounded-bl-md px-4 py-2.5"}`}>
                        {isUser ? (
                          <div>
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {msg.attachments.map((a, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary-foreground/20">
                                    <Paperclip className="h-2.5 w-2.5" /> {a.name}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content.replace(/\[Attached file:.*?\]\n?/g, "").replace("[Web Search Mode] ", "")}</p>
                          </div>
                        ) : (
                          <>
                            {mermaidBlocks.length > 0 ? (
                              <div className="space-y-3">
                                {mermaidBlocks.map((block, bi) => (
                                  <div key={bi}>
                                    {block.before && (
                                      <div className="text-[13px] leading-relaxed prose-editor" dangerouslySetInnerHTML={{ __html: block.before }} />
                                    )}
                                    <MermaidDiagram chart={block.mermaid} />
                                    {block.after && (
                                      <div className="text-[13px] leading-relaxed prose-editor" dangerouslySetInnerHTML={{ __html: block.after }} />
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[13px] leading-relaxed prose-editor" dangerouslySetInnerHTML={{ __html: displayContent }} />
                            )}
                            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/30 flex-wrap">
                              {noteMarker && (
                                <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 rounded-lg" onClick={() => saveAsNote(msg.content)}>
                                  <StickyNote className="h-3 w-3" /> Save Note
                                </Button>
                              )}
                              {presentationMarker && (
                                <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 rounded-lg" onClick={() => saveAsPdf(msg.content)}>
                                  <FileDown className="h-3 w-3" /> Save PDF
                                </Button>
                              )}
                              {isAuthenticated && (
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 rounded-lg text-muted-foreground" onClick={() => saveResponseAsFile(msg.content)}>
                                  <FileDown className="h-3 w-3" /> Save to Files
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 rounded-lg text-muted-foreground" onClick={() => downloadContent(msg.content)}>
                                <Download className="h-3 w-3" /> Download
                              </Button>
                            </div>
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

          {/* Attached files preview */}
          {attachedFiles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {attachedFiles.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-muted border border-border">
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate max-w-[120px]">{f.name}</span>
                  <button onClick={() => removeAttachment(i)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="mt-2 relative">
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
              
              {/* Web search toggle */}
              <Button
                variant={webSearchEnabled ? "default" : "ghost"}
                size="icon"
                className={`h-9 w-9 rounded-xl shrink-0 ${webSearchEnabled ? "" : "text-muted-foreground"}`}
                onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                title="Toggle web search"
              >
                <Globe className="h-4 w-4" />
              </Button>

              {/* File attach */}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl shrink-0 text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileAttach}
              />

              <Input
                ref={inputRef}
                placeholder={webSearchEnabled ? "Search the web…" : (isAuthenticated ? "Ask anything… Type @ to reference a note" : "Ask AI anything…")}
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
