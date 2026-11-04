import type { Metadata } from "next";
import "./globals.css";
import { BackToTop, ReadingProgress } from "./_components/reading-navigation";

export const metadata: Metadata = {
  title: "Blog | Um espaço para boas ideias",
  description: "Um espaço para histórias, ideias e novas perspectivas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><ReadingProgress />{children}<BackToTop /></body>
    </html>
  );
}
