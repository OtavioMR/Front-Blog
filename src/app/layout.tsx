import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./_components/navbar";
import NavTracker from "./_components/nav-tracker";
import { BackToTop, ReadingProgress } from "./_components/reading-navigation";
import Toasts from "./_components/toast";

export const metadata: Metadata = {
  title: "Blog | Um espaço para boas ideias",
  description: "Um espaço para histórias, ideias e novas perspectivas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("entrelinhas-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()` }} /></head>
      <body>
        <ReadingProgress />
        <NavTracker />
        <Navbar />
        {children}
        <Toasts />
        <BackToTop />
      </body>
    </html>
  );
}
