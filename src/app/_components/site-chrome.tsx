"use client";

import { usePathname } from "next/navigation";
import Navbar from "./navbar";
import Footer from "./footer";
import NavTracker from "./nav-tracker";
import { BackToTop, ReadingProgress } from "./reading-navigation";
import Toasts from "./toast";

export function SiteHeader() {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  return <><ReadingProgress /><NavTracker /><Navbar /></>;
}

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  return <><Footer /><Toasts /><BackToTop /></>;
}
