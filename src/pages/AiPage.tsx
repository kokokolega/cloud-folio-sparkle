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
  NotebookPen, MessageCircle, Workflow, Globe2, ChevronDown, Sparkles,
  FileText, Image, Code, ListChecks,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VoiceInput } from "@/components/ai/VoiceInput";
import { ChatHistorySidebar } from "@/components/ai/ChatHistorySidebar";
import { NoteMentionDropdown } from "@/components/ai/NoteMentionDropdown";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MermaidDiagram } from "@/components/ai/MermaidDiagram";
import { PresentationEditor } from "@/components/ai/PresentationEditor";
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

const AI_FEATURES = [
  { label: "General", icon: <MessageCircle className="h-4 w-4" />, prefill: "" },
  { label: "Create Note", icon: <NotebookPen className="h-4 w-4" />, prefill: "Create a new note about " },
  { label: "Web Search", icon: <Globe2 className="h-4 w-4" />, prefill: "" },
  { label: "Flowchart", icon: <Workflow className="h-4 w-4" />, prefill: "Draw a flowchart for " },
  { label: "Summarize", icon: <Brain className="h-4 w-4" />, prefill: "Summarize my notes" },
  { label: "Edit Note", icon: <Pencil className="h-4 w-4" />, prefill: "Edit my note " },
  { label: "Code Help", icon: <Code className="h-4 w-4" />, prefill: "Help me write code for " },
  { label: "To-Do List", icon: <ListChecks className="h-4 w-4" />, prefill: "Create a checklist for " },
];

const QUICK_PROMPTS = [
  { icon: <NotebookPen className="h-5 w-5" />, text: "Create note", prompt: "Create a new note", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" },
  { icon: <Globe2 className="h-5 w-5" />, text: "Search web", prompt: "Search the web", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" },
  { icon: <Workflow className="h-5 w-5" />, text: "Flowchart", prompt: "Draw a flowchart", color: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300" },
  { icon: <Brain className="h-5 w-5" />, text: "Summarize", prompt: "Summarize my notes", color: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300" },
];

const RESPONSE_STYLES = [
  { id: "default", label: "Default", instruction: "" },
  { id: "article", label: "Article", instruction: "Format the entire response as a long-form magazine article with an <h2> title, a lead paragraph in <em>, <h3> section headings, multiple short body paragraphs, and a closing reflection." },
  { id: "newspaper", label: "Newspaper", instruction: "Format the response as a newspaper front page: an all-caps masthead-style <h2> title, a bold one-line subhead, a dateline, and 2-3 column-style sections with <h3> bylines and tight punchy paragraphs." },
  { id: "blog", label: "Blog Post", instruction: "Format as a friendly conversational blog post with an engaging <h2> title, a hook intro, <h3> sections, bullet lists where useful, and a takeaway conclusion." },
  { id: "academic", label: "Academic Paper", instruction: "Format as an academic paper with: <h2> title, an <h3>Abstract</h3>, <h3>Introduction</h3>, <h3>Discussion</h3>, <h3>Conclusion</h3>, formal tone, and <blockquote> for key claims." },
  { id: "report", label: "Executive Report", instruction: "Format as a business executive report: <h2> title, <h3>Summary</h3>, <h3>Key Findings</h3> with bullet list, <h3>Recommendations</h3> with numbered list, concise and decisive tone." },
  { id: "story", label: "Story / Narrative", instruction: "Format as a narrative short story with vivid scene-setting, characters, dialogue in <em>, and a satisfying arc. No headings — use paragraphs and pacing." },
  { id: "tutorial", label: "Step-by-Step Tutorial", instruction: "Format as a numbered step-by-step tutorial with <h2> title, <h3>What you'll need</h3>, then <h3>Step 1</h3>, <h3>Step 2</h3>… each with code blocks or images placeholders, and a <h3>Wrap up</h3>." },
  { id: "qa", label: "Q&A Interview", instruction: "Format as a Q&A interview: bold the questions and use plain paragraphs for the answers, with an <h2> title and a short <em>intro</em>." },
  { id: "letter", label: "Personal Letter", instruction: "Format as a personal letter with a date, salutation, warm flowing paragraphs, and a sign-off — no headings." },
  { id: "bullet", label: "Bullet Brief", instruction: "Format as a tight bullet brief: <h2> title and a single nested bullet list — no paragraphs, no fluff." },
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
  const [selectedFeature, setSelectedFeature] = useState("General");
  const [selectedStyle, setSelectedStyle] = useState("default");
  const [userNotes, setUserNotes] = useState<NoteData[]>([]);
  const [userMemory, setUserMemory] = useState<MemoryData[]>([]);
  const [conversationHistory, setConversationHistory] = useState<{ title: string; messages: { role: string; content: string }[] }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingPresentation, setEditingPresentation] = useState<{ idx: number; content: string } | null>(null);

  const isAuthenticated = !!user;

  useEffect(() => {
    if (!user) return;
    const loadContext = async () => {
      const [notesRes, memRes, convsRes] = await Promise.all([
        supabase.from("notes").select("id, title, content, color, pinned, updated_at").eq("user_id", user.id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(100),
        supabase.from("ai_memory").select("id, key, value").eq("user_id", user.id).limit(100),
        supabase.from("ai_conversations").select("id, title").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(20),
      ]);
      if (notesRes.data) setUserNotes(notesRes.data);
      if (memRes.data) setUserMemory(memRes.data);
      if (convsRes.data && convsRes.data.length > 0) {
        const historyPromises = convsRes.data.slice(0, 10).map(async (conv) => {
          const { data: msgs } = await supabase
            .from("ai_messages").select("role, content").eq("conversation_id", conv.id).order("created_at", { ascending: true }).limit(10);
          return { title: conv.title, messages: (msgs || []).map(m => ({ role: m.role, content: m.content.slice(0, 300) })) };
        });
        const history = await Promise.all(historyPromises);
        setConversationHistory(history.filter(h => h.messages.length > 0));
      }
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

  // Autofocus textarea on mount
  useEffect(() => {
    if (textareaRef.current) textareaRef.current.focus();
  }, []);

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
    if (data) {
      setMessages(data as Msg[]);
      setActiveConversationId(id);
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    }
  }, []);

  const processAiActions = useCallback(async (responseContent: string) => {
    if (!user) return;
    const editMarker = parseEditNoteMarker(responseContent);
    if (editMarker) {
      try {
        const { error } = await supabase.from("notes").update({ title: editMarker.title, content: editMarker.content }).eq("id", editMarker.id).eq("user_id", user.id);
        if (error) throw error;
        toast.success(`Note "${editMarker.title}" updated!`);
        const { data } = await supabase.from("notes").select("id, title, content, color, pinned, updated_at").eq("user_id", user.id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(100);
        if (data) setUserNotes(data);
      } catch (e: any) { toast.error("Failed to edit note: " + e.message); }
    }
    const deleteMarker = parseDeleteNoteMarker(responseContent);
    if (deleteMarker) {
      try {
        const { error } = await supabase.from("notes").update({ deleted_at: new Date().toISOString() }).eq("id", deleteMarker.id).eq("user_id", user.id);
        if (error) throw error;
        toast.success("Note moved to trash!");
        setUserNotes(prev => prev.filter(n => n.id !== deleteMarker.id));
      } catch (e: any) { toast.error("Failed to delete note: " + e.message); }
    }
    const memoryMarkers = parseMemoryMarker(responseContent);
    for (const mem of memoryMarkers) {
      try {
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
        conversationHistory: conversationHistory,
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
  }, [webSearchEnabled, userNotes, userMemory, conversationHistory]);

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
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:system-ui,sans-serif;padding:2rem;max-width:800px;margin:0 auto;line-height:1.6}h1,h2,h3{margin-top:1.5em}ul,ol{padding-left:1.5em}</style></head><body>${cleanContent}</body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const saveResponseAsFile = async (content: string) => {
    if (!user) return;
    const cleanContent = stripMarkers(content);
    const blob = new Blob([cleanContent], { type: "text/markdown" });
    const file = new File([blob], `ai-response-${Date.now()}.md`, { type: "text/markdown" });
    const path = `${user.id}/${file.name}`;
    try {
      const { error: uploadError } = await supabase.storage.from("user-files").upload(path, file);
      if (uploadError) throw uploadError;
      await supabase.from("files").insert({ name: file.name, storage_path: path, type: file.type, size: file.size, user_id: user.id });
      toast.success("Saved to files!");
    } catch (e: any) { toast.error("Failed to save: " + e.message); }
  };

  const downloadContent = (content: string) => {
    const cleanContent = stripMarkers(content);
    const blob = new Blob([cleanContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ai-response-${Date.now()}.md`; a.click();
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
        className="text-center max-w-xl w-full"
      >
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight leading-[1.1]"
        >
          Welcome to Oltrid
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-base text-muted-foreground mb-10 max-w-md mx-auto leading-relaxed"
        >
          Get started by sending a task and Chat can do the rest. Not sure where to start?
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="grid grid-cols-2 gap-3 max-w-lg mx-auto"
        >
          {QUICK_PROMPTS.map((p, i) => (
            <motion.button
              key={p.text}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.06 }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => send(p.prompt)}
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border/50 bg-card hover:shadow-lg transition-all duration-200 group text-left"
            >
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${p.color}`}>
                {p.icon}
              </div>
              <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground">{p.text}</span>
              <Plus className="h-4 w-4 text-muted-foreground/40 ml-auto shrink-0 group-hover:text-muted-foreground" />
            </motion.button>
          ))}
        </motion.div>

        {isAuthenticated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground/50 mt-8"
          >
            <span className="flex items-center gap-1"><StickyNote className="h-3 w-3" /> {userNotes.length} notes</span>
            <span className="flex items-center gap-1"><Brain className="h-3 w-3" /> {userMemory.length} memories</span>
          </motion.div>
        )}
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
                  {isUser ? <User className="h-4 w-4 text-foreground/60" /> : <Bot className="h-4 w-4 text-foreground/70" />}
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
                          <>
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 rounded-xl border-border/60" onClick={() => setEditingPresentation({ idx: i, content: stripMarkers(msg.content) })}>
                              <Pencil className="h-3 w-3" /> Edit
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 rounded-xl border-border/60" onClick={() => saveAsPdf(msg.content)}>
                              <FileDown className="h-3 w-3" /> Save PDF
                            </Button>
                          </>
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
                <Bot className="h-4 w-4 text-foreground/70" />
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
    <div className="shrink-0 px-3 md:px-6 pb-3 md:pb-5 pt-2">
      <div className="max-w-3xl mx-auto">
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

        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_8px_-2px_hsl(0_0%_0%/0.06)] focus-within:border-foreground/15 focus-within:shadow-[0_2px_16px_-4px_hsl(0_0%_0%/0.1)] transition-all duration-200">
          {/* Textarea row */}
          <div className="px-4 pt-3 pb-2">
            <textarea
              ref={textareaRef}
              placeholder={webSearchEnabled ? "Search the web…" : "How can I help you today?"}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              disabled={isLoading}
              rows={1}
              className="w-full bg-transparent border-0 outline-none resize-none text-[15px] text-foreground placeholder:text-muted-foreground/50 min-h-[28px] max-h-[200px]"
            />
          </div>

          {/* Bottom toolbar inside the card */}
          <div className="flex items-center justify-between px-3 pb-2.5">
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground/50 hover:text-foreground" onClick={() => fileInputRef.current?.click()} title="Attach file">
                <Plus className="h-4.5 w-4.5" />
              </Button>
              <Button
                variant={webSearchEnabled ? "secondary" : "ghost"}
                size="icon"
                className={`h-8 w-8 rounded-lg ${webSearchEnabled ? "text-foreground" : "text-muted-foreground/50 hover:text-foreground"}`}
                onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                title="Browse Web"
              >
                <Globe className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 rounded-lg text-[12px] text-muted-foreground/60 hover:text-foreground gap-1 px-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{selectedFeature}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {AI_FEATURES.map((feature) => (
                    <DropdownMenuItem
                      key={feature.label}
                      onClick={() => {
                        setSelectedFeature(feature.label);
                        if (feature.prefill) {
                          setInput(feature.prefill);
                        }
                        if (feature.label === "Web Search") {
                          setWebSearchEnabled(true);
                        } else {
                          setWebSearchEnabled(false);
                        }
                      }}
                      className="gap-2 text-[13px]"
                    >
                      {feature.icon}
                      {feature.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <VoiceInput onTranscript={(text) => { setInput(text); setTimeout(() => send(text), 100); }} disabled={isLoading} />
              {(input.trim() || attachedFiles.length > 0) && (
                <motion.div whileTap={{ scale: 0.9 }} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                  <Button size="icon" className="h-8 w-8 rounded-xl shrink-0" onClick={() => send()} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileAttach} />
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
              <div className="flex items-center justify-between px-4 md:px-6 h-14 border-b border-border/40 shrink-0 bg-background/80 backdrop-blur-sm">
                <div className="flex items-center gap-2.5">
                  <span className="text-[15px] font-semibold text-foreground tracking-tight">Oltrid AI</span>
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

              <div ref={scrollRef} className="flex-1 overflow-y-auto pb-40">
                {messages.length === 0 ? renderWelcome() : renderMessages()}
              </div>

              <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
                <div className="pointer-events-auto bg-gradient-to-t from-background via-background/95 to-transparent pt-8">
                  {renderInputArea()}
                </div>
              </div>
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
      <PresentationEditor
        open={!!editingPresentation}
        onOpenChange={(o) => !o && setEditingPresentation(null)}
        initialContent={editingPresentation?.content || ""}
        onSave={(newContent) => {
          if (editingPresentation == null) return;
          setMessages((prev) => prev.map((m, i) => i === editingPresentation.idx ? { ...m, content: newContent + "\n<!--OLTRID_PRESENTATION:{\"title\":\"Edited Presentation\"}-->" } : m));
          toast.success("Presentation updated");
        }}
      />
    </DashboardLayout>
  );
}
