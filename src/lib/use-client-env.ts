"use client";
import { useMemo, useSyncExternalStore } from "react";

const noop = () => () => undefined;
const SERVER = JSON.stringify({ perm: "unsupported", ios: false, standalone: false });
function snapshot(): string {
  const nav = navigator as Navigator & { standalone?: boolean };
  return JSON.stringify({
    perm: "Notification" in window ? Notification.permission : "unsupported",
    ios: /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1),
    standalone: matchMedia("(display-mode: standalone)").matches || nav.standalone === true,
  });
}
/** Browser capabilities for notification UI, read without setState-in-effect and hydration-safe. */
export function useClientEnv(): { perm: string; ios: boolean; standalone: boolean } {
  const raw = useSyncExternalStore(noop, snapshot, () => SERVER);
  return useMemo(() => JSON.parse(raw), [raw]);
}

const subOnline = (cb: () => void) => { window.addEventListener("online", cb); window.addEventListener("offline", cb); return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); }; };
export function useOnline(): boolean { return useSyncExternalStore(subOnline, () => navigator.onLine, () => true); }
