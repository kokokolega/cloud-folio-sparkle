import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Camera, ImagePlus, Search, Sparkles, Inbox, ShieldCheck, CloudOff, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CaptureCamera } from "@/components/capture/CaptureCamera";
import { CaptureProcessing } from "@/components/capture/CaptureProcessing";
import { CaptureReviewSheet } from "@/components/capture/CaptureReviewSheet";
import { CaptureDetail } from "@/components/capture/CaptureDetail";
import { DuplicateDialog } from "@/components/capture/DuplicateDialog";
import {
  fetchUserRules,
  processCapture,
  timeBucket,
  TIME_BUCKETS,
  type CaptureRow,
  type CaptureStep,
  type DuplicateInfo,
} from "@/lib/smartCapture/pipeline";
import {
  cacheCaptures,
  isOnline,
  listPending,
  queueCapture,
  readCachedCaptures,
  syncPendingCaptures,
  type PendingCapture,
} from "@/lib/smartCapture/offlineQueue";
import { textSimilarity, type UserRule } from "@/lib/smartCapture/rules";

const db = supabase as any;
const publicUrl = (p: string) => supabase.storage.from("user-files").getPublicUrl(p).data.publicUrl;

export default function SmartCapturePage() {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [captures, setCaptures] = useState<CaptureRow[]>([]);
  const [rules, setRules] = useState<UserRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [review, setReview] = useState<File | null>(null);
  const [step, setStep] = useState<CaptureStep | null>(null);
  const [queue, setQueue] = useState({ current: 0, total: 0 });
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const pendingRef = useRef<File | null>(null);
  const [selected, setSelected] = useState<CaptureRow | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [inbox, setInbox] = useState<{ total: number; breakdown: [string, number][] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState<PendingCapture[]>([]);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    if (!isOnline()) {
      setCaptures(await readCachedCaptures(user.id));
      setPending(await listPending(user.id));
      setLoading(false);
      return;
    }
    const { data } = await db
      .from("captures")
      .select("*")
      .eq("user_id", user.id)
      .order("captured_at", { ascending: false });
    const rows = (data ?? []) as CaptureRow[];
    setCaptures(rows);
    cacheCaptures(rows).catch(() => undefined);
    setPending(await listPending(user.id));
    try {
      setRules(await fetchUserRules(user.id));
    } catch {
      /* offline */
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---- offline / sync ---- */
  const runSync = useCallback(async () => {
    if (!user || !isOnline()) return;
    const queued = await listPending(user.id);
    if (!queued.length) return;
    setSyncing(true);
    const { synced, failed } = await syncPendingCaptures(user.id);
    setSyncing(false);
    setPending(await listPending(user.id));
    if (synced.length) toast.success(`${synced.length} offline capture${synced.length > 1 ? "s" : ""} synced`);
    if (failed) toast.error(`${failed} capture${failed > 1 ? "s" : ""} couldn't sync yet`);
    if (synced.length) load();
  }, [user, load]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      runSync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (isOnline()) runSync();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [runSync]);


  const runFiles = useCallback(
    async (files: File[], allowDuplicate = false) => {
      if (!user || files.length === 0) return;
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) {
        toast.error("Only images are supported right now");
        return;
      }
      const currentRules = await fetchUserRules(user.id);
      const results: CaptureRow[] = [];
      for (let i = 0; i < images.length; i++) {
        setQueue({ current: i + 1, total: images.length });
        try {
          const res = await processCapture({
            userId: user.id,
            file: images[i],
            userRules: currentRules,
            onStep: setStep,
            allowDuplicate,
          });
          if (res.duplicate) {
            pendingRef.current = images[i];
            setDuplicate(res.duplicate);
            setStep(null);
            return;
          }
          if (res.capture) results.push(res.capture);
        } catch (e: any) {
          toast.error(e?.message || "Could not process that image");
        }
      }
      setStep(null);
      setQueue({ current: 0, total: 0 });

      if (results.length) {
        const map = new Map<string, number>();
        results.forEach((r) => map.set(r.subfolder || r.category, (map.get(r.subfolder || r.category) ?? 0) + 1));
        setInbox({ total: results.length, breakdown: [...map.entries()].sort((a, b) => b[1] - a[1]) });
        setTimeout(() => setInbox(null), 9000);
      }
      load();
    },
    [user, load]
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    runFiles(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    runFiles(Array.from(e.dataTransfer.files));
  };

  const categories = useMemo(
    () => ["All", ...[...new Set(captures.map((c) => c.category))].sort()],
    [captures]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return captures.filter((c) => {
      if (category !== "All" && c.category !== category) return false;
      if (!q) return true;
      const hay = `${c.title} ${c.category} ${c.subfolder ?? ""} ${c.tags?.join(" ")} ${c.ocr_text}`.toLowerCase();
      return hay.includes(q) || textSimilarity(q, c.ocr_text) > 0.5;
    });
  }, [captures, query, category]);

  const grouped = useMemo(() => {
    const map = new Map<string, CaptureRow[]>();
    filtered.forEach((c) => {
      const b = timeBucket(c.captured_at);
      map.set(b, [...(map.get(b) ?? []), c]);
    });
    return TIME_BUCKETS.filter((b) => map.has(b)).map((b) => [b, map.get(b)!] as const);
  }, [filtered]);

  const needsReview = captures.filter((c) => c.status === "review").length;

  return (
    <DashboardLayout>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`min-h-[70vh] transition-all ${dragOver ? "rounded-2xl ring-2 ring-primary/40" : ""}`}
      >
        {/* Header */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Sparkles className="h-4.5 w-4.5 text-primary" /> Smart Capture
            </h1>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Zero-click organization — photos are read, named, tagged and filed automatically on your device.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setCameraOpen(true)} className="h-9 flex-1 rounded-xl text-xs sm:flex-none">
              <Camera className="mr-1.5 h-3.5 w-3.5" /> Camera
            </Button>
            <Button
              variant="outline"
              onClick={() => inputRef.current?.click()}
              className="h-9 flex-1 rounded-xl text-xs sm:flex-none"
            >
              <ImagePlus className="mr-1.5 h-3.5 w-3.5" /> Import
            </Button>
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
          </div>
        </div>

        {/* Search + filters */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search text inside images, tags, folders…"
              className="h-9 rounded-xl border-border bg-secondary/50 pl-9 text-sm"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] transition-all ${
                  category === c
                    ? "border-foreground/25 bg-secondary text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {needsReview > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[12px] text-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
            {needsReview} capture{needsReview > 1 ? "s" : ""} in “Needs Review” — open one to correct the folder and
            Oltrid will learn.
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-secondary/50" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card flex flex-col items-center rounded-2xl px-6 py-16 text-center">
            <Camera className="mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">Nothing captured yet</p>
            <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">
              Take a photo or drop screenshots, notes, receipts or documents here. Oltrid reads them locally and files
              them for you.
            </p>
          </div>
        ) : (
          <div className="space-y-7">
            {grouped.map(([bucket, items]) => (
              <div key={bucket}>
                <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {bucket} · {items.length}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  <AnimatePresence mode="popLayout">
                    {items.map((c) => (
                      <motion.button
                        key={c.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        whileHover={{ y: -3 }}
                        onClick={() => setSelected(c)}
                        className="glass-card group overflow-hidden rounded-2xl text-left"
                      >
                        <div className="aspect-[4/3] overflow-hidden bg-muted/30">
                          <img
                            src={publicUrl(c.storage_path)}
                            alt={c.title}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <div className="p-2.5">
                          <p className="truncate text-[12.5px] font-medium text-foreground">{c.title}</p>
                          <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
                            {c.category} › {c.subfolder}
                          </p>
                          <div className="mt-1.5 flex items-center gap-1">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                c.confidence >= 85 ? "bg-emerald-500" : c.confidence >= 60 ? "bg-amber-500" : "bg-rose-500"
                              }`}
                            />
                            <span className="text-[10px] text-muted-foreground">{c.confidence}%</span>
                            {c.tags?.[0] && (
                              <Badge variant="secondary" className="ml-auto rounded-full px-1.5 text-[9.5px] font-normal">
                                #{c.tags[0]}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Smart Inbox summary */}
      <AnimatePresence>
        {inbox && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="glass-card fixed bottom-4 right-4 z-[150] w-[calc(100vw-2rem)] max-w-xs rounded-2xl p-4 sm:w-72"
          >
            <div className="mb-2 flex items-center gap-2">
              <Inbox className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">{inbox.total} files organized</p>
            </div>
            <div className="space-y-1">
              {inbox.breakdown.map(([name, count]) => (
                <div key={name} className="flex items-center justify-between text-[12px] text-muted-foreground">
                  <span className="truncate">{name}</span>
                  <span className="text-foreground">{count}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CaptureCamera open={cameraOpen} onOpenChange={setCameraOpen} onCapture={(f) => runFiles([f])} />
      <CaptureProcessing open={!!step && step !== "done"} step={step} current={queue.current} total={queue.total} />
      <CaptureDetail
        capture={selected}
        all={captures}
        onOpenChange={(v) => !v && setSelected(null)}
        onChanged={load}
        onSelect={setSelected}
      />
      <DuplicateDialog
        duplicate={duplicate}
        onDismiss={() => {
          setDuplicate(null);
          pendingRef.current = null;
        }}
        onKeepBoth={() => {
          const f = pendingRef.current;
          setDuplicate(null);
          pendingRef.current = null;
          if (f) runFiles([f], true);
        }}
        onReplace={async () => {
          const f = pendingRef.current;
          const existing = duplicate?.existing;
          setDuplicate(null);
          pendingRef.current = null;
          if (existing) {
            await db.from("captures").delete().eq("id", existing.id);
            if (existing.file_id)
              await db.from("files").update({ deleted_at: new Date().toISOString() }).eq("id", existing.file_id);
          }
          if (f) runFiles([f], true);
        }}
        onOpenExisting={() => {
          setSelected(duplicate?.existing ?? null);
          setDuplicate(null);
          pendingRef.current = null;
        }}
      />
    </DashboardLayout>
  );
}
