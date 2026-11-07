import Link from "next/link";
import { AdminFailure, AdminShell } from "../../_components/shell";
import { adminCommentDetail, adminCommentHistory, adminCommentsRead, adminCsrf, record } from "../../_lib/data";
import ModerateComment from "../_components/moderate";
import styles from "../../admin.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));
const text = (v: unknown, limit: number): v is string => typeof v === "string" && v.length <= limit;
const nullableId = (v: unknown) => v === null || (typeof v === "string" && uuid.test(v));

export default async function CommentDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params, raw = await searchParams, page = typeof raw.page === "string" && raw.page ? raw.page : "1";
  if (!uuid.test(id) || Array.isArray(raw.page) || !/^[1-9]\d{0,5}$/.test(page)) {
    const access = await adminCommentsRead(new URLSearchParams({ page: "1", limit: "1" }));
    if (!access.ok) return <AdminFailure reason={access.reason} />;
    return <AdminShell title="Comentário" current="comments"><section className={styles.panel}><h2>Endereço inválido</h2><Link href="/admin/comments">Voltar aos comentários</Link></section></AdminShell>;
  }
  const [detailResult, historyResult] = await Promise.all([adminCommentDetail(id), adminCommentHistory(id, page)]);
  if (!detailResult.ok) return <AdminFailure reason={detailResult.reason} />;
  if (!historyResult.ok) return <AdminFailure reason={historyResult.reason} />;
  const detail = detailResult.value, history = historyResult.value, csrf = await adminCsrf();
  if (!csrf) return <AdminFailure reason="session" />;
  if (!record(detail) || detail.id !== id || !text(detail.postId, 36) || !uuid.test(detail.postId) || !text(detail.authorId, 36) || !uuid.test(detail.authorId) || !nullableId(detail.rootId) || !nullableId(detail.replyToId) || !text(detail.content, 1000) || typeof detail.isActive !== "boolean" || typeof detail.moderationHidden !== "boolean" || !date(detail.createdAt) || !Array.isArray(detail.reports) || detail.reports.length > 100
    || detail.reports.some(r => !record(r) || !text(r.id, 36) || !uuid.test(r.id) || !text(r.reason, 1000) || !["PENDING", "IN_REVIEW", "RESOLVED", "DISMISSED"].includes(String(r.status)) || !date(r.createdAt))
    || !record(history) || !Array.isArray(history.data) || history.data.length > 10 || !record(history.meta) || history.meta.page !== Number(page) || typeof history.meta.hasPreviousPage !== "boolean" || typeof history.meta.hasNextPage !== "boolean" || (page === "1" && history.meta.hasPreviousPage) || (page === "999999" && history.meta.hasNextPage)
    || history.data.some(row => !record(row) || !text(row.id, 36) || !uuid.test(row.id) || !text(row.action, 80) || !nullableId(row.actorId) || !date(row.createdAt))) return <AdminFailure reason="unavailable" />;
  return <AdminShell title="Comentário" current="comments"><div className={styles.intro}><p className={styles.eyebrow}>Moderação</p><h2>Contexto do comentário</h2><p>Identificador: {id}</p></div><section className={styles.panel}><p className={styles.commentText}>{detail.content}</p><p>Autor: {detail.authorId} · Artigo: {detail.postId}</p><p>Comentário principal: {String(detail.rootId || "—")} · Em resposta a: {String(detail.replyToId || "—")}</p><p>{detail.moderationHidden ? "Oculto pela moderação" : detail.isActive ? "Ativo" : "Desativado por outros meios"} · {new Date(detail.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>{(detail.isActive || detail.moderationHidden) && <ModerateComment id={id} action={detail.isActive ? "hide" : "restore"} csrf={csrf} />}</section><section className={styles.panel}><h2>Denúncias relacionadas</h2>{detail.reports.length ? <ul className={styles.list}>{detail.reports.map(r => <li key={r.id}><Link href={`/admin/reports/${r.id}`} prefetch={false}>{r.reason}</Link> · {r.status} · {new Date(r.createdAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</li>)}</ul> : <p>Nenhuma denúncia relacionada.</p>}</section><section className={styles.panel}><h2>Histórico de moderação</h2>{history.data.length ? <ul className={styles.list}>{history.data.map(row => <li key={row.id}>{new Date(row.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {row.action} · {row.actorId || "Sistema"}{record(row.details) && text(row.details.reason, 1000) ? ` · ${row.details.reason}` : ""}</li>)}</ul> : <p>Nenhuma ação registrada.</p>}<nav className={styles.pagination} aria-label="Paginação do histórico">{history.meta.hasPreviousPage && <Link href={`?page=${Number(page) - 1}`} prefetch={false}>Anterior</Link>}<span>Página {page}</span>{history.meta.hasNextPage && <Link href={`?page=${Number(page) + 1}`} prefetch={false}>Próxima</Link>}</nav></section><p><Link href="/admin/comments" prefetch={false}>Voltar aos comentários</Link></p></AdminShell>;
}
