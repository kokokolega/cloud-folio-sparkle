import { useState, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Play, Download, Save, Plus, Trash2, FileCode2, Code2,
  Loader2, Send, Sparkles, Eye, X, ArrowUp,
} from "lucide-react";
import { CodeEditor } from "@/components/codrix/CodeEditor";
import { motion, AnimatePresence } from "framer-motion";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface CodeFile {
  id: string;
  name: string;
  language: "html" | "css" | "js";
  content: string;
}

const DEFAULT_HTML = `<!DOCTYPE html>\n<html>\n<head>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello, Codrix!</h1>\n  <p>Start coding here...</p>\n  <script src="script.js"></script>\n</body>\n</html>`;
const DEFAULT_CSS = `body {\n  font-family: -apple-system, sans-serif;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  min-height: 100vh;\n  margin: 0;\n  background: #f5f5f7;\n  color: #1d1d1f;\n}\n\nh1 {\n  font-size: 2rem;\n  margin-bottom: 0.5rem;\n}`;
const DEFAULT_JS = `// Your JavaScript code here\nconsole.log("Codrix is running!");`;

function generateId() { return Math.random().toString(36).slice(2, 10); }

export default function CodrixPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<CodeFile[]>([
    { id: generateId(), name: "index.html", language: "html", content: DEFAULT_HTML },
    { id: generateId(), name: "style.css", language: "css", content: DEFAULT_CSS },
    { id: generateId(), name: "script.js", language: "js", content: DEFAULT_JS },
  ]);
  const [activeFileId, setActiveFileId] = useState(files[0].id);
  const [showPreview, setShowPreview] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeFile = files.find(f => f.id === activeFileId) || files[0];

  const updateFileContent = (content: string) => {
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content } : f));
  };

  const addFile = () => {
    const name = prompt("File name (e.g. utils.js):");
    if (!name) return;
    const ext = name.split(".").pop()?.toLowerCase();
    const language = ext === "html" ? "html" : ext === "css" ? "css" : "js";
    const newFile: CodeFile = { id: generateId(), name, language, content: "" };
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
  };

  const deleteFile = (id: string) => {
    if (files.length <= 1) { toast.error("Need at least one file"); return; }
    setFiles(prev => prev.filter(f => f.id !== id));
    if (activeFileId === id) setActiveFileId(files[0].id);
  };

  const runPreview = useCallback(() => {
    setShowPreview(true);
    setTimeout(() => {
      if (!iframeRef.current) return;
      const htmlFile = files.find(f => f.language === "html");
      const cssFile = files.find(f => f.language === "css");
      const jsFiles = files.filter(f => f.language === "js");
      let html = htmlFile?.content || "<html><body></body></html>";
      if (cssFile) {
        html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, `<style>${cssFile.content}</style>`);
        if (!html.includes("<style>")) html = html.replace("</head>", `<style>${cssFile.content}</style></head>`);
      }
      jsFiles.forEach(jsFile => {
        html = html.replace(new RegExp(`<script[^>]*src=["']${jsFile.name}["'][^>]*></script>`, "gi"), `<script>${jsFile.content}</script>`);
      });
      iframeRef.current.src = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    }, 100);
  }, [files]);

  const downloadProject = () => {
    const htmlFile = files.find(f => f.language === "html");
    const cssFile = files.find(f => f.language === "css");
    const jsFiles = files.filter(f => f.language === "js");
    let html = htmlFile?.content || "";
    if (cssFile) html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, `<style>${cssFile.content}</style>`);
    jsFiles.forEach(jsFile => { html = html.replace(new RegExp(`<script[^>]*src=["']${jsFile.name}["'][^>]*></script>`, "gi"), `<script>${jsFile.content}</script>`); });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = "codrix-project.html";
    a.click();
  };

  const saveToFiles = async () => {
    if (!user) { toast.error("Sign in to save files"); return; }
    try {
      for (const file of files) {
        const blob = new Blob([file.content], { type: "text/plain" });
        const path = `${user.id}/codrix-${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("user-files").upload(path, blob);
        if (error) throw error;
        await supabase.from("files").insert({ name: file.name, type: file.language === "html" ? "text/html" : file.language === "css" ? "text/css" : "application/javascript", size: blob.size, storage_path: path, user_id: user.id });
      }
      toast.success("Files saved!");
    } catch (e: any) { toast.error("Save failed: " + e.message); }
  };

  const askAi = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const currentCode = files.map(f => `--- ${f.name} ---\n${f.content}`).join("\n\n");
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ messages: [{ role: "user", content: `You are Codrix, an AI coding assistant. The user has these files:\n\n${currentCode}\n\nUser request: ${aiPrompt}\n\nRespond with the COMPLETE updated file contents. Format each file as:\n---CODRIX_FILE:filename.ext---\n(file content)\n---END_FILE---\n\nOnly include files that changed.` }] }),
      });
      if (!resp.ok) throw new Error("AI request failed");
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx); buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try { const parsed = JSON.parse(json); const c = parsed.choices?.[0]?.delta?.content; if (c) full += c; } catch { break; }
        }
      }
      const fileRegex = /---CODRIX_FILE:(.*?)---\n([\s\S]*?)---END_FILE---/g;
      let match; let updated = false;
      while ((match = fileRegex.exec(full)) !== null) {
        const fileName = match[1].trim(); const fileContent = match[2].trim();
        setFiles(prev => {
          const existing = prev.find(f => f.name === fileName);
          if (existing) return prev.map(f => f.name === fileName ? { ...f, content: fileContent } : f);
          const ext = fileName.split(".").pop()?.toLowerCase();
          return [...prev, { id: generateId(), name: fileName, language: (ext === "html" ? "html" : ext === "css" ? "css" : "js") as any, content: fileContent }];
        });
        updated = true;
      }
      if (updated) toast.success("Code updated!"); else toast.info("AI responded but no code changes detected");
      setAiPrompt("");
    } catch (e: any) { toast.error(e.message || "AI request failed"); } finally { setAiLoading(false); }
  };


  return (
    <DashboardLayout noPadding>
      <div className="h-screen flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0 gap-2">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Codrix</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant={showAi ? "secondary" : "ghost"} size="sm" className="h-7 rounded-lg text-[11px] gap-1" onClick={() => setShowAi(!showAi)}>
              <Sparkles className="h-3 w-3" /> AI
            </Button>
            <Button variant={showImageGen ? "secondary" : "ghost"} size="sm" className="h-7 rounded-lg text-[11px] gap-1" onClick={() => setShowImageGen(!showImageGen)}>
              <ImagePlus className="h-3 w-3" /> Image
            </Button>
            <Button variant="ghost" size="sm" className="h-7 rounded-lg text-[11px] gap-1" onClick={runPreview}>
              <Play className="h-3 w-3" /> Run
            </Button>
            <Button variant="ghost" size="sm" className="h-7 rounded-lg text-[11px] gap-1" onClick={downloadProject}>
              <Download className="h-3 w-3" />
            </Button>
            {user && (
              <Button variant="ghost" size="sm" className="h-7 rounded-lg text-[11px] gap-1" onClick={saveToFiles}>
                <Save className="h-3 w-3" /> Save
              </Button>
            )}
          </div>
        </div>

        {/* AI Bar */}
        <AnimatePresence>
          {showAi && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="border-b border-border">
              <div className="flex items-center gap-2 px-4 py-2">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  placeholder="Ask AI to write or modify code…"
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && askAi()}
                  className="flex-1 bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
                />
                <Button size="icon" className="h-7 w-7 rounded-lg shrink-0" onClick={askAi} disabled={aiLoading || !aiPrompt.trim()}>
                  {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUp className="h-3 w-3" />}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex min-h-0">
          {/* Editor */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center border-b border-border bg-secondary/30 overflow-x-auto">
              {files.map(f => (
                <button key={f.id} onClick={() => setActiveFileId(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-r border-border shrink-0 transition-colors group ${
                    f.id === activeFileId ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  }`}>
                  <FileCode2 className="h-3 w-3" />
                  {f.name}
                  {files.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); deleteFile(f.id); }} className="ml-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </button>
              ))}
              <button onClick={addFile} className="flex items-center px-2.5 py-2 text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <CodeEditor
              value={activeFile.content}
              onChange={updateFileContent}
              language={activeFile.language}
              placeholder={`Write ${activeFile.language.toUpperCase()} code here...`}
            />
          </div>

          {/* Preview */}
          <AnimatePresence>
            {showPreview && (
              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "50%" }} exit={{ opacity: 0, width: 0 }} className="flex flex-col border-l border-border">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30">
                  <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1"><Eye className="h-3 w-3" /> Preview</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 rounded" onClick={() => setShowPreview(false)}><X className="h-3 w-3" /></Button>
                </div>
                <iframe ref={iframeRef} className="flex-1 w-full bg-white" sandbox="allow-scripts allow-modals" title="Codrix Preview" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Image Generator Panel */}
          <AnimatePresence>
            {showImageGen && (
              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 320 }} exit={{ opacity: 0, width: 0 }} className="flex flex-col border-l border-border bg-background shrink-0 overflow-hidden">
                <ImageGenerator onInsert={handleImageInsert} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  );
}
