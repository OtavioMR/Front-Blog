import Form from "next/form";
import Link from "next/link";
import { AdminFailure, AdminShell } from "../_components/shell";
import { adminReportsRead, record } from "../_lib/data";
import styles from "../admin.module.css";

/* O detalhe existente é um Route Handler que entrega um documento completo. */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses: Record<string, string> = { PENDING: "Pendente", IN_REVIEW: "Em análise", RESOLVED: "Resolvida", DISMISSED: "Improcedente" };
const targets: Record<string, string> = { POST: "Artigo", COMMENT: "Comentário", USER: "Perfil" };
const one = (v: string | string[] | undefined) => typeof v === "string" ? v : "";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams, page = one(raw.page) || "1", status = one(raw.status) || "PENDING", target = one(raw.target);
  const invalid = [raw.page, raw.status, raw.target].some(Array.isArray) || !/^[1-9]\d{0,5}$/.test(page) || ![...Object.keys(statuses), "ALL"].includes(status) || !!(target && !Object.hasOwn(targets, target));
  const query = new URLSearchParams();
  if (!invalid && status !== "ALL") query.set("status", status);
  if (!invalid && target) query.set("target", target);
  query.set("page", invalid ? "1" : page); query.set("limit", invalid ? "1" : "20");
  const result = await adminReportsRead(query);
  if (!result.ok) return <AdminFailure reason={result.reason} />;
  if (invalid) return <AdminShell title="Denúncias" current="reports"><section className={styles.panel}><h2>Filtros inválidos</h2><Link href="/admin/reports">Limpar filtros</Link></section></AdminShell>;
  const value = result.value;
  if (!record(value) || !Array.isArray(value.data) || value.data.length > 20 || !record(value.meta) || value.meta.page !== Number(page) || typeof value.meta.hasPreviousPage !== "boolean" || typeof value.meta.hasNextPage !== "boolean" || (page === "1" && value.meta.hasPreviousPage) || (page === "999999" && value.meta.hasNextPage)
    || value.data.some(row => !record(row) || typeof row.id !== "string" || !uuid.test(row.id) || typeof row.reason !== "string" || row.reason.length > 1000 || typeof row.status !== "string" || !Object.hasOwn(statuses, row.status) || (status !== "ALL" && row.status !== status) || [row.postId, row.commentId, row.userId].filter(x => typeof x === "string" && uuid.test(x)).length !== 1 || [row.postId, row.commentId, row.userId].some(x => x != null && (typeof x !== "string" || !uuid.test(x))))) return <AdminFailure reason="unavailable" />;
  const href = (n: number) => { const p = new URLSearchParams({ page: String(n), status }); if (target) p.set("target", target); return `/admin/reports?${p}`; };
  return <AdminShell title="Denúncias" current="reports"><div className={styles.intro}><p className={styles.eyebrow}>Moderação</p><h2>Central de denúncias</h2><p>Consulte a situação e abra o contexto antes de registrar uma decisão.</p></div><section className={styles.panel}><Form className={styles.filters} action="/admin/reports" prefetch={false}><label>Situação<select name="status" defaultValue={status}>{Object.entries(statuses).map(([v, label]) => <option key={v} value={v}>{label}</option>)}<option value="ALL">Todas</option></select></label><label>Tipo<select name="target" defaultValue={target}><option value="">Todos</option>{Object.entries(targets).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label><button>Filtrar</button></Form></section><section className={styles.panel}>{value.data.length ? <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Denúncia</th><th>Tipo</th><th>Motivo</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{value.data.map(row => <tr key={row.id}><td>{row.id}</td><td>{row.postId ? "Artigo" : row.commentId ? "Comentário" : "Perfil"}</td><td>{row.reason}</td><td>{statuses[row.status]}</td><td><Link href={`/admin/reports/${row.id}`} prefetch={false}>Ver detalhes</Link></td></tr>)}</tbody></table></div> : <p>Nenhuma denúncia nesta página.</p>}<nav className={styles.pagination} aria-label="Paginação">{value.meta.hasPreviousPage && <Link href={href(Number(page) - 1)} prefetch={false}>Anterior</Link>}<span>Página {page}</span>{value.meta.hasNextPage && <Link href={href(Number(page) + 1)} prefetch={false}>Próxima</Link>}</nav></section></AdminShell>;
}
