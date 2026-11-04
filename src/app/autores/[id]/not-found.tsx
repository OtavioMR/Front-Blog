import Link from "next/link";
import styles from "./profile.module.css";

export default function AuthorNotFound() {
  return <main className={styles.page}><h1>Autor não encontrado</h1><p>Este perfil não está disponível.</p><Link href="/">Voltar ao início</Link></main>;
}
