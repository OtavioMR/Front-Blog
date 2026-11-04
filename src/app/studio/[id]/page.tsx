import type { Metadata } from "next";
import Editor from "../editor";
import { notFound } from "next/navigation";
import { editorialWorkflowEnabled } from "../editorial-config";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editar rascunho", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { if (!editorialWorkflowEnabled()) notFound(); return <Editor initialId={(await params).id} />; }
