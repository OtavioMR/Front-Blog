import type { Metadata } from "next";
import Account from "../session-account";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "E-mail de recuperação", robots: { index: false, follow: false } };

export default function Page() { return <Account section="recovery-email" />; }
