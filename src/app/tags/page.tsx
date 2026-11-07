import type { Metadata } from "next";
import Link from "next/link";
import { getTags, pageNumber } from "./data";
import styles from "../categorias/categories.module.css";

export const metadata: Metadata = { title: "Tags | Grifório", description: "Descubra artigos por tag." };
export default async function Tags({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageNumber((await searchParams).page);
  const result = await getTags(page).catch(() => null);
  return <main className={styles.page}><section aria-labelledby="tags-title">
    <div className={styles.intro}><p className={styles.eyebrow}>Explore por assunto</p><h1 id="tags-title">Descubra por tags.</h1><p>Encontre histórias por temas e ideias.</p></div>
    {!result ? <p className={styles.status} role="status">Não foi possível carregar as tags agora. Tente novamente em instantes.</p> : result.data.length === 0 ? <p className={styles.status}>Nenhuma tag encontrada nesta página.</p> : <div className={styles.grid}>{result.data.map(item => <article className={`${styles.card} article-surface`} key={item.id}><h2><Link href={`/tags/${encodeURIComponent(item.slug)}`}>{item.name}</Link></h2><Link className={`${styles.action} article-surface-link`} href={`/tags/${encodeURIComponent(item.slug)}`}>Explorar tag <span aria-hidden="true">↗</span></Link></article>)}</div>}
    {result && (result.meta.hasPreviousPage || result.meta.hasNextPage) && <nav className={styles.pagination} aria-label="Paginação de tags">{result.meta.hasPreviousPage && <Link href={`/tags?page=${page - 1}`}>← Anterior</Link>}<span>Página {result.meta.page} de {result.meta.totalPages}</span>{result.meta.hasNextPage && <Link href={`/tags?page=${page + 1}`}>Próxima →</Link>}</nav>}
  </section></main>;
}
