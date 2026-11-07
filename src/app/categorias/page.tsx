import type { Metadata } from "next";
import Link from "next/link";
import Form from "next/form";
import { getCategories, pageNumber } from "./data";
import styles from "./categories.module.css";

export const metadata: Metadata = { title: "Categorias | Grifório", description: "Explore artigos por assunto no Grifório." };

export default async function Categories({ searchParams }: { searchParams: Promise<{ page?: string; search?: string; articleSearch?: string; author?: string }> }) {
  const query = await searchParams;
  const page = pageNumber(query.page);
  const clean = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 100) : "";
  const search = clean(query.search), articleSearch = clean(query.articleSearch), author = clean(query.author);
  const result = await getCategories(page, search).catch(() => null);
  const context = { ...(articleSearch && { articleSearch }), ...(author && { author }) };
  const pageUrl = (number: number) => `/categorias?${new URLSearchParams({ ...context, ...(search && { search }), page: String(number) })}`;
  const filterUrl = (slug: string) => `/?${new URLSearchParams({ ...(articleSearch && { search: articleSearch }), ...(author && { author }), categorySlug: slug })}#artigos`;
  return <main className={styles.page}>
    <section aria-labelledby="categories-title">
      <div className={styles.intro}><p className={styles.eyebrow}>Explore por assunto</p><h1 id="categories-title">Encontre sua próxima leitura.</h1><p>Ideias e histórias reunidas por temas para despertar a curiosidade.</p><Link href="/tags">Explorar tags</Link></div>
      <Form key={`${search}|${articleSearch}|${author}`} className={styles.search} action="/categorias" role="search" aria-label="Buscar categorias">
        <label htmlFor="category-search">Buscar categoria</label>
        <div><input id="category-search" name="search" type="search" defaultValue={search} maxLength={100} placeholder="Nome ou assunto" />{articleSearch && <input type="hidden" name="articleSearch" value={articleSearch} />}{author && <input type="hidden" name="author" value={author} />}<button type="submit">Buscar</button></div>
        {search && <Link href={`/categorias?${new URLSearchParams(context)}`}>Limpar busca</Link>}
      </Form>
      {!result ? <p className={styles.status} role="status">Não foi possível carregar as categorias agora. Tente novamente em instantes.</p> : result.data.length === 0 ? <p className={styles.status}>{search ? "Nenhuma categoria encontrada para esta busca." : page > 1 ? "Nenhuma categoria encontrada nesta página." : "Ainda não há categorias cadastradas."}</p> : <div className={styles.grid}>{result.data.map(item => <article className={`${styles.card} article-surface`} key={item.id}><h2><Link href={`/categorias/${encodeURIComponent(item.slug)}`}>{item.name}</Link></h2>{item.description && <p>{item.description}</p>}<Link className={`${styles.action} article-surface-secondary`} href={filterUrl(item.slug)}>Filtrar artigos por {item.name} →</Link><Link className={`${styles.detail} article-surface-link`} href={`/categorias/${encodeURIComponent(item.slug)}`} aria-label={`Explorar categoria: ${item.name}`}>Ver página da categoria ↗</Link></article>)}</div>}
      {result && (result.meta.hasPreviousPage || result.meta.hasNextPage) && <nav className={styles.pagination} aria-label="Paginação de categorias">{result.meta.hasPreviousPage && <Link href={pageUrl(page - 1)}>← Anterior</Link>}<span>Página {result.meta.page} de {result.meta.totalPages}</span>{result.meta.hasNextPage && <Link href={pageUrl(page + 1)}>Próxima →</Link>}</nav>}
    </section>
  </main>;
}
