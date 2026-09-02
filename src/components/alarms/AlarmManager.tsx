import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlarmClock, BellOff, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAlarms } from "@/hooks/useAlarms";
import { formatTime12, describeRepeat } from "@/lib/alarms";

/** Mounts the global alarm scheduler and renders the full-screen ringing overlay. */
export function AlarmManager() {
  const { ringing, dismissRinging, snoozeRinging } = useAlarms();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!ringing) return;
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [ringing]);

  const active = ringing && !ringing.snoozedUntil ? ringing : null;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="alarm-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Alarm ringing"
          className="fixed inset-0 z-[999] flex items-center justify-center bg-background/95 backdrop-blur-xl p-6"
        >
          <motion.div
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="w-full max-w-sm text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
              className="mx-auto mb-6 h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center"
            >
              <AlarmClock className="h-9 w-9 text-primary" />
            </motion.div>

            <p className="text-5xl font-semibold tracking-tight text-foreground tabular-nums">
              {formatTime12(active.alarm.alarm_time)}
            </p>
            <p className="mt-2 text-base font-medium text-foreground">{active.alarm.label}</p>
            {active.alarm.notif_message && (
              <p className="mt-1 text-sm text-muted-foreground">{active.alarm.notif_message}</p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {describeRepeat(active.alarm.repeat_days)} ·{" "}
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              {active.attempt > 1 ? ` · attempt ${active.attempt}` : ""}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-2xl gap-2"
                onClick={snoozeRinging}
              >
                <Timer className="h-4 w-4" />
                Snooze {Math.max(1, active.alarm.snooze_minutes || 5)}m
              </Button>
              <Button className="flex-1 h-12 rounded-2xl gap-2" onClick={dismissRinging}>
                <BellOff className="h-4 w-4" />
                Dismiss
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
