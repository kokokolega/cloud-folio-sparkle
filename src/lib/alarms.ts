// Oltrid Alarm & Notification engine — types, sounds, vibration, NL parsing

export type SoundMode = "sound_vibration" | "sound_only" | "vibration_only" | "silent";
export type RingtoneId = "classic" | "soft" | "digital" | "chime" | "siren";
export type VibrationPatternId = "off" | "gentle" | "strong" | "pulse" | "heartbeat";

export interface Alarm {
  id: string;
  user_id: string;
  label: string;
  alarm_time: string; // "HH:MM" 24h
  repeat_days: number[]; // 0=Sun..6=Sat, empty = one-shot
  ringtone: RingtoneId;
  sound_mode: SoundMode;
  vibration_pattern: VibrationPatternId;
  volume: number; // 0..1
  snooze_minutes: number;
  repeat_attempts: number;
  notif_title: string;
  notif_message: string;
  fullscreen: boolean;
  enabled: boolean;
  last_fired_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlarmDraft {
  label?: string;
  alarm_time: string;
  repeat_days?: number[];
  ringtone?: RingtoneId;
  sound_mode?: SoundMode;
  vibration_pattern?: VibrationPatternId;
  volume?: number;
  snooze_minutes?: number;
  repeat_attempts?: number;
  notif_title?: string;
  notif_message?: string;
  fullscreen?: boolean;
  enabled?: boolean;
}

export const RINGTONES: { id: RingtoneId; name: string; description: string }[] = [
  { id: "classic", name: "Classic", description: "Traditional alarm beeps" },
  { id: "soft", name: "Soft", description: "Gentle warm tones" },
  { id: "digital", name: "Digital", description: "Retro digital beeps" },
  { id: "chime", name: "Chime", description: "Bell-like chimes" },
  { id: "siren", name: "Siren", description: "Loud rising siren" },
];

export const VIBRATION_PATTERNS: { id: VibrationPatternId; name: string; pattern: number[] }[] = [
  { id: "off", name: "Off", pattern: [] },
  { id: "gentle", name: "Gentle", pattern: [200, 400, 200] },
  { id: "strong", name: "Strong", pattern: [500, 250, 500, 250, 800] },
  { id: "pulse", name: "Pulse", pattern: [150, 150, 150, 150, 150, 150, 600] },
  { id: "heartbeat", name: "Heartbeat", pattern: [120, 100, 120, 500, 120, 100, 120] },
];

export const SOUND_MODES: { id: SoundMode; name: string }[] = [
  { id: "sound_vibration", name: "Sound + Vibration" },
  { id: "sound_only", name: "Sound only" },
  { id: "vibration_only", name: "Vibration only" },
  { id: "silent", name: "Silent (visual only)" },
];

export const REPEAT_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ---------------- capabilities ---------------- */

export interface AlarmCapabilities {
  notifications: boolean;
  notificationPermission: NotificationPermission | "unsupported";
  vibration: boolean;
  audio: boolean;
  serviceWorker: boolean;
}

export function getCapabilities(): AlarmCapabilities {
  return {
    notifications: typeof window !== "undefined" && "Notification" in window,
    notificationPermission: typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
    vibration: typeof navigator !== "undefined" && "vibrate" in navigator,
    audio: typeof window !== "undefined" && ("AudioContext" in window || "webkitAudioContext" in window),
    serviceWorker: typeof navigator !== "undefined" && "serviceWorker" in navigator,
  };
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/* ---------------- sound engine (Web Audio synth, no assets) ---------------- */

let audioCtx: AudioContext | null = null;
let activeNodes: { stop: () => void } | null = null;

function ctx(): AudioContext {
  if (!audioCtx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

interface ToneStep { freq: number; start: number; dur: number; type?: OscillatorType; gain?: number }

const RINGTONE_LOOPS: Record<RingtoneId, { steps: ToneStep[]; loopDur: number }> = {
  classic: {
    loopDur: 1.2,
    steps: [0, 0.2, 0.4, 0.6].map((s) => ({ freq: 880, start: s, dur: 0.15, type: "square" as OscillatorType, gain: 0.5 })),
  },
  soft: {
    loopDur: 2.4,
    steps: [
      { freq: 523.25, start: 0, dur: 0.6, type: "sine", gain: 0.35 },
      { freq: 659.25, start: 0.7, dur: 0.6, type: "sine", gain: 0.35 },
      { freq: 783.99, start: 1.4, dur: 0.8, type: "sine", gain: 0.35 },
    ],
  },
  digital: {
    loopDur: 0.9,
    steps: [
      { freq: 1200, start: 0, dur: 0.1, type: "square", gain: 0.3 },
      { freq: 1000, start: 0.15, dur: 0.1, type: "square", gain: 0.3 },
      { freq: 1200, start: 0.3, dur: 0.1, type: "square", gain: 0.3 },
      { freq: 1000, start: 0.45, dur: 0.1, type: "square", gain: 0.3 },
    ],
  },
  chime: {
    loopDur: 2.0,
    steps: [
      { freq: 1046.5, start: 0, dur: 0.9, type: "sine", gain: 0.4 },
      { freq: 1318.5, start: 0.5, dur: 0.9, type: "sine", gain: 0.3 },
      { freq: 1568, start: 1.0, dur: 0.9, type: "sine", gain: 0.25 },
    ],
  },
  siren: {
    loopDur: 1.6,
    steps: Array.from({ length: 8 }, (_, i) => ({
      freq: 600 + (i % 2 === 0 ? i * 60 : 400 - i * 30),
      start: i * 0.2,
      dur: 0.2,
      type: "sawtooth" as OscillatorType,
      gain: 0.35,
    })),
  },
};

/** Play a ringtone loop. Returns a stop function. Volume 0..1. */
export function playRingtone(ringtone: RingtoneId, volume: number): () => void {
  stopRingtone();
  const def = RINGTONE_LOOPS[ringtone] || RINGTONE_LOOPS.classic;
  const ac = ctx();
  const master = ac.createGain();
  master.gain.value = Math.min(1, Math.max(0, volume));
  master.connect(ac.destination);

  let stopped = false;
  const timers: number[] = [];
  const oscillators: OscillatorNode[] = [];

  const scheduleLoop = () => {
    if (stopped) return;
    const t0 = ac.currentTime + 0.05;
    for (const step of def.steps) {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = step.type || "sine";
      osc.frequency.value = step.freq;
      g.gain.setValueAtTime(0, t0 + step.start);
      g.gain.linearRampToValueAtTime(step.gain ?? 0.4, t0 + step.start + 0.02);
      g.gain.setValueAtTime(step.gain ?? 0.4, t0 + step.start + step.dur - 0.03);
      g.gain.linearRampToValueAtTime(0, t0 + step.start + step.dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0 + step.start);
      osc.stop(t0 + step.start + step.dur + 0.05);
      oscillators.push(osc);
    }
    timers.push(window.setTimeout(scheduleLoop, def.loopDur * 1000));
  };
  scheduleLoop();

  const stop = () => {
    stopped = true;
    timers.forEach((t) => clearTimeout(t));
    oscillators.forEach((o) => { try { o.stop(); } catch {} });
    try { master.disconnect(); } catch {}
  };
  activeNodes = { stop };
  return stop;
}

export function stopRingtone() {
  if (activeNodes) {
    activeNodes.stop();
    activeNodes = null;
  }
}

export function previewRingtone(ringtone: RingtoneId, volume: number, ms = 2500) {
  const stop = playRingtone(ringtone, volume);
  window.setTimeout(stop, ms);
}

/* ---------------- vibration ---------------- */

export function vibrate(patternId: VibrationPatternId): boolean {
  if (!("vibrate" in navigator)) return false;
  const def = VIBRATION_PATTERNS.find((p) => p.id === patternId);
  if (!def || def.pattern.length === 0) return false;
  try {
    return navigator.vibrate(def.pattern);
  } catch {
    return false;
  }
}

export function stopVibration() {
  if ("vibrate" in navigator) {
    try { navigator.vibrate(0); } catch {}
  }
}

/* ---------------- scheduling ---------------- */

/** Next Date at which the alarm should fire, or null if disabled/invalid. */
export function nextFireDate(alarm: Pick<Alarm, "alarm_time" | "repeat_days" | "enabled">, from = new Date()): Date | null {
  if (!alarm.enabled) return null;
  const m = alarm.alarm_time.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh > 23 || mm > 59) return null;

  if (!alarm.repeat_days || alarm.repeat_days.length === 0) {
    const d = new Date(from);
    d.setHours(hh, mm, 0, 0);
    if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 1);
    return d;
  }
  // repeating: find the next matching weekday
  for (let add = 0; add < 8; add++) {
    const d = new Date(from);
    d.setDate(d.getDate() + add);
    d.setHours(hh, mm, 0, 0);
    if (d.getTime() <= from.getTime()) continue;
    if (alarm.repeat_days.includes(d.getDay())) return d;
  }
  return null;
}

export function formatTime12(hhmm: string): string {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return hhmm;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${ampm}`;
}

export function describeRepeat(days: number[]): string {
  if (!days || days.length === 0) return "Once";
  if (days.length === 7) return "Every day";
  const sorted = [...days].sort();
  if (sorted.join() === "1,2,3,4,5") return "Weekdays";
  if (sorted.join() === "0,6") return "Weekends";
  return sorted.map((d) => REPEAT_DAY_LABELS[d]).join(", ");
}

/* ---------------- natural-language command parsing (English + Hinglish) ---------------- */

export type AlarmIntent =
  | { kind: "create"; draft: AlarmDraft }
  | { kind: "update"; patch: Partial<AlarmDraft> }
  | { kind: "delete" }
  | { kind: "list" }
  | { kind: "none" };

const CREATE_RE = /(alarm\s*(laga|set|baja|rakh)|mujhe\s+(uthana|jagana)|wake\s*me|set\s+(an?\s+)?alarm|remind\s+me|alarm\s+की|अलार्म)/i;
const UPDATE_HINTS = /(alarm|अलार्म)/i;
const LIST_RE = /(show|list|batao|बताओ|दिखाओ|dikhao).*(alarm|अलार्म)|(alarm|अलार्म).*(list|show|batao|dikhao)/i;
const DELETE_RE = /(alarm|अलार्म).*(hata\s*do|delete|cancel|band\s*kar|remove)|(hatao|delete|cancel|remove).*(alarm|अलार्म)/i;

function parseTimeFromText(text: string): string | null {
  // "6:30", "6.30", "7 baje", "7:00 am", "shaam 7 baje", "subah 6 baje"
  const colon = text.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
  let h: number, min: number;
  if (colon) {
    h = parseInt(colon[1], 10);
    min = parseInt(colon[2], 10);
    const mer = colon[3]?.toLowerCase();
    if (mer === "pm" && h < 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
  } else {
    const baje = text.match(/(\d{1,2})\s*(baje|बजे|o'?clock)/i);
    if (!baje) return null;
    h = parseInt(baje[1], 10);
    min = 0;
  }
  if (!colon || (!colon[3] && h <= 12)) {
    // Hinglish day-part hints
    if (/(shaam|शाम|evening|raat|रात|night|dopahar|दोपहर|afternoon)/i.test(text) && h < 12) h += 12;
    else if (/(subah|सुबह|morning|savere|सवेरे)/i.test(text) && h === 12) h = 0;
    else if (!colon?.[3] && h < 7) h += 12; // bare small hour likely evening ("5 baje" -> 17:00) unless morning hint
  }
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function parseSnooze(text: string): number | null {
  const m = text.match(/(\d{1,2})\s*(minute|min|मिनट)\s*(ka\s*|ki\s*)?snooze/i) || text.match(/snooze\s*(\d{1,2})/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 60 ? n : null;
}

function parseRepeatDays(text: string): number[] | undefined {
  const lower = text.toLowerCase();
  if (/(roz|रोज|har\s*roz|every\s*day|daily)/.test(lower)) return [0, 1, 2, 3, 4, 5, 6];
  if (/weekday/.test(lower)) return [1, 2, 3, 4, 5];
  if (/weekend/.test(lower)) return [0, 6];
  const dayMap: [RegExp, number][] = [
    [/sun(day)?|ravivar|रविवार/, 0],
    [/mon(day)?|somvar|सोमवार/, 1],
    [/tue(sday)?|mangalvar|मंगलवार/, 2],
    [/wed(nesday)?|budhvar|बुधवार/, 3],
    [/thu(rsday)?|guruvar|गुरुवार/, 4],
    [/fri(day)?|shukravar|शुक्रवार/, 5],
    [/sat(urday)?|shanivar|शनिवार/, 6],
  ];
  const days: number[] = [];
  for (const [re, d] of dayMap) if (re.test(lower)) days.push(d);
  return days.length > 0 ? days : undefined;
}

function parseRingtone(text: string): RingtoneId | undefined {
  const lower = text.toLowerCase();
  if (/soft|धीम|dhimi|gentle/.test(lower)) return "soft";
  if (/digital|retro/.test(lower)) return "digital";
  if (/chime|bell|ghanti|घंटी/.test(lower)) return "chime";
  if (/siren|loud|tez|तेज़/.test(lower)) return "siren";
  if (/classic|normal|default/.test(lower)) return "classic";
  return undefined;
}

function parseSoundMode(text: string): SoundMode | undefined {
  const lower = text.toLowerCase();
  const noSound = /(sound\s*(hata|band|off|nahi)|bina\s*sound|without\s*sound|sirf\s*vibration|only\s*vibration|vibration\s*rakh)/.test(lower);
  const noVib = /(vibration\s*(hata|band|off|nahi)|bina\s*vibration|without\s*vibration|sirf\s*sound|only\s*sound)/.test(lower);
  const silent = /(silent|chup|चुप|mute)/.test(lower);
  const both = /(sound\s*\+?\s*vibration|vibration\s*(ke\s*)?saath|sound\s*(ke\s*)?saath|sound\s*and\s*vibration)/.test(lower);
  if (silent) return "silent";
  if (noSound) return "vibration_only";
  if (noVib) return "sound_only";
  if (both) return "sound_vibration";
  return undefined;
}

function parseVolume(text: string): number | undefined {
  const m = text.match(/volume\s*(\d{1,3})/i) || text.match(/(\d{1,3})\s*%\s*volume/i);
  if (m) {
    const n = parseInt(m[1], 10);
    return Math.min(100, Math.max(0, n)) / 100;
  }
  if (/full\s*volume|max\s*volume|poora\s*volume/i.test(text)) return 1;
  if (/half\s*volume|aadha\s*volume/i.test(text)) return 0.5;
  if (/low\s*volume|dheema\s*volume|kam\s*volume/i.test(text)) return 0.3;
  return undefined;
}

function parseLabel(text: string): string | undefined {
  const m = text.match(/(?:label|naam|name|title)\s*[:=]?\s*["']([^"']+)["']/i) || text.match(/(?:called|named)\s+([a-z0-9 ]{2,30})/i);
  return m ? m[1].trim() : undefined;
}

function extractQuoted(text: string): string | undefined {
  const m = text.match(/["“']([^"”']{2,120})["”']/);
  return m ? m[1] : undefined;
}

/** Parse a user chat message into an alarm intent. Returns {kind:"none"} if not alarm-related. */
export function parseAlarmCommand(raw: string): AlarmIntent {
  const text = raw.trim();
  if (!text) return { kind: "none" };
  const lower = text.toLowerCase();
  const mentionsAlarm = /alarm|अलार्म|remind|reminder|uthana|jagana|wake\s*me|snooze/.test(lower);
  if (!mentionsAlarm) return { kind: "none" };

  if (LIST_RE.test(text)) return { kind: "list" };
  if (DELETE_RE.test(text)) return { kind: "delete" };

  const time = parseTimeFromText(text);
  const snooze = parseSnooze(text);
  const ringtone = parseRingtone(text);
  const soundMode = parseSoundMode(text);
  const volume = parseVolume(text);
  const repeatDays = parseRepeatDays(text);
  const label = parseLabel(text);
  const wantsVibration = /vibration\s*(on|chalu|chaalu|rakh|with|ke\s*saath)|vibrate/.test(lower);

  const isCreate = CREATE_RE.test(text) && !!time;
  if (isCreate) {
    const draft: AlarmDraft = {
      alarm_time: time!,
      label: label || "Alarm",
      ringtone: ringtone || "classic",
      sound_mode: soundMode || (wantsVibration ? "sound_vibration" : "sound_vibration"),
      volume: volume ?? 0.8,
      enabled: true,
    };
    if (snooze) draft.snooze_minutes = snooze;
    if (repeatDays) draft.repeat_days = repeatDays;
    const quoted = extractQuoted(text);
    if (quoted) draft.notif_message = quoted;
    return { kind: "create", draft };
  }

  // update-style: must mention alarm and have something to change
  if (UPDATE_HINTS.test(text)) {
    const patch: Partial<AlarmDraft> = {};
    if (time) patch.alarm_time = time;
    if (snooze) patch.snooze_minutes = snooze;
    if (ringtone) patch.ringtone = ringtone;
    if (soundMode) patch.sound_mode = soundMode;
    if (volume !== undefined) patch.volume = volume;
    if (repeatDays) patch.repeat_days = repeatDays;
    if (label) patch.label = label;
    if (/(band\s*kar\s*do|turn\s*off|disable|off\s*kar)/i.test(lower) && !DELETE_RE.test(text)) patch.enabled = false;
    if (/(chalu\s*kar|turn\s*on|enable|on\s*kar)/i.test(lower)) patch.enabled = true;
    if (Object.keys(patch).length > 0) return { kind: "update", patch };
  }

  return { kind: "none" };
}

/** Human-readable summary of an alarm draft/patch, for AI confirmations. */
export function summarizeAlarm(a: { alarm_time: string; label?: string; repeat_days?: number[]; ringtone?: string; sound_mode?: string; snooze_minutes?: number; volume?: number }): string {
  const parts: string[] = [`${formatTime12(a.alarm_time)}`];
  if (a.label) parts.push(`"${a.label}"`);
  if (a.repeat_days && a.repeat_days.length > 0) parts.push(describeRepeat(a.repeat_days));
  if (a.sound_mode) parts.push(SOUND_MODES.find((s) => s.id === a.sound_mode)?.name || a.sound_mode);
  if (a.ringtone) parts.push(`${RINGTONES.find((r) => r.id === a.ringtone)?.name || a.ringtone} ringtone`);
  if (a.snooze_minutes) parts.push(`${a.snooze_minutes} min snooze`);
  if (a.volume !== undefined) parts.push(`volume ${Math.round(a.volume * 100)}%`);
  return parts.join(" · ");
}
