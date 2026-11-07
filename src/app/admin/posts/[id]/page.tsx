import Link from "next/link";
import sanitizeHtml from "sanitize-html";
import { AdminFailure, AdminShell } from "../../_components/shell";
import { adminCsrf, adminPostDetail, adminPostHistory, adminPostsRead, record } from "../../_lib/data";
import ModerateComment from "../../comments/_components/moderate";
import Review from "../_components/review";
import styles from "../../admin.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));

export default async function PostDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params, raw = await searchParams, page = typeof raw.page === "string" && raw.page ? raw.page : "1";
  if (!uuid.test(id) || Array.isArray(raw.page) || !/^[1-9]\d{0,5}$/.test(page)) {
    const access = await adminPostsRead(new URLSearchParams({ page: "1", limit: "1" }));
    if (!access.ok) return <AdminFailure reason={access.reason} />;
    return <AdminShell title="Artigo" current="posts"><section className={styles.panel}><h2>Endereço inválido</h2><Link href="/admin/posts">Voltar aos artigos</Link></section></AdminShell>;
  }
  const [detailResult, historyResult] = await Promise.all([adminPostDetail(id), adminPostHistory(id, page)]);
  if (!detailResult.ok) return <AdminFailure reason={detailResult.reason} />;
  if (!historyResult.ok) return <AdminFailure reason={historyResult.reason} />;
  const detail = detailResult.value, history = historyResult.value, csrf = await adminCsrf();
  if (!csrf) return <AdminFailure reason="session" />;
  if (!record(detail) || detail.id !== id || !text(detail.title, 255) || !text(detail.content, 1000000) || !text(detail.authorId, 36) || !uuid.test(detail.authorId) || typeof detail.published !== "boolean" || typeof detail.isActive !== "boolean" || typeof detail.moderationHidden !== "boolean" || !["DRAFT", "PENDING", "APPROVED", "REJECTED"].includes(String(detail.reviewStatus)) || !(detail.reviewNote === null || text(detail.reviewNote, 1000)) || !(detail.author === null || (record(detail.author) && text(detail.author.name, 255)))
    || !record(history) || !Array.isArray(history.data) || history.data.length > 10 || !record(history.meta) || history.meta.page !== Number(page) || typeof history.meta.hasPreviousPage !== "boolean" || typeof history.meta.hasNextPage !== "boolean" || (page === "1" && history.meta.hasPreviousPage) || (page === "999999" && history.meta.hasNextPage)
    || history.data.some(row => !record(row) || !text(row.id, 36) || !uuid.test(row.id) || !text(row.action, 80) || !(row.actorId === null || (text(row.actorId, 36) && uuid.test(row.actorId))) || !date(row.createdAt))) return <AdminFailure reason="unavailable" />;
  const content = sanitizeHtml(detail.content, { allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "blockquote", "h2", "h3", "h4"], allowedAttributes: {} });
  return <AdminShell title="Artigo" current="posts"><div className={styles.intro}><p className={styles.eyebrow}>Gestão editorial</p><h2>{detail.title}</h2><p>Autor: {record(detail.author) ? String(detail.author.name) : detail.authorId} · Revisão: {String(detail.reviewStatus)}</p></div><section className={styles.panel}><p>{detail.moderationHidden ? "Oculto pela moderação" : detail.published && detail.isActive ? "Publicado" : "Não público"}</p>{detail.reviewNote && <p>Justificativa editorial: {String(detail.reviewNote)}</p>}<div dangerouslySetInnerHTML={{ __html: content }} />{detail.reviewStatus === "PENDING" && detail.isActive && <Review id={id} csrf={csrf} />}{((detail.published && detail.isActive) || detail.moderationHidden) && <ModerateComment id={id} kind="posts" action={detail.moderationHidden ? "restore" : "hide"} csrf={csrf} />}</section><section className={styles.panel}><h2>Histórico editorial</h2>{history.data.length ? <ul className={styles.list}>{history.data.map(row => <li key={row.id}>{new Date(row.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {row.action} · {row.actorId || "Sistema"}{record(row.details) && text(row.details.reason, 1000) ? ` · ${row.details.reason}` : ""}</li>)}</ul> : <p>Nenhuma ação registrada.</p>}<nav className={styles.pagination} aria-label="Paginação do histórico">{history.meta.hasPreviousPage && <Link href={`?page=${Number(page) - 1}`} prefetch={false}>Anterior</Link>}<span>Página {page}</span>{history.meta.hasNextPage && <Link href={`?page=${Number(page) + 1}`} prefetch={false}>Próxima</Link>}</nav></section><p><Link href="/admin/posts" prefetch={false}>Voltar aos artigos</Link></p></AdminShell>;
}
