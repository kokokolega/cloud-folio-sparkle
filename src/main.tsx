import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { pruneDrafts } from "./lib/localDraft";

// Drop local drafts that haven't been touched in a month.
pruneDrafts();

// The installed Android/iOS build ships the full Oltrid workspace, so it opens
// on the normal home route. Mark the shell as native for layout tweaks.
let isNativeShell = false;
try {
  isNativeShell = !!(window as any)?.Capacitor?.isNativePlatform?.();
  if (isNativeShell) {
    document.documentElement.classList.add("native-app");
  }
} catch {
  /* ignore */
}

// Service Worker Registration for PWA (browser only — native uses its own shell)
if (!isNativeShell && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available, show update notification
                if (confirm('New version available! Reload to update?')) {
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
