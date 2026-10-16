"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

function remaining(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// A ticking clock as an external store, so the server render never reads the time.
const subscribe = (onTick: () => void) => {
  const timer = setInterval(onTick, 1000);
  return () => clearInterval(timer);
};
const nowSeconds = () => Math.floor(Date.now() / 1000);
const serverSnapshot = () => null;

export function Countdown({ closesAt }: { closesAt: string }) {
  const router = useRouter();
  const target = new Date(closesAt).getTime();
  const now = useSyncExternalStore(subscribe, nowSeconds, serverSnapshot);
  const expired = now !== null && now * 1000 >= target;

  useEffect(() => {
    if (expired) router.refresh();
  }, [expired, router]);

  const label = new Date(closesAt).toLocaleString();
  return (
    <time dateTime={closesAt} title={label}>
      {now === null ? `Closes ${label}` : expired ? "Closing…" : `Closes in ${remaining(target - now * 1000)}`}
    </time>
  );
}
