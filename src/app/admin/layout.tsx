import type { Metadata } from "next";

export const metadata: Metadata = { title: "Administração | Grifório", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function AdminLayout({ children }: { children: React.ReactNode }) { return children; }
