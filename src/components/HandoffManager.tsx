import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Laptop, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  applyScroll,
  clearRestore,
  deviceId,
  deviceLabel,
  scrollSnapshot,
  snapshotHandoffState,
  stageRestore,
} from "@/lib/handoff";

interface RemoteSession {
  device_id: string;
  device_label: string;
  route: string;
  title: string | null;
  state: any;
  updated_at: string;
}

const IGNORED_ROUTES = ["/auth", "/reset-password"];
const DISMISS_KEY = "oltrid-handoff-dismissed";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function HandoffManager() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<RemoteSession | null>(null);
  const lastPayload = useRef<string>("");
  const checked = useRef(false);

  const routeIgnored = IGNORED_ROUTES.some((r) => location.pathname.startsWith(r));

  /* ---------- publish this device's session ---------- */

  const push = useCallback(async () => {
    if (!user || routeIgnored) return;
    const state = {
      ...snapshotHandoffState(),
      scroll: scrollSnapshot(),
      viewport: { w: window.innerWidth, h: window.innerHeight },
      at: Date.now(),
    };
    const payload = {
      user_id: user.id,
      device_id: deviceId(),
      device_label: deviceLabel(),
      route: location.pathname + location.search,
      title: document.title,
      state,
    };
    const fingerprint = JSON.stringify({ r: payload.route, s: { ...state, at: 0 } });
    if (fingerprint === lastPayload.current) return;
    lastPayload.current = fingerprint;
    await supabase
      .from("device_sessions")
      .upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: "user_id,device_id" });
  }, [user, location.pathname, location.search, routeIgnored]);

  useEffect(() => {
    if (!user) return;
    push();
    const interval = window.setInterval(push, 10_000);
    const onHide = () => push();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [user, push]);

  /* ---------- look for another device to continue from ---------- */

  useEffect(() => {
    if (!user || checked.current || routeIgnored) return;
    checked.current = true;
    (async () => {
      const { data } = await supabase
        .from("device_sessions")
        .select("device_id, device_label, route, title, state, updated_at")
        .eq("user_id", user.id)
        .neq("device_id", deviceId())
        .order("updated_at", { ascending: false })
        .limit(1);
      const s = data?.[0] as RemoteSession | undefined;
      if (!s) return;
      const age = Date.now() - new Date(s.updated_at).getTime();
      if (age > MAX_AGE_MS) return;
      if (s.route === location.pathname + location.search) return;
      if (localStorage.getItem(DISMISS_KEY) === s.updated_at) return;
      setCandidate(s);
    })();
  }, [user, routeIgnored, location.pathname, location.search]);

  const restore = () => {
    if (!candidate) return;
    clearRestore();
    stageRestore(candidate.state ?? {});
    navigate(candidate.route);
    setTimeout(() => applyScroll(candidate.state?.scroll), 350);
    setCandidate(null);
  };

  const dismiss = () => {
    if (candidate) localStorage.setItem(DISMISS_KEY, candidate.updated_at);
    setCandidate(null);
  };

  return (
    <AnimatePresence>
      {candidate && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed inset-x-3 top-3 z-[90] mx-auto max-w-md rounded-2xl border border-border/70 bg-background/90 p-3 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-primary/10 p-2">
              <Laptop className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">Continue where you left off?</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {candidate.title || candidate.route} · {candidate.device_label}
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="h-7 text-[11px]" onClick={restore}>
                  Continue
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={dismiss}>
                  Not now
                </Button>
              </div>
            </div>
            <button onClick={dismiss} aria-label="Dismiss handoff" className="p-1 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
