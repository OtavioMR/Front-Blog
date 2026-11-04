import Link from "next/link";
import styles from "../categories.module.css";

export default function CategoryNotFound() {
  return <main className={styles.page}><h1>Categoria não encontrada</h1><p>Ela pode ter sido removida ou não estar disponível.</p><Link href="/categorias">Ver categorias</Link></main>;
}
