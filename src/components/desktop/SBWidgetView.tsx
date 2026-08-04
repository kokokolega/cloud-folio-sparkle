import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";
import type { SBObject } from "@/lib/secondBrain";

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function SBWidgetView({
  object,
  onQuickCapture,
}: {
  object: SBObject;
  onQuickCapture?: (text: string) => void;
}) {
  const { user } = useAuth();
  const now = useNow();
  const [capture, setCapture] = useState("");
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [running]);

  const { data: tasks = [] } = useQuery({
    queryKey: ["sb-tasks", user?.id],
    enabled: !!user && (object.widget === "tasks" || object.widget === "reading"),
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id,title,completed")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(12);
      return data ?? [];
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["sb-notes", user?.id],
    enabled: !!user && (object.widget === "recent-notes" || object.widget === "favorites"),
    queryFn: async () => {
      const { data } = await supabase
        .from("notes")
        .select("id,title,pinned,updated_at")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const storage = useMemo(() => {
    try {
      let bytes = 0;
      for (const k of Object.keys(localStorage)) bytes += (localStorage.getItem(k) || "").length;
      return bytes;
    } catch {
      return 0;
    }
  }, [object.updatedAt]);

  const wrap = "h-full w-full overflow-hidden p-2.5 text-[11px]";

  switch (object.widget) {
    case "clock":
      return (
        <div className={`${wrap} flex flex-col items-center justify-center`}>
          <p className="text-2xl font-semibold tabular-nums">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
          <p className="mt-1 text-muted-foreground">{now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })}</p>
        </div>
      );

    case "calendar":
      return (
        <div className={`${wrap} flex items-center justify-center`}>
          <Calendar mode="single" selected={date} onSelect={setDate} className="scale-[0.78] origin-center p-0 pointer-events-auto" />
        </div>
      );

    case "tasks":
      return (
        <div className={`${wrap} space-y-1 overflow-y-auto`}>
          {tasks.length === 0 && <p className="text-muted-foreground">No tasks yet.</p>}
          {tasks.map((t: any) => (
            <p key={t.id} className={t.completed ? "line-through opacity-50" : ""}>
              • {t.title}
            </p>
          ))}
        </div>
      );

    case "recent-notes":
    case "favorites":
      return (
        <div className={`${wrap} space-y-1 overflow-y-auto`}>
          {(object.widget === "favorites" ? notes.filter((n: any) => n.pinned) : notes).map((n: any) => (
            <p key={n.id} className="truncate">• {n.title || "Untitled"}</p>
          ))}
          {notes.length === 0 && <p className="text-muted-foreground">Nothing yet.</p>}
        </div>
      );

    case "quick-capture":
      return (
        <div className={`${wrap} flex flex-col gap-1.5`}>
          <Input
            value={capture}
            onChange={(e) => setCapture(e.target.value)}
            placeholder="Capture a thought…"
            className="h-8 text-[11px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && capture.trim()) {
                onQuickCapture?.(capture.trim());
                setCapture("");
              }
            }}
          />
          <p className="text-muted-foreground">Enter drops a sticky on the desktop.</p>
        </div>
      );

    case "storage":
      return (
        <div className={`${wrap} flex flex-col justify-center gap-1.5`}>
          <p className="text-muted-foreground">Local workspace</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (storage / 5_000_000) * 100)}%` }} />
          </div>
          <p className="tabular-nums">{(storage / 1024).toFixed(0)} KB used offline</p>
        </div>
      );

    case "reading": {
      const done = tasks.filter((t: any) => t.completed).length;
      const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
      return (
        <div className={`${wrap} flex flex-col justify-center gap-1.5`}>
          <p className="text-muted-foreground">Progress</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p>{done}/{tasks.length} completed · {pct}%</p>
        </div>
      );
    }

    case "pomodoro":
      return (
        <div className={`${wrap} flex flex-col items-center justify-center gap-2`}>
          <p className="text-2xl font-semibold tabular-nums">
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
          </p>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Toggle timer" onClick={() => setRunning((r) => !r)}>
              {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Reset timer" onClick={() => { setRunning(false); setSeconds(25 * 60); }}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      );

    case "bookmarks":
      return (
        <div className={`${wrap} space-y-1 overflow-y-auto`}>
          {(object.meta?.links as string[] | undefined)?.length ? (
            (object.meta!.links as string[]).map((l) => (
              <a key={l} href={l} target="_blank" rel="noreferrer" className="block truncate text-primary underline">{l}</a>
            ))
          ) : (
            <p className="text-muted-foreground">Drop links onto the desktop to collect them here.</p>
          )}
        </div>
      );

    default:
      return <div className={wrap}>{object.title}</div>;
  }
}
