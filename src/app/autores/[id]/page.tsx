import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/app/_components/avatar";
import backStyles from "@/app/_components/back-button.module.css";
import CoverImage from "@/app/_components/cover-image";
import { publicCoverPath, seriesPreview } from "@/lib/public-post";
import { formatDate, getAuthor, getAuthorSeries, getAuthorStories, pageNumber, safeExternalUrl } from "./data";
import Follow from "./follow";
import styles from "./profile.module.css";

type AuthorPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; aba?: string; origem?: string }>;
};

const tabs = [
  { id: "contos", label: "Contos" },
  { id: "series", label: "Séries" },
  { id: "sobre", label: "Sobre o autor" },
] as const;

type Tab = (typeof tabs)[number]["id"];

export async function generateMetadata({ params, searchParams }: AuthorPageProps): Promise<Metadata> {
  const { id } = await params;
  const author = await getAuthor(id);
  if (!author) {
    return { title: "Autor não encontrado | Grifório", robots: { index: false } };
  }
  const query = await searchParams;
  const page = query.aba === "sobre" ? 1 : pageNumber(query.page);
  const pageSuffix = page > 1 ? ` — página ${page}` : "";
  return {
    title: `${author.name}${pageSuffix} | Grifório`,
    description: author.bio ? author.bio.slice(0, 160) : `Conheça ${author.name} e suas publicações no Grifório.`,
  };
}

export default async function AuthorPage({ params, searchParams }: AuthorPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const author = await getAuthor(id);
  if (!author) notFound();

  const page = pageNumber(query.page);
  const activeTab = tabs.find((tab) => tab.id === query.aba)?.id ?? "contos";
  const fromAccount = query.origem === "conta";
  const tabHref = (tab: Tab, targetPage = 1) => {
    const search = new URLSearchParams({ aba: tab });
    if (targetPage > 1) search.set("page", String(targetPage));
    if (fromAccount) search.set("origem", "conta");
    return `/autores/${encodeURIComponent(author.id)}?${search}`;
  };

  const publications = activeTab === "contos" ? await getAuthorStories(author.id, page)
    : activeTab === "series" ? await getAuthorSeries(author.id, page)
    : null;
  const website = safeExternalUrl(author.websiteUrl);
  const social = safeExternalUrl(author.socialUrl);

  return (
    <main className={styles.page}>
      <Link href={fromAccount ? "/conta" : "/"} data-back-button="true" className={backStyles.back}>
        <span aria-hidden="true">←</span><span>{fromAccount ? "Voltar à conta" : "Voltar ao início"}</span>
      </Link>
      <header className={styles.profile}>
        <Avatar name={author.name} src={author.profilePhoto} size={64} />
        <div className={styles.profileDetails}>
          <h1>{author.name}</h1>
          <div className={styles.follow}><Follow authorId={author.id} /></div>
        </div>
      </header>

      <section className={styles.tabsContainer} id="publicacoes">
        <nav aria-label="Seções do autor">
          <ul className={styles.tabs}>
            {tabs.map(({ id, label }) => (
              <li className={styles.tabItem} key={id}>
                <Link
                  aria-current={activeTab === id ? "page" : undefined}
                  className={`${styles.tab} ${activeTab === id ? styles.tabActive : ""}`}
                  href={tabHref(id)}
                  scroll={false}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {publications ? (
          <>
            {publications.data.length === 0 ? (
              <div className={styles.emptyState}>
                <p>{page > 1 ? "Não há publicações nesta página."
                  : activeTab === "series" ? "Este autor ainda não publicou séries."
                  : "Este autor ainda não publicou contos avulsos."}</p>
                {page > 1 ? (
                  <Link className={styles.emptyAction} href={`${tabHref(activeTab)}#publicacoes`}>
                    Voltar à primeira página
                  </Link>
                ) : (
                  <Link className={styles.emptyAction} href="/#contos">
                    Explorar contos no Grifório
                  </Link>
                )}
              </div>
            ) : (
              <div className={activeTab === "series" ? styles.seriesList : styles.storyGrid}>
                {publications.data.map((item) => {
                  const isSeries = "description" in item;
                  const cover = publicCoverPath(item.coverImage ?? null);
                  const href = isSeries ? `/series/${encodeURIComponent(item.id)}` : `/posts/${encodeURIComponent(item.slug)}`;
                  const action = isSeries ? "Ver capítulos" : "Ler conto";
                  const date = isSeries ? null : formatDate(item.publishedAt);
                  return (
                    <article className={`${styles.card} ${isSeries ? styles.seriesCard : ""} article-surface`} key={item.id}>
                      {(cover || isSeries) && (
                        <CoverImage className={styles.cardCover} src={cover} blurredBackdrop />
                      )}
                      <div className={styles.cardBody}>
                        <p className={styles.cardCategory}>
                          {isSeries ? (item.contentRating === "18+" ? "Série · 18+" : "Série") : item.categories?.[0]?.name || "Conto"}
                        </p>
                        <h2>{item.title}</h2>
                        <p className={styles.cardExcerpt}>{isSeries ? seriesPreview(item.description) : item.excerpt}</p>
                        <div className={styles.cardMeta}>
                          {isSeries ? (
                            <span>{item.publishedCount} {item.publishedCount === 1 ? "capítulo publicado" : "capítulos publicados"}</span>
                          ) : (
                            <>
                              {date && item.publishedAt && <time dateTime={item.publishedAt}>{date}</time>}
                              <span>{item.readingTimeMinutes} min de leitura</span>
                            </>
                          )}
                        </div>
                        <Link className={`${styles.action} article-surface-link`} href={href} aria-label={`${action}: ${item.title}`}>
                          {action}
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {(publications.meta.hasPreviousPage || publications.meta.hasNextPage) && (
              <nav className={styles.pagination} aria-label={activeTab === "series" ? "Paginação das séries" : "Paginação dos contos"}>
                {publications.meta.hasPreviousPage && <Link href={`${tabHref(activeTab, page - 1)}#publicacoes`}>Anterior</Link>}
                <span>
                  Página {publications.meta.page}
                  {publications.meta.totalPages > 0 && ` de ${publications.meta.totalPages}`}
                </span>
                {publications.meta.hasNextPage && <Link href={`${tabHref(activeTab, page + 1)}#publicacoes`}>Próxima</Link>}
              </nav>
            )}
          </>
        ) : (
          <div className={styles.aboutPanel} id="sobre">
            <h2>Sobre {author.name}</h2>
            <p>{author.bio || "Este autor ainda não adicionou uma biografia."}</p>
            {(website || social) && (
              <nav className={styles.links} aria-label="Links do autor">
                {website && <a href={website} target="_blank" rel="noopener noreferrer">Site oficial ↗</a>}
                {social && <a href={social} target="_blank" rel="noopener noreferrer">Perfil em rede social ↗</a>}
              </nav>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
