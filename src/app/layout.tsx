import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { SiteHeader, SiteFooter } from "./_components/site-chrome";

export const metadata: Metadata = {
  title: "Grifório | Um espaço para boas ideias",
  description: "Um espaço para histórias, ideias e novas perspectivas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=location.pathname;var t=p.startsWith('/gestao-editorial')?localStorage.getItem('admin-theme'):localStorage.getItem('entrelinhas-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;var b=localStorage.getItem('entrelinhas-bg-tone');document.documentElement.dataset.bgTone=(b==='warm'?'warm':'neutral');}catch(e){}})()`,
          }}
        />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
