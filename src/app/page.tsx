import Link from "next/link";
import Form from "next/form";
import type { Metadata } from "next";
import Image from "next/image";
import styles from "./home.module.css";
import { NewsletterForm } from "./newsletter-form";

type ArticleSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string | null;
  readingTimeMinutes: number;
  coverImage?: string | null;
  author?: { id: string; name: string };
  categories?: { name: string }[];
};

type ArticlePage = {
  data: ArticleSummary[];
  meta: { page: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean };
};

type QueryParams = { search?: string | string[]; author?: string | string[]; categorySlug?: string | string[]; page?: string | string[] };

export async function generateMetadata({ searchParams }: { searchParams: Promise<QueryParams> }): Promise<Metadata> {
  const { search, author, categorySlug } = await searchParams;
  if ([search, author, categorySlug].some((value) => typeof value === "string" && value.trim())) return { title: "Busca de artigos", robots: { index: false, follow: true } };
  return { title: "Grifório | Um espaço para boas ideias" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArticleSummary(value: unknown): value is ArticleSummary {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.slug === "string"
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)
    && typeof value.title === "string"
    && typeof value.excerpt === "string"
    && value.published === true
    && value.isActive === true
    && (value.publishedAt === null || typeof value.publishedAt === "string")
    && typeof value.readingTimeMinutes === "number"
    && (value.coverImage === undefined || value.coverImage === null || typeof value.coverImage === "string")
    && (value.author === undefined || (isRecord(value.author) && typeof value.author.id === "string" && typeof value.author.name === "string"))
    && (value.categories === undefined || (Array.isArray(value.categories) && value.categories.every((category: unknown) => isRecord(category) && typeof category.name === "string")));
}

function pageLink(page: number, search: string, author: string, category: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (author) params.set("author", author);
  if (category) params.set("categorySlug", category);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/${query ? `?${query}` : ""}#artigos`;
}

async function getArticles(page: number, search: string, author: string, category: string): Promise<ArticlePage> {
  const params = new URLSearchParams({ page: String(page), limit: "6" });
  if (search) params.set("search", search);
  if (author) params.set("author", author);
  if (category) params.set("categorySlug", category);
  const response = await fetch(`${process.env.API_ORIGIN || "http://localhost:3001"}/api/v1/posts?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("API indisponível");
  const result: unknown = await response.json();
  if (!isRecord(result) || !Array.isArray(result.data) || !result.data.every(isArticleSummary) || !isRecord(result.meta)
      || typeof result.meta.page !== "number" || typeof result.meta.totalPages !== "number"
      || typeof result.meta.hasNextPage !== "boolean" || typeof result.meta.hasPreviousPage !== "boolean") {
    throw new Error("Resposta inválida");
  }
  return result as ArticlePage;
}

async function getCategories(): Promise<{ slug: string; name: string }[] | null> {
  try {
    const response = await fetch(`${process.env.API_ORIGIN || "http://localhost:3001"}/api/v1/categories?limit=6`, {
      cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    if (!isRecord(value) || !Array.isArray(value.data) || !value.data.every((item: unknown) =>
      isRecord(item) && typeof item.slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)
      && typeof item.name === "string" && item.isActive === true)) return null;
    return value.data as { slug: string; name: string }[];
  } catch { return null; }
}

export default async function Home({ searchParams }: { searchParams: Promise<QueryParams> }) {
  const query = await searchParams;
  const search = typeof query.search === "string" ? query.search.trim().slice(0, 100) : "";
  const author = typeof query.author === "string" ? query.author.trim().slice(0, 100) : "";
  const category = typeof query.categorySlug === "string" ? query.categorySlug.trim().slice(0, 100) : "";
  const requestedPage = typeof query.page === "string" && /^[1-9]\d*$/.test(query.page) ? Number(query.page) : 1;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [articles, categories] = await Promise.all([getArticles(page, search, author, category), getCategories()]);
  const filtering = Boolean(search || author || category);
  const showFeatured = page === 1 && !filtering && articles.data.length > 0;
  const featured = showFeatured ? articles.data[0] : null;
  const rest = showFeatured ? articles.data.slice(1) : articles.data;
  const cover = (a: ArticleSummary) => Boolean(a.coverImage && /^\/uploads\/post-covers\/[a-z0-9-]+\.webp$/i.test(a.coverImage));

  return (
    <main className={styles.homeContainer}>
      <div className={styles.homeInner}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span className={styles.eyebrowLine} /> HISTÓRIAS QUE CONECTAM</p>
            <h1 id="hero-title" className={styles.heroTitle}>Sempre existe <em>mais</em> para descobrir.</h1>
            <p className={styles.introduction}>
              Um lugar para desacelerar, encontrar novas perspectivas e deixar a curiosidade levar você mais longe.
            </p>
            <div className={styles.heroFooter}>
              <a href="#artigos" className={styles.heroCta}>EXPLORAR ARTIGOS <span aria-hidden="true">↘</span></a>
            </div>
          </div>
          <div className={styles.heroArtwork} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/branding/hero-editorial-laranja.svg" alt="" className={styles.heroImgLight} width="850" height="720" fetchPriority="high" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/branding/hero-editorial-laranja-escuro.svg" alt="" className={styles.heroImgDark} width="850" height="720" fetchPriority="high" />
          </div>
        </section>

        <section className={styles.discovery} aria-label="Encontrar leituras">
          <Form key={`${search}|${author}|${category}`} className={styles.search} action="/#artigos" role="search" aria-label="Busca de artigos">
            <div className={styles.field}><label htmlFor="search">Buscar artigos</label><input id="search" name="search" type="search" defaultValue={search} maxLength={100} placeholder="Título ou assunto" /></div>
            <div className={styles.field}><label htmlFor="author">Autor <span>(opcional)</span></label><input id="author" name="author" type="search" defaultValue={author} maxLength={100} placeholder="Nome do autor" /></div>
            {category && <input type="hidden" name="categorySlug" value={category} />}
            <button type="submit">Buscar</button>
          </Form>
          <nav className={styles.categoryNav} aria-label="Filtrar por categorias">
            <span className={styles.categoryNavLabel}>Assuntos:</span>
            <div className={styles.categoryList}>
              {categories?.map((item) => <Link key={item.slug} href={pageLink(1, search, author, item.slug)} aria-current={category === item.slug ? "true" : undefined} className={`${styles.categoryPill} ${category === item.slug ? styles.categoryPillActive : ""}`}>{item.name}</Link>)}
              <Link className={styles.categoryPill} href={`/categorias?${new URLSearchParams({ ...(search && { articleSearch: search }), ...(author && { author }) })}`}>Ver todas as categorias →</Link>
            </div>
            {!categories && <span>Não foi possível carregar os assuntos em destaque.</span>}
            {categories && categories.length === 0 && <span>Ainda não há categorias cadastradas.</span>}
          </nav>
        </section>

        <section className={styles.articles} id="artigos" aria-labelledby="articles-title">
          <div className={styles.articlesHeading}>
            <div>
              <p className={styles.eyebrow}><span className={styles.eyebrowLine} /> LEITURAS PARA DESCOBRIR</p>
              <h2 id="articles-title">Ideias para ficar um pouco mais.</h2>
            </div>
          </div>

          {filtering && (
            <div className={styles.resultSummary}>
              <div className={styles.filterChips}>
                <span>Filtrando por:</span>
                {search && <span className={styles.chip}>Busca: “{search}”</span>}
                {author && <span className={styles.chip}>Autor: {author}</span>}
                {category && <span className={styles.chip}>Categoria: {categories?.find(item => item.slug === category)?.name || category}</span>}
              </div>
              <Link className={styles.clearFilters} href="/#artigos">Limpar filtros ✕</Link>
            </div>
          )}

          {articles.data.length === 0 ? (
            <div className={styles.articleStatus}>
              <p className={styles.emptyTitle}>
                {page > 1 ? "Não há artigos nesta página." : filtering ? "Nenhum artigo encontrado para esta busca." : "Ainda não há artigos publicados por aqui."}
              </p>
              {filtering && <p className={styles.emptySubtitle}>Tente pesquisar por outros termos ou explorar outras categorias.</p>}
              {filtering ? (
                <Link className={styles.clearSearchBtn} href="/#artigos">Ver todos os artigos</Link>
              ) : page > 1 ? (
                <Link className={styles.clearSearchBtn} href={pageLink(1, search, author, category)}>Voltar à primeira página</Link>
              ) : null}
            </div>
          ) : (
            <>
              {featured && (
                <article className={`${styles.featured} article-surface`}>
                  {cover(featured) && <Link prefetch={false} href={`/posts/${encodeURIComponent(featured.slug)}`} className={styles.featuredCover} tabIndex={-1} aria-hidden="true"><Image className={styles.coverBackdrop} src={featured.coverImage!} alt="" width={960} height={540} sizes="(max-width: 800px) 100vw, 55vw" unoptimized /><Image src={featured.coverImage!} alt="" width={960} height={540} sizes="(max-width: 800px) 100vw, 55vw" priority unoptimized /></Link>}
                  <div className={styles.featuredBody}>
                    <p className={styles.leadLabel}>PUBLICAÇÃO RECENTE <span aria-hidden="true">↗</span></p>
                    <p className={styles.articleCategory}>{featured.categories?.[0]?.name || "LEITURA"}</p>
                    <h3><Link prefetch={false} href={`/posts/${encodeURIComponent(featured.slug)}`}>{featured.title}</Link></h3>
                    <p className={styles.articleExcerpt}>{featured.excerpt}</p>
                    <p className={styles.articleMeta}>{featured.author ? <Link className="article-surface-secondary" href={`/autores/${encodeURIComponent(featured.author.id)}`}>{featured.author.name}</Link> : "Equipe editorial"} {featured.readingTimeMinutes ? `· ${featured.readingTimeMinutes} min de leitura` : ""}</p>
                    <Link className={`${styles.articleLink} article-surface-link`} prefetch={false} href={`/posts/${encodeURIComponent(featured.slug)}`} aria-label={`Ler artigo: ${featured.title}`}>Ler artigo <span aria-hidden="true">↗</span></Link>
                  </div>
                </article>
              )}
              {rest.length > 0 && <div className={styles.articleGrid}>
                {rest.map((article) => (
                  <article className={`${styles.card} article-surface`} key={article.id}>
                    {cover(article) && <Link prefetch={false} href={`/posts/${encodeURIComponent(article.slug)}`} className={styles.cardCover} tabIndex={-1} aria-hidden="true"><Image className={styles.coverBackdrop} src={article.coverImage!} alt="" width={960} height={540} sizes="(max-width: 700px) 100vw, 33vw" unoptimized /><Image src={article.coverImage!} alt="" width={960} height={540} sizes="(max-width: 700px) 100vw, 33vw" unoptimized /></Link>}
                    <p className={styles.articleCategory}>{article.categories?.[0]?.name || "LEITURA"}</p>
                    <h3><Link prefetch={false} href={`/posts/${encodeURIComponent(article.slug)}`}>{article.title}</Link></h3>
                    <p className={styles.articleExcerpt}>{article.excerpt}</p>
                    <p className={styles.articleMeta}>{article.author ? <Link className="article-surface-secondary" href={`/autores/${encodeURIComponent(article.author.id)}`}>{article.author.name}</Link> : "Equipe editorial"} {article.readingTimeMinutes ? `· ${article.readingTimeMinutes} min de leitura` : ""}</p>
                    <Link className={`${styles.articleLink} article-surface-link`} prefetch={false} href={`/posts/${encodeURIComponent(article.slug)}`} aria-label={`Ler artigo: ${article.title}`}>Ler artigo <span aria-hidden="true">↗</span></Link>
                  </article>
                ))}
              </div>}
            </>
          )}
          {(articles.meta.hasPreviousPage || articles.meta.hasNextPage) && (
            <nav className={styles.pagination} aria-label="Paginação dos artigos">
              {articles.meta.hasPreviousPage && <Link href={pageLink(page - 1, search, author, category)}>← Anterior</Link>}
              <span>Página {articles.meta.page}{articles.meta.totalPages > 0 && ` de ${articles.meta.totalPages}`}</span>
              {articles.meta.hasNextPage && <Link href={pageLink(page + 1, search, author, category)}>Próxima →</Link>}
            </nav>
          )}
        </section>
        <NewsletterForm />
      </div>
    </main>
  );
}
