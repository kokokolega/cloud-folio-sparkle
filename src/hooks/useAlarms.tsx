import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Alarm,
  AlarmDraft,
  nextFireDate,
  playRingtone,
  stopRingtone,
  vibrate,
  stopVibration,
  formatTime12,
  getCapabilities,
} from "@/lib/alarms";

export interface RingingState {
  alarm: Alarm;
  attempt: number;
  snoozedUntil?: Date;
}

export function useAlarms(options?: { schedule?: boolean }) {
  const schedulingEnabled = options?.schedule !== false;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [ringing, setRinging] = useState<RingingState | null>(null);
  const timersRef = useRef<Map<string, number>>(new Map());
  const stopSoundRef = useRef<(() => void) | null>(null);
  const vibIntervalRef = useRef<number | null>(null);
  const attemptsRef = useRef(0);
  const snoozeTimerRef = useRef<number | null>(null);

  const { data: alarms = [], isLoading } = useQuery({
    queryKey: ["alarms", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alarms")
        .select("*")
        .eq("user_id", user!.id)
        .order("alarm_time", { ascending: true });
      if (error) throw error;
      return data as Alarm[];
    },
    enabled: !!user,
  });

  /* ---------- firing ---------- */

  const stopAllOutput = useCallback(() => {
    if (stopSoundRef.current) { stopSoundRef.current(); stopSoundRef.current = null; }
    stopRingtone();
    stopVibration();
    if (vibIntervalRef.current) { clearInterval(vibIntervalRef.current); vibIntervalRef.current = null; }
  }, []);

  const fireAlarm = useCallback((alarm: Alarm, attempt: number) => {
    attemptsRef.current = attempt;
    setRinging({ alarm, attempt });

    // notification (best-effort; only works when permission granted)
    const caps = getCapabilities();
    if (caps.notificationPermission === "granted") {
      try {
        new Notification(alarm.notif_title || "Oltrid Alarm", {
          body: alarm.notif_message || `${alarm.label} — ${formatTime12(alarm.alarm_time)}`,
          tag: `oltrid-alarm-${alarm.id}`,
          // @ts-ignore - vibrate in notification is supported on some platforms
          vibrate: alarm.sound_mode !== "sound_only" && alarm.sound_mode !== "silent" ? [300, 150, 300] : undefined,
        });
      } catch {}
    }

    const mode = alarm.sound_mode;
    if (mode === "sound_vibration" || mode === "sound_only") {
      stopSoundRef.current = playRingtone(alarm.ringtone, alarm.volume);
    }
    if (mode === "sound_vibration" || mode === "vibration_only") {
      vibrate(alarm.vibration_pattern);
      vibIntervalRef.current = window.setInterval(() => vibrate(alarm.vibration_pattern), 3000);
    }

    // auto re-ring attempts (repeat_attempts) every 60s if not dismissed
    if (attempt < Math.max(1, alarm.repeat_attempts)) {
      const t = window.setTimeout(() => {
        stopAllOutput();
        fireAlarm(alarm, attempt + 1);
      }, 60_000);
      timersRef.current.set(`retry-${alarm.id}`, t);
    }

    supabase.from("alarms").update({ last_fired_at: new Date().toISOString() }).eq("id", alarm.id).then(() => {});
  }, [stopAllOutput]);

  /* ---------- scheduling ---------- */

  const scheduleAll = useCallback((list: Alarm[]) => {
    timersRef.current.forEach((t, key) => {
      if (!key.startsWith("retry-")) clearTimeout(t);
    });
    timersRef.current.clear();
    if (!user || !schedulingEnabled) return;
    for (const alarm of list) {
      const next = nextFireDate(alarm);
      if (!next) continue;
      const delay = next.getTime() - Date.now();
      if (delay > 2_147_000_000) continue; // setTimeout limit ~24.8 days
      const t = window.setTimeout(() => {
        fireAlarm(alarm, 1);
        // if one-shot, disable after firing
        if (!alarm.repeat_days || alarm.repeat_days.length === 0) {
          supabase.from("alarms").update({ enabled: false }).eq("id", alarm.id).then(() => {
            queryClient.invalidateQueries({ queryKey: ["alarms"] });
          });
        }
      }, delay);
      timersRef.current.set(alarm.id, t);
    }
  }, [user, fireAlarm, queryClient]);

  useEffect(() => {
    scheduleAll(alarms);
  }, [alarms, scheduleAll]);

  // reschedule on visibility return (timers may have drifted while tab hidden)
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") scheduleAll(alarms); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [alarms, scheduleAll]);

  useEffect(() => () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    stopAllOutput();
  }, [stopAllOutput]);

  /* ---------- actions ---------- */

  const dismissRinging = useCallback(() => {
    stopAllOutput();
    const retryKey = ringing ? `retry-${ringing.alarm.id}` : null;
    if (retryKey && timersRef.current.has(retryKey)) {
      clearTimeout(timersRef.current.get(retryKey));
      timersRef.current.delete(retryKey);
    }
    setRinging(null);
  }, [ringing, stopAllOutput]);

  const snoozeRinging = useCallback(() => {
    if (!ringing) return;
    stopAllOutput();
    const mins = Math.max(1, ringing.alarm.snooze_minutes || 5);
    const until = new Date(Date.now() + mins * 60_000);
    setRinging({ ...ringing, snoozedUntil: until });
    if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    snoozeTimerRef.current = window.setTimeout(() => {
      fireAlarm(ringing.alarm, 1);
    }, mins * 60_000);
    toast.success(`Snoozed for ${mins} minute${mins === 1 ? "" : "s"}`);
  }, [ringing, stopAllOutput, fireAlarm]);

  const createAlarm = useCallback(async (draft: AlarmDraft): Promise<Alarm | null> => {
    if (!user) { toast.error("Sign in to set alarms"); return null; }
    const { data, error } = await supabase
      .from("alarms")
      .insert({
        user_id: user.id,
        label: draft.label || "Alarm",
        alarm_time: draft.alarm_time,
        repeat_days: draft.repeat_days || [],
        ringtone: draft.ringtone || "classic",
        sound_mode: draft.sound_mode || "sound_vibration",
        vibration_pattern: draft.vibration_pattern || "strong",
        volume: draft.volume ?? 0.8,
        snooze_minutes: draft.snooze_minutes ?? 5,
        repeat_attempts: draft.repeat_attempts ?? 3,
        notif_title: draft.notif_title || "Oltrid Alarm",
        notif_message: draft.notif_message || "",
        fullscreen: draft.fullscreen ?? true,
        enabled: draft.enabled ?? true,
      })
      .select("*")
      .single();
    if (error) { toast.error("Failed to save alarm: " + error.message); return null; }
    queryClient.invalidateQueries({ queryKey: ["alarms"] });
    return data as Alarm;
  }, [user, queryClient]);

  const updateAlarm = useCallback(async (id: string, patch: Partial<Alarm>) => {
    const { error } = await supabase.from("alarms").update(patch).eq("id", id).eq("user_id", user!.id);
    if (error) { toast.error("Failed to update alarm: " + error.message); return false; }
    queryClient.invalidateQueries({ queryKey: ["alarms"] });
    return true;
  }, [user, queryClient]);

  const deleteAlarm = useCallback(async (id: string) => {
    const { error } = await supabase.from("alarms").delete().eq("id", id).eq("user_id", user!.id);
    if (error) { toast.error("Failed to delete alarm: " + error.message); return false; }
    queryClient.invalidateQueries({ queryKey: ["alarms"] });
    return true;
  }, [user, queryClient]);

  return {
    alarms,
    isLoading,
    ringing,
    createAlarm,
    updateAlarm,
    deleteAlarm,
    dismissRinging,
    snoozeRinging,
  };
}
