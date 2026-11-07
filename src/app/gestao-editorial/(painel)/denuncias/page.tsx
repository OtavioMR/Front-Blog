import Form from "next/form";
import Link from "next/link";
import { AdminFailure, AdminShell } from "../_components/shell";
import { adminReportsRead, record } from "../_lib/data";
import {
  IconPosts,
  IconComments,
  IconUsers,
  IconArrowUpRight,
  IconFilter,
} from "../_components/icons";
import styles from "../admin.module.css";

/* O detalhe existente é um Route Handler que entrega um documento completo. */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses: Record<string, string> = {
  PENDING: "Pendente",
  IN_REVIEW: "Em análise",
  RESOLVED: "Resolvida",
  DISMISSED: "Improcedente",
};
const targets: Record<string, string> = {
  POST: "Artigo",
  COMMENT: "Comentário",
  USER: "Perfil",
};
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

function statusBadgeClass(status: string) {
  switch (status) {
    case "PENDING":
      return styles.badgePending;
    case "IN_REVIEW":
      return styles.badgeInReview;
    case "RESOLVED":
      return styles.badgeResolved;
    case "DISMISSED":
      return styles.badgeDismissed;
    default:
      return styles.badgeDraft;
  }
}

function targetIcon(row: Record<string, unknown>) {
  if (row.postId) return <IconPosts size={15} />;
  if (row.commentId) return <IconComments size={15} />;
  return <IconUsers size={15} />;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams,
    page = one(raw.page) || "1",
    status = one(raw.status) || "PENDING",
    target = one(raw.target);

  const invalid =
    [raw.page, raw.status, raw.target].some(Array.isArray) ||
    !/^[1-9]\d{0,5}$/.test(page) ||
    ![...Object.keys(statuses), "ALL"].includes(status) ||
    !!(target && !Object.hasOwn(targets, target));

  const query = new URLSearchParams();
  if (!invalid && status !== "ALL") query.set("status", status);
  if (!invalid && target) query.set("target", target);
  query.set("page", invalid ? "1" : page);
  query.set("limit", invalid ? "1" : "20");

  const result = await adminReportsRead(query);
  if (!result.ok) return <AdminFailure reason={result.reason} />;

  if (invalid) {
    return (
      <AdminShell title="Denúncias" current="reports">
        <section className={styles.panel}>
          <h2>Filtros inválidos</h2>
          <p>Os parâmetros de pesquisa informados não são válidos.</p>
          <Link href="/gestao-editorial/denuncias" className={styles.btnSecondary}>
            Limpar filtros
          </Link>
        </section>
      </AdminShell>
    );
  }

  const value = result.value;
  if (
    !record(value) ||
    !Array.isArray(value.data) ||
    value.data.length > 20 ||
    !record(value.meta) ||
    value.meta.page !== Number(page) ||
    typeof value.meta.hasPreviousPage !== "boolean" ||
    typeof value.meta.hasNextPage !== "boolean" ||
    (page === "1" && value.meta.hasPreviousPage) ||
    (page === "999999" && value.meta.hasNextPage) ||
    value.data.some(
      row =>
        !record(row) ||
        typeof row.id !== "string" ||
        !uuid.test(row.id) ||
        typeof row.reason !== "string" ||
        row.reason.length > 1000 ||
        typeof row.status !== "string" ||
        !Object.hasOwn(statuses, row.status) ||
        (status !== "ALL" && row.status !== status) ||
        [row.postId, row.commentId, row.userId].filter(x => typeof x === "string" && uuid.test(x)).length !== 1 ||
        [row.postId, row.commentId, row.userId].some(x => x != null && (typeof x !== "string" || !uuid.test(x)))
    )
  ) {
    return <AdminFailure reason="unavailable" />;
  }

  const href = (n: number) => {
    const p = new URLSearchParams({ page: String(n), status });
    if (target) p.set("target", target);
    return `/gestao-editorial/denuncias?${p}`;
  };

  const statusTabHref = (s: string) => {
    const p = new URLSearchParams({ status: s });
    if (target) p.set("target", target);
    return `/gestao-editorial/denuncias?${p}`;
  };

  return (
    <AdminShell title="Denúncias" current="reports">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Moderação</p>
        <h2>Central de denúncias</h2>
        <p>Consulte a situação e abra o contexto antes de registrar uma decisão.</p>
      </div>

      {/* Tabs Rápidas de Status */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {[
          { key: "PENDING", label: "Pendentes" },
          { key: "IN_REVIEW", label: "Em análise" },
          { key: "RESOLVED", label: "Resolvidas" },
          { key: "DISMISSED", label: "Improcedentes" },
          { key: "ALL", label: "Todas as denúncias" },
        ].map(tab => (
          <Link
            key={tab.key}
            href={statusTabHref(tab.key)}
            prefetch={false}
            className={status === tab.key ? styles.btnPrimary : styles.btnSecondary}
            style={{ padding: "0.45rem 0.9rem", fontSize: "0.82rem" }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Painel de Filtros */}
      <section className={styles.panel}>
        <Form className={styles.filters} action="/gestao-editorial/denuncias" prefetch={false}>
          <label>
            Situação
            <select name="status" defaultValue={status}>
              {Object.entries(statuses).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
              <option value="ALL">Todas</option>
            </select>
          </label>

          <label>
            Tipo
            <select name="target" defaultValue={target}>
              <option value="">Todos</option>
              {Object.entries(targets).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <button type="submit">
            <IconFilter size={15} style={{ verticalAlign: "middle", marginRight: "0.3rem" }} />
            Filtrar
          </button>
        </Form>
      </section>

      {/* Tabela de Denúncias */}
      <section className={styles.panel}>
        {value.data.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Identificador</th>
                  <th>Tipo de Alvo</th>
                  <th>Motivo informado</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {value.data.map(row => {
                  const targetLabel = row.postId ? "Artigo" : row.commentId ? "Comentário" : "Perfil";
                  return (
                    <tr key={String(row.id)}>
                      <td>
                        <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          {String(row.id).slice(0, 8)}…{String(row.id).slice(-4)}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            fontWeight: 600,
                          }}
                        >
                          {targetIcon(row as Record<string, unknown>)}
                          {targetLabel}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            maxWidth: "28rem",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={String(row.reason)}
                        >
                          {String(row.reason)}
                        </span>
                      </td>
                      <td>
                        <span className={statusBadgeClass(String(row.status))}>
                          {statuses[String(row.status)]}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/gestao-editorial/denuncias/${row.id}`}
                          prefetch={false}
                          className={styles.btnSecondary}
                          style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                        >
                          <span>Ver detalhes</span>
                          <IconArrowUpRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ padding: "1.5rem 0", textAlign: "center", color: "var(--text-muted)" }}>
            Nenhuma denúncia nesta página.
          </p>
        )}

        <nav className={styles.pagination} aria-label="Paginação">
          {value.meta.hasPreviousPage && (
            <Link href={href(Number(page) - 1)} prefetch={false}>
              Anterior
            </Link>
          )}
          <span>Página {page}</span>
          {value.meta.hasNextPage && (
            <Link href={href(Number(page) + 1)} prefetch={false}>
              Próxima
            </Link>
          )}
        </nav>
      </section>
    </AdminShell>
  );
}
