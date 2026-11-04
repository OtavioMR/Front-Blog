import type { Metadata } from "next";
import Studio from "./studio";
import { editorialWorkflowEnabled } from "./editorial-config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Studio", robots: { index: false, follow: false } };

export default function StudioPage() { return <Studio editorialEnabled={editorialWorkflowEnabled()} />; }
