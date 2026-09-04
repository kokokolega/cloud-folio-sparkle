// OS-level alarm delivery: Capacitor local notifications on iOS/Android,
// service-worker notifications as the browser fallback.
// Everything here is best-effort and must never throw into the UI.

import type { Alarm } from "@/lib/alarms";

/* ---------------- platform detection ---------------- */

export function isNativeApp(): boolean {
  try {
    const cap = (window as any)?.Capacitor;
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** Stable positive 32-bit int id from an alarm uuid + slot index. */
function notifId(alarmId: string, slot: number): number {
  let h = 2166136261;
  for (let i = 0; i < alarmId.length; i++) {
    h ^= alarmId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (Math.abs(h) % 1_000_000) * 10 + (slot % 10);
}

function parseHHMM(t: string): { hour: number; minute: number } {
  const [h, m] = (t || "00:00").split(":").map((n) => parseInt(n, 10));
  return { hour: isNaN(h) ? 0 : h, minute: isNaN(m) ? 0 : m };
}

function nextOneShot(alarm: Alarm): Date {
  const { hour, minute } = parseHHMM(alarm.alarm_time);
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

function body(alarm: Alarm): string {
  return alarm.notif_message || alarm.label || "Alarm";
}

/* ---------------- native (Capacitor) ---------------- */

async function loadPlugin() {
  if (!isNativeApp()) return null;
  try {
    const mod = await import("@capacitor/local-notifications");
    return mod.LocalNotifications;
  } catch {
    return null;
  }
}

export async function ensureNativePermission(): Promise<"granted" | "denied" | "unavailable"> {
  const LN = await loadPlugin();
  if (!LN) return "unavailable";
  try {
    let res = await LN.checkPermissions();
    if (res.display !== "granted") res = await LN.requestPermissions();
    if (res.display !== "granted") return "denied";
    // Android 12+ needs the user to allow exact alarms for second-accurate ringing.
    try {
      const exact = await (LN as any).checkExactNotificationSetting?.();
      if (exact && exact.exact_alarm !== "granted") {
        await (LN as any).changeExactNotificationSetting?.();
      }
    } catch {
      /* not available on this platform */
    }
    return "granted";
  } catch {
    return "unavailable";
  }
}

async function syncNative(alarms: Alarm[]) {
  const LN = await loadPlugin();
  if (!LN) return;
  try {
    const pending = await LN.getPending();
    if (pending.notifications.length) {
      await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
  } catch {
    /* ignore */
  }

  const toSchedule: any[] = [];
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    const { hour, minute } = parseHHMM(alarm.alarm_time);
    const silent = alarm.sound_mode === "silent" || alarm.sound_mode === "vibration_only";
    const common = {
      title: alarm.notif_title || "Oltrid Alarm",
      body: body(alarm),
      sound: silent ? undefined : "beep.wav",
      ongoing: false,
      autoCancel: true,
      channelId: silent ? "oltrid-alarms-silent" : "oltrid-alarms",
      extra: { alarmId: alarm.id },
      smallIcon: "ic_stat_icon_config_sample",
    };

    if (alarm.repeat_days && alarm.repeat_days.length > 0) {
      alarm.repeat_days.forEach((day, i) => {
        toSchedule.push({
          ...common,
          id: notifId(alarm.id, i),
          schedule: {
            // Capacitor weekday: 1 = Sunday … 7 = Saturday
            on: { weekday: (day % 7) + 1, hour, minute, second: 0 },
            allowWhileIdle: true,
          },
        });
      });
    } else {
      toSchedule.push({
        ...common,
        id: notifId(alarm.id, 0),
        schedule: { at: nextOneShot(alarm), allowWhileIdle: true },
      });
    }
  }

  if (!toSchedule.length) return;
  try {
    await LN.schedule({ notifications: toSchedule });
  } catch (e) {
    console.warn("Native alarm scheduling failed", e);
  }
}

/* ---------------- web fallback (service worker) ---------------- */

function nextWebOccurrences(alarm: Alarm, horizonDays = 7): number[] {
  const { hour, minute } = parseHHMM(alarm.alarm_time);
  const out: number[] = [];
  const now = Date.now();
  for (let i = 0; i <= horizonDays; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(hour, minute, 0, 0);
    if (d.getTime() <= now) continue;
    if (alarm.repeat_days?.length && !alarm.repeat_days.includes(d.getDay())) continue;
    out.push(d.getTime());
    if (!alarm.repeat_days?.length) break;
  }
  return out;
}

async function syncWeb(alarms: Alarm[]) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const payload = alarms
      .filter((a) => a.enabled)
      .flatMap((a) =>
        nextWebOccurrences(a).map((at) => ({
          at,
          title: a.notif_title || "Oltrid Alarm",
          body: body(a),
          tag: `oltrid-alarm-${a.id}-${at}`,
          silent: a.sound_mode === "silent",
        })),
      );
    reg.active?.postMessage({ type: "OLTRID_SET_ALARMS", alarms: payload });
  } catch {
    /* ignore */
  }
}

/* ---------------- public API ---------------- */

/** Mirror the user's alarms into OS-level schedules (native + browser fallback). */
export async function syncOsAlarms(alarms: Alarm[]) {
  await Promise.all([syncNative(alarms), syncWeb(alarms)]);
}

export async function requestOsAlarmPermission(): Promise<"granted" | "denied" | "unavailable"> {
  if (isNativeApp()) return ensureNativePermission();
  if (typeof Notification === "undefined") return "unavailable";
  const res = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  return res === "granted" ? "granted" : "denied";
}
