import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import type { DesignElement } from "@/lib/cardDesign";
import type { CardTheme } from "@/lib/cardThemes";

export interface ElementRenderCtx {
  theme: CardTheme;
  accent: string;
  fontHeading: string;
  fontBody: string;
  /** 1 for a 1080-wide card */
  u: number;
}

const px = (n: number) => `${n}px`;

function useQr(url: string, dark: string, light: string) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url || "https://oltrid.app", { margin: 1, width: 512, color: { dark, light } })
      .then((d) => alive && setSrc(d))
      .catch(() => alive && setSrc(""));
    return () => {
      alive = false;
    };
  }, [url, dark, light]);
  return src;
}

function Qr({ el, ctx }: { el: DesignElement; ctx: ElementRenderCtx }) {
  const src = useQr(el.props.url, ctx.theme.text, "#00000000");
  return src ? (
    <img src={src} alt="QR code" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
  ) : (
    <div style={{ width: "100%", height: "100%", border: `2px dashed ${ctx.theme.border}` }} />
  );
}

function Calendar({ el, ctx }: { el: DesignElement; ctx: ElementRenderCtx }) {
  const base = el.props.month ? new Date(el.props.month) : new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const today = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month;
  const cell = el.w / 7;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: px(cell * 0.12) }}>
      <div style={{ fontFamily: ctx.fontHeading, fontSize: px(cell * 0.42), fontWeight: 700, color: ctx.theme.text }}>
        {base.toLocaleString(undefined, { month: "long", year: "numeric" })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: px(cell * 0.08), flex: 1 }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} style={{ fontFamily: ctx.fontBody, fontSize: px(cell * 0.26), color: ctx.theme.muted, textAlign: "center" }}>
            {d}
          </div>
        ))}
        {cells.map((d, i) => (
          <div
            key={i}
            style={{
              fontFamily: ctx.fontBody,
              fontSize: px(cell * 0.3),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: px(cell * 0.25),
              color: d ? ctx.theme.text : "transparent",
              background: d && isThisMonth && d === today.getDate() ? ctx.accent : "transparent",
              fontWeight: d && isThisMonth && d === today.getDate() ? 700 : 400,
            }}
          >
            {d ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function Countdown({ el, ctx }: { el: DesignElement; ctx: ElementRenderCtx }) {
  const target = el.props.target ? new Date(el.props.target).getTime() : Date.now() + 7 * 86400000;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target - now);
  const parts = [
    { v: Math.floor(diff / 86400000), l: "days" },
    { v: Math.floor(diff / 3600000) % 24, l: "hrs" },
    { v: Math.floor(diff / 60000) % 60, l: "min" },
    { v: Math.floor(diff / 1000) % 60, l: "sec" },
  ];
  const unit = el.h;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: px(unit * 0.06), height: "100%" }}>
      {el.props.label && (
        <span style={{ fontFamily: ctx.fontBody, fontSize: px(unit * 0.16), color: ctx.theme.muted }}>{el.props.label}</span>
      )}
      <div style={{ display: "flex", gap: px(unit * 0.08), flex: 1 }}>
        {parts.map((p) => (
          <div
            key={p.l}
            style={{
              flex: 1,
              borderRadius: px(unit * 0.14),
              background: ctx.theme.accentSoft,
              border: `1px solid ${ctx.theme.border}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontFamily: ctx.fontHeading, fontSize: px(unit * 0.3), fontWeight: 800, color: ctx.theme.text }}>
              {String(p.v).padStart(2, "0")}
            </span>
            <span style={{ fontFamily: ctx.fontBody, fontSize: px(unit * 0.11), color: ctx.theme.muted }}>{p.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DesignElementView({ el, ctx }: { el: DesignElement; ctx: ElementRenderCtx }) {
  const { theme, accent } = ctx;
  const s = Math.min(el.w, el.h);

  const box = (children: React.ReactNode, extra: React.CSSProperties = {}) => (
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...extra,
      }}
    >
      {children}
    </div>
  );

  const cardSurface: React.CSSProperties = {
    background: theme.cardBg,
    border: `1.5px solid ${theme.border}`,
    borderRadius: px(Math.min(40, s * 0.14)),
    padding: px(s * 0.1),
    backdropFilter: theme.glass ? "blur(18px)" : undefined,
  };

  switch (el.kind) {
    case "badge":
      return box(
        <span
          style={{
            fontFamily: ctx.fontBody,
            fontSize: px(el.h * 0.42),
            fontWeight: 700,
            color: theme.bg.startsWith("#") ? theme.bg : "#fff",
            background: accent,
            borderRadius: px(999),
            padding: `0 ${px(el.h * 0.42)}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            letterSpacing: "0.02em",
          }}
        >
          {el.props.text}
        </span>
      );

    case "ribbon":
      return box(
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            paddingLeft: px(el.h * 0.4),
            paddingRight: px(el.h * 0.9),
            background: accent,
            color: "#fff",
            fontFamily: ctx.fontBody,
            fontWeight: 700,
            fontSize: px(el.h * 0.38),
            clipPath: "polygon(0 0, 100% 0, calc(100% - 28px) 50%, 100% 100%, 0 100%)",
          }}
        >
          {el.props.text}
        </div>
      );

    case "label":
      return box(
        <span
          style={{
            fontFamily: ctx.fontBody,
            fontSize: px(el.h * 0.44),
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: accent,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            height: "100%",
          }}
        >
          {el.props.text}
        </span>
      );

    case "divider":
      return box(
        <div
          style={{
            width: "100%",
            marginTop: "auto",
            marginBottom: "auto",
            borderTop: `${px(el.props.thickness || 4)} ${el.props.style || "solid"} ${accent}`,
            opacity: 0.85,
          }}
        />
      );

    case "statBlock":
      return box(
        <>
          <span style={{ fontFamily: ctx.fontHeading, fontSize: px(el.h * 0.44), fontWeight: 800, letterSpacing: "-0.04em", color: accent, lineHeight: 1 }}>
            {el.props.value}
          </span>
          <span style={{ fontFamily: ctx.fontBody, fontSize: px(el.h * 0.14), color: theme.muted, marginTop: px(el.h * 0.08), lineHeight: 1.3 }}>
            {el.props.label}
          </span>
        </>,
        { justifyContent: "center" }
      );

    case "quoteBox":
      return box(
        <>
          <span style={{ fontFamily: "Georgia, serif", fontSize: px(el.h * 0.4), color: accent, lineHeight: 0.8, opacity: 0.55 }}>“</span>
          <span style={{ fontFamily: ctx.fontHeading, fontSize: px(el.h * 0.16), lineHeight: 1.3, color: theme.text }}>{el.props.text}</span>
          {el.props.author && (
            <span style={{ fontFamily: ctx.fontBody, fontSize: px(el.h * 0.1), color: theme.muted, marginTop: px(el.h * 0.06) }}>— {el.props.author}</span>
          )}
        </>,
        { ...cardSurface, justifyContent: "center" }
      );

    case "featureCard":
      return box(
        <>
          <div style={{ width: px(s * 0.16), height: px(s * 0.16), borderRadius: px(s * 0.05), background: theme.accentSoft, border: `2px solid ${accent}` }} />
          <span style={{ fontFamily: ctx.fontHeading, fontSize: px(el.h * 0.16), fontWeight: 700, color: theme.text, marginTop: px(el.h * 0.07) }}>
            {el.props.title}
          </span>
          <span style={{ fontFamily: ctx.fontBody, fontSize: px(el.h * 0.11), color: theme.muted, marginTop: px(el.h * 0.03), lineHeight: 1.4 }}>
            {el.props.body}
          </span>
        </>,
        { ...cardSurface, justifyContent: "center" }
      );

    case "pricingCard":
      return box(
        <>
          <span style={{ fontFamily: ctx.fontBody, fontSize: px(el.h * 0.06), letterSpacing: "0.18em", textTransform: "uppercase", color: accent, fontWeight: 600 }}>
            {el.props.plan}
          </span>
          <div style={{ display: "flex", alignItems: "flex-end", gap: px(el.h * 0.015), marginTop: px(el.h * 0.03) }}>
            <span style={{ fontFamily: ctx.fontHeading, fontSize: px(el.h * 0.2), fontWeight: 800, color: theme.text, lineHeight: 1 }}>{el.props.price}</span>
            <span style={{ fontFamily: ctx.fontBody, fontSize: px(el.h * 0.06), color: theme.muted, paddingBottom: px(el.h * 0.02) }}>{el.props.period}</span>
          </div>
          <div style={{ height: 1, background: theme.border, margin: `${px(el.h * 0.06)} 0` }} />
          {(el.props.features || []).map((f: string, i: number) => (
            <div key={i} style={{ display: "flex", gap: px(el.h * 0.03), alignItems: "center", marginBottom: px(el.h * 0.03) }}>
              <span style={{ width: px(el.h * 0.035), height: px(el.h * 0.035), borderRadius: 999, background: accent, display: "block" }} />
              <span style={{ fontFamily: ctx.fontBody, fontSize: px(el.h * 0.055), color: theme.text }}>{f}</span>
            </div>
          ))}
        </>,
        cardSurface
      );

    case "testimonial":
      return box(
        <>
          <span style={{ fontFamily: ctx.fontBody, fontSize: px(el.h * 0.13), lineHeight: 1.4, color: theme.text }}>“{el.props.text}”</span>
          <div style={{ display: "flex", alignItems: "center", gap: px(el.h * 0.05), marginTop: px(el.h * 0.08) }}>
            <div style={{ width: px(el.h * 0.17), height: px(el.h * 0.17), borderRadius: 999, background: theme.accentSoft, border: `2px solid ${accent}` }} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: ctx.fontBody, fontSize: px(el.h * 0.09), fontWeight: 700, color: theme.text }}>{el.props.name}</span>
              <span style={{ fontFamily: ctx.fontBody, fontSize: px(el.h * 0.075), color: theme.muted }}>{el.props.role}</span>
            </div>
          </div>
        </>,
        { ...cardSurface, justifyContent: "center" }
      );

    case "timeline": {
      const steps: string[] = el.props.steps || [];
      return box(
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
          {steps.map((st, i) => (
            <div key={i} style={{ display: "flex", gap: px(el.h * 0.05), alignItems: "center", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
                <div style={{ width: 2, flex: 1, background: i === 0 ? "transparent" : theme.border }} />
                <div style={{ width: px(el.h * 0.06), height: px(el.h * 0.06), borderRadius: 999, background: accent }} />
                <div style={{ width: 2, flex: 1, background: i === steps.length - 1 ? "transparent" : theme.border }} />
              </div>
              <span style={{ fontFamily: ctx.fontBody, fontSize: px(el.h * 0.1), color: theme.text }}>{st}</span>
            </div>
          ))}
        </div>
      );
    }

    case "callout": {
      const tone = el.props.tone || "info";
      const toneColor = tone === "warn" ? "#F59E0B" : tone === "success" ? "#10B981" : tone === "danger" ? "#EF4444" : accent;
      return box(
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            gap: px(el.h * 0.12),
            padding: px(el.h * 0.16),
            borderRadius: px(el.h * 0.18),
            background: theme.accentSoft,
            borderLeft: `${px(el.h * 0.05)} solid ${toneColor}`,
            boxSizing: "border-box",
          }}
        >
          <span style={{ fontFamily: ctx.fontBody, fontSize: px(el.h * 0.2), color: theme.text, lineHeight: 1.35 }}>{el.props.text}</span>
        </div>
      );
    }

    case "progress": {
      const v = Math.max(0, Math.min(100, Number(el.props.value) || 0));
      return box(
        <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: px(el.h * 0.14) }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: ctx.fontBody, fontSize: px(el.h * 0.22), color: theme.muted }}>
            <span>{el.props.label}</span>
            <span style={{ color: accent, fontWeight: 700 }}>{v}%</span>
          </div>
          <div style={{ height: px(el.h * 0.24), borderRadius: 999, background: theme.accentSoft, overflow: "hidden" }}>
            <div style={{ width: `${v}%`, height: "100%", background: accent, borderRadius: 999 }} />
          </div>
        </div>
      );
    }

    case "counter":
      return box(
        <>
          <span style={{ fontFamily: ctx.fontHeading, fontSize: px(el.h * 0.46), fontWeight: 800, color: theme.text, lineHeight: 1, letterSpacing: "-0.04em" }}>
            {el.props.prefix}
            {Number(el.props.value).toLocaleString()}
            {el.props.suffix}
          </span>
          <span style={{ fontFamily: ctx.fontBody, fontSize: px(el.h * 0.14), color: theme.muted, marginTop: px(el.h * 0.06) }}>{el.props.label}</span>
        </>,
        { justifyContent: "center" }
      );

    case "rating": {
      const v = Number(el.props.value) || 0;
      const max = Number(el.props.max) || 5;
      return box(
        <div style={{ display: "flex", alignItems: "center", gap: px(el.h * 0.12), height: "100%" }}>
          {Array.from({ length: max }).map((_, i) => {
            const fill = Math.max(0, Math.min(1, v - i));
            return (
              <div key={i} style={{ position: "relative", width: px(el.h * 0.66), height: px(el.h * 0.66) }}>
                <Star color={theme.border} size={el.h * 0.66} />
                <div style={{ position: "absolute", inset: 0, width: `${fill * 100}%`, overflow: "hidden" }}>
                  <Star color={accent} size={el.h * 0.66} />
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    case "qr":
      return box(<Qr el={el} ctx={ctx} />);

    case "calendar":
      return box(<Calendar el={el} ctx={ctx} />, cardSurface);

    case "countdown":
      return box(<Countdown el={el} ctx={ctx} />);

    case "bars": {
      const series: Array<{ label: string; value: number }> = el.props.series || [];
      const max = Math.max(1, ...series.map((d) => d.value));
      return box(
        <div style={{ display: "flex", alignItems: "flex-end", gap: px(el.w * 0.03), height: "100%" }}>
          {series.map((d, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: px(el.h * 0.03) }}>
              <span style={{ fontFamily: ctx.fontBody, fontSize: px(el.h * 0.07), color: theme.muted }}>{d.value}</span>
              <div style={{ width: "100%", height: `${(d.value / max) * 74}%`, background: accent, borderRadius: px(el.w * 0.02), opacity: 0.9 }} />
              <span style={{ fontFamily: ctx.fontBody, fontSize: px(el.h * 0.07), color: theme.muted }}>{d.label}</span>
            </div>
          ))}
        </div>
      );
    }

    case "text":
      return box(
        <span
          style={{
            fontFamily: ctx.fontHeading,
            fontSize: px(Number(el.props.size) || 46),
            fontWeight: Number(el.props.weight) || 600,
            color: el.props.color || theme.text,
            textAlign: el.props.align || "left",
            lineHeight: 1.25,
            whiteSpace: "pre-wrap",
            width: "100%",
          }}
        >
          {el.props.text}
        </span>,
        { justifyContent: "center" }
      );

    case "shape": {
      const fill = el.props.fill === "accent" ? accent : el.props.fill === "soft" ? theme.accentSoft : el.props.fill || accent;
      const shape = el.props.shape || "rect";
      const radius = shape === "circle" ? "50%" : shape === "pill" ? px(999) : px(Math.min(48, s * 0.12));
      if (shape === "triangle") {
        return box(<div style={{ width: "100%", height: "100%", background: fill, clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} />);
      }
      return box(<div style={{ width: "100%", height: "100%", background: fill, borderRadius: radius }} />);
    }

    case "image":
      return el.props.src ? (
        <img
          src={el.props.src}
          alt={el.name}
          crossOrigin="anonymous"
          style={{ width: "100%", height: "100%", objectFit: el.props.fit || "cover", borderRadius: px(Math.min(40, s * 0.08)) }}
        />
      ) : (
        box(
          <div
            style={{
              width: "100%",
              height: "100%",
              border: `2px dashed ${theme.border}`,
              borderRadius: px(24),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: theme.muted,
              fontFamily: ctx.fontBody,
              fontSize: px(Math.max(16, s * 0.09)),
            }}
          >
            Image
          </div>
        )
      );

    default:
      return null;
  }
}

function Star({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: "block" }}>
      <path d="M12 2l2.9 6.2 6.6.9-4.8 4.6 1.2 6.6L12 17.3 6.1 20.3l1.2-6.6L2.5 9.1l6.6-.9L12 2z" />
    </svg>
  );
}

/** Static overlay used both in the preview and in the offscreen export node. */
export function DesignOverlay({ elements, ctx }: { elements: DesignElement[]; ctx: ElementRenderCtx }) {
  const sorted = useMemo(() => [...elements].sort((a, b) => a.z - b.z), [elements]);
  return (
    <>
      {sorted
        .filter((e) => !e.hidden)
        .map((el) => (
          <div
            key={el.id}
            style={{
              position: "absolute",
              left: px(el.x),
              top: px(el.y),
              width: px(el.w),
              height: px(el.h),
              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
              opacity: el.opacity,
              zIndex: 10 + el.z,
            }}
          >
            <DesignElementView el={el} ctx={ctx} />
          </div>
        ))}
    </>
  );
}
