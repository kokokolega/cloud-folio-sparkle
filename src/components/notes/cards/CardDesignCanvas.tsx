import { useCallback, useEffect, useRef, useState } from "react";
import type { DesignElement, Guide } from "@/lib/cardDesign";

interface Props {
  width: number;
  height: number;
  scale: number;
  elements: DesignElement[];
  selectedIds: string[];
  guides: Guide[];
  showRulers: boolean;
  showGrid: boolean;
  onSelect: (ids: string[]) => void;
  onChange: (els: DesignElement[], commit: boolean) => void;
  onGuidesChange: (g: Guide[]) => void;
  children: React.ReactNode;
}

const RULER = 18;
const SNAP = 8;

type Drag =
  | { type: "move"; startX: number; startY: number; origin: Record<string, { x: number; y: number }> }
  | { type: "resize"; handle: string; startX: number; startY: number; origin: DesignElement }
  | { type: "guide"; axis: "x" | "y"; id: string }
  | null;

export function CardDesignCanvas({
  width,
  height,
  scale,
  elements,
  selectedIds,
  guides,
  showRulers,
  showGrid,
  onSelect,
  onChange,
  onGuidesChange,
  children,
}: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag>(null);
  const [snapLines, setSnapLines] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });

  const toCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = surfaceRef.current!.getBoundingClientRect();
      return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
    },
    [scale]
  );

  const snapTargets = useCallback(
    (ignore: string[]) => {
      const xs = [0, width / 2, width, ...guides.filter((g) => g.axis === "x").map((g) => g.pos)];
      const ys = [0, height / 2, height, ...guides.filter((g) => g.axis === "y").map((g) => g.pos)];
      elements
        .filter((e) => !ignore.includes(e.id) && !e.hidden)
        .forEach((e) => {
          xs.push(e.x, e.x + e.w / 2, e.x + e.w);
          ys.push(e.y, e.y + e.h / 2, e.y + e.h);
        });
      return { xs, ys };
    },
    [elements, guides, width, height]
  );

  const applySnap = (val: number, targets: number[], tol: number) => {
    let best: number | null = null;
    let dist = tol;
    for (const t of targets) {
      const d = Math.abs(t - val);
      if (d <= dist) {
        dist = d;
        best = t;
      }
    }
    return best;
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const p = toCanvas(e.clientX, e.clientY);
      const tol = SNAP / scale;

      if (drag.type === "guide") {
        onGuidesChange(
          guides.map((g) => (g.id === drag.id ? { ...g, pos: Math.round(drag.axis === "x" ? p.x : p.y) } : g))
        );
        return;
      }

      if (drag.type === "move") {
        const dx = p.x - drag.startX;
        const dy = p.y - drag.startY;
        const ids = Object.keys(drag.origin);
        const { xs, ys } = snapTargets(ids);
        // snap using the first selected element's edges
        const lead = elements.find((el) => el.id === ids[0]);
        let adjX = 0;
        let adjY = 0;
        const lines: { x: number[]; y: number[] } = { x: [], y: [] };
        if (lead && !e.altKey) {
          const o = drag.origin[lead.id];
          const cand = [o.x + dx, o.x + dx + lead.w / 2, o.x + dx + lead.w];
          for (let i = 0; i < cand.length; i++) {
            const s = applySnap(cand[i], xs, tol);
            if (s !== null) {
              adjX = s - cand[i];
              lines.x.push(s);
              break;
            }
          }
          const candY = [o.y + dy, o.y + dy + lead.h / 2, o.y + dy + lead.h];
          for (let i = 0; i < candY.length; i++) {
            const s = applySnap(candY[i], ys, tol);
            if (s !== null) {
              adjY = s - candY[i];
              lines.y.push(s);
              break;
            }
          }
        }
        setSnapLines(lines);
        onChange(
          elements.map((el) =>
            drag.origin[el.id] && !el.locked
              ? { ...el, x: Math.round(drag.origin[el.id].x + dx + adjX), y: Math.round(drag.origin[el.id].y + dy + adjY) }
              : el
          ),
          false
        );
        return;
      }

      if (drag.type === "resize") {
        const o = drag.origin;
        const dx = p.x - drag.startX;
        const dy = p.y - drag.startY;
        let { x, y, w, h } = o;
        if (drag.handle.includes("e")) w = Math.max(24, o.w + dx);
        if (drag.handle.includes("s")) h = Math.max(24, o.h + dy);
        if (drag.handle.includes("w")) {
          w = Math.max(24, o.w - dx);
          x = o.x + (o.w - w);
        }
        if (drag.handle.includes("n")) {
          h = Math.max(24, o.h - dy);
          y = o.y + (o.h - h);
        }
        if (e.shiftKey) {
          const ratio = o.w / o.h;
          h = Math.round(w / ratio);
        }
        onChange(
          elements.map((el) =>
            el.id === o.id ? { ...el, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) } : el
          ),
          false
        );
      }
    };

    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setSnapLines({ x: [], y: [] });
      onChange(elements, true);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [elements, guides, onChange, onGuidesChange, scale, snapTargets, toCanvas]);

  const startMove = (e: React.PointerEvent, el: DesignElement) => {
    if (el.locked) return;
    e.stopPropagation();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    const ids = additive
      ? selectedIds.includes(el.id)
        ? selectedIds.filter((i) => i !== el.id)
        : [...selectedIds, el.id]
      : selectedIds.includes(el.id)
        ? selectedIds
        : [el.id];
    onSelect(ids);
    const p = toCanvas(e.clientX, e.clientY);
    const origin: Record<string, { x: number; y: number }> = {};
    elements.filter((x) => ids.includes(x.id) && !x.locked).forEach((x) => (origin[x.id] = { x: x.x, y: x.y }));
    dragRef.current = { type: "move", startX: p.x, startY: p.y, origin };
  };

  const startResize = (e: React.PointerEvent, el: DesignElement, handle: string) => {
    e.stopPropagation();
    const p = toCanvas(e.clientX, e.clientY);
    dragRef.current = { type: "resize", handle, startX: p.x, startY: p.y, origin: { ...el } };
  };

  const addGuide = (axis: "x" | "y", clientPos: number) => {
    const rect = surfaceRef.current!.getBoundingClientRect();
    const pos = Math.round(((axis === "x" ? clientPos - rect.left : clientPos - rect.top)) / scale);
    const id = `g-${Date.now()}`;
    onGuidesChange([...guides, { id, axis, pos }]);
    dragRef.current = { type: "guide", axis, id };
  };

  const ticks = (axis: "x" | "y") => {
    const len = axis === "x" ? width : height;
    const step = 100;
    const out: React.ReactNode[] = [];
    for (let v = 0; v <= len; v += step) {
      out.push(
        <div
          key={v}
          style={{
            position: "absolute",
            [axis === "x" ? "left" : "top"]: v * scale,
            [axis === "x" ? "top" : "left"]: 0,
            [axis === "x" ? "height" : "width"]: "100%",
            display: "flex",
            alignItems: axis === "x" ? "flex-end" : "center",
            justifyContent: axis === "x" ? "flex-start" : "flex-end",
            fontSize: 8,
            lineHeight: 1,
            paddingLeft: axis === "x" ? 2 : 0,
            paddingRight: axis === "y" ? 2 : 0,
            borderLeft: axis === "x" ? "1px solid currentColor" : undefined,
            borderTop: axis === "y" ? "1px solid currentColor" : undefined,
            opacity: 0.6,
          } as React.CSSProperties}
        >
          {v}
        </div>
      );
    }
    return out;
  };

  return (
    <div className="relative" style={{ paddingLeft: showRulers ? RULER : 0, paddingTop: showRulers ? RULER : 0 }}>
      {showRulers && (
        <>
          <div
            className="absolute text-muted-foreground bg-muted/60 cursor-ns-resize select-none"
            style={{ left: RULER, top: 0, width: width * scale, height: RULER }}
            onPointerDown={(e) => addGuide("y", e.clientY)}
          >
            <div className="relative h-full w-full overflow-hidden">{ticks("x")}</div>
          </div>
          <div
            className="absolute text-muted-foreground bg-muted/60 cursor-ew-resize select-none"
            style={{ left: 0, top: RULER, width: RULER, height: height * scale }}
            onPointerDown={(e) => addGuide("x", e.clientX)}
          >
            <div className="relative h-full w-full overflow-hidden">{ticks("y")}</div>
          </div>
        </>
      )}

      <div
        ref={surfaceRef}
        className="relative overflow-hidden rounded-lg shadow-xl"
        style={{ width: width * scale, height: height * scale }}
        onPointerDown={() => onSelect([])}
      >
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>

        {showGrid && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0,0,0,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.08) 1px, transparent 1px)",
              backgroundSize: `${60 * scale}px ${60 * scale}px`,
            }}
          />
        )}

        {/* guides */}
        {guides.map((g) => (
          <div
            key={g.id}
            onPointerDown={(e) => {
              e.stopPropagation();
              dragRef.current = { type: "guide", axis: g.axis, id: g.id };
            }}
            onDoubleClick={() => onGuidesChange(guides.filter((x) => x.id !== g.id))}
            className="absolute bg-cyan-500/70"
            style={
              g.axis === "x"
                ? { left: g.pos * scale, top: 0, width: 1, height: "100%", cursor: "ew-resize" }
                : { top: g.pos * scale, left: 0, height: 1, width: "100%", cursor: "ns-resize" }
            }
          />
        ))}

        {/* snap lines */}
        {snapLines.x.map((v, i) => (
          <div key={`sx${i}`} className="pointer-events-none absolute bg-pink-500" style={{ left: v * scale, top: 0, width: 1, height: "100%" }} />
        ))}
        {snapLines.y.map((v, i) => (
          <div key={`sy${i}`} className="pointer-events-none absolute bg-pink-500" style={{ top: v * scale, left: 0, height: 1, width: "100%" }} />
        ))}

        {/* interaction layer */}
        {elements
          .filter((e) => !e.hidden)
          .map((el) => {
            const selected = selectedIds.includes(el.id);
            return (
              <div
                key={el.id}
                onPointerDown={(e) => startMove(e, el)}
                className="absolute"
                style={{
                  left: el.x * scale,
                  top: el.y * scale,
                  width: el.w * scale,
                  height: el.h * scale,
                  cursor: el.locked ? "not-allowed" : "move",
                  outline: selected ? "1.5px solid hsl(var(--primary))" : "none",
                  outlineOffset: 1,
                  zIndex: 50 + el.z,
                }}
              >
                {selected && !el.locked &&
                  ["nw", "ne", "sw", "se"].map((h) => (
                    <div
                      key={h}
                      onPointerDown={(e) => startResize(e, el, h)}
                      className="absolute h-2.5 w-2.5 rounded-[2px] border border-primary bg-background"
                      style={{
                        left: h.includes("w") ? -5 : undefined,
                        right: h.includes("e") ? -5 : undefined,
                        top: h.includes("n") ? -5 : undefined,
                        bottom: h.includes("s") ? -5 : undefined,
                        cursor: h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize",
                      }}
                    />
                  ))}
              </div>
            );
          })}
      </div>
    </div>
  );
}
