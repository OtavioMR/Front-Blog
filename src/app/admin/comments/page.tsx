import Form from "next/form";
import Link from "next/link";
import { AdminFailure, AdminShell } from "../_components/shell";
import { adminCommentsRead, adminCsrf, record } from "../_lib/data";
import ModerateComment from "./_components/moderate";
import styles from "../admin.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => typeof v === "string" ? v.trim() : "";

export default async function CommentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams, page = one(raw.page) || "1", search = one(raw.search), status = one(raw.status), authorId = one(raw.authorId), postId = one(raw.postId);
  const invalid = [raw.page, raw.search, raw.status, raw.authorId, raw.postId].some(Array.isArray) || !/^[1-9]\d{0,5}$/.test(page) || search.length > 200 || !["", "active", "hidden", "deleted"].includes(status) || !!(authorId && !uuid.test(authorId)) || !!(postId && !uuid.test(postId));
  const query = new URLSearchParams({ page: invalid ? "1" : page, limit: invalid ? "1" : "20" });
  if (!invalid) { if (search) query.set("search", search); if (status) query.set("status", status); if (authorId) query.set("authorId", authorId); if (postId) query.set("postId", postId); }
  const result = await adminCommentsRead(query);
  if (!result.ok) return <AdminFailure reason={result.reason} />;
  if (invalid) return <AdminShell title="Comentários" current="comments"><section className={styles.panel}><h2>Filtros inválidos</h2><Link href="/admin/comments">Limpar filtros</Link></section></AdminShell>;
  const value = result.value, csrf = await adminCsrf();
  if (!csrf) return <AdminFailure reason="session" />;
  if (!record(value) || !Array.isArray(value.data) || value.data.length > 20 || !record(value.meta) || value.meta.page !== Number(page) || typeof value.meta.hasPreviousPage !== "boolean" || typeof value.meta.hasNextPage !== "boolean" || (page === "1" && value.meta.hasPreviousPage) || (page === "999999" && value.meta.hasNextPage)
    || value.data.some(row => !record(row) || typeof row.id !== "string" || !uuid.test(row.id) || typeof row.postId !== "string" || !uuid.test(row.postId) || typeof row.authorId !== "string" || !uuid.test(row.authorId) || typeof row.content !== "string" || row.content.length > 1000 || typeof row.isActive !== "boolean" || typeof row.moderationHidden !== "boolean" || typeof row.createdAt !== "string" || !Number.isFinite(Date.parse(row.createdAt)))) return <AdminFailure reason="unavailable" />;
  const href = (n: number) => { const p = new URLSearchParams(query); p.delete("limit"); p.set("page", String(n)); return `/admin/comments?${p}`; };
  return <AdminShell title="Comentários" current="comments"><div className={styles.intro}><p className={styles.eyebrow}>Moderação</p><h2>Comentários</h2><p>Comentários ocultados pela moderação podem ser restaurados; os demais comentários inativos permanecem indisponíveis.</p></div><section className={styles.panel}><Form className={styles.filters} action="/admin/comments" prefetch={false}><label>Buscar<input name="search" defaultValue={search} maxLength={200} /></label><label>Situação<select name="status" defaultValue={status}><option value="">Todas</option><option value="active">Ativo</option><option value="hidden">Oculto pela moderação</option><option value="deleted">Desativado por outros meios</option></select></label><label>Identificador do autor<input name="authorId" defaultValue={authorId} maxLength={36} /></label><label>Identificador do artigo<input name="postId" defaultValue={postId} maxLength={36} /></label><button>Filtrar</button></Form></section><section className={styles.panel}>{value.data.length ? value.data.map(row => <article className={styles.comment} key={row.id}><p>{row.content}</p><p>Autor: {row.authorId} · Artigo: {row.postId}</p><p>{row.moderationHidden ? "Oculto pela moderação" : row.isActive ? "Ativo" : "Desativado por outros meios"} · {new Date(row.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p><p><Link href={`/admin/comments/${row.id}`} prefetch={false}>Ver contexto e histórico</Link></p>{(row.isActive || row.moderationHidden) && <ModerateComment id={row.id} action={row.isActive ? "hide" : "restore"} csrf={csrf} />}</article>) : <p>Nenhum comentário nesta página.</p>}<nav className={styles.pagination} aria-label="Paginação">{value.meta.hasPreviousPage && <Link href={href(Number(page) - 1)} prefetch={false}>Anterior</Link>}<span>Página {page}</span>{value.meta.hasNextPage && <Link href={href(Number(page) + 1)} prefetch={false}>Próxima</Link>}</nav></section></AdminShell>;
}
