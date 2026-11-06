import type { Metadata } from "next";
import BackButton from "@/app/_components/back-button";
import ThemeControl from "@/app/_components/theme-control";
import BackgroundToneControl from "@/app/_components/bg-tone-control";
import styles from "../conta/configuracoes/settings.module.css";

export const metadata: Metadata = { title: "Configurações | Entrelinhas", robots: { index: false, follow: true } };

export default function SiteSettings() {
  return (
    <main className={styles.page}>
      <BackButton fallback="/" />
      <p className={styles.eyebrow}>SUA EXPERIÊNCIA</p>
      <h1>Configurações.</h1>
      <p className={styles.intro}>Escolha como prefere ler neste navegador.</p>
      <section className={styles.panel} aria-labelledby="appearance">
        <h2 id="appearance">Aparência</h2>
        <p>Acompanhe o tema do dispositivo ou escolha uma aparência para este navegador.</p>
        <ThemeControl />
        <BackgroundToneControl />
      </section>
    </main>
  );
}
