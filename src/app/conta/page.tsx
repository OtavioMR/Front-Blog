import type { Metadata } from "next";
import Account from "./session-account";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minha conta", robots: { index: false, follow: false } };

export default function AccountPage() { return <Account />; }
