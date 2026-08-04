import { useEffect, useState } from "react";

export type SidebarFeatureKey = "files" | "codrix" | "groups" | "calendar" | "pdfEditor" | "notemaroyaar" | "smartCapture" | "scratchpad" | "secondBrain";

const STORAGE_KEY = "oltrid-sidebar-features";

const DEFAULTS: Record<SidebarFeatureKey, boolean> = {
  files: false,
  codrix: false,
  groups: false,
  calendar: false,
  pdfEditor: false,
  notemaroyaar: false,
  smartCapture: false,
  scratchpad: false,
  secondBrain: false,
};


function read(): Record<SidebarFeatureKey, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { return DEFAULTS; }
}

export function useSidebarFeatures() {
  const [features, setFeatures] = useState(read);

  useEffect(() => {
    const handler = () => setFeatures(read());
    window.addEventListener("oltrid-sidebar-features-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("oltrid-sidebar-features-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setFeature = (key: SidebarFeatureKey, value: boolean) => {
    const next = { ...features, [key]: value };
    setFeatures(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("oltrid-sidebar-features-changed"));
  };

  return { features, setFeature };
}
