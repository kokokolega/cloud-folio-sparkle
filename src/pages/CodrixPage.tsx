import { useState, useRef, useCallback, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Play, Download, Save, Plus, Trash2, FileCode2, Code2,
  Loader2, Send, Bot, Sparkles, Eye, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface CodeFile {
  id: string;
  name: string;
  language: "html" | "css" | "js";
  content: string;
}

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Hello, Codrix!</h1>
  <p>Start coding here...</p>
  <script src="script.js"></script>
</body>
</html>`;

const DEFAULT_CSS = `body {
  font-family: -apple-system, sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  margin: 0;
  background: #f5f5f7;
  color: #1d1d1f;
}

h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}`;

const DEFAULT_JS = `// Your JavaScript code here
console.log("Codrix is running!");`;

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

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
      
      // Inject CSS
      if (cssFile) {
        html = html.replace(
          /<link[^>]*rel=["']stylesheet["'][^>]*>/gi,
          `<style>${cssFile.content}</style>`
        );
        if (!html.includes("<style>")) {
          html = html.replace("</head>", `<style>${cssFile.content}</style></head>`);
        }
      }

      // Inject JS
      jsFiles.forEach(jsFile => {
        html = html.replace(
          new RegExp(`<script[^>]*src=["']${jsFile.name}["'][^>]*></script>`, "gi"),
          `<script>${jsFile.content}</script>`
        );
      });

      const blob = new Blob([html], { type: "text/html" });
      iframeRef.current.src = URL.createObjectURL(blob);
    }, 100);
  }, [files]);

  const downloadProject = () => {
    const htmlFile = files.find(f => f.language === "html");
    const cssFile = files.find(f => f.language === "css");
    const jsFiles = files.filter(f => f.language === "js");

    let html = htmlFile?.content || "";
    if (cssFile) {
      html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, `<style>${cssFile.content}</style>`);
    }
    jsFiles.forEach(jsFile => {
      html = html.replace(
        new RegExp(`<script[^>]*src=["']${jsFile.name}["'][^>]*></script>`, "gi"),
        `<script>${jsFile.content}</script>`
      );
    });

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "codrix-project.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveToFiles = async () => {
    if (!user) { toast.error("Sign in to save files"); return; }
    try {
      for (const file of files) {
        const blob = new Blob([file.content], { type: "text/plain" });
        const path = `${user.id}/codrix-${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("user-files").upload(path, blob);
        if (error) throw error;
        await supabase.from("files").insert({
          name: file.name,
          type: file.language === "html" ? "text/html" : file.language === "css" ? "text/css" : "application/javascript",
          size: blob.size,
          storage_path: path,
          user_id: user.id,
        });
      }
      toast.success("All files saved to All Files!");
    } catch (e: any) {
      toast.error("Save failed: " + e.message);
    }
  };

  const askAi = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const currentCode = files.map(f => `--- ${f.name} ---\n${f.content}`).join("\n\n");
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `You are Codrix, an AI coding assistant. The user has these files:\n\n${currentCode}\n\nUser request: ${aiPrompt}\n\nRespond with the COMPLETE updated file contents. Format each file as:\n---CODRIX_FILE:filename.ext---\n(file content)\n---END_FILE---\n\nOnly include files that changed. If creating new files, use the same format.`
            }
          ]
        }),
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
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) full += c;
          } catch { break; }
        }
      }

      // Parse AI response for file updates
      const fileRegex = /---CODRIX_FILE:(.*?)---\n([\s\S]*?)---END_FILE---/g;
      let match;
      let updated = false;
      while ((match = fileRegex.exec(full)) !== null) {
        const fileName = match[1].trim();
        const fileContent = match[2].trim();
        setFiles(prev => {
          const existing = prev.find(f => f.name === fileName);
          if (existing) {
            return prev.map(f => f.name === fileName ? { ...f, content: fileContent } : f);
          } else {
            const ext = fileName.split(".").pop()?.toLowerCase();
            const language = ext === "html" ? "html" : ext === "css" ? "css" : "js";
            return [...prev, { id: generateId(), name: fileName, language: language as any, content: fileContent }];
          }
        });
        updated = true;
      }

      if (updated) {
        toast.success("Code updated by AI!");
      } else {
        toast.info("AI responded but no code changes detected");
      }
      setAiPrompt("");
    } catch (e: any) {
      toast.error(e.message || "AI request failed");
    } finally {
      setAiLoading(false);
    }
  };

  const getLanguageIcon = (lang: string) => {
    return <FileCode2 className="h-3.5 w-3.5" />;
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-80px)] flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Codrix</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-[12px] gap-1.5" onClick={() => setShowAi(!showAi)}>
              <Sparkles className="h-3.5 w-3.5" /> AI Assist
            </Button>
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-[12px] gap-1.5" onClick={runPreview}>
              <Play className="h-3.5 w-3.5" /> Run
            </Button>
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-[12px] gap-1.5" onClick={downloadProject}>
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
            {user && (
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-[12px] gap-1.5" onClick={saveToFiles}>
                <Save className="h-3.5 w-3.5" /> Save to Files
              </Button>
            )}
          </div>
        </div>

        {/* AI Prompt Bar */}
        <AnimatePresence>
          {showAi && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3"
            >
              <div className="flex items-center gap-2 p-2 rounded-xl border border-border bg-card">
                <Bot className="h-4 w-4 text-primary shrink-0" />
                <Input
                  placeholder="Ask AI to write or modify code…"
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && askAi()}
                  className="border-0 bg-transparent h-8 text-[13px] focus-visible:ring-0"
                />
                <Button size="icon" className="h-8 w-8 rounded-lg shrink-0" onClick={askAi} disabled={aiLoading || !aiPrompt.trim()}>
                  {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex gap-3 min-h-0">
          {/* Editor Panel */}
          <div className="flex-1 flex flex-col min-w-0 border border-border rounded-xl overflow-hidden bg-card">
            {/* File tabs */}
            <div className="flex items-center border-b border-border bg-muted/30 overflow-x-auto">
              {files.map(f => (
                <button
                  key={f.id}
                  onClick={() => setActiveFileId(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border-r border-border shrink-0 transition-colors group ${
                    f.id === activeFileId ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                  }`}
                >
                  {getLanguageIcon(f.language)}
                  {f.name}
                  {files.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteFile(f.id); }}
                      className="ml-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </button>
              ))}
              <button
                onClick={addFile}
                className="flex items-center gap-1 px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Code editor */}
            <textarea
              ref={textareaRef}
              value={activeFile.content}
              onChange={(e) => updateFileContent(e.target.value)}
              className="flex-1 w-full p-4 bg-card text-foreground font-mono text-[13px] leading-relaxed resize-none outline-none"
              spellCheck={false}
              placeholder={`Write ${activeFile.language.toUpperCase()} code here...`}
            />
          </div>

          {/* Preview Panel */}
          <AnimatePresence>
            {showPreview && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "50%" }}
                exit={{ opacity: 0, width: 0 }}
                className="flex flex-col border border-border rounded-xl overflow-hidden bg-card"
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground font-medium">
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => setShowPreview(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <iframe
                  ref={iframeRef}
                  className="flex-1 w-full bg-white"
                  sandbox="allow-scripts allow-modals"
                  title="Codrix Preview"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  );
}
