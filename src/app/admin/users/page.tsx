import Form from "next/form";
import Link from "next/link";
import { AdminFailure, AdminShell } from "../_components/shell";
import { adminUsersRead, record } from "../_lib/data";
import styles from "../admin.module.css";

/* O detalhe existente é um Route Handler que entrega um documento completo. */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roles = ["READER", "AUTHOR", "ADMIN", "SUPER_ADMIN"];
const one = (v: string | string[] | undefined) => typeof v === "string" ? v.trim() : "";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams, page = one(raw.page) || "1", search = one(raw.search), role = one(raw.role), status = one(raw.status), sort = one(raw.sort) || "createdAt", order = one(raw.order) || "DESC";
  const invalid = [raw.page, raw.search, raw.role, raw.status, raw.sort, raw.order].some(Array.isArray) || !/^[1-9]\d{0,5}$/.test(page) || search.length > 255 || !!(role && !roles.includes(role)) || !["", "active", "suspended", "inactive"].includes(status) || !["createdAt", "name"].includes(sort) || !["ASC", "DESC"].includes(order);
  const query = new URLSearchParams({ page: invalid ? "1" : page, limit: invalid ? "1" : "20" });
  if (!invalid) { if (search) query.set("search", search); if (role) query.set("role", role); if (status) query.set("status", status); if (sort !== "createdAt") query.set("sort", sort); if (order !== "DESC") query.set("order", order); }
  const result = await adminUsersRead(query);
  if (!result.ok) return <AdminFailure reason={result.reason} />;
  if (invalid) return <AdminShell title="Usuários" current="users"><section className={styles.panel}><h2>Filtros inválidos</h2><Link href="/admin/users">Limpar filtros</Link></section></AdminShell>;
  const value = result.value;
  if (!record(value) || !Array.isArray(value.data) || value.data.length > 20 || !record(value.meta) || value.meta.page !== Number(page) || typeof value.meta.hasPreviousPage !== "boolean" || typeof value.meta.hasNextPage !== "boolean" || (page === "1" && value.meta.hasPreviousPage) || (page === "999999" && value.meta.hasNextPage)
    || value.data.some(row => !record(row) || typeof row.id !== "string" || !uuid.test(row.id) || typeof row.name !== "string" || row.name.length > 255 || typeof row.email !== "string" || row.email.length > 255 || !roles.includes(String(row.role)) || typeof row.isActive !== "boolean" || typeof row.moderationSuspended !== "boolean" || typeof row.createdAt !== "string" || !Number.isFinite(Date.parse(row.createdAt)))) return <AdminFailure reason="unavailable" />;
  const href = (n: number) => { const p = new URLSearchParams(query); p.delete("limit"); p.set("page", String(n)); return `/admin/users?${p}`; };
  return <AdminShell title="Usuários" current="users"><div className={styles.intro}><p className={styles.eyebrow}>Comunidade</p><h2>Contas da plataforma</h2><p>Consulte contas, sua situação e o histórico administrativo.</p></div><section className={styles.panel}><Form className={styles.filters} action="/admin/users" prefetch={false}><label>Nome, e-mail ou identificador<input name="search" defaultValue={search} maxLength={255} /></label><label>Papel<select name="role" defaultValue={role}><option value="">Todos</option>{roles.map(r => <option key={r} value={r}>{r}</option>)}</select></label><label>Situação<select name="status" defaultValue={status}><option value="">Todas</option><option value="active">Ativa</option><option value="suspended">Suspensa</option><option value="inactive">Inativa</option></select></label><label>Ordenar por<select name="sort" defaultValue={sort}><option value="createdAt">Cadastro</option><option value="name">Nome</option></select></label><label>Ordem<select name="order" defaultValue={order}><option value="DESC">Decrescente</option><option value="ASC">Crescente</option></select></label><button>Filtrar</button></Form></section><section className={styles.panel}>{value.data.length ? <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Situação</th><th>Cadastro</th><th>Ação</th></tr></thead><tbody>{value.data.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.email}</td><td>{row.role}</td><td>{row.moderationSuspended ? "Suspensa" : row.isActive ? "Ativa" : "Inativa"}</td><td>{new Date(row.createdAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td><Link href={`/admin/users/${row.id}`} prefetch={false}>Ver conta</Link></td></tr>)}</tbody></table></div> : <p>Nenhuma conta nesta página.</p>}<nav className={styles.pagination} aria-label="Paginação">{value.meta.hasPreviousPage && <Link href={href(Number(page) - 1)} prefetch={false}>Anterior</Link>}<span>Página {page}</span>{value.meta.hasNextPage && <Link href={href(Number(page) + 1)} prefetch={false}>Próxima</Link>}</nav></section></AdminShell>;
}
