"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";

const CloseAllContext = createContext<(() => void) | null>(null);

type PushListener = (url: string | URL | null | undefined) => void;
const pushListeners = new Set<PushListener>();
let pushPatched = false;

/**
 * Wraps `history.pushState` once per page. Next.js wraps it too and React may mount effects
 * twice (StrictMode), so per-effect wrapping would stack and count each push more than once;
 * scopes subscribe to the single wrapper instead.
 */
function onPush(listener: PushListener): () => void {
  if (!pushPatched) {
    pushPatched = true;
    const push = window.history.pushState;
    window.history.pushState = function (this: History, data, unused, url) {
      pushListeners.forEach((l) => l(url));
      return push.call(this, data, unused, url);
    };
  }
  pushListeners.add(listener);
  return () => pushListeners.delete(listener);
}

/**
 * Counts how many history entries were pushed on top of `home`, so closing a popup closes all
 * of them at once: reading → person → reading still closes straight to home. Every push counts —
 * a query-only step too (buy: "Солих" → choose another person) — while a replace (redirect)
 * doesn't. Counting pushes directly also holds once the browser caps `history.length` (50).
 * Back/forward steps down one.
 */
export function ModalScope({ home, children }: { home: string; children: ReactNode }) {
  const router = useRouter();
  const depth = useRef(0);

  useEffect(() => {
    const off = onPush((url) => {
      const path = url == null ? null : new URL(url, window.location.href).pathname;
      depth.current = path === home ? 0 : depth.current + 1;
    });
    const onPop = () => {
      depth.current = window.location.pathname === home ? 0 : Math.max(0, depth.current - 1);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      off();
      window.removeEventListener("popstate", onPop);
    };
  }, [home]);

  const closeAll = useCallback(() => {
    if (depth.current > 0) window.history.go(-depth.current);
    else router.push(home, { scroll: false });
  }, [home, router]);

  return <CloseAllContext value={closeAll}>{children}</CloseAllContext>;
}

/** Closes every popup back to home, or null outside a ModalScope. */
export function useCloseAllModals(): (() => void) | null {
  return useContext(CloseAllContext);
}
