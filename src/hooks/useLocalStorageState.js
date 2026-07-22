import { useEffect, useState } from "react";

// Personal, per-device state (never shared with other members) -- used for
// "My Info" and each member's own outreach tracking.
export function useLocalStorageState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch (err) {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (err) {
      // Storage unavailable (e.g. private browsing) -- fail silently.
    }
  }, [key, state]);

  return [state, setState];
}
