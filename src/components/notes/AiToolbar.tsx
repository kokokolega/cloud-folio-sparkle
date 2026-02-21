import { useState } from "react";
import { Editor } from "@tiptap/react";
import {
  Sparkles,
  FileText,
  Expand,
  Wand2,
  SpellCheck,
  ArrowDownToLine,
  Briefcase,
  SmilePlus,
  List,
  Heading,
  PenLine,
  Languages,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface AiToolbarProps {
  editor: Editor;
}

type AiAction = {
  id: string;
  label: string;
  icon: React.ElementType;
};

const ACTIONS: AiAction[] = [
  { id: "summarize", label: "Summarize", icon: FileText },
  { id: "expand", label: "Expand & elaborate", icon: Expand },
  { id: "improve", label: "Improve writing", icon: Wand2 },
  { id: "fix_grammar", label: "Fix grammar", icon: SpellCheck },
  { id: "simplify", label: "Simplify", icon: ArrowDownToLine },
  { id: "bullet_points", label: "To bullet points", icon: List },
  { id: "continue_writing", label: "Continue writing", icon: PenLine },
  { id: "generate_title", label: "Generate title", icon: Heading },
];

const TONE_ACTIONS: AiAction[] = [
  { id: "make_formal", label: "Formal", icon: Briefcase },
  { id: "make_casual", label: "Casual", icon: SmilePlus },
];

const TRANSLATE_ACTIONS: AiAction[] = [
  { id: "translate_english", label: "English", icon: Languages },
  { id: "translate_spanish", label: "Spanish", icon: Languages },
  { id: "translate_french", label: "French", icon: Languages },
  { id: "translate_hindi", label: "Hindi", icon: Languages },
];

async function streamAi(
  action: string,
  content: string,
  customPrompt?: string,
  onDelta?: (text: string) => void
): Promise<string> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ action, content, customPrompt }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "AI request failed" }));
    throw new Error(err.error || "AI request failed");
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
          onDelta?.(full);
        }
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  return full;
}

export function AiToolbar({ editor }: AiToolbarProps) {
  const [loading, setLoading] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const runAction = async (action: string, prompt?: string) => {
    const content = editor.getHTML();
    if (editor.isEmpty && action !== "continue_writing") {
      toast.error("Write something first so AI can work with it.");
      return;
    }

    setLoading(true);
    try {
      const result = await streamAi(action, content, prompt);

      if (action === "generate_title") {
        // title is plain text, handled outside editor
        toast.success(`Suggested title: ${result.trim()}`, { duration: 8000 });
      } else {
        editor.commands.setContent(result);
      }
      toast.success("AI applied successfully");
    } catch (e: any) {
      toast.error(e.message || "AI request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCustom = () => {
    if (!customPrompt.trim()) return;
    setCustomOpen(false);
    runAction("custom", customPrompt);
    setCustomPrompt("");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 rounded-lg text-[12px] text-primary hover:text-primary hover:bg-primary/10"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            AI
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {ACTIONS.map((a) => (
            <DropdownMenuItem key={a.id} onClick={() => runAction(a.id)}>
              <a.icon className="h-3.5 w-3.5 mr-2" />
              {a.label}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Briefcase className="h-3.5 w-3.5 mr-2" />
              Change tone
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {TONE_ACTIONS.map((a) => (
                <DropdownMenuItem key={a.id} onClick={() => runAction(a.id)}>
                  <a.icon className="h-3.5 w-3.5 mr-2" />
                  {a.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Languages className="h-3.5 w-3.5 mr-2" />
              Translate
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {TRANSLATE_ACTIONS.map((a) => (
                <DropdownMenuItem key={a.id} onClick={() => runAction(a.id)}>
                  {a.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setCustomOpen(true)}>
            <MessageSquare className="h-3.5 w-3.5 mr-2" />
            Custom prompt…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Custom AI prompt</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="e.g. Rewrite as a poem, Add a conclusion…"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCustom()}
            autoFocus
          />
          <DialogFooter>
            <Button size="sm" onClick={handleCustom} disabled={!customPrompt.trim()}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
