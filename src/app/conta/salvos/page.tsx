import type { Metadata } from "next";
import SavedPosts from "./saved-posts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contos salvos", robots: { index: false, follow: false } };
export default function Page() { return <SavedPosts />; }
