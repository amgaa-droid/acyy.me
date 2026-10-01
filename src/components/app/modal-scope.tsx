"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";

const CloseAllContext = createContext<(() => void) | null>(null);

/**
 * Counts how many popups were opened on top of `home` (one per history entry), so closing a
 * popup closes all of them at once: reading → person → reading still closes straight to home.
 * A replace (redirect) adds no history entry and isn't counted; back/forward steps down.
 */
export function ModalScope({ home, children }: { home: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const depth = useRef(0);
  const popped = useRef(false);
  const length = useRef(0);

  useEffect(() => {
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (pathname === home) depth.current = 0;
    else if (popped.current) depth.current = Math.max(0, depth.current - 1);
    else if (window.history.length > length.current) depth.current += 1;
    popped.current = false;
    length.current = window.history.length;
  }, [pathname, home]);

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
