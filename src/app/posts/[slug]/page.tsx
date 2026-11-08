import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { getPublicPost, publicAuthorPath, publicCoverPath } from "@/lib/public-post";
import { postSeo } from "@/lib/post-seo";
import { getRelatedPosts } from "./related";
import { getPublicSeries } from "./series";
import { commentsPage, getComments } from "./comments";
import CommentForm from "./comment-form";
import CommentThread from "./comment-thread";
import { CommentSession } from "./comment-session";
import PostViewTracker from "./post-view-tracker";
import Interactions from "./interactions";
import EditArticleLink from "./edit-article-link";
import { PostReport } from "./report-form";
import Avatar from "@/app/_components/avatar";
import BackButton from "@/app/_components/back-button";
import { getAuthor } from "../../autores/[id]/data";
import styles from "./post.module.css";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ commentsPage?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublicPost(slug);
  if (!post) return { title: "Artigo não encontrado", robots: { index: false } };
  const { url, image } = postSeo(post);
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: { type: "article", url, title: post.title, description: post.excerpt, ...(image && { images: [image] }), ...(post.publishedAt && { publishedTime: post.publishedAt }), ...(post.updatedAt && { modifiedTime: post.updatedAt }), ...(post.author?.name && { authors: [post.author.name] }) },
  };
}

export default async function PostPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const post = await getPublicPost(slug);
  if (!post) notFound();
  if (slug !== post.slug) permanentRedirect(`/posts/${post.slug}`);
  const requestedPage = commentsPage((await searchParams).commentsPage);
  const [related, comments, authorProfile, series] = await Promise.all([
    getRelatedPosts({ slug: post.slug, id: post.id, authorId: post.author?.id }),
    getComments(post.id, requestedPage),
    post.author?.id ? getAuthor(post.author.id).catch(() => null) : Promise.resolve(null),
    getPublicSeries(post.id, post.slug),
  ]);

  const content = sanitizeHtml(post.content, {
    allowedTags: ["p", "br", "strong", "em", "b", "i", "u", "s", "ul", "ol", "li", "blockquote", "pre", "code", "h2", "h3", "h4", "a"],
    allowedAttributes: { a: ["href", "title"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
  });
  const plainText = !/<[a-z][\s\S]*?>/i.test(content);
  const cover = publicCoverPath(post.coverImage);
  const authorPath = publicAuthorPath(post.author?.id);
  const { jsonLd } = postSeo(post);
  const date = post.publishedAt ? new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(post.publishedAt)) : null;

  const fmt = (value: string) => new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));
  const updated = post.updatedAt && post.publishedAt && Date.parse(post.updatedAt) - Date.parse(post.publishedAt) > 3_600_000 ? fmt(post.updatedAt) : null;
  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <article className={styles.article}>
        <PostViewTracker postId={post.id} />
        <div className={styles.articleBack}><BackButton fallback="/" /></div>
        <div className={styles.category}>{post.categories.map(category => category.name).join(" · ") || "BOAS HISTÓRIAS"}</div>
        <h1>{post.title}</h1>
        {post.excerpt && <p className={styles.excerpt}>{post.excerpt}</p>}
        <div className={styles.byline}>
          {post.author?.name && <Avatar name={post.author.name} src={authorProfile?.profilePhoto} size={52} />}
          <div className={styles.bylineText}>
            {post.author?.name && <strong>{authorPath ? <Link href={authorPath}>{post.author.name}</Link> : post.author.name}</strong>}
            <span>{date && <time dateTime={post.publishedAt!}>{date}</time>}{date && " · "}{post.readingTimeMinutes} min de leitura{updated && <> · Atualizado em <time dateTime={post.updatedAt!}>{updated}</time></>}</span>
          </div>
          <EditArticleLink postId={post.id} authorId={post.author?.id} />
        </div>
        {cover && <div className={styles.cover}><Image className={styles.coverBackdrop} src={cover} alt="" width={1920} height={1080} unoptimized /><Image src={cover} alt="" width={1920} height={1080} unoptimized /></div>}
        <div className={plainText ? `${styles.content} ${styles.plainContent}` : styles.content} data-reading-body dangerouslySetInnerHTML={{ __html: content }} />
        {series && <nav className={styles.series} aria-labelledby="series-title"><p className={styles.category}>SÉRIE</p><h2 id="series-title">{series.title}</h2>{series.description && <p>{series.description}</p>}<ol className={styles.seriesList}>{series.posts.map((item, index) => <li key={item.id}>{item.id === post.id ? <span aria-current="page">{index + 1}. {item.title} (artigo atual)</span> : <Link href={`/posts/${encodeURIComponent(item.slug)}`}>{index + 1}. {item.title}</Link>}</li>)}</ol></nav>}
        <Interactions postId={post.id} />
        <PostReport postId={post.id} />
        {post.author?.name && <aside className={styles.authorBox} aria-labelledby="author-box-title">
          <Avatar name={post.author.name} src={authorProfile?.profilePhoto} size={72} />
          <div>
            <p className={styles.authorLabel}>ESCRITO POR</p>
            <h2 id="author-box-title">{post.author.name}</h2>
            {authorProfile?.bio && <p className={styles.authorBio}>{authorProfile.bio}</p>}
            {authorPath && <Link className={styles.authorLink} href={authorPath}>Ver {authorProfile && authorProfile.publicationCount > 1 ? `as ${authorProfile.publicationCount} publicações` : "outras publicações"} do autor <span aria-hidden="true">→</span></Link>}
          </div>
        </aside>}      </article>
      <section className={styles.comments} id="comentarios" aria-labelledby="comments-title">
        <p className={styles.category}>A CONVERSA CONTINUA</p><h2 id="comments-title">Comentários.</h2>
        {comments.kind === "disabled" ? <p>Os comentários estão desativados neste artigo.</p> : comments.kind === "unavailable" ? <p role="status">Não foi possível carregar os comentários agora. Tente novamente mais tarde.</p> : <>
          {post.id && <CommentForm postId={post.id} slug={post.slug} page={requestedPage} />}
          {comments.page.data.length === 0 ? <p>Ainda não há comentários nesta página.</p> : <CommentSession><ol className={styles.commentsList}>{comments.page.data.map(item => <li key={item.id}>
            <CommentThread item={item} postAuthorId={post.author?.id} slug={post.slug} page={requestedPage} />
          </li>)}</ol></CommentSession>}
          {(comments.page.meta.hasPreviousPage || comments.page.meta.hasNextPage) && <nav className={styles.commentsPagination} aria-label="Paginação dos comentários">{comments.page.meta.hasPreviousPage && <Link href={`/posts/${encodeURIComponent(post.slug)}?commentsPage=${requestedPage - 1}#comentarios`}>← Anteriores</Link>}<span>Página {comments.page.meta.page} de {comments.page.meta.totalPages}</span>{comments.page.meta.hasNextPage && <Link href={`/posts/${encodeURIComponent(post.slug)}?commentsPage=${requestedPage + 1}#comentarios`}>Próximos →</Link>}</nav>}
        </>}
      </section>
      {related && related.length > 0 && <section className={styles.related} aria-labelledby="related-title">
        <p className={styles.category}>CONTINUE A LEITURA</p><h2 id="related-title">Mais histórias para descobrir.</h2>
        <div className={styles.relatedGrid}>{related.map(item => <article className={`${styles.relatedCard} article-surface`} key={item.slug}>
          {publicCoverPath(item.coverImage) && <Link href={`/posts/${encodeURIComponent(item.slug)}`} className={styles.relatedCover} tabIndex={-1} aria-hidden="true"><Image className={styles.coverBackdrop} src={publicCoverPath(item.coverImage)!} alt="" width={960} height={540} sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 25vw" unoptimized /><Image src={publicCoverPath(item.coverImage)!} alt="" width={960} height={540} sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 25vw" unoptimized /></Link>}
          <h3><Link href={`/posts/${encodeURIComponent(item.slug)}`}>{item.title}</Link></h3>
          {item.excerpt && <p>{item.excerpt}</p>}
          <p className={styles.relatedMeta}>{item.author?.name || "Equipe editorial"} · {item.readingTimeMinutes} min de leitura</p>
          <Link className={`${styles.relatedLink} article-surface-link`} href={`/posts/${encodeURIComponent(item.slug)}`} aria-label={`Ler artigo: ${item.title}`}>Ler artigo <span aria-hidden="true">↗</span></Link>
        </article>)}</div>
      </section>}
    </main>
  );
}
