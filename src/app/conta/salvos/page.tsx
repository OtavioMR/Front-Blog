import type { Metadata } from "next";
import SavedPosts from "./saved-posts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artigos salvos", robots: { index: false, follow: false } };
export default function Page() { return <SavedPosts />; }
