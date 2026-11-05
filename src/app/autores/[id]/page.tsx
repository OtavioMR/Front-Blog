import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAuthor,
  getAuthorArticles,
  pageNumber,
  photoPath,
  coverPath,
  formatDate,
  safeExternalUrl,
} from "./data";
import styles from "./profile.module.css";
import Follow from "./follow";
import backStyles from "@/app/_components/back-button.module.css";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; aba?: string; origem?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const author = await getAuthor(id);
  if (!author) {
    return { title: "Autor não encontrado | Entrelinhas", robots: { index: false } };
  }
  const query = await searchParams;
  const page = pageNumber(query?.page);
  const pageSuffix = page > 1 ? ` — página ${page}` : "";
  return {
    title: `${author.name}${pageSuffix} | Entrelinhas`,
    description: author.bio ? author.bio.slice(0, 160) : `Conheça ${author.name} e suas publicações no Entrelinhas.`,
  };
}

export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; aba?: string; origem?: string }>;
}) {
  const { id } = await params;
  const author = await getAuthor(id);
  if (!author) notFound();

  const query = await searchParams;
  const page = pageNumber(query?.page);
  const activeTab = query?.aba === "sobre" ? "sobre" : "artigos";
  const fromAccount = query?.origem === "conta";
  const originQuery = fromAccount ? "&origem=conta" : "";

  const articles = await getAuthorArticles(id, author.name, page, 6);

  const photo = photoPath(author.profilePhoto);
  const website = safeExternalUrl(author.websiteUrl);
  const social = safeExternalUrl(author.socialUrl);

  const totalArticles = articles.meta.total;
  const countText = `${author.publicationCount} ${author.publicationCount === 1 ? "artigo publicado" : "artigos publicados"}`;

  return (
    <main className={styles.page}>
      <Link href={fromAccount ? "/conta" : "/"} data-back-button="true" className={backStyles.back}>
        <span aria-hidden="true">←</span><span>{fromAccount ? "Voltar à conta" : "Voltar ao início"}</span>
      </Link>
      <article className={styles.profile}>
        <div className={styles.portrait}>
          {photo ? (
            <Image src={photo} alt="" width={240} height={240} unoptimized />
          ) : (
            <span aria-hidden="true">✳</span>
          )}
        </div>
        <div>
          <p className={styles.eyebrow}>Quem escreve</p>
          <h1>{author.name}</h1>
          {author.bio && <p className={styles.bio}>{author.bio}</p>}
          <span className={styles.countBadge}>{countText}</span>
          <Follow authorId={author.id} />
          {(website || social) && (
            <nav className={styles.links} aria-label="Links do autor">
              {website && (
                <a href={website} target="_blank" rel="noopener noreferrer">
                  Site ↗
                </a>
              )}
              {social && (
                <a href={social} target="_blank" rel="noopener noreferrer">
                  Rede social ↗
                </a>
              )}
            </nav>
          )}
        </div>
      </article>

      <section className={styles.tabsContainer} id="artigos">
        <nav aria-label="Seções do autor"><ul className={styles.tabs}>
          <li className={styles.tabItem}>
            <Link
              aria-current={activeTab === "artigos" ? "page" : undefined}
              className={`${styles.tab} ${activeTab === "artigos" ? styles.tabActive : ""}`}
              href={`/autores/${encodeURIComponent(author.id)}?aba=artigos${originQuery}#artigos`}
            >
              Artigos publicados
              <span className={styles.tabBadge}>{totalArticles}</span>
            </Link>
          </li>
          <li className={styles.tabItem}>
            <Link
              aria-current={activeTab === "sobre" ? "page" : undefined}
              className={`${styles.tab} ${activeTab === "sobre" ? styles.tabActive : ""}`}
              href={`/autores/${encodeURIComponent(author.id)}?aba=sobre${originQuery}#sobre`}
            >
              Sobre o autor
            </Link>
          </li>
        </ul></nav>

        {activeTab === "artigos" ? (
          <div id="painel-artigos">
            {articles.data.length === 0 ? (
              <div className={styles.emptyState}>
                <p>
                  {page > 1
                    ? "Não há artigos nesta página."
                    : "Este autor ainda não possui artigos publicados no momento."}
                </p>
                {page > 1 ? (
                  <Link
                    className={styles.emptyAction}
                    href={`/autores/${encodeURIComponent(author.id)}?aba=artigos${originQuery}#artigos`}
                  >
                    Voltar à primeira página
                  </Link>
                ) : (
                  <Link className={styles.emptyAction} href="/#artigos">
                    Explorar outros artigos no Entrelinhas →
                  </Link>
                )}
              </div>
            ) : (
              <div className={styles.articleGrid}>
                {articles.data.map((item) => {
                  const cover = coverPath(item.coverImage);
                  const dateStr = formatDate(item.publishedAt);
                  const categoryName = item.categories?.[0]?.name || "Leitura";
                  return (
                    <article className={styles.card} key={item.id}>
                      {cover && (
                        <div className={styles.cardCover}>
                          <Image
                            src={cover}
                            alt=""
                            width={600}
                            height={338}
                            sizes="(max-width: 700px) 100vw, 33vw"
                            unoptimized
                          />
                        </div>
                      )}
                      <p className={styles.cardCategory}>{categoryName}</p>
                      <h2>
                        <Link href={`/posts/${encodeURIComponent(item.slug)}`}>
                          {item.title}
                        </Link>
                      </h2>
                      <p className={styles.cardExcerpt}>{item.excerpt}</p>
                      <div className={styles.cardMeta}>
                        {dateStr && item.publishedAt && (
                          <time dateTime={item.publishedAt}>{dateStr}</time>
                        )}
                        <span>{item.readingTimeMinutes} min de leitura</span>
                      </div>
                      <Link
                        className={styles.action}
                        href={`/posts/${encodeURIComponent(item.slug)}`}
                        aria-label={`Ler artigo: ${item.title}`}
                      >
                        Ler artigo <span aria-hidden="true">↗</span>
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}

            {(articles.meta.hasPreviousPage || articles.meta.hasNextPage) && (
              <nav className={styles.pagination} aria-label="Paginação dos artigos do autor">
                {articles.meta.hasPreviousPage && (
                  <Link
                    href={`/autores/${encodeURIComponent(author.id)}?aba=artigos&page=${page - 1}${originQuery}#artigos`}
                  >
                    ← Anterior
                  </Link>
                )}
                <span>
                  Página {articles.meta.page}
                  {articles.meta.totalPages > 0 && ` de ${articles.meta.totalPages}`}
                </span>
                {articles.meta.hasNextPage && (
                  <Link
                    href={`/autores/${encodeURIComponent(author.id)}?aba=artigos&page=${page + 1}${originQuery}#artigos`}
                  >
                    Próxima →
                  </Link>
                )}
              </nav>
            )}
          </div>
        ) : (
          <div id="painel-sobre">
            <div className={styles.aboutPanel} id="sobre">
              <h2>Sobre {author.name}</h2>
              {author.bio ? (
                <p>{author.bio}</p>
              ) : (
                <p>Este autor ainda não adicionou uma biografia detalhada.</p>
              )}
              {(website || social) && (
                <nav className={styles.links} aria-label="Links do autor">
                  {website && (
                    <a href={website} target="_blank" rel="noopener noreferrer">
                      Site oficial ↗
                    </a>
                  )}
                  {social && (
                    <a href={social} target="_blank" rel="noopener noreferrer">
                      Perfil em rede social ↗
                    </a>
                  )}
                </nav>
              )}
              <Link
                className={styles.viewArticlesBtn}
                href={`/autores/${encodeURIComponent(author.id)}?aba=artigos${originQuery}#artigos`}
              >
                Ver artigos deste autor ({totalArticles}) →
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
