import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Fullscreen slide-by-slide presentation of the cards. No export needed.
 */
export function CardPresentMode({
  count,
  start,
  render,
  ratio,
  onClose,
}: {
  count: number;
  start: number;
  ratio: { w: number; h: number };
  render: (index: number) => React.ReactNode;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(start);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") setIndex((i) => Math.min(count - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, onClose]);

  const scale = Math.min((size.w * 0.9) / ratio.w, (size.h * 0.86) / ratio.h);

  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black">
      <div className="overflow-hidden rounded-xl shadow-2xl" style={{ width: ratio.w * scale, height: ratio.h * scale }}>
        <div style={{ width: ratio.w, height: ratio.h, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {render(index)}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-white/80">
        <button aria-label="Previous slide" className="rounded-full p-2 hover:bg-white/10 disabled:opacity-30" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-xs tabular-nums">
          {index + 1} / {count}
        </span>
        <button aria-label="Next slide" className="rounded-full p-2 hover:bg-white/10 disabled:opacity-30" disabled={index >= count - 1} onClick={() => setIndex((i) => i + 1)}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <button aria-label="Exit presentation" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-white/70 hover:bg-white/10">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
