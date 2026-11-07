"use client";

import { usePathname } from "next/navigation";
import Navbar from "./navbar";
import Footer from "./footer";
import NavTracker from "./nav-tracker";
import { BackToTop, ReadingProgress } from "./reading-navigation";
import Toasts from "./toast";

// A administração tem layout próprio; o cabeçalho e o rodapé do blog não são renderizados nela.
const inAdministration = (pathname: string) =>
  pathname === "/gestao-editorial" ||
  pathname.startsWith("/gestao-editorial/") ||
  pathname === "/admin" ||
  pathname.startsWith("/admin/");

export function SiteHeader() {
  const pathname = usePathname();
  if (inAdministration(pathname)) return null;
  return <><ReadingProgress /><NavTracker /><Navbar /></>;
}

export function SiteFooter() {
  const pathname = usePathname();
  if (inAdministration(pathname)) return null;
  return <><Footer /><Toasts /><BackToTop /></>;
}
