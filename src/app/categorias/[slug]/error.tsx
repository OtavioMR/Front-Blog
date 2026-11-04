"use client";

import Link from "next/link";
import styles from "../categories.module.css";

export default function CategoryError({ reset }: { reset: () => void }) {
  return <main className={styles.page}><p className={styles.status} role="alert">Não foi possível carregar esta categoria agora.</p><button type="button" onClick={reset}>Tentar novamente</button> <Link href="/categorias">Ver categorias</Link></main>;
}
