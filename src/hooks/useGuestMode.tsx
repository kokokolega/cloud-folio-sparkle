import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

interface GuestContextType {
  isGuest: boolean;
  guestExpired: boolean;
  startGuestSession: () => void;
  endGuestSession: () => void;
  guestMinutesLeft: number;
}

const GuestContext = createContext<GuestContextType>({
  isGuest: false,
  guestExpired: false,
  startGuestSession: () => {},
  endGuestSession: () => {},
  guestMinutesLeft: 60,
});

const GUEST_KEY = "fylix_guest_start";
const GUEST_DURATION = 60 * 60 * 1000; // 1 hour

export function GuestProvider({ children }: { children: ReactNode }) {
  const [isGuest, setIsGuest] = useState(false);
  const [guestExpired, setGuestExpired] = useState(false);
  const [guestMinutesLeft, setGuestMinutesLeft] = useState(60);

  const checkGuest = useCallback(() => {
    const start = localStorage.getItem(GUEST_KEY);
    if (!start) {
      setIsGuest(false);
      setGuestExpired(false);
      return;
    }
    const elapsed = Date.now() - parseInt(start);
    if (elapsed >= GUEST_DURATION) {
      setIsGuest(false);
      setGuestExpired(true);
    } else {
      setIsGuest(true);
      setGuestExpired(false);
      setGuestMinutesLeft(Math.ceil((GUEST_DURATION - elapsed) / 60000));
    }
  }, []);

  useEffect(() => {
    checkGuest();
    const interval = setInterval(checkGuest, 30000);
    return () => clearInterval(interval);
  }, [checkGuest]);

  const startGuestSession = () => {
    localStorage.setItem(GUEST_KEY, Date.now().toString());
    setIsGuest(true);
    setGuestExpired(false);
    setGuestMinutesLeft(60);
  };

  const endGuestSession = () => {
    localStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
    setGuestExpired(false);
  };

  return (
    <GuestContext.Provider value={{ isGuest, guestExpired, startGuestSession, endGuestSession, guestMinutesLeft }}>
      {children}
    </GuestContext.Provider>
  );
}

export const useGuestMode = () => useContext(GuestContext);
