import { useEffect, useState } from "react";

export type SidebarStyleKey = "classic" | "minimal" | "pill" | "glass" | "compact" | "underline";

export const SIDEBAR_STYLES: {
  key: SidebarStyleKey;
  label: string;
  description: string;
  item: string;
  active: string;
  inactive: string;
  shell?: string;
}[] = [
  {
    key: "classic",
    label: "Classic",
    description: "Solid highlight, rounded",
    item: "rounded-xl px-3 py-2.5 text-[13.5px] font-medium",
    active: "bg-primary text-primary-foreground font-semibold shadow-sm",
    inactive: "text-foreground/65 hover:bg-secondary hover:text-foreground",
  },
  {
    key: "minimal",
    label: "Minimal",
    description: "Text only, no fills",
    item: "rounded-lg px-3 py-2 text-[13.5px] font-medium",
    active: "text-foreground font-semibold",
    inactive: "text-foreground/45 hover:text-foreground",
  },
  {
    key: "pill",
    label: "Pill",
    description: "Full rounded soft accent",
    item: "rounded-full px-3.5 py-2.5 text-[13.5px] font-medium",
    active: "bg-primary/10 text-foreground font-semibold ring-1 ring-primary/20",
    inactive: "text-foreground/60 hover:bg-secondary/70 hover:text-foreground",
  },
  {
    key: "glass",
    label: "Glass",
    description: "Frosted translucent cards",
    item: "rounded-2xl px-3 py-2.5 text-[13.5px] font-medium backdrop-blur-md",
    active: "bg-foreground/10 text-foreground font-semibold border border-border shadow-sm",
    inactive: "text-foreground/60 hover:bg-foreground/5 hover:text-foreground border border-transparent",
    shell: "backdrop-blur-xl",
  },
  {
    key: "compact",
    label: "Compact",
    description: "Denser rows, small type",
    item: "rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium",
    active: "bg-secondary text-foreground font-semibold",
    inactive: "text-foreground/60 hover:bg-secondary/60 hover:text-foreground",
  },
  {
    key: "underline",
    label: "Marker",
    description: "Left accent bar",
    item: "rounded-r-xl px-3 py-2.5 text-[13.5px] font-medium border-l-2",
    active: "border-l-primary bg-secondary/70 text-foreground font-semibold",
    inactive: "border-l-transparent text-foreground/60 hover:bg-secondary/40 hover:text-foreground",
  },
];

const STORAGE_KEY = "oltrid-sidebar-style";
const EVENT = "oltrid-sidebar-style-changed";

function read(): SidebarStyleKey {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) as SidebarStyleKey | null;
    if (raw && SIDEBAR_STYLES.some((s) => s.key === raw)) return raw;
  } catch {
    /* ignore */
  }
  return "classic";
}

export function useSidebarStyle() {
  const [styleKey, setStyleKey] = useState<SidebarStyleKey>(read);

  useEffect(() => {
    const handler = () => setStyleKey(read());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setStyle = (key: SidebarStyleKey) => {
    setStyleKey(key);
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  };

  const style = SIDEBAR_STYLES.find((s) => s.key === styleKey) || SIDEBAR_STYLES[0];

  return { styleKey, style, setStyle };
}
