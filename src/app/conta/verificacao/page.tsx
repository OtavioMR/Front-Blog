import type { Metadata } from "next";
import Account from "../session-account";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verificação em duas etapas", robots: { index: false, follow: false } };

export default function Page() { return <Account section="totp" />; }
