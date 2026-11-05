import type { Metadata } from "next";
import EmailForm from "./email-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Alterar e-mail", robots: { index: false, follow: false } };

export default function EmailPage() { return <EmailForm />; }
