import { useRef, useEffect, useState, useCallback, useMemo } from "react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: "html" | "css" | "js";
  placeholder?: string;
}

// Simple regex-based syntax highlighting (no external deps)
function highlightHTML(code: string): string {
  return code
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/(\/\/.*)/g, '<span class="hl-comment">$1</span>')
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="hl-comment">$1</span>')
    .replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="hl-tag">$2</span>')
    .replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|default|async|await|new|this|true|false|null|undefined|typeof|instanceof)\b/g, '<span class="hl-keyword">$1</span>')
    .replace(/(["'`])((?:(?!\1)[\s\S])*?)\1/g, '<span class="hl-string">$1$2$1</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');
}

function highlightCSS(code: string): string {
  return code
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>')
    .replace(/([\w-]+)(\s*:)/g, '<span class="hl-property">$1</span>$2')
    .replace(/(#[\da-fA-F]{3,8})\b/g, '<span class="hl-number">$1</span>')
    .replace(/\b(\d+\.?\d*)(px|em|rem|%|vh|vw|s|ms|deg|fr)?\b/g, '<span class="hl-number">$1$2</span>')
    .replace(/(["'])((?:(?!\1)[\s\S])*?)\1/g, '<span class="hl-string">$1$2$1</span>');
}

function highlightJS(code: string): string {
  return code
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/(\/\/.*)/g, '<span class="hl-comment">$1</span>')
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>')
    .replace(/\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|import|export|from|default|async|await|new|this|super|try|catch|finally|throw|typeof|instanceof|in|of|yield|void|delete)\b/g, '<span class="hl-keyword">$1</span>')
    .replace(/\b(true|false|null|undefined|NaN|Infinity)\b/g, '<span class="hl-number">$1</span>')
    .replace(/(["'`])((?:(?!\1)[\s\S])*?)\1/g, '<span class="hl-string">$1$2$1</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>')
    .replace(/\b([A-Z]\w*)\b/g, '<span class="hl-function">$1</span>')
    .replace(/(\w+)(\s*\()/g, '<span class="hl-function">$1</span>$2');
}

const HIGHLIGHTERS: Record<string, (code: string) => string> = {
  html: highlightHTML,
  css: highlightCSS,
  js: highlightJS,
};

export function CodeEditor({ value, onChange, language, placeholder }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const highlighted = useMemo(() => {
    const fn = HIGHLIGHTERS[language] || highlightHTML;
    return fn(value);
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
        className="absolute inset-0 p-4 font-mono text-[13px] leading-relaxed overflow-auto pointer-events-none m-0 whitespace-pre-wrap break-words"
        aria-hidden="true"
      >
        <code dangerouslySetInnerHTML={{ __html: highlighted + "\n" }} />
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
