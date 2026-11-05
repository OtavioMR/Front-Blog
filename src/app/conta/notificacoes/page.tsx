import type { Metadata } from "next";
import NotificationsView from "./view";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notificações", robots: { index: false, follow: false } };
export default function Page() { return <NotificationsView />; }
