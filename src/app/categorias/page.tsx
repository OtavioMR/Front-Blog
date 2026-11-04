import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, pageNumber } from "./data";
import styles from "./categories.module.css";

export const metadata: Metadata = { title: "Categorias | Entrelinhas", description: "Explore artigos por assunto no Entrelinhas." };

export default async function Categories({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageNumber((await searchParams).page);
  const result = await getCategories(page).catch(() => null);
  return <main className={styles.page}>
    <header className={styles.header}><Link className={styles.brand} href="/">✳ entrelinhas.</Link><Link className={styles.back} href="/">← Voltar ao início</Link></header>
    <section aria-labelledby="categories-title">
      <div className={styles.intro}><p className={styles.eyebrow}>Explore por assunto</p><h1 id="categories-title">Encontre sua próxima leitura.</h1><p>Ideias e histórias reunidas por temas para despertar a curiosidade.</p></div>
      {!result ? <p className={styles.status} role="status">Não foi possível carregar as categorias agora. Tente novamente em instantes.</p> : result.data.length === 0 ? <p className={styles.status}>Nenhuma categoria encontrada nesta página.</p> : <div className={styles.grid}>{result.data.map(item => <article className={styles.card} key={item.id}><h2><Link href={`/categorias/${encodeURIComponent(item.slug)}`}>{item.name}</Link></h2>{item.description && <p>{item.description}</p>}<Link className={styles.action} href={`/categorias/${encodeURIComponent(item.slug)}`} aria-label={`Explorar categoria: ${item.name}`}>Explorar categoria <span aria-hidden="true">↗</span></Link></article>)}</div>}
      {result && (result.meta.hasPreviousPage || result.meta.hasNextPage) && <nav className={styles.pagination} aria-label="Paginação de categorias">{result.meta.hasPreviousPage && <Link href={`/categorias?page=${page - 1}`}>← Anterior</Link>}<span>Página {result.meta.page} de {result.meta.totalPages}</span>{result.meta.hasNextPage && <Link href={`/categorias?page=${page + 1}`}>Próxima →</Link>}</nav>}
    </section>
  </main>;
}
