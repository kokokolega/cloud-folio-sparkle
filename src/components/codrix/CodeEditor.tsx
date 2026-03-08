import { useRef, useEffect, useState, useCallback } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-markup";

const THEME_STYLES = `
.codrix-highlight .token.comment,
.codrix-highlight .token.prolog,
.codrix-highlight .token.doctype,
.codrix-highlight .token.cdata { color: hsl(220, 10%, 45%); font-style: italic; }

.codrix-highlight .token.punctuation { color: hsl(220, 10%, 55%); }

.codrix-highlight .token.property,
.codrix-highlight .token.tag,
.codrix-highlight .token.boolean,
.codrix-highlight .token.number,
.codrix-highlight .token.constant,
.codrix-highlight .token.symbol { color: hsl(350, 70%, 55%); }

.codrix-highlight .token.selector,
.codrix-highlight .token.attr-name,
.codrix-highlight .token.string,
.codrix-highlight .token.char,
.codrix-highlight .token.builtin { color: hsl(95, 50%, 45%); }

.codrix-highlight .token.operator,
.codrix-highlight .token.entity,
.codrix-highlight .token.url { color: hsl(35, 80%, 55%); }

.codrix-highlight .token.atrule,
.codrix-highlight .token.attr-value,
.codrix-highlight .token.keyword { color: hsl(265, 60%, 60%); }

.codrix-highlight .token.function,
.codrix-highlight .token.class-name { color: hsl(210, 70%, 55%); }

.codrix-highlight .token.regex,
.codrix-highlight .token.important,
.codrix-highlight .token.variable { color: hsl(35, 80%, 55%); }

.dark .codrix-highlight .token.comment,
.dark .codrix-highlight .token.prolog,
.dark .codrix-highlight .token.doctype,
.dark .codrix-highlight .token.cdata { color: hsl(220, 10%, 50%); }

.dark .codrix-highlight .token.punctuation { color: hsl(220, 10%, 60%); }

.dark .codrix-highlight .token.property,
.dark .codrix-highlight .token.tag,
.dark .codrix-highlight .token.boolean,
.dark .codrix-highlight .token.number,
.dark .codrix-highlight .token.constant,
.dark .codrix-highlight .token.symbol { color: hsl(350, 75%, 65%); }

.dark .codrix-highlight .token.selector,
.dark .codrix-highlight .token.attr-name,
.dark .codrix-highlight .token.string,
.dark .codrix-highlight .token.char,
.dark .codrix-highlight .token.builtin { color: hsl(95, 55%, 55%); }

.dark .codrix-highlight .token.operator,
.dark .codrix-highlight .token.entity,
.dark .codrix-highlight .token.url { color: hsl(35, 85%, 60%); }

.dark .codrix-highlight .token.atrule,
.dark .codrix-highlight .token.attr-value,
.dark .codrix-highlight .token.keyword { color: hsl(265, 65%, 70%); }

.dark .codrix-highlight .token.function,
.dark .codrix-highlight .token.class-name { color: hsl(210, 75%, 65%); }

.dark .codrix-highlight .token.regex,
.dark .codrix-highlight .token.important,
.dark .codrix-highlight .token.variable { color: hsl(35, 85%, 60%); }
`;

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: "html" | "css" | "js";
  placeholder?: string;
}

const LANG_MAP: Record<string, string> = {
  html: "markup",
  css: "css",
  js: "javascript",
};

export function CodeEditor({ value, onChange, language, placeholder }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const [styleInjected, setStyleInjected] = useState(false);

  useEffect(() => {
    if (!styleInjected) {
      const style = document.createElement("style");
      style.textContent = THEME_STYLES;
      document.head.appendChild(style);
      setStyleInjected(true);
      return () => { document.head.removeChild(style); };
    }
  }, [styleInjected]);

  const highlighted = useCallback(() => {
    const grammar = Prism.languages[LANG_MAP[language]];
    if (!grammar) return value;
    return Prism.highlight(value, grammar, LANG_MAP[language]);
  }, [value, language]);

  const syncScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  return (
    <div className="relative flex-1 overflow-hidden">
      <pre
        ref={preRef}
        className="codrix-highlight absolute inset-0 p-4 font-mono text-[13px] leading-relaxed overflow-auto pointer-events-none m-0 whitespace-pre-wrap break-words"
        aria-hidden="true"
      >
        <code dangerouslySetInnerHTML={{ __html: highlighted() + "\n" }} />
      </pre>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        className="absolute inset-0 w-full h-full p-4 bg-transparent text-transparent caret-foreground font-mono text-[13px] leading-relaxed resize-none outline-none"
        spellCheck={false}
        placeholder={placeholder}
      />
    </div>
  );
}
