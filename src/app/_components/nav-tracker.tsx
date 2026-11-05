"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Remembers the previous in-app page so BackButton can decide between history and a fallback route.
export default function NavTracker() {
  const pathname = usePathname();
  const initialized = useRef(false);
  useEffect(() => {
    try {
      if (!initialized.current) {
        initialized.current = true;
        sessionStorage.removeItem("blog-nav-prev");
        sessionStorage.setItem("blog-nav-current", pathname);
        return;
      }
      const current = sessionStorage.getItem("blog-nav-current");
      if (current && current !== pathname) sessionStorage.setItem("blog-nav-prev", current);
      sessionStorage.setItem("blog-nav-current", pathname);
    } catch { /* Storage unavailable: BackButton uses its fallback. */ }
  }, [pathname]);
  return null;
}
