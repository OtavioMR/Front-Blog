import Form from "next/form";
import Link from "next/link";
import Avatar from "@/app/_components/avatar";
import { AdminFailure, AdminShell } from "../_components/shell";
import { adminAuditRead, adminIdentity, adminUserDetail, adminUsersRead, record } from "../_lib/data";
import { IconArrowUpRight, IconShield } from "../_components/icons";
import styles from "../admin.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const short = (id: string) => `${id.slice(0, 8)}.${id.slice(-4)}`;
type Row = { id: string; name: string; email: string; role: string; profilePhoto: string | null; isActive: boolean; moderationSuspended: boolean };

function rows(value: unknown, max: number): Row[] | null {
  if (!record(value) || !Array.isArray(value.data) || value.data.length > max) return null;
  const out: Row[] = [];
  for (const row of value.data) {
    if (!record(row) || typeof row.id !== "string" || !uuid.test(row.id) || typeof row.name !== "string" || row.name.length > 255 || typeof row.email !== "string" || row.email.length > 255
      || typeof row.role !== "string" || typeof row.isActive !== "boolean" || typeof row.moderationSuspended !== "boolean") return null;
    out.push({ id: row.id, name: row.name, email: row.email, role: row.role, profilePhoto: typeof row.profilePhoto === "string" ? row.profilePhoto : null, isActive: row.isActive, moderationSuspended: row.moderationSuspended });
  }
  return out;
}

async function names(ids: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  await Promise.all([...new Set(ids)].filter(id => uuid.test(id)).map(async id => {
    const result = await adminUserDetail(id);
    if (result.ok && record(result.value) && typeof result.value.name === "string") found.set(id, result.value.name.slice(0, 255));
  }));
  return found;
}

export default async function AdministratorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams, search = one(raw.busca), page = one(raw.pagina) || "1";
  const actor = await adminIdentity();
  if (!actor) return <AdminFailure reason="session" />;
  // Exclusivo do SUPER_ADMIN; a API também recusa a alteração de cargos para qualquer outro perfil.
  if (actor.role !== "SUPER_ADMIN") return <AdminFailure reason="forbidden" />;
  if ([raw.busca, raw.pagina].some(Array.isArray) || search.length > 255 || !/^[1-9]\d{0,5}$/.test(page)) return <AdminFailure reason="missing" />;

  const [admins, supers, candidates, history] = await Promise.all([
    adminUsersRead(new URLSearchParams({ page: "1", limit: "20", role: "ADMIN", status: "active", sort: "name", order: "ASC" })),
    adminUsersRead(new URLSearchParams({ page: "1", limit: "20", role: "SUPER_ADMIN", status: "active", sort: "name", order: "ASC" })),
    search ? adminUsersRead(new URLSearchParams({ page: "1", limit: "10", search, status: "active" })) : Promise.resolve(null),
    adminAuditRead(new URLSearchParams({ page, limit: "10", action: "user.permissions_changed", targetType: "user" })),
  ]);
  for (const result of [admins, supers, history]) if (!result.ok) return <AdminFailure reason={result.reason} />;
  if (candidates && !candidates.ok) return <AdminFailure reason={candidates.reason} />;
  const adminRows = admins.ok ? rows(admins.value, 20) : null, superRows = supers.ok ? rows(supers.value, 20) : null;
  const found = candidates?.ok ? rows(candidates.value, 10) : [];
  const log = history.ok && record(history.value) && Array.isArray(history.value.data) && history.value.data.length <= 10 && record(history.value.meta) ? history.value : null;
  if (!adminRows || !superRows || !found || !log) return <AdminFailure reason="unavailable" />;
  const entries = (log.data as unknown[]).filter(record).filter(e => typeof e.id === "string" && typeof e.createdAt === "string" && Number.isFinite(Date.parse(e.createdAt)) && typeof e.targetId === "string" && uuid.test(e.targetId) && record(e.details));
  const meta = record(log.meta) ? log.meta : {};
  const known = await names(entries.flatMap(e => [String(e.targetId), typeof e.actorId === "string" ? e.actorId : ""]));
  const who = (id: unknown) => (typeof id === "string" && uuid.test(id) ? known.get(id) ?? short(id) : "Sistema");
  const eligible = found.filter(u => u.role !== "ADMIN" && u.role !== "SUPER_ADMIN");

  return (
    <AdminShell title="Administradores" current="admins">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Exclusivo do SUPER_ADMIN</p>
        <h2>Gerenciamento de Administradores</h2>
        <p>Conceda ou revogue o cargo ADMIN. Cada alteração exige justificativa e código do autenticador, revoga as sessões da conta e fica registrada na auditoria.</p>
      </div>

      <section className={styles.panel} aria-labelledby="admins-now">
        <h2 id="admins-now">Administradores ativos</h2>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr><th>Conta</th><th>E-mail</th><th>Cargo</th><th>Ações</th></tr></thead>
            <tbody>
              {[...superRows, ...adminRows].map(row => (
                <tr key={row.id}>
                  <td><div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}><Avatar name={row.name} src={row.profilePhoto} size={32} /><div><strong style={{ display: "block" }}>{row.name}</strong><span style={{ fontSize: "0.74rem", fontFamily: "monospace", color: "var(--text-muted)" }}>{short(row.id)}</span></div></div></td>
                  <td>{row.email}</td>
                  <td><span className={row.role === "SUPER_ADMIN" ? styles.roleBadgeSuperAdmin : styles.roleBadgeAdmin}><IconShield size={11} /> {row.role}</span></td>
                  <td>
                    {row.role === "ADMIN" ? (
                      <Link href={`/gestao-editorial/usuarios/${row.id}/funcao?cargo=READER`} prefetch={false} className={styles.btnSecondary} style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}>Remover cargo ADMIN</Link>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{row.id === actor.id ? "Sua conta" : "Cargo protegido"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!adminRows.length && <p style={{ color: "var(--text-muted)" }}>Nenhum ADMIN ativo além dos SUPER_ADMIN.</p>}
      </section>

      <section className={styles.panel} aria-labelledby="admins-promote">
        <h2 id="admins-promote">Promover usuário a ADMIN</h2>
        <Form className={styles.filters} action="/gestao-editorial/administradores" prefetch={false}>
          <label>Nome, e-mail ou identificador<input name="busca" defaultValue={search} maxLength={255} placeholder="Pesquise uma conta ativa" /></label>
          <button type="submit">Pesquisar</button>
        </Form>
        {search && (eligible.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead><tr><th>Conta</th><th>E-mail</th><th>Cargo atual</th><th>Ações</th></tr></thead>
              <tbody>
                {eligible.map(row => (
                  <tr key={row.id}>
                    <td><strong>{row.name}</strong></td>
                    <td>{row.email}</td>
                    <td>{row.role}</td>
                    <td><Link href={`/gestao-editorial/usuarios/${row.id}/funcao?cargo=ADMIN`} prefetch={false} className={styles.btnPrimary} style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}>Promover a ADMIN <IconArrowUpRight size={13} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p style={{ color: "var(--text-muted)" }}>Nenhuma conta elegível encontrada para esta busca.</p>)}
      </section>

      <section className={styles.panel} aria-labelledby="admins-history">
        <h2 id="admins-history">Histórico de alterações de cargo</h2>
        {entries.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead><tr><th>Quando</th><th>Concedido por</th><th>Conta</th><th>Alteração</th><th>Justificativa</th></tr></thead>
              <tbody>
                {entries.map(e => {
                  const d = e.details as Record<string, unknown>;
                  return (
                    <tr key={String(e.id)}>
                      <td>{new Date(String(e.createdAt)).toLocaleString("pt-BR", { timeZone: "UTC" })} UTC</td>
                      <td>{who(e.actorId)}</td>
                      <td><Link href={`/gestao-editorial/usuarios/${e.targetId}`} prefetch={false}>{who(e.targetId)}</Link></td>
                      <td>{typeof d.previousRole === "string" ? d.previousRole.slice(0, 20) : "?"} → {typeof d.role === "string" ? d.role.slice(0, 20) : "?"}</td>
                      <td>{typeof d.reason === "string" ? d.reason.slice(0, 1000) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p style={{ color: "var(--text-muted)" }}>Nenhuma alteração registrada.</p>}
        <nav className={styles.pagination} aria-label="Paginação do histórico">
          {meta.hasPreviousPage === true && <Link href={`/gestao-editorial/administradores?pagina=${Number(page) - 1}${search ? `&busca=${encodeURIComponent(search)}` : ""}`} prefetch={false}>Anterior</Link>}
          <span>Página {page}</span>
          {meta.hasNextPage === true && <Link href={`/gestao-editorial/administradores?pagina=${Number(page) + 1}${search ? `&busca=${encodeURIComponent(search)}` : ""}`} prefetch={false}>Próxima</Link>}
        </nav>
      </section>
    </AdminShell>
  );
}
