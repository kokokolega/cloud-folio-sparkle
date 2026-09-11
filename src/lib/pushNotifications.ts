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
  | "not-configured"
  | "open-in-new-tab"
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

/** Browser (Firebase Cloud Messaging) registration — used when not in the native app. */
async function registerWeb(): Promise<PushState> {
  const appId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID as string | undefined;
  const vapidKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY as string | undefined;
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY as string | undefined,
    projectId: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID as string | undefined,
    appId,
    messagingSenderId: appId?.split(":")[1] ?? "",
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !appId || !vapidKey || !firebaseConfig.messagingSenderId) {
    return { status: "not-configured" };
  }
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return { status: "unsupported" };

  try {
    const { initializeApp } = await import("firebase/app");
    const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) return { status: "unsupported" };
    if (window.top !== window.self) return { status: "open-in-new-tab" };

    const permission =
      Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") return { status: "denied" };

    const query = new URLSearchParams(firebaseConfig as Record<string, string>).toString();
    const serviceWorkerRegistration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${query}`,
    );
    const messaging = getMessaging(initializeApp(firebaseConfig, "oltrid-push"));
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration });
    if (!token) return { status: "denied" };
    return { status: await saveToken(token), token };
  } catch (e) {
    console.warn("Web push registration failed", e);
    return { status: "error" };
  }
}

/**
 * Ask the OS (or browser) for notification permission and register this device
 * for push so alarms alert even when the app is closed.
 */
export async function registerForPush(): Promise<PushState> {
  if (!isNativeApp()) return registerWeb();


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
