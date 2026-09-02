import { useState } from "react";
import { AlarmClock, Plus, Trash2, Play, ChevronDown, BellRing, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useAlarms } from "@/hooks/useAlarms";
import {
  Alarm,
  RINGTONES,
  SOUND_MODES,
  VIBRATION_PATTERNS,
  REPEAT_DAY_LABELS,
  RingtoneId,
  SoundMode,
  VibrationPatternId,
  formatTime12,
  describeRepeat,
  previewRingtone,
  vibrate,
  getCapabilities,
  requestNotificationPermission,
} from "@/lib/alarms";

export function AlarmSettings() {
  // Scheduling is owned by the global AlarmManager; this panel only edits.
  const { alarms, createAlarm, updateAlarm, deleteAlarm } = useAlarms({ schedule: false });
  const [openId, setOpenId] = useState<string | null>(null);
  const [permission, setPermission] = useState(() => getCapabilities().notificationPermission);
  const caps = getCapabilities();

  const askPermission = async () => {
    const res = await requestNotificationPermission();
    setPermission(res);
    if (res === "granted") toast.success("Notifications enabled");
    else if (res === "denied") toast.error("Notifications blocked in browser settings");
  };

  const addAlarm = async () => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const created = await createAlarm({ alarm_time: hhmm, label: "New alarm" });
    if (created) {
      setOpenId(created.id);
      toast.success(`Alarm set for ${formatTime12(hhmm)}`);
    }
  };

  const patch = (a: Alarm, p: Partial<Alarm>) => updateAlarm(a.id, p);

  const toggleDay = (a: Alarm, day: number) => {
    const days = a.repeat_days.includes(day) ? a.repeat_days.filter((d) => d !== day) : [...a.repeat_days, day].sort();
    patch(a, { repeat_days: days });
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlarmClock className="h-4 w-4 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium text-foreground">Alarms & Notifications</h3>
            <p className="text-[11px] text-muted-foreground">Sound, vibration and snooze control</p>
          </div>
        </div>
        <Button size="sm" className="rounded-lg text-xs gap-1" onClick={addAlarm}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {/* Permissions / capabilities */}
      <div className="rounded-xl border border-border p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <BellRing className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-foreground truncate">System notifications</span>
          </div>
          {permission === "granted" ? (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Allowed</span>
          ) : permission === "unsupported" ? (
            <span className="text-[11px] text-muted-foreground">Unsupported</span>
          ) : (
            <Button size="sm" variant="outline" className="h-7 rounded-lg text-[11px]" onClick={askPermission}>
              {permission === "denied" ? "Blocked — retry" : "Enable"}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>Vibration: {caps.vibration ? "supported" : "not on this device"}</span>
          <span>Audio: {caps.audio ? "ready" : "unavailable"}</span>
        </div>
      </div>

      {alarms.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">No alarms yet. Add one, or just ask Oltrid AI — "7 baje alarm laga do".</p>
      )}

      <div className="space-y-2">
        {alarms.map((a) => {
          const open = openId === a.id;
          return (
            <div key={a.id} className="rounded-xl border border-border overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <button
                  onClick={() => setOpenId(open ? null : a.id)}
                  className="flex-1 text-left min-w-0"
                  aria-expanded={open}
                >
                  <p className="text-base font-medium text-foreground tabular-nums">{formatTime12(a.alarm_time)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {a.label} · {describeRepeat(a.repeat_days)} · {SOUND_MODES.find((s) => s.id === a.sound_mode)?.name}
                  </p>
                </button>
                <Switch checked={a.enabled} onCheckedChange={(v) => patch(a, { enabled: v })} />
                <button onClick={() => setOpenId(open ? null : a.id)} className="text-muted-foreground" aria-label="Toggle details">
                  <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
              </div>

              {open && (
                <div className="border-t border-border p-3 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Time</Label>
                      <Input
                        type="time"
                        value={a.alarm_time.slice(0, 5)}
                        onChange={(e) => patch(a, { alarm_time: e.target.value })}
                        className="h-9 rounded-lg text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Label</Label>
                      <Input
                        value={a.label}
                        onChange={(e) => patch(a, { label: e.target.value })}
                        className="h-9 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Repeat</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {REPEAT_DAY_LABELS.map((d, i) => (
                        <button
                          key={d}
                          onClick={() => toggleDay(a, i)}
                          className={`h-8 w-10 rounded-lg text-[11px] border transition-colors ${
                            a.repeat_days.includes(i)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:bg-secondary/50"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Sound mode</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SOUND_MODES.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => patch(a, { sound_mode: s.id as SoundMode })}
                          className={`rounded-lg border px-2.5 py-2 text-[11px] text-left transition-colors ${
                            a.sound_mode === s.id ? "border-primary bg-secondary/50" : "border-border hover:bg-secondary/40"
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Ringtone</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {RINGTONES.map((r) => (
                        <div
                          key={r.id}
                          className={`rounded-lg border px-2.5 py-2 flex items-center justify-between gap-2 ${
                            a.ringtone === r.id ? "border-primary bg-secondary/50" : "border-border"
                          }`}
                        >
                          <button className="text-[11px] text-left flex-1 truncate" onClick={() => patch(a, { ringtone: r.id as RingtoneId })}>
                            {r.name}
                          </button>
                          <button
                            aria-label={`Preview ${r.name}`}
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => previewRingtone(r.id, a.volume)}
                          >
                            <Play className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Vibration pattern</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {VIBRATION_PATTERNS.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => { patch(a, { vibration_pattern: v.id as VibrationPatternId }); vibrate(v.id); }}
                          className={`rounded-lg border px-2.5 py-2 text-[11px] transition-colors ${
                            a.vibration_pattern === v.id ? "border-primary bg-secondary/50" : "border-border hover:bg-secondary/40"
                          }`}
                        >
                          {v.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px]">Volume</Label>
                      <span className="text-[11px] text-muted-foreground">{Math.round(a.volume * 100)}%</span>
                    </div>
                    <Slider
                      value={[Math.round(a.volume * 100)]}
                      min={0}
                      max={100}
                      step={5}
                      onValueChange={(v) => patch(a, { volume: v[0] / 100 })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Snooze (min)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={a.snooze_minutes}
                        onChange={(e) => patch(a, { snooze_minutes: Math.max(1, Math.min(60, Number(e.target.value) || 5)) })}
                        className="h-9 rounded-lg text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Repeat attempts</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={a.repeat_attempts}
                        onChange={(e) => patch(a, { repeat_attempts: Math.max(1, Math.min(10, Number(e.target.value) || 3)) })}
                        className="h-9 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Notification title</Label>
                      <Input
                        value={a.notif_title}
                        onChange={(e) => patch(a, { notif_title: e.target.value })}
                        className="h-9 rounded-lg text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Notification message</Label>
                      <Input
                        value={a.notif_message}
                        onChange={(e) => patch(a, { notif_message: e.target.value })}
                        placeholder="Time to wake up"
                        className="h-9 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-[11px]">Full-screen ringing overlay</Label>
                    <Switch checked={a.fullscreen} onCheckedChange={(v) => patch(a, { fullscreen: v })} />
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-lg text-xs text-destructive hover:text-destructive"
                    onClick={async () => { if (await deleteAlarm(a.id)) toast.success("Alarm deleted"); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete alarm
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
