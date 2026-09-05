import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { pruneDrafts } from "./lib/localDraft";

// Drop local drafts that haven't been touched in a month.
pruneDrafts();

// The installed Android/iOS build ships as the standalone Oltrid Alarms app:
// launch straight into the alarm screen instead of the web workspace.
try {
  const isNative = !!(window as any)?.Capacitor?.isNativePlatform?.();
  if (isNative && (window.location.pathname === "/" || window.location.pathname === "/index.html")) {
    window.history.replaceState(null, "", "/alarm");
  }
} catch {
  /* ignore */
}




// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
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
