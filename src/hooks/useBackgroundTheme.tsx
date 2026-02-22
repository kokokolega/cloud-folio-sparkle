import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type BgTheme = "none" | "aurora" | "particles" | "waves" | "gradient-mesh" | "starfield" | "rain" | "matrix" | "fireflies" | "reading-warm" | "reading-cool" | "custom-image";

interface BgThemeContextType {
  bgTheme: BgTheme;
  setBgTheme: (t: BgTheme) => void;
  customImageUrl: string | null;
  setCustomImageUrl: (url: string | null) => void;
}

const BgThemeContext = createContext<BgThemeContextType>({
  bgTheme: "none",
  setBgTheme: () => {},
  customImageUrl: null,
  setCustomImageUrl: () => {},
});

export function BgThemeProvider({ children }: { children: ReactNode }) {
  const [bgTheme, setBgThemeState] = useState<BgTheme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("fylix-bg-theme") as BgTheme) || "none";
    }
    return "none";
  });

  const [customImageUrl, setCustomImageUrlState] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("fylix-bg-custom-image");
    }
    return null;
  });

  const setBgTheme = (t: BgTheme) => {
    setBgThemeState(t);
    localStorage.setItem("fylix-bg-theme", t);
  };

  const setCustomImageUrl = (url: string | null) => {
    setCustomImageUrlState(url);
    if (url) {
      localStorage.setItem("fylix-bg-custom-image", url);
    } else {
      localStorage.removeItem("fylix-bg-custom-image");
    }
  };

  return (
    <BgThemeContext.Provider value={{ bgTheme, setBgTheme, customImageUrl, setCustomImageUrl }}>
      {children}
    </BgThemeContext.Provider>
  );
}

export const useBackgroundTheme = () => useContext(BgThemeContext);
