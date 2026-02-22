import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type BgTheme = "none" | "aurora" | "particles" | "waves" | "gradient-mesh" | "starfield";

interface BgThemeContextType {
  bgTheme: BgTheme;
  setBgTheme: (t: BgTheme) => void;
}

const BgThemeContext = createContext<BgThemeContextType>({
  bgTheme: "none",
  setBgTheme: () => {},
});

export function BgThemeProvider({ children }: { children: ReactNode }) {
  const [bgTheme, setBgThemeState] = useState<BgTheme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("fylix-bg-theme") as BgTheme) || "none";
    }
    return "none";
  });

  const setBgTheme = (t: BgTheme) => {
    setBgThemeState(t);
    localStorage.setItem("fylix-bg-theme", t);
  };

  return (
    <BgThemeContext.Provider value={{ bgTheme, setBgTheme }}>
      {children}
    </BgThemeContext.Provider>
  );
}

export const useBackgroundTheme = () => useContext(BgThemeContext);
