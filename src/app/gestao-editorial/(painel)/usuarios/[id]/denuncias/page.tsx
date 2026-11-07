import Link from "next/link";
import { AdminFailure, AdminShell } from "../../../_components/shell";
import { adminUserDetail, adminUserReports, adminUsersRead, record } from "../../../_lib/data";
import styles from "../../../admin.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));

const statuses: Record<string, string> = {
  PENDING: "Pendente",
  IN_REVIEW: "Em análise",
  RESOLVED: "Resolvida",
  DISMISSED: "Improcedente",
};

export default async function UserReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params, raw = await searchParams, page = typeof raw.page === "string" && raw.page ? raw.page : "1";
  if (!uuid.test(id) || Array.isArray(raw.page) || !/^[1-9]\d{0,5}$/.test(page)) {
    const access = await adminUsersRead(new URLSearchParams({ page: "1", limit: "1" }));
    if (!access.ok) return <AdminFailure reason={access.reason} />;
    return (
      <AdminShell title="Denúncias do usuário" current="users">
        <section className={styles.panel}>
          <h2>Endereço inválido</h2>
          <Link href="/gestao-editorial/usuarios">Voltar aos usuários</Link>
        </section>
      </AdminShell>
    );
  }

  const [userResult, reportsResult] = await Promise.all([
    adminUserDetail(id),
    adminUserReports(id, page),
  ]);

  if (!userResult.ok) return <AdminFailure reason={userResult.reason} />;
  if (!reportsResult.ok) return <AdminFailure reason={reportsResult.reason} />;

  const user = userResult.value, reports = reportsResult.value;

  if (
    !record(user) ||
    user.id !== id ||
    !text(user.name, 255) ||
    !record(reports) ||
    !Array.isArray(reports.data) ||
    reports.data.length > 10 ||
    !record(reports.meta) ||
    reports.meta.page !== Number(page) ||
    typeof reports.meta.hasPreviousPage !== "boolean" ||
    typeof reports.meta.hasNextPage !== "boolean" ||
    (page === "1" && reports.meta.hasPreviousPage) ||
    (page === "999999" && reports.meta.hasNextPage) ||
    reports.data.some(
      row =>
        !record(row) ||
        !text(row.id, 36) ||
        !uuid.test(row.id) ||
        !text(row.reason, 1000) ||
        !text(row.status, 20) ||
        !date(row.createdAt)
    )
  ) {
    return <AdminFailure reason="unavailable" />;
  }

  return (
    <AdminShell title="Denúncias relacionadas" current="users">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Moderação de conta</p>
        <h2>Denúncias de {user.name}</h2>
        <p>Denúncias abertas sobre o perfil ou conteúdos de autoria deste usuário.</p>
      </div>

      <section className={styles.panel}>
        {reports.data.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Motivo</th>
                  <th>Situação</th>
                  <th>Data</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {reports.data.map(row => (
                  <tr key={String(row.id)}>
                    <td>{String(row.reason)}</td>
                    <td>{statuses[String(row.status)] ?? String(row.status)}</td>
                    <td>{new Date(String(row.createdAt)).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                    <td>
                      <Link href={`/gestao-editorial/denuncias/${row.id}`} prefetch={false}>
                        Ver denúncia
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Nenhuma denúncia associada a esta conta.</p>
        )}

        <nav className={styles.pagination} aria-label="Paginação">
          {reports.meta.hasPreviousPage && (
            <Link href={`?page=${Number(page) - 1}`} prefetch={false}>
              Anterior
            </Link>
          )}
          <span>Página {page}</span>
          {reports.meta.hasNextPage && (
            <Link href={`?page=${Number(page) + 1}`} prefetch={false}>
              Próxima
            </Link>
          )}
        </nav>
      </section>

      <p>
        <Link href={`/gestao-editorial/usuarios/${id}`} prefetch={false}>
          Voltar aos detalhes da conta
        </Link>
      </p>
    </AdminShell>
  );
}
