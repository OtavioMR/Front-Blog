import Form from "next/form";
import Link from "next/link";
import { AdminFailure, AdminShell } from "../_components/shell";
import { adminPostsRead, record } from "../_lib/data";
import styles from "../admin.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => typeof v === "string" ? v.trim() : "";
const statuses: Record<string, string> = { published: "Publicados", pending: "Em revisão", rejected: "Rejeitados", hidden: "Ocultos", draft: "Rascunhos" };

export default async function PostsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams, page = one(raw.page) || "1", search = one(raw.search), status = one(raw.status), authorId = one(raw.authorId);
  const invalid = [raw.page, raw.search, raw.status, raw.authorId].some(Array.isArray) || !/^[1-9]\d{0,5}$/.test(page) || search.length > 150 || !!(status && !Object.hasOwn(statuses, status)) || !!(authorId && !uuid.test(authorId));
  const query = new URLSearchParams({ page: invalid ? "1" : page, limit: invalid ? "1" : "20" });
  if (!invalid) { if (search) query.set("search", search); if (status) query.set("status", status); if (authorId) query.set("authorId", authorId); }
  const result = await adminPostsRead(query);
  if (!result.ok) return <AdminFailure reason={result.reason} />;
  if (invalid) return <AdminShell title="Artigos" current="posts"><section className={styles.panel}><h2>Filtros inválidos</h2><Link href="/admin/posts">Limpar filtros</Link></section></AdminShell>;
  const value = result.value;
  if (!record(value) || !Array.isArray(value.data) || value.data.length > 20 || !record(value.meta) || value.meta.page !== Number(page) || typeof value.meta.hasPreviousPage !== "boolean" || typeof value.meta.hasNextPage !== "boolean" || (page === "1" && value.meta.hasPreviousPage) || (page === "999999" && value.meta.hasNextPage)
    || value.data.some(row => !record(row) || typeof row.id !== "string" || !uuid.test(row.id) || typeof row.title !== "string" || row.title.length > 255 || typeof row.authorId !== "string" || !uuid.test(row.authorId) || typeof row.published !== "boolean" || typeof row.isActive !== "boolean" || typeof row.moderationHidden !== "boolean" || !["DRAFT", "PENDING", "APPROVED", "REJECTED"].includes(String(row.reviewStatus)) || typeof row.createdAt !== "string" || !Number.isFinite(Date.parse(row.createdAt)))) return <AdminFailure reason="unavailable" />;
  const href = (n: number) => { const p = new URLSearchParams(query); p.delete("limit"); p.set("page", String(n)); return `/admin/posts?${p}`; };
  return <AdminShell title="Artigos" current="posts"><div className={styles.intro}><p className={styles.eyebrow}>Gestão editorial</p><h2>Artigos da plataforma</h2><p>Publicação, revisão e ocultação são estados independentes.</p></div><section className={styles.panel}><Form className={styles.filters} action="/admin/posts" prefetch={false}><label>Buscar título<input name="search" defaultValue={search} maxLength={150} /></label><label>Situação<select name="status" defaultValue={status}><option value="">Todas</option>{Object.entries(statuses).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label><label>Identificador do autor<input name="authorId" defaultValue={authorId} maxLength={36} /></label><button>Filtrar</button></Form></section><section className={styles.panel}>{value.data.length ? <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Título</th><th>Autor</th><th>Revisão</th><th>Visibilidade</th><th>Cadastro</th><th>Ação</th></tr></thead><tbody>{value.data.map(row => <tr key={row.id}><td>{row.title}</td><td>{row.authorId}</td><td>{row.reviewStatus}</td><td>{row.moderationHidden ? "Oculto" : row.published && row.isActive ? "Publicado" : "Não público"}</td><td>{new Date(row.createdAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td><Link href={`/admin/posts/${row.id}`} prefetch={false}>Ver artigo</Link></td></tr>)}</tbody></table></div> : <p>Nenhum artigo nesta página.</p>}<nav className={styles.pagination} aria-label="Paginação">{value.meta.hasPreviousPage && <Link href={href(Number(page) - 1)} prefetch={false}>Anterior</Link>}<span>Página {page}</span>{value.meta.hasNextPage && <Link href={href(Number(page) + 1)} prefetch={false}>Próxima</Link>}</nav></section><p><Link href="/admin/posts?status=pending" prefetch={false}>Ver primeiras publicações em revisão</Link></p></AdminShell>;
}
