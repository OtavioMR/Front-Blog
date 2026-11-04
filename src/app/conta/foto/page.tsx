import type { Metadata } from "next";
import PhotoForm from "./photo-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Foto de perfil", robots: { index: false, follow: false } };

export default function PhotoPage() {
  return <PhotoForm />;
}
