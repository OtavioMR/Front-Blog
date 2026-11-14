import type { Metadata } from "next";
import Editor from "../editor";
import { notFound } from "next/navigation";
import { editorialWorkflowEnabled } from "../editorial-config";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Novo rascunho", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ seriesId?: string }> }) { if (!editorialWorkflowEnabled()) notFound(); const { seriesId } = await searchParams; return <Editor initialSeriesId={seriesId} />; }
