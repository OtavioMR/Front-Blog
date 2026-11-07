import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader, SiteFooter } from "./_components/site-chrome";

export const metadata: Metadata = {
  title: "Grifório | Um espaço para boas ideias",
  description: "Um espaço para histórias, ideias e novas perspectivas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("entrelinhas-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;var b=localStorage.getItem("entrelinhas-bg-tone");document.documentElement.dataset.bgTone=(b==="warm"?"warm":"neutral");}catch(e){}})()` }} /></head>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
