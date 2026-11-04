import type { Metadata } from "next";
import PasswordForm from "./password-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Alterar senha", robots: { index: false, follow: false } };

export default function PasswordPage() { return <PasswordForm />; }
