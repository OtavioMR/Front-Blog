import type { Metadata } from "next";
import FeedView from "./view";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Seu feed", robots: { index: false, follow: false } };
export default function Page() { return <FeedView />; }
