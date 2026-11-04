import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { getPublicPost, publicAuthorPath, publicCoverPath } from "@/lib/public-post";
import { postSeo } from "@/lib/post-seo";
import { getRelatedPosts } from "./related";
import { commentsPage, getComments } from "./comments";
import Replies from "./replies";
import CommentForm from "./comment-form";
import PostViewTracker from "./post-view-tracker";
import Interactions from "./interactions";
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
  const [related, comments] = await Promise.all([getRelatedPosts(post.slug), getComments(post.id, requestedPage)]);

  const content = sanitizeHtml(post.content, {
    allowedTags: ["p", "br", "strong", "em", "b", "i", "u", "s", "ul", "ol", "li", "blockquote", "pre", "code", "h2", "h3", "h4", "a"],
    allowedAttributes: { a: ["href", "title"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
  });
  const cover = publicCoverPath(post.coverImage);
  const authorPath = publicAuthorPath(post.author?.id);
  const { jsonLd } = postSeo(post);
  const date = post.publishedAt ? new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(post.publishedAt)) : null;

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Entrelinhas, página inicial"><span aria-hidden="true">✳</span> entrelinhas.</Link>
        <Link className={styles.back} href="/">← Voltar ao início</Link>
      </header>
      <article className={styles.article}>
        <PostViewTracker postId={post.id} />
        <div className={styles.category}>{post.categories.map(category => category.name).join(" · ") || "BOAS HISTÓRIAS"}</div>
        <h1>{post.title}</h1>
        {post.excerpt && <p className={styles.excerpt}>{post.excerpt}</p>}
        <div className={styles.meta}>
          {post.author?.name && <span>Por {authorPath ? <Link href={authorPath}>{post.author.name}</Link> : post.author.name}</span>}
          {date && <time dateTime={post.publishedAt!}>{date}</time>}
          <span>{post.readingTimeMinutes} min de leitura</span>
        </div>
        {cover && <div className={styles.cover}><Image src={cover} alt="" width={1920} height={1080} unoptimized /></div>}
        <div className={styles.content} data-reading-body dangerouslySetInnerHTML={{ __html: content }} />
        <Interactions postId={post.id} />
      </article>
      <section className={styles.comments} id="comentarios" aria-labelledby="comments-title">
        <p className={styles.category}>A CONVERSA CONTINUA</p><h2 id="comments-title">Comentários.</h2>
        {comments.kind === "disabled" ? <p>Os comentários estão desativados neste artigo.</p> : comments.kind === "unavailable" ? <p role="status">Não foi possível carregar os comentários agora. Tente novamente mais tarde.</p> : <>
          {post.id && <CommentForm postId={post.id} slug={post.slug} page={requestedPage} />}
          {comments.page.data.length === 0 ? <p>Ainda não há comentários nesta página.</p> : <ol className={styles.commentsList}>{comments.page.data.map(item => <li key={item.id}>
            <div className={styles.comment}><strong>{item.author.name}</strong><time dateTime={item.createdAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(item.createdAt))}</time><p>{item.isActive ? item.content : "Comentário excluído"}</p>{item.editedAt && item.isActive && <span>Editado</span>}</div>
            <Replies postId={item.postId} rootId={item.id} initial={item.replies.data} total={item.replies.meta.total} slug={post.slug} page={requestedPage} canReply={item.isActive} />
          </li>)}</ol>}
          {(comments.page.meta.hasPreviousPage || comments.page.meta.hasNextPage) && <nav className={styles.commentsPagination} aria-label="Paginação dos comentários">{comments.page.meta.hasPreviousPage && <Link href={`/posts/${encodeURIComponent(post.slug)}?commentsPage=${requestedPage - 1}#comentarios`}>← Anteriores</Link>}<span>Página {comments.page.meta.page} de {comments.page.meta.totalPages}</span>{comments.page.meta.hasNextPage && <Link href={`/posts/${encodeURIComponent(post.slug)}?commentsPage=${requestedPage + 1}#comentarios`}>Próximos →</Link>}</nav>}
        </>}
      </section>
      {related && related.length > 0 && <section className={styles.related} aria-labelledby="related-title">
        <p className={styles.category}>CONTINUE A LEITURA</p><h2 id="related-title">Mais histórias para descobrir.</h2>
        <div className={styles.relatedGrid}>{related.map(item => <article className={styles.relatedCard} key={item.slug}>
          <h3><Link href={`/posts/${encodeURIComponent(item.slug)}`}>{item.title}</Link></h3>
          {item.excerpt && <p>{item.excerpt}</p>}
          <p className={styles.relatedMeta}>{item.author?.name || "Equipe editorial"} · {item.readingTimeMinutes} min de leitura</p>
          <Link className={styles.relatedLink} href={`/posts/${encodeURIComponent(item.slug)}`} aria-label={`Ler artigo: ${item.title}`}>Ler artigo <span aria-hidden="true">↗</span></Link>
        </article>)}</div>
      </section>}
      <footer className={styles.footer}><Link href="/">entrelinhas.</Link><span>UM BLOG PARA LER E SENTIR.</span></footer>
    </main>
  );
}
