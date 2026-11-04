import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory, getCategoryArticles, pageNumber } from "../data";
import styles from "../categories.module.css";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }): Promise<Metadata> {
  const category = await getCategory((await params).slug);
  if (!category) return { title: "Categoria não encontrada | Entrelinhas", robots: { index: false } };
  const page = pageNumber((await searchParams).page);
  return {
    title: `${category.name}${page > 1 ? ` — página ${page}` : ""} | Entrelinhas`,
    description: category.description || `Explore artigos sobre ${category.name} no Entrelinhas.`,
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const { slug } = await params;
  const page = pageNumber((await searchParams).page);
  const category = await getCategory(slug);
  if (!category) notFound();
  const result = await getCategoryArticles(slug, page);
  if (!result) notFound();
  const base = `/categorias/${encodeURIComponent(category.slug)}`;
  return <main className={styles.page}>
    <header className={styles.header}><Link className={styles.brand} href="/">✳ entrelinhas.</Link><Link className={styles.back} href="/categorias">← Todas as categorias</Link></header>
    <section aria-labelledby="category-title">
      <div className={styles.intro}><p className={styles.eyebrow}>Categoria</p><h1 id="category-title">{category.name}</h1>{category.description && <p>{category.description}</p>}</div>
      {result.data.length === 0 ? <p className={styles.status}>Ainda não há artigos nesta página.</p> : <div className={styles.grid}>{result.data.map(item => <article className={styles.card} key={item.id}><h2><Link href={`/posts/${encodeURIComponent(item.slug)}`}>{item.title}</Link></h2><p>{item.excerpt}</p><p>{item.author?.name || "Equipe editorial"} · {item.readingTimeMinutes} min de leitura</p><Link className={styles.action} href={`/posts/${encodeURIComponent(item.slug)}`} aria-label={`Ler artigo: ${item.title}`}>Ler artigo <span aria-hidden="true">↗</span></Link></article>)}</div>}
      {(result.meta.hasPreviousPage || result.meta.hasNextPage) && <nav className={styles.pagination} aria-label="Paginação dos artigos">{result.meta.hasPreviousPage && <Link href={`${base}?page=${page - 1}`}>← Anterior</Link>}<span>Página {result.meta.page} de {result.meta.totalPages}</span>{result.meta.hasNextPage && <Link href={`${base}?page=${page + 1}`}>Próxima →</Link>}</nav>}
    </section>
  </main>;
}
