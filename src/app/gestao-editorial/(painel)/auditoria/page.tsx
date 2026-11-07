import Link from "next/link";
import Form from "next/form";
import { AdminFailure, AdminShell } from "../_components/shell";
import { adminAuditRead, record } from "../_lib/data";
import { IconFilter } from "../_components/icons";
import styles from "../admin.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const single = (value: string | string[] | undefined) => (typeof value === "string" ? value.trim() : "");
const validDay = (day: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(day) &&
  Number.isFinite(Date.parse(`${day}T00:00:00.000Z`)) &&
  new Date(`${day}T00:00:00.000Z`).toISOString().slice(0, 10) === day;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams,
    page = single(raw.page) || "1",
    actorId = single(raw.actorId),
    targetId = single(raw.targetId),
    action = single(raw.action),
    targetType = single(raw.targetType),
    from = single(raw.from),
    to = single(raw.to);

  const invalid =
    [raw.page, raw.actorId, raw.targetId, raw.action, raw.targetType, raw.from, raw.to].some(Array.isArray) ||
    !/^[1-9]\d{0,5}$/.test(page) ||
    !!(actorId && !uuid.test(actorId)) ||
    !!(targetId && !uuid.test(targetId)) ||
    action.length > 100 ||
    targetType.length > 100 ||
    !!(from && !validDay(from)) ||
    !!(to && !validDay(to)) ||
    !!(from && to && from > to);

  if (invalid) {
    const access = await adminAuditRead(new URLSearchParams({ page: "1", limit: "1" }));
    if (!access.ok) return <AdminFailure reason={access.reason} />;
    return (
      <AdminShell title="Auditoria" current="audit">
        <section className={styles.panel}>
          <h2>Filtros inválidos</h2>
          <p>Confira o identificador, os filtros e a página.</p>
          <Link href="/gestao-editorial/auditoria" className={styles.btnSecondary}>
            Limpar filtros
          </Link>
        </section>
      </AdminShell>
    );
  }

  const query = new URLSearchParams({ page, limit: "20" });
  if (actorId) query.set("actorId", actorId);
  if (targetId) query.set("targetId", targetId);
  if (action) query.set("action", action);
  if (targetType) query.set("targetType", targetType);
  if (from) query.set("from", `${from}T00:00:00.000Z`);
  if (to) query.set("to", `${to}T23:59:59.999Z`);

  const result = await adminAuditRead(query);
  if (!result.ok) return <AdminFailure reason={result.reason} />;

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
        !(row.actorId === null || (typeof row.actorId === "string" && uuid.test(row.actorId))) ||
        typeof row.action !== "string" ||
        row.action.length > 80 ||
        typeof row.targetType !== "string" ||
        row.targetType.length > 40 ||
        typeof row.targetId !== "string" ||
        !uuid.test(row.targetId) ||
        typeof row.createdAt !== "string" ||
        !Number.isFinite(Date.parse(row.createdAt))
    )
  ) {
    return <AdminFailure reason="unavailable" />;
  }

  const href = (n: number) => {
    const p = new URLSearchParams(query);
    p.delete("limit");
    p.set("page", String(n));
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return `/gestao-editorial/auditoria?${p}`;
  };

  return (
    <AdminShell title="Auditoria" current="audit">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Histórico</p>
        <h2>Ações registradas</h2>
        <p>Eventos administrativos em ordem decrescente de data. O filtro de datas usa UTC.</p>
      </div>

      {/* Painel de Filtros */}
      <section className={styles.panel}>
        <Form className={styles.filters} action="/gestao-editorial/auditoria" prefetch={false}>
          <label>
            Identificador do responsável
            <input
              name="actorId"
              defaultValue={actorId}
              maxLength={36}
              placeholder="UUID do administrador..."
            />
          </label>

          <label>
            Identificador do recurso
            <input
              name="targetId"
              defaultValue={targetId}
              maxLength={36}
              placeholder="UUID do alvo..."
            />
          </label>

          <label>
            Ação
            <input
              name="action"
              defaultValue={action}
              maxLength={100}
              placeholder="Ex: report.resolve, user.suspend"
            />
          </label>

          <label>
            Tipo de recurso
            <input
              name="targetType"
              defaultValue={targetType}
              maxLength={100}
              placeholder="Ex: report, post, user"
            />
          </label>

          <label>
            De
            <input type="date" name="from" defaultValue={from} />
          </label>

          <label>
            Até
            <input type="date" name="to" defaultValue={to} />
          </label>

          <button type="submit">
            <IconFilter size={15} style={{ verticalAlign: "middle", marginRight: "0.3rem" }} />
            Filtrar
          </button>
        </Form>
      </section>

      {/* Tabela de Logs */}
      <section className={styles.panel}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Responsável</th>
                <th>Ação</th>
                <th>Recurso</th>
                <th>Justificativa</th>
              </tr>
            </thead>
            <tbody>
              {value.data.map(row => (
                <tr key={String(row.id)}>
                  <td>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      {new Date(String(row.createdAt)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--text)" }}>
                      {row.actorId || "Sistema"}
                    </span>
                  </td>
                  <td>
                    <span className={styles.badgeInReview}>{String(row.action)}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: "0.82rem" }}>
                      <strong style={{ color: "var(--text)" }}>{String(row.targetType)}</strong>:{" "}
                      <code style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{String(row.targetId)}</code>
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      {record(row.details) &&
                      typeof row.details.reason === "string" &&
                      row.details.reason.length <= 1000
                        ? row.details.reason
                        : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {value.data.length === 0 && (
          <p style={{ padding: "1.5rem 0", textAlign: "center", color: "var(--text-muted)" }}>
            Nenhum evento nesta página.
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
