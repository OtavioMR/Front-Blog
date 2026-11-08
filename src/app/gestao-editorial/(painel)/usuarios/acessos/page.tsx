import Link from "next/link";
import { AdminFailure, AdminShell } from "../../_components/shell";
import { adminBlockedAuthors, adminIdentity, count, record } from "../../_lib/data";
import styles from "../../admin.module.css";

export default async function AuthorAccessPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await adminIdentity();
  if (!actor) return <AdminFailure reason="session" />;
  if (actor.role !== "SUPER_ADMIN") return <AdminFailure reason="forbidden" />;
  const params = await searchParams;
  const raw = params.page ?? "1";
  if (typeof raw !== "string" || !/^[1-9]\d{0,5}$/.test(raw)) return <AdminFailure reason="unavailable" />;
  const search = typeof params.search === "string" ? params.search.trim().slice(0, 255) : "";
  const filter = params.filter === "all" ? "all" : "requested";
  const page = Number(raw), result = await adminBlockedAuthors(page, 20, search, filter);
  if (!result.ok) return <AdminFailure reason={result.reason} />;
  const value = result.value;
  if (!record(value) || !Array.isArray(value.data) || !count(value.pendingTotal) || !record(value.meta) || !count(value.meta.total) || typeof value.meta.hasNextPage !== "boolean" || typeof value.meta.hasPreviousPage !== "boolean" || value.data.some((row: unknown) => !record(row) || typeof row.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id) || typeof row.name !== "string" || typeof row.email !== "string" || !(row.requestedAt === null || (typeof row.requestedAt === "string" && Number.isFinite(Date.parse(row.requestedAt)))))) return <AdminFailure reason="unavailable" />;
  const pageLink = (number: number) => `/gestao-editorial/usuarios/acessos?${new URLSearchParams({ page: String(number), search, filter })}`;
  return <AdminShell title="Acesso à autoria" current="users"><section className={styles.panel}>
    <h2>Solicitações e bloqueios de autoria</h2><p><strong>{value.pendingTotal} {value.pendingTotal === 1 ? "solicitação pendente" : "solicitações pendentes"}</strong>. A lista de bloqueados também inclui pessoas que ainda não solicitaram acesso.</p>
    <form method="get" className={styles.actions}><label>Buscar por nome, e-mail ou ID <input name="search" defaultValue={search} maxLength={255} /></label><label>Situação <select name="filter" defaultValue={filter}><option value="requested">Solicitações pendentes</option><option value="all">Todas as contas bloqueadas</option></select></label><button className={styles.btnPrimary}>Filtrar</button><Link href="/gestao-editorial/usuarios/acessos">Limpar</Link></form>
    <p>{value.meta.total} {value.meta.total === 1 ? "resultado" : "resultados"} · Página {page}</p>
    {value.data.length === 0 ? <p>Nenhuma conta encontrada para este filtro.</p> : <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Usuário</th><th>E-mail</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{value.data.map((user: { id: string; name: string; email: string; requestedAt: string | null }) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.requestedAt ? <>Solicitada em {new Date(user.requestedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</> : "Bloqueada, sem solicitação"}</td><td><Link href={`/gestao-editorial/usuarios/${user.id}`} prefetch={false}>Avaliar conta</Link></td></tr>)}</tbody></table></div>}
    <div className={styles.actions}>{value.meta.hasPreviousPage && <Link href={pageLink(page - 1)}>Página anterior</Link>}{value.meta.hasNextPage && <Link href={pageLink(page + 1)}>Próxima página</Link>}</div>
  </section></AdminShell>;
}
