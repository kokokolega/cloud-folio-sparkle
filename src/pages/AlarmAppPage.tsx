import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlarmClock, Plus, Trash2, BellRing, Smartphone, Globe, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { AlarmManager } from "@/components/alarms/AlarmManager";
import { useAlarms } from "@/hooks/useAlarms";
import {
  REPEAT_DAY_LABELS,
  SOUND_MODES,
  RINGTONES,
  describeRepeat,
  formatTime12,
  nextFireDate,
  type SoundMode,
  type RingtoneId,
} from "@/lib/alarms";
import { isNativeApp, requestOsAlarmPermission } from "@/lib/nativeAlarms";
import { registerForPush } from "@/lib/pushNotifications";

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function countdown(target: Date | null): string {
  if (!target) return "Off";
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return "Now";
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

export default function AlarmAppPage() {
  const now = useClock();
  // AlarmManager owns the scheduler; this page only reads and edits.
  const { alarms, isLoading, createAlarm, updateAlarm, deleteAlarm } = useAlarms({ schedule: false });

  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("07:00");
  const [label, setLabel] = useState("Alarm");
  const [days, setDays] = useState<number[]>([]);
  const [soundMode, setSoundMode] = useState<SoundMode>("sound_vibration");
  const [ringtone, setRingtone] = useState<RingtoneId>("classic");
  const [snooze, setSnooze] = useState(5);
  const [saving, setSaving] = useState(false);

  const [permission, setPermission] = useState<string>(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );
  const native = isNativeApp();

  const sorted = useMemo(
    () =>
      [...alarms].sort((a, b) => {
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
        return a.alarm_time.localeCompare(b.alarm_time);
      }),
    [alarms],
  );

  const nextUp = useMemo(() => {
    const upcoming = alarms
      .filter((a) => a.enabled)
      .map((a) => ({ alarm: a, at: nextFireDate(a) }))
      .filter((x) => !!x.at)
      .sort((a, b) => a.at!.getTime() - b.at!.getTime());
    return upcoming[0] || null;
  }, [alarms, now]);

  const enableNotifications = async () => {
    const res = await requestOsAlarmPermission();
    setPermission(res);
    if (res === "granted") {
      toast.success("Alarms will now ring with notifications");
      const push = await registerForPush();
      if (push.status === "registered") toast.success("This device is registered for alarm pushes");
    } else if (res === "denied") {
      toast.error("Notifications blocked — allow them in your device settings");
    } else {
      toast.message("Notifications aren't available here");
    }
  };

  const resetForm = () => {
    setTime("07:00");
    setLabel("Alarm");
    setDays([]);
    setSoundMode("sound_vibration");
    setRingtone("classic");
    setSnooze(5);
  };

  const save = async () => {
    setSaving(true);
    const created = await createAlarm({
      label: label.trim() || "Alarm",
      alarm_time: time,
      repeat_days: days,
      sound_mode: soundMode,
      ringtone,
      snooze_minutes: snooze,
      notif_title: "Oltrid Alarm",
      notif_message: label.trim() || "Alarm",
      enabled: true,
    });
    setSaving(false);
    if (created) {
      toast.success(`Alarm set for ${formatTime12(time)}`);
      setOpen(false);
      resetForm();
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <AlarmManager />

      {/* Header */}
      <header
        className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 border-b border-border/60"
        role="banner"
      >
        <div className="mx-auto w-full max-w-lg">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlarmClock className="h-4 w-4" />
            <span>Oltrid Alarms</span>
          </div>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight tabular-nums">
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
            {nextUp ? ` · next ${countdown(nextUp.at)}` : " · no alarms set"}
          </p>
        </div>
      </header>

      {/* Delivery status */}
      <div className="px-5 pt-4">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-border/60 bg-card/60 p-4">
          <div className="flex items-start gap-3">
            {native ? (
              <Smartphone className="h-4 w-4 mt-0.5 text-primary" />
            ) : (
              <Globe className="h-4 w-4 mt-0.5 text-muted-foreground" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {native ? "Installed app — alarms ring with the app closed" : "Browser preview"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {native
                  ? "Alarms are handed to the phone's own scheduler."
                  : "Install the Android/iOS build for alarms that ring when the app is closed."}
              </p>
            </div>
            {permission !== "granted" && (
              <Button size="sm" variant="secondary" onClick={enableNotifications}>
                <BellRing className="h-3.5 w-3.5 mr-1.5" />
                Allow
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Alarm list */}
      <main className="flex-1 px-5 py-4 pb-32">
        <div className="mx-auto w-full max-w-lg space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading alarms…</p>}
          {!isLoading && sorted.length === 0 && (
            <div className="text-center py-16">
              <AlarmClock className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">No alarms yet</p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {sorted.map((alarm) => (
              <motion.div
                key={alarm.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-3xl font-semibold tabular-nums tracking-tight ${
                      alarm.enabled ? "" : "text-muted-foreground/60"
                    }`}
                  >
                    {formatTime12(alarm.alarm_time)}
                  </p>
                  <p className="text-sm truncate mt-0.5">{alarm.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {describeRepeat(alarm.repeat_days)}
                    {alarm.enabled ? ` · ${countdown(nextFireDate(alarm))}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <Switch
                    checked={alarm.enabled}
                    aria-label={`Turn ${alarm.label} ${alarm.enabled ? "off" : "on"}`}
                    onCheckedChange={(v) => updateAlarm(alarm.id, { enabled: v })}
                  />
                  <button
                    type="button"
                    aria-label={`Delete ${alarm.label}`}
                    onClick={() => deleteAlarm(alarm.id)}
                    className="text-muted-foreground/70 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* Add button */}
      <div className="fixed inset-x-0 bottom-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-background via-background to-transparent">
        <div className="mx-auto w-full max-w-lg">
          <Button className="w-full h-12 rounded-2xl text-base" onClick={() => setOpen(true)}>
            <Plus className="h-5 w-5 mr-2" />
            New alarm
          </Button>
        </div>
      </div>

      {/* New alarm dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>New alarm</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="alarm-time">Time</Label>
              <Input
                id="alarm-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="text-2xl h-14 tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alarm-label">Label</Label>
              <Input
                id="alarm-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Wake up"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Repeat</Label>
              <div className="flex flex-wrap gap-1.5">
                {REPEAT_DAY_LABELS.map((d, i) => {
                  const active = days.includes(i);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setDays((prev) =>
                          prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort(),
                        )
                      }
                      className={`h-9 w-11 rounded-xl text-xs font-medium border transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Alert</Label>
                <Select value={soundMode} onValueChange={(v) => setSoundMode(v as SoundMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOUND_MODES.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Ringtone</Label>
                <Select value={ringtone} onValueChange={(v) => setRingtone(v as RingtoneId)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RINGTONES.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alarm-snooze">Snooze (minutes)</Label>
              <Input
                id="alarm-snooze"
                type="number"
                min={1}
                max={60}
                value={snooze}
                onChange={(e) => setSnooze(Math.max(1, Math.min(60, Number(e.target.value) || 5)))}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 mr-1.5" />
                Cancel
              </Button>
              <Button className="flex-1" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save alarm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
