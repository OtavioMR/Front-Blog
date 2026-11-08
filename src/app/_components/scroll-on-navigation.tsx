"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export default function ScrollOnNavigation() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const historyNavigation = useRef(false);

  useEffect(() => {
    const onPopState = () => { historyNavigation.current = window.location.pathname !== previousPath.current; };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (previousPath.current !== pathname) {
      if (!historyNavigation.current && !window.location.hash) window.scrollTo({ top: 0, behavior: "instant" });
      previousPath.current = pathname;
    }
    historyNavigation.current = false;
  }, [pathname]);

  return null;
}
