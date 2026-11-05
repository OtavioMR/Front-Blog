import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BackButton from "@/app/_components/back-button";
import { getTag, getTagArticles, pageNumber } from "../data";
import styles from "../../categorias/categories.module.css";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = await getTag((await params).slug);
  return tag ? { title: `${tag.name} | Entrelinhas`, description: `Artigos sobre ${tag.name}.` } : { title: "Tag não encontrada | Entrelinhas", robots: { index: false } };
}
export default async function TagPage({ params, searchParams }: Props) {
  const tag = await getTag((await params).slug);
  if (!tag) notFound();
  const page = pageNumber((await searchParams).page);
  const result = await getTagArticles(tag.slug, page);
  const base = `/tags/${encodeURIComponent(tag.slug)}`;
  return <main className={styles.page}><section aria-labelledby="tag-title">
    <BackButton fallback="/tags" label="Todas as tags" />
    <div className={styles.intro}><p className={styles.eyebrow}>Tag</p><h1 id="tag-title">{tag.name}</h1></div>
    {result.data.length === 0 ? <p className={styles.status}>Ainda não há artigos nesta página.</p> : <div className={styles.grid}>{result.data.map(item => <article className={styles.card} key={item.id}><h2><Link prefetch={false} href={`/posts/${encodeURIComponent(item.slug)}`}>{item.title}</Link></h2><p>{item.excerpt}</p><Link className={styles.action} prefetch={false} href={`/posts/${encodeURIComponent(item.slug)}`}>Ler artigo <span aria-hidden="true">↗</span></Link></article>)}</div>}
    {(result.meta.hasPreviousPage || result.meta.hasNextPage) && <nav className={styles.pagination} aria-label="Paginação dos artigos">{result.meta.hasPreviousPage && <Link href={`${base}?page=${page - 1}`}>← Anterior</Link>}<span>Página {result.meta.page} de {result.meta.totalPages}</span>{result.meta.hasNextPage && <Link href={`${base}?page=${page + 1}`}>Próxima →</Link>}</nav>}
  </section></main>;
}
