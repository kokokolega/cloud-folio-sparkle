import { useEffect, useRef, useState, useCallback } from "react";

interface UseIdleTimeoutOptions {
  timeout?: number; // ms before logout (default 60s)
  warningBefore?: number; // ms before timeout to show warning (default 10s)
  onTimeout: () => void;
  enabled?: boolean;
}

export function useIdleTimeout({
  timeout = 60_000,
  warningBefore = 10_000,
  onTimeout,
  enabled = true,
}: UseIdleTimeoutOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const warningTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();

  const resetTimers = useCallback(() => {
    if (!enabled) return;
    setShowWarning(false);
    clearTimeout(timerRef.current);
    clearTimeout(warningTimerRef.current);
    clearInterval(countdownRef.current);

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsLeft(Math.ceil(warningBefore / 1000));
      countdownRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, timeout - warningBefore);

    timerRef.current = setTimeout(() => {
      setShowWarning(false);
      onTimeout();
    }, timeout);
  }, [timeout, warningBefore, onTimeout, enabled]);

  const dismissWarning = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    if (!enabled) return;

    const events = ["mousemove", "keydown", "scroll", "touchstart", "click"];
    const handler = () => resetTimers();

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetTimers();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      clearTimeout(timerRef.current);
      clearTimeout(warningTimerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [resetTimers, enabled]);

  return { showWarning, secondsLeft, dismissWarning };
}
