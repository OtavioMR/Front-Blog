import Link from "next/link";
import styles from "./post.module.css";

export default function PostNotFound() {
  return <main className={styles.message}><p>404</p><h1>História não encontrada.</h1><p>Este artigo não está disponível.</p><Link href="/">← Voltar ao início</Link></main>;
}
