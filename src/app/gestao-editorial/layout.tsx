import type { Metadata } from "next";

export const metadata: Metadata = { title: "Administração | Grifório", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Layout raiz da administração: sem navbar, rodapé ou menus do blog público.
export default function AdministrationLayout({ children }: { children: React.ReactNode }) { return children; }
