"use client";

import Link from "next/link";
import styles from "./post.module.css";

export default function PostError({ reset }: { reset: () => void }) {
  return <main className={styles.message}><p>ALGO NÃO SAIU COMO ESPERADO</p><h1>Não foi possível carregar esta história.</h1><p>Tente novamente em alguns instantes.</p><button onClick={reset}>Tentar novamente</button><Link href="/">← Voltar ao início</Link></main>;
}
