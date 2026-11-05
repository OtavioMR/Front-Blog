import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { editorialWorkflowEnabled } from "../editorial-config";
import SeriesManager from "./series-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minhas séries", robots: { index: false, follow: false } };
export default function Page() {
  if (!editorialWorkflowEnabled()) notFound();
  return <SeriesManager />;
}
