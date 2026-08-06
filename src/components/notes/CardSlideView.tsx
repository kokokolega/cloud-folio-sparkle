import { forwardRef } from "react";
import type { CardSlide } from "@/lib/cardParser";
import { CardTheme, PatternId, patternStyle } from "@/lib/cardThemes";
import { OltridLogo } from "@/components/OltridLogo";

export interface CardStyleConfig {
  theme: CardTheme;
  accent: string;
  fontHeading: string;
  fontBody: string;
  pattern: PatternId;
  showLogo: boolean;
  watermark: string;
  width: number;
  height: number;
  coverImage?: string | null;
  index: number;
  total: number;
  /** global styling knobs */
  textScale?: number;
  spacingScale?: number;
  /** hide the generated body so only design elements show */
  contentHidden?: boolean;
}

const px = (n: number) => `${n}px`;

export const CardSlideView = forwardRef<
  HTMLDivElement,
  { slide: CardSlide; cfg: CardStyleConfig; overlay?: React.ReactNode }
>(function CardSlideView({ slide, cfg, overlay }, ref) {
    const { theme, accent, width, height } = cfg;
    // Scale typography relative to a 1080x1350 reference so every ratio stays balanced.
    const u = (Math.min(width, height) / 1080) * (cfg.textScale ?? 1);
    const pad = 88 * (Math.min(width, height) / 1080) * (cfg.spacingScale ?? 1);
    const isDark = ["dark", "neon", "glass", "startup"].includes(theme.id) ;

    /** Auto-fit: shrink type gracefully when a block runs long so it never overflows. */
    const fit = (text: string | undefined, comfortable: number, min = 0.6) =>
      Math.max(min, Math.min(1, Math.sqrt(comfortable / Math.max(1, (text || "").length))));

    const wrap: React.CSSProperties = { overflowWrap: "anywhere", wordBreak: "break-word" };


    const surface: React.CSSProperties = {
      background: theme.cardBg,
      border: `${Math.max(1, 1.5 * u)}px solid ${theme.border}`,
      borderRadius: px(theme.radius * u),
      backdropFilter: theme.glass ? "blur(18px)" : undefined,
    };

    const eyebrow = slide.eyebrow ? (
      <div
        style={{
          fontFamily: cfg.fontBody,
          fontSize: px(22 * u),
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: accent,
          fontWeight: 600,
          marginBottom: px(20 * u),
        }}
      >
        {slide.eyebrow.slice(0, 42)}
      </div>
    ) : null;

    const body = () => {
      switch (slide.kind) {
        case "cover":
          return (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", gap: px(28 * u) }}>
              {cfg.coverImage && (
                <img
                  src={cfg.coverImage}
                  alt=""
                  crossOrigin="anonymous"
                  style={{
                    width: "100%",
                    height: px(height * 0.3),
                    objectFit: "cover",
                    borderRadius: px(28 * u),
                    marginBottom: px(12 * u),
                  }}
                />
              )}
              <div
                style={{
                  width: px(84 * u),
                  height: px(6 * u),
                  background: accent,
                  borderRadius: px(4 * u),
                }}
              />
              <h1
                style={{
                  fontFamily: cfg.fontHeading,
                  fontSize: px(Math.min(96, 84) * u),
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                  fontWeight: 700,
                  color: theme.text,
                  margin: 0,
                }}
              >
                {slide.title}
              </h1>
              {slide.subtitle && (
                <p style={{ fontFamily: cfg.fontBody, fontSize: px(34 * u), lineHeight: 1.45, color: theme.muted, margin: 0 }}>
                  {slide.subtitle}
                </p>
              )}
            </div>
          );

        case "points":
          return (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
              {eyebrow}
              {slide.title && (
                <h2 style={{ fontFamily: cfg.fontHeading, fontSize: px(58 * u), lineHeight: 1.1, letterSpacing: "-0.02em", color: theme.text, margin: `0 0 ${px(44 * u)}` }}>
                  {slide.title}
                </h2>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: px(26 * u) }}>
                {slide.points?.map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: px(22 * u), alignItems: "flex-start", ...surface, padding: px(26 * u) }}>
                    <div
                      style={{
                        minWidth: px(46 * u),
                        height: px(46 * u),
                        borderRadius: px(14 * u),
                        background: theme.accentSoft,
                        color: accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: cfg.fontBody,
                        fontSize: px(24 * u),
                        fontWeight: 700,
                      }}
                    >
                      {i + 1}
                    </div>
                    <p style={{ fontFamily: cfg.fontBody, fontSize: px(32 * u), lineHeight: 1.35, color: theme.text, margin: 0 }}>{p}</p>
                  </div>
                ))}
              </div>
            </div>
          );

        case "paragraph":
          return (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
              {eyebrow}
              <p style={{ fontFamily: cfg.fontBody, fontSize: px(40 * u), lineHeight: 1.45, color: theme.text, margin: 0 }}>{slide.body}</p>
            </div>
          );

        case "quote":
          return (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", gap: px(28 * u) }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: px(150 * u), lineHeight: 0.7, color: accent, opacity: 0.5 }}>“</div>
              <p style={{ fontFamily: cfg.fontHeading, fontSize: px(52 * u), lineHeight: 1.3, letterSpacing: "-0.02em", color: theme.text, margin: 0 }}>
                {slide.quote}
              </p>
              {slide.attribution && (
                <p style={{ fontFamily: cfg.fontBody, fontSize: px(26 * u), color: theme.muted, margin: 0 }}>— {slide.attribution}</p>
              )}
            </div>
          );

        case "stat":
          return (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", height: "100%", gap: px(20 * u) }}>
              {eyebrow}
              <div
                style={{
                  fontFamily: cfg.fontHeading,
                  fontSize: px(170 * u),
                  lineHeight: 1,
                  fontWeight: 800,
                  letterSpacing: "-0.05em",
                  color: accent,
                }}
              >
                {slide.stat}
              </div>
              <p style={{ fontFamily: cfg.fontBody, fontSize: px(40 * u), lineHeight: 1.3, color: theme.text, margin: 0, maxWidth: "90%" }}>
                {slide.statLabel}
              </p>
            </div>
          );

        case "image":
          return (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", gap: px(28 * u) }}>
              {eyebrow}
              <img
                src={slide.imageUrl}
                alt={slide.caption || ""}
                crossOrigin="anonymous"
                style={{ width: "100%", maxHeight: px(height * 0.55), objectFit: "cover", borderRadius: px(28 * u), border: `1px solid ${theme.border}` }}
              />
              {slide.caption && (
                <p style={{ fontFamily: cfg.fontBody, fontSize: px(30 * u), lineHeight: 1.4, color: theme.muted, margin: 0 }}>{slide.caption}</p>
              )}
            </div>
          );

        case "code":
          return (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
              {eyebrow}
              <div style={{ ...surface, background: theme.codeBg, padding: px(36 * u), overflow: "hidden" }}>
                <div style={{ display: "flex", gap: px(10 * u), marginBottom: px(24 * u) }}>
                  {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
                    <span key={c} style={{ width: px(16 * u), height: px(16 * u), borderRadius: "50%", background: c, display: "block" }} />
                  ))}
                </div>
                <pre
                  style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: px(26 * u),
                    lineHeight: 1.5,
                    color: theme.text,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {slide.code?.slice(0, 900)}
                </pre>
              </div>
            </div>
          );

        case "cta":
          return (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", gap: px(26 * u), textAlign: "center" }}>
              {cfg.showLogo && (
                <div style={{ width: px(110 * u), height: px(110 * u), display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <OltridLogo className="h-full w-full" />
                </div>
              )}
              <h2 style={{ fontFamily: cfg.fontHeading, fontSize: px(62 * u), letterSpacing: "-0.03em", color: theme.text, margin: 0 }}>{slide.title}</h2>
              <p style={{ fontFamily: cfg.fontBody, fontSize: px(32 * u), color: theme.muted, margin: 0 }}>{slide.subtitle}</p>
              <div
                style={{
                  marginTop: px(14 * u),
                  padding: `${px(18 * u)} ${px(38 * u)}`,
                  borderRadius: px(999),
                  background: accent,
                  color: isDark ? "#0B0B0D" : "#FFFFFF",
                  fontFamily: cfg.fontBody,
                  fontSize: px(28 * u),
                  fontWeight: 600,
                }}
              >
                oltrid.app
              </div>
            </div>
          );
      }
    };

    return (
      <div
        ref={ref}
        style={{
          width: px(width),
          height: px(height),
          background: theme.bg,
          position: "relative",
          overflow: "hidden",
          boxSizing: "border-box",
          color: theme.text,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            ...patternStyle(cfg.pattern, isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
          }}
        />
        {theme.glow && (
          <div
            style={{
              position: "absolute",
              width: px(width * 0.9),
              height: px(width * 0.9),
              left: px(-width * 0.25),
              top: px(-width * 0.3),
              background: `radial-gradient(circle, ${accent}55 0%, transparent 65%)`,
            }}
          />
        )}
        <div style={{ position: "absolute", inset: 0, padding: px(pad), display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
          <div style={{ flex: 1, minHeight: 0, visibility: cfg.contentHidden ? "hidden" : "visible" }}>{body()}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: px(24 * u) }}>
            <div style={{ display: "flex", alignItems: "center", gap: px(14 * u) }}>
              {cfg.showLogo && slide.kind !== "cta" && (
                <div style={{ width: px(34 * u), height: px(34 * u) }}>
                  <OltridLogo className="h-full w-full" />
                </div>
              )}
              {cfg.watermark && (
                <span style={{ fontFamily: cfg.fontBody, fontSize: px(24 * u), color: theme.muted }}>{cfg.watermark}</span>
              )}
            </div>
            <span style={{ fontFamily: cfg.fontBody, fontSize: px(24 * u), color: theme.muted }}>
              {cfg.index + 1} / {cfg.total}
            </span>
          </div>
        </div>
        {overlay}
      </div>
    );
  }
);

