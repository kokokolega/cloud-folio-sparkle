// Device push-token registration for the standalone Oltrid Alarm app.
// Native (Capacitor) devices register with APNs/FCM and store the token so the
// backend can wake the device even when the app is fully closed.
// Everything here is best-effort and must never throw into the UI.

import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/nativeAlarms";

export type PushStatus =
  | "registered"
  | "denied"
  | "unsupported"
  | "not-signed-in"
  | "error";

export interface PushState {
  status: PushStatus;
  token?: string;
}

function platform(): string {
  try {
    return (window as any)?.Capacitor?.getPlatform?.() || "web";
  } catch {
    return "web";
  }
}

function deviceLabel(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "iPhone / iPad";
  if (/Android/i.test(ua)) return "Android device";
  return "Desktop browser";
}

async function saveToken(token: string): Promise<PushStatus> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return "not-signed-in";

  const { error } = await (supabase.from("device_push_tokens") as any).upsert(
    {
      user_id: userId,
      token,
      platform: platform(),
      device_label: deviceLabel(),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
  if (error) {
    console.warn("Failed to store push token", error.message);
    return "error";
  }
  return "registered";
}

/**
 * Ask the OS for notification permission and register this device for push.
 * Returns "unsupported" in the browser — real background push needs the
 * installed Android/iOS build.
 */
export async function registerForPush(): Promise<PushState> {
  if (!isNativeApp()) return { status: "unsupported" };

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return { status: "denied" };

    const token = await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 15_000);
      PushNotifications.addListener("registration", (t) => {
        clearTimeout(timeout);
        resolve(t.value);
      });
      PushNotifications.addListener("registrationError", () => {
        clearTimeout(timeout);
        resolve(null);
      });
      PushNotifications.register();
    });

    if (!token) return { status: "error" };
    const status = await saveToken(token);
    return { status, token };
  } catch (e) {
    console.warn("Push registration failed", e);
    return { status: "error" };
  }
}

/** Remove this device's token (used on sign-out or when the user opts out). */
export async function unregisterPush(token: string) {
  try {
    await (supabase.from("device_push_tokens") as any).delete().eq("token", token);
  } catch {
    /* ignore */
  }
}
