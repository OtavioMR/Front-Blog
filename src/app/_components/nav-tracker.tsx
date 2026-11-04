"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Remembers the previous in-app page so BackButton can decide between history and a fallback route.
export default function NavTracker() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const current = sessionStorage.getItem("blog-nav-current");
      if (current && current !== pathname) sessionStorage.setItem("blog-nav-prev", current);
      sessionStorage.setItem("blog-nav-current", pathname);
    } catch { /* Storage unavailable: BackButton uses its fallback. */ }
  }, [pathname]);
  return null;
}