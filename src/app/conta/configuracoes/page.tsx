import type { Metadata } from "next";
import Link from "next/link";
import AccountBack from "@/app/conta/account-back";
import ThemeControl from "@/app/_components/theme-control";
import DeactivateControl from "./deactivate-control";
import styles from "./settings.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configurações", robots: { index: false, follow: false } };

export default function SettingsPage() {
  return <main className={styles.page}><AccountBack /><p className={styles.eyebrow}>SEU ESPAÇO</p><h1>Configurações.</h1><p className={styles.intro}>Cuide da sua conta e escolha como prefere ler.</p>
    <section className={styles.panel} aria-labelledby="appearance"><h2 id="appearance">Aparência</h2><p>Acompanhe o tema do dispositivo ou escolha uma aparência para este navegador.</p><ThemeControl /></section>
    <section className={styles.panel} aria-labelledby="account"><h2 id="account">Conta</h2><nav aria-label="Configurações da conta"><ul className={styles.links}><li><Link href="/conta/perfil"><strong>Perfil</strong><span>Nome, biografia e links</span></Link></li><li><Link href="/conta/foto"><strong>Foto</strong><span>Atualize sua imagem de perfil</span></Link></li><li><Link href="/conta/email"><strong>E-mail</strong><span>Solicite a alteração do endereço</span></Link></li></ul></nav></section>
    <section className={styles.panel} aria-labelledby="security"><h2 id="security">Segurança</h2><nav aria-label="Configurações de segurança"><ul className={styles.links}><li><Link href="/conta/senha"><strong>Senha</strong><span>Altere sua senha de acesso</span></Link></li><li><Link href="/conta/sessoes"><strong>Sessões</strong><span>Revise e encerre acessos</span></Link></li><li><Link href="/conta#security-title"><strong>Verificação em duas etapas</strong><span>Configure seu aplicativo autenticador</span></Link></li></ul></nav></section>
    <section className={styles.panel} aria-labelledby="deactivate"><h2 id="deactivate">Desativar conta</h2><DeactivateControl /></section>
  </main>;
}
