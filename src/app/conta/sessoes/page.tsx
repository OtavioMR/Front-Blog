import type { Metadata } from "next";
import Sessions from "./sessions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sessões da conta", robots: { index: false, follow: false } };
export default function Page() { return <Sessions />; }
