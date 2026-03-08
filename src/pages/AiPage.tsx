import { useState, useRef, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useGuestMode } from "@/hooks/useGuestMode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Bot, StickyNote, FileDown, User,
  PanelRightClose, PanelRightOpen, Clock, Globe, Paperclip, Download,
  X, Plus, ArrowUp, Search, Brain, Pencil, Trash2,
  NotebookPen, MessageCircle, Workflow, Globe2,
} from "lucide-react";
import { VoiceInput } from "@/components/ai/VoiceInput";
import { ChatHistorySidebar } from "@/components/ai/ChatHistorySidebar";
import { NoteMentionDropdown } from "@/components/ai/NoteMentionDropdown";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MermaidDiagram } from "@/components/ai/MermaidDiagram";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type Msg = { role: "user" | "assistant"; content: string; attachments?: FileAttachment[] };

interface FileAttachment {
  name: string;
  type: string;
  content: string;
}

interface NoteData {
  id: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  updated_at: string;
}

interface MemoryData {
  id: string;
  key: string;
  value: string;
}

const QUICK_PROMPTS = [
  { icon: <NotebookPen className="h-4 w-4" />, text: "Create a new note" },
  { icon: <MessageCircle className="h-4 w-4" />, text: "Summarize my notes" },
  { icon: <Workflow className="h-4 w-4" />, text: "Draw a flowchart" },
  { icon: <Globe2 className="h-4 w-4" />, text: "Search the web" },
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

function parseEditNoteMarker(content: string) {
  const match = content.match(/<!--OLTRID_EDIT_NOTE:(.*?)-->/);
  if (!match) return null;
  try { return JSON.parse(match[1]) as { id: string; title: string; content: string }; } catch { return null; }
}

function parseDeleteNoteMarker(content: string) {
  const match = content.match(/<!--OLTRID_DELETE_NOTE:(.*?)-->/);
  if (!match) return null;
  try { return JSON.parse(match[1]) as { id: string }; } catch { return null; }
}

function parseMemoryMarker(content: string) {
  const markers: { key: string; value: string }[] = [];
  const regex = /<!--OLTRID_MEMORY:(.*?)-->/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    try { markers.push(JSON.parse(match[1])); } catch {}
  }
  return markers;
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
    .replace(/<!--OLTRID_EDIT_NOTE:.*?-->/g, "")
    .replace(/<!--OLTRID_DELETE_NOTE:.*?-->/g, "")
    .replace(/<!--OLTRID_MEMORY:.*?-->/g, "")
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
  const [userNotes, setUserNotes] = useState<NoteData[]>([]);
  const [userMemory, setUserMemory] = useState<MemoryData[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAuthenticated = !!user;

  // Load notes and memory on mount & when user changes
  useEffect(() => {
    if (!user) return;
    const loadContext = async () => {
      const [notesRes, memRes] = await Promise.all([
        supabase.from("notes").select("id, title, content, color, pinned, updated_at").eq("user_id", user.id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(100),
        supabase.from("ai_memory").select("id, key, value").eq("user_id", user.id).limit(100),
      ]);
      if (notesRes.data) setUserNotes(notesRes.data);
      if (memRes.data) setUserMemory(memRes.data);
    };
    loadContext();
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

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
        const title = msgs[0].content.split(/\s+/).slice(0, 2).join(" ") || "New Chat";
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

  // Process AI response for note/memory actions
  const processAiActions = useCallback(async (responseContent: string) => {
    if (!user) return;

    // Handle note creation
    const noteMarker = parseNoteMarker(responseContent);
    // (handled by save button, not auto)

    // Handle note editing
    const editMarker = parseEditNoteMarker(responseContent);
    if (editMarker) {
      try {
        const { error } = await supabase.from("notes").update({
          title: editMarker.title,
          content: editMarker.content,
        }).eq("id", editMarker.id).eq("user_id", user.id);
        if (error) throw error;
        toast.success(`Note "${editMarker.title}" updated!`);
        // Refresh notes
        const { data } = await supabase.from("notes").select("id, title, content, color, pinned, updated_at").eq("user_id", user.id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(100);
        if (data) setUserNotes(data);
      } catch (e: any) { toast.error("Failed to edit note: " + e.message); }
    }

    // Handle note deletion
    const deleteMarker = parseDeleteNoteMarker(responseContent);
    if (deleteMarker) {
      try {
        const { error } = await supabase.from("notes").update({ deleted_at: new Date().toISOString() }).eq("id", deleteMarker.id).eq("user_id", user.id);
        if (error) throw error;
        toast.success("Note moved to trash!");
        setUserNotes(prev => prev.filter(n => n.id !== deleteMarker.id));
      } catch (e: any) { toast.error("Failed to delete note: " + e.message); }
    }

    // Handle memory saving
    const memoryMarkers = parseMemoryMarker(responseContent);
    for (const mem of memoryMarkers) {
      try {
        // Upsert memory
        const existing = userMemory.find(m => m.key === mem.key);
        if (existing) {
          await supabase.from("ai_memory").update({ value: mem.value, updated_at: new Date().toISOString() }).eq("id", existing.id);
          setUserMemory(prev => prev.map(m => m.key === mem.key ? { ...m, value: mem.value } : m));
        } else {
          const { data } = await supabase.from("ai_memory").insert({ user_id: user.id, key: mem.key, value: mem.value }).select("id, key, value").single();
          if (data) setUserMemory(prev => [...prev, data]);
        }
        toast.success(`Remembered: ${mem.key}`);
      } catch (e: any) { console.error("Failed to save memory:", e); }
    }
  }, [user, userMemory]);

  const streamChat = useCallback(async (allMessages: Msg[]) => {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({
        messages: allMessages.map(m => ({ role: m.role, content: m.content })),
        webSearch: webSearchEnabled,
        notesContext: userNotes.map(n => ({ id: n.id, title: n.title, content: n.content, color: n.color, pinned: n.pinned, updated_at: n.updated_at })),
        memoryContext: userMemory.map(m => ({ key: m.key, value: m.value })),
      }),
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
  }, [webSearchEnabled, userNotes, userMemory]);

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
      const responseContent = await streamChat(newMessages);
      // Process any AI actions in the response
      await processAiActions(responseContent);
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
      // Refresh notes
      const { data } = await supabase.from("notes").select("id, title, content, color, pinned, updated_at").eq("user_id", user.id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(100);
      if (data) setUserNotes(data);
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

  const renderWelcome = () => (
    <div className="h-full flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-2xl w-full"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1, type: "spring", stiffness: 200 }}
          className="relative mx-auto mb-8"
        >
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-foreground/10 to-foreground/5 flex items-center justify-center mx-auto relative overflow-hidden">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-primary/5"
            />
            <Bot className="h-9 w-9 text-foreground/80 relative z-10" />
          </div>
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-primary/5 to-primary/10 blur-xl -z-10"
          />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl md:text-4xl font-bold text-foreground mb-3 tracking-tight"
        >
          What can I help with?
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-sm text-muted-foreground mb-3 max-w-md mx-auto leading-relaxed"
        >
          Full control over your notes, persistent memory, diagrams & more.
        </motion.p>
        {isAuthenticated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground/60 mb-8"
          >
            <span className="flex items-center gap-1"><StickyNote className="h-3 w-3" /> {userNotes.length} notes</span>
            <span className="flex items-center gap-1"><Brain className="h-3 w-3" /> {userMemory.length} memories</span>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl mx-auto"
        >
          {QUICK_PROMPTS.map((p, i) => (
            <motion.button
              key={p.text}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.06 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => send(p.text)}
              className={`flex items-center gap-3 text-left text-sm px-4 py-3.5 rounded-2xl border bg-gradient-to-br ${p.color} hover:shadow-md transition-shadow text-foreground group`}
            >
              <span className="text-foreground/60 group-hover:text-foreground/80 transition-colors">{p.icon}</span>
              <span className="text-muted-foreground group-hover:text-foreground transition-colors line-clamp-1 text-[13px]">{p.text}</span>
            </motion.button>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );

  const renderMessages = () => (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-1">
      <AnimatePresence initial={false}>
        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          const noteMarker = !isUser ? parseNoteMarker(msg.content) : null;
          const editMarker = !isUser ? parseEditNoteMarker(msg.content) : null;
          const deleteMarker = !isUser ? parseDeleteNoteMarker(msg.content) : null;
          const memMarkers = !isUser ? parseMemoryMarker(msg.content) : [];
          const presentationMarker = !isUser ? parsePresentationMarker(msg.content) : null;
          const displayContent = stripMarkers(msg.content);
          const mermaidBlocks = !isUser ? extractMermaidBlocks(displayContent) : [];

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`py-5 ${i > 0 ? "border-t border-border/30" : ""}`}
            >
              <div className="flex gap-3.5">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    isUser
                      ? "bg-gradient-to-br from-foreground/10 to-foreground/5"
                      : "bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/10"
                  }`}
                >
                  {isUser ? <User className="h-4 w-4 text-foreground/60" /> : <Sparkles className="h-4 w-4 text-foreground/70" />}
                </motion.div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground/70 mb-2 tracking-wide uppercase">
                    {isUser ? "You" : "Oltrid AI"}
                  </p>
                  {isUser ? (
                    <div>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {msg.attachments.map((a, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-xl bg-secondary/80 border border-border/50">
                              <Paperclip className="h-3 w-3 text-muted-foreground" /> {a.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">
                        {msg.content.replace(/\[Attached file:.*?\]\n?/g, "").replace("[Web Search Mode] ", "")}
                      </p>
                    </div>
                  ) : (
                    <>
                      {mermaidBlocks.length > 0 ? (
                        <div className="space-y-3">
                          {mermaidBlocks.map((block, bi) => (
                            <div key={bi}>
                              {block.before && <div className="text-[15px] leading-relaxed prose-editor" dangerouslySetInnerHTML={{ __html: block.before }} />}
                              <MermaidDiagram chart={block.mermaid} />
                              {block.after && <div className="text-[15px] leading-relaxed prose-editor" dangerouslySetInnerHTML={{ __html: block.after }} />}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[15px] leading-relaxed prose-editor" dangerouslySetInnerHTML={{ __html: displayContent }} />
                      )}

                      {/* Action indicators */}
                      {(editMarker || deleteMarker || memMarkers.length > 0) && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {editMarker && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              <Pencil className="h-3 w-3" /> Note edited
                            </span>
                          )}
                          {deleteMarker && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                              <Trash2 className="h-3 w-3" /> Note deleted
                            </span>
                          )}
                          {memMarkers.map((m, mi) => (
                            <span key={mi} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                              <Brain className="h-3 w-3" /> Remembered: {m.key}
                            </span>
                          ))}
                        </div>
                      )}

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="flex items-center gap-1.5 mt-3 flex-wrap"
                      >
                        {noteMarker && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 rounded-xl border-border/60" onClick={() => saveAsNote(msg.content)}>
                            <StickyNote className="h-3 w-3" /> Save Note
                          </Button>
                        )}
                        {presentationMarker && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 rounded-xl border-border/60" onClick={() => saveAsPdf(msg.content)}>
                            <FileDown className="h-3 w-3" /> Save PDF
                          </Button>
                        )}
                        {isAuthenticated && (
                          <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1 rounded-xl text-muted-foreground" onClick={() => saveResponseAsFile(msg.content)}>
                            <FileDown className="h-3 w-3" /> Save to Files
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1 rounded-xl text-muted-foreground" onClick={() => downloadContent(msg.content)}>
                          <Download className="h-3 w-3" /> Download
                        </Button>
                      </motion.div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-5 border-t border-border/30">
            <div className="flex gap-3.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="h-4 w-4 text-foreground/70" />
              </div>
              <div className="pt-1">
                <p className="text-xs font-semibold text-foreground/70 mb-2 tracking-wide uppercase">Oltrid AI</p>
                <div className="flex items-center gap-1.5">
                  <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} className="w-2 h-2 rounded-full bg-foreground/30" />
                  <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} className="w-2 h-2 rounded-full bg-foreground/30" />
                  <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} className="w-2 h-2 rounded-full bg-foreground/30" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderInputArea = () => (
    <div className="shrink-0 bg-background/80 backdrop-blur-xl">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-3">
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachedFiles.map((f, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-xl bg-secondary/80 border border-border/50"
              >
                <Paperclip className="h-3 w-3 text-muted-foreground" />
                <span className="truncate max-w-[120px]">{f.name}</span>
                <button onClick={() => removeAttachment(i)} className="hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>
              </motion.span>
            ))}
          </div>
        )}

        <NoteMentionDropdown query={mentionQuery} onSelect={handleMentionSelect} visible={showMentions && isAuthenticated} />

        <div className="relative flex items-end gap-2 rounded-2xl border border-border/60 bg-secondary/20 px-3 py-2 focus-within:border-foreground/20 focus-within:shadow-[0_0_0_1px_hsl(var(--foreground)/0.08)] transition-all duration-200">
          <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80" onClick={() => fileInputRef.current?.click()} title="Attach file">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              variant={webSearchEnabled ? "secondary" : "ghost"}
              size="icon"
              className={`h-8 w-8 rounded-xl transition-all ${webSearchEnabled ? "text-foreground bg-secondary shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"}`}
              onClick={() => setWebSearchEnabled(!webSearchEnabled)}
              title="Toggle web search"
            >
              <Globe className="h-4 w-4" />
            </Button>
            <VoiceInput onTranscript={(text) => { setInput(text); setTimeout(() => send(text), 100); }} disabled={isLoading} />
          </div>

          <textarea
            ref={textareaRef}
            placeholder={webSearchEnabled ? "Search the web…" : "Message Oltrid AI… (@ to mention notes)"}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-transparent border-0 outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/50 py-1.5 min-h-[36px] max-h-[200px]"
          />

          <motion.div whileTap={{ scale: 0.9 }}>
            <Button size="icon" className="h-8 w-8 rounded-xl shrink-0 mb-0.5 transition-all" onClick={() => send()} disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </Button>
          </motion.div>
        </div>

        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileAttach} />
        <p className="text-[10px] text-muted-foreground/40 text-center mt-2">
          Oltrid AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );

  return (
    <DashboardLayout noPadding>
      <div className="h-full flex">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel defaultSize={historySidebarOpen && isAuthenticated ? 75 : 100} minSize={50}>
            <div className="h-full flex flex-col min-w-0 relative">
              {/* Top bar */}
              <div className="flex items-center justify-between px-4 md:px-6 h-13 border-b border-border/30 shrink-0 bg-background/60 backdrop-blur-md">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-foreground/10 to-foreground/5 flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-foreground/70" />
                    </div>
                    <span className="text-sm font-semibold text-foreground tracking-tight">Oltrid AI</span>
                  </div>
                  {isGuest && !user && (
                    <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full font-medium">Guest · {guestMinutesLeft}m</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearChat} className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-xl">
                      <Plus className="h-3.5 w-3.5" /> New
                    </Button>
                  )}
                  {isAuthenticated && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground" onClick={() => setHistorySidebarOpen(!historySidebarOpen)} title="Chat history">
                      {historySidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto">
                {messages.length === 0 ? renderWelcome() : renderMessages()}
              </div>

              {renderInputArea()}
            </div>
          </ResizablePanel>

          {historySidebarOpen && isAuthenticated && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={25} minSize={18} maxSize={40} className="hidden md:block">
                <ChatHistorySidebar activeId={activeConversationId} onSelect={loadConversation} onNewChat={handleNewChat} open={true} onClose={() => setHistorySidebarOpen(false)} />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        {historySidebarOpen && isAuthenticated && (
          <div className="md:hidden">
            <ChatHistorySidebar activeId={activeConversationId} onSelect={loadConversation} onNewChat={handleNewChat} open={true} onClose={() => setHistorySidebarOpen(false)} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
