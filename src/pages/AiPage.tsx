import { useState, useRef, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useGuestMode } from "@/hooks/useGuestMode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Send, Loader2, Sparkles, StickyNote, FileDown, User, Bot, Trash2,
  PanelLeftClose, PanelLeftOpen, Clock, Globe, Paperclip, Download,
  X, Plus, ArrowUp,
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
  content: string;
}

const QUICK_PROMPTS = [
  { icon: "📝", text: "Create a note about project planning tips" },
  { icon: "📊", text: "Make a presentation on time management" },
  { icon: "🔀", text: "Draw a flowchart for user onboarding" },
  { icon: "🧠", text: "Create a mind map about web development" },
  { icon: "🌐", text: "Search the web for latest AI trends" },
  { icon: "📐", text: "Generate a diagram of a REST API architecture" },
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAuthenticated = !!user;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

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
    textareaRef.current?.focus();
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: FileAttachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} is too large (max 10MB)`); continue; }
      try {
        const content = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          if (file.type.startsWith("text/") || file.name.match(/\.(txt|md|json|csv|xml|html|css|js|ts|jsx|tsx|py|java|c|cpp|h|yml|yaml)$/i)) {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsText(file);
          } else {
            reader.onload = () => { const base64 = (reader.result as string).split(",")[1]; resolve(base64); };
            reader.readAsDataURL(file);
          }
        });
        newAttachments.push({ name: file.name, type: file.type, content });
      } catch { toast.error(`Failed to read ${file.name}`); }
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
        if (data) { convId = data.id; setActiveConversationId(convId); }
      }
      if (convId) {
        const last2 = msgs.slice(-2);
        for (const msg of last2) {
          await supabase.from("ai_messages").insert({ conversation_id: convId, role: msg.role, content: msg.content });
        }
      }
    } catch (e) { console.error("Failed to save conversation:", e); }
    return convId;
  }, [user]);

  const loadConversation = useCallback(async (id: string) => {
    const { data } = await supabase.from("ai_messages").select("role, content").eq("conversation_id", id).order("created_at", { ascending: true });
    if (data) { setMessages(data as Msg[]); setActiveConversationId(id); }
  }, []);

  const streamChat = useCallback(async (allMessages: Msg[]) => {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ messages: allMessages.map(m => ({ role: m.role, content: m.content })), webSearch: webSearchEnabled }),
    });
    if (!resp.ok) { const err = await resp.json().catch(() => ({ error: "AI request failed" })); throw new Error(err.error || `AI request failed (${resp.status})`); }
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
              if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: full } : m);
              return [...prev, { role: "assistant", content: full }];
            });
          }
        } catch { buffer = line + "\n" + buffer; break; }
      }
    }
    return full;
  }, [webSearchEnabled]);

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;
    let fullContent = msg;
    if (attachedFiles.length > 0) {
      const fileContext = attachedFiles.map(f => {
        if (f.type.startsWith("text/") || f.name.match(/\.(txt|md|json|csv|xml|html|css|js|ts)$/i)) return `[Attached file: ${f.name}]\n${f.content.slice(0, 5000)}`;
        return `[Attached file: ${f.name} (${f.type})]`;
      }).join("\n\n");
      fullContent = `${fileContext}\n\n${msg}`;
    }
    if (webSearchEnabled) fullContent = `[Web Search Mode] ${fullContent}`;
    const userMsg: Msg = { role: "user", content: fullContent, attachments: attachedFiles.length > 0 ? [...attachedFiles] : undefined };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setAttachedFiles([]);
    setShowMentions(false);
    setIsLoading(true);
    try {
      await streamChat(newMessages);
      if (isAuthenticated) setMessages((current) => { saveConversation(current, activeConversationId); return current; });
    } catch (e: any) { toast.error(e.message || "AI request failed"); } finally { setIsLoading(false); }
  };

  const saveAsNote = async (content: string) => {
    if (!user) { toast.error("Sign up to save notes"); return; }
    const marker = parseNoteMarker(content);
    const title = marker?.title || "AI Generated Note";
    const cleanContent = stripMarkers(content);
    try {
      const { error } = await supabase.from("notes").insert({ title, content: cleanContent, color: "blue", user_id: user.id });
      if (error) throw error;
      toast.success("Note saved!");
    } catch (e: any) { toast.error("Failed to save note: " + e.message); }
  };

  const saveAsPdf = (content: string) => {
    const marker = parsePresentationMarker(content);
    const title = marker?.title || "AI Presentation";
    const cleanContent = stripMarkers(content);
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Please allow popups"); return; }
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a2e; } .slide { page-break-after: always; padding: 60px 80px; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; } h1 { font-size: 2.5em; margin-bottom: 0.5em; } h2 { font-size: 1.8em; margin-bottom: 0.5em; } p { font-size: 1.2em; line-height: 1.6; margin: 0.5em 0; } ul, ol { font-size: 1.1em; padding-left: 1.5em; margin: 0.5em 0; } li { margin: 0.4em 0; line-height: 1.5; } @media print { .slide { min-height: auto; height: 100vh; } }</style></head><body>${cleanContent}</body></html>`);
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
      await supabase.from("files").insert({ name: `AI Output ${new Date().toLocaleDateString()}.html`, type: "text/html", size: blob.size, storage_path: path, user_id: user.id });
      toast.success("Saved to All Files!");
    } catch (e: any) { toast.error("Failed to save: " + e.message); }
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

  const clearChat = () => { setMessages([]); setActiveConversationId(null); };
  const handleNewChat = () => { setMessages([]); setActiveConversationId(null); };

  if (guestExpired && !user) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto mt-20 text-center space-y-4">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold text-foreground">Guest Session Expired</h2>
          <p className="text-sm text-muted-foreground">Your 1-hour guest session has ended.</p>
          <Button onClick={() => navigate("/auth")} className="rounded-xl">Sign up / Login</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout noPadding>
      <div className="h-[calc(100vh-0px)] md:h-screen flex">
        {/* Chat history sidebar */}
        {isAuthenticated && (
          <ChatHistorySidebar
            activeId={activeConversationId}
            onSelect={loadConversation}
            onNewChat={handleNewChat}
            open={historySidebarOpen}
            onClose={() => setHistorySidebarOpen(false)}
          />
        )}

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 md:px-6 h-14 border-b border-border/50 shrink-0">
            <div className="flex items-center gap-2">
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
              <span className="text-sm font-semibold text-foreground">Oltrid AI</span>
              {isGuest && !user && (
                <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                  Guest · {guestMinutesLeft}m
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearChat} className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" /> New chat
                </Button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center max-w-2xl w-full"
                >
                  <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="h-8 w-8 text-foreground/80" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-2">
                    What can I help with?
                  </h1>
                  <p className="text-sm text-muted-foreground mb-10 max-w-md mx-auto">
                    Notes, presentations, diagrams, web search & more. Type @ to reference a note.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto">
                    {QUICK_PROMPTS.map((p) => (
                      <button
                        key={p.text}
                        onClick={() => send(p.text)}
                        className="flex items-center gap-3 text-left text-sm px-4 py-3 rounded-xl border border-border bg-background hover:bg-secondary/60 transition-colors text-foreground group"
                      >
                        <span className="text-lg">{p.icon}</span>
                        <span className="text-muted-foreground group-hover:text-foreground transition-colors line-clamp-1">{p.text}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
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
                        className="flex gap-3"
                      >
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${isUser ? "bg-secondary" : "bg-secondary"}`}>
                          {isUser ? <User className="h-3.5 w-3.5 text-foreground/70" /> : <Sparkles className="h-3.5 w-3.5 text-foreground/70" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">{isUser ? "You" : "Oltrid AI"}</p>
                          {isUser ? (
                            <div>
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                  {msg.attachments.map((a, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-secondary border border-border">
                                      <Paperclip className="h-3 w-3" /> {a.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                {msg.content.replace(/\[Attached file:.*?\]\n?/g, "").replace("[Web Search Mode] ", "")}
                              </p>
                            </div>
                          ) : (
                            <>
                              {mermaidBlocks.length > 0 ? (
                                <div className="space-y-3">
                                  {mermaidBlocks.map((block, bi) => (
                                    <div key={bi}>
                                      {block.before && <div className="text-sm leading-relaxed prose-editor" dangerouslySetInnerHTML={{ __html: block.before }} />}
                                      <MermaidDiagram chart={block.mermaid} />
                                      {block.after && <div className="text-sm leading-relaxed prose-editor" dangerouslySetInnerHTML={{ __html: block.after }} />}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm leading-relaxed prose-editor" dangerouslySetInnerHTML={{ __html: displayContent }} />
                              )}
                              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                                {noteMarker && (
                                  <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 rounded-lg" onClick={() => saveAsNote(msg.content)}>
                                    <StickyNote className="h-3 w-3" /> Save Note
                                  </Button>
                                )}
                                {presentationMarker && (
                                  <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 rounded-lg" onClick={() => saveAsPdf(msg.content)}>
                                    <FileDown className="h-3 w-3" /> Save PDF
                                  </Button>
                                )}
                                {isAuthenticated && (
                                  <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1 rounded-lg text-muted-foreground" onClick={() => saveResponseAsFile(msg.content)}>
                                    <FileDown className="h-3 w-3" /> Save to Files
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1 rounded-lg text-muted-foreground" onClick={() => downloadContent(msg.content)}>
                                  <Download className="h-3 w-3" /> Download
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                  {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                      <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                        <Sparkles className="h-3.5 w-3.5 text-foreground/70" />
                      </div>
                      <div className="pt-1">
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Oltrid AI</p>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t border-border/50 bg-background">
            <div className="max-w-3xl mx-auto px-4 md:px-6 py-3">
              {/* Attached files */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {attachedFiles.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-secondary border border-border">
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate max-w-[120px]">{f.name}</span>
                      <button onClick={() => removeAttachment(i)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}

              {/* Mention dropdown */}
              <NoteMentionDropdown query={mentionQuery} onSelect={handleMentionSelect} visible={showMentions && isAuthenticated} />

              {/* Input box */}
              <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-secondary/30 px-3 py-2 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring transition-all">
                <div className="flex items-center gap-1 shrink-0 pb-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach file"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={webSearchEnabled ? "secondary" : "ghost"}
                    size="icon"
                    className={`h-8 w-8 rounded-lg ${webSearchEnabled ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                    title="Toggle web search"
                  >
                    <Globe className="h-4 w-4" />
                  </Button>
                  <VoiceInput
                    onTranscript={(text) => { setInput(text); setTimeout(() => send(text), 100); }}
                    disabled={isLoading}
                  />
                </div>

                <textarea
                  ref={textareaRef}
                  placeholder={webSearchEnabled ? "Search the web…" : "Message Oltrid AI…"}
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 bg-transparent border-0 outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/60 py-1.5 min-h-[36px] max-h-[200px]"
                />

                <Button
                  size="icon"
                  className="h-8 w-8 rounded-lg shrink-0 mb-0.5"
                  onClick={() => send()}
                  disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </Button>
              </div>

              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileAttach} />
              <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
                Oltrid AI can make mistakes. Verify important information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
