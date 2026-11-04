"use client";
import Link from "next/link";
import styles from "./profile.module.css";

export default function AuthorError({ reset }: { reset: () => void }) {
  return <main className={styles.page}><p className={styles.status} role="alert">Não foi possível carregar este perfil agora.</p><button type="button" onClick={reset}>Tentar novamente</button> <Link href="/">Voltar ao início</Link></main>;
}
