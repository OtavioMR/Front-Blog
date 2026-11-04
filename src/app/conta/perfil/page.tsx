import type { Metadata } from "next";
import ProfileForm from "./profile-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editar perfil", robots: { index: false, follow: false } };

export default function ProfilePage() { return <ProfileForm />; }
