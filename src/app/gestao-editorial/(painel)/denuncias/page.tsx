import Form from "next/form";
import Link from "next/link";
import Avatar from "@/app/_components/avatar";
import { AdminFailure, AdminShell } from "../_components/shell";
import { adminReportsRead, adminUsersRead, record } from "../_lib/data";
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
    target = one(raw.target),
    selected = one(raw.assignee),
    assignee = uuid.test(selected) ? "" : selected,
    moderatorId = one(raw.moderatorId) || (uuid.test(selected) ? selected : "");

  const invalid =
    [raw.page, raw.status, raw.target, raw.assignee, raw.moderatorId].some(Array.isArray) ||
    !/^[1-9]\d{0,5}$/.test(page) ||
    ![...Object.keys(statuses), "ALL"].includes(status) ||
    !!(target && !Object.hasOwn(targets, target)) || !["", "me", "unassigned"].includes(assignee) ||
    !!(moderatorId && (!uuid.test(moderatorId) || assignee));

  const query = new URLSearchParams();
  if (!invalid && status !== "ALL") query.set("status", status);
  if (!invalid && target) query.set("target", target);
  if (!invalid && assignee) query.set("assignee", assignee);
  if (!invalid && moderatorId) query.set("moderatorId", moderatorId);
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

  async function loadModerators(role: string) {
    const users: { id: string; name: string }[] = [];
    for (let n = 1; n <= 100; n++) {
      const response = await adminUsersRead(new URLSearchParams({ page: String(n), limit: "100", role, sort: "name", order: "ASC" }));
      if (!response.ok || !record(response.value) || !Array.isArray(response.value.data) || !record(response.value.meta) || typeof response.value.meta.hasNextPage !== "boolean") return null;
      for (const user of response.value.data) {
        if (!record(user) || typeof user.id !== "string" || !uuid.test(user.id) || typeof user.name !== "string") return null;
        users.push({ id: user.id, name: user.name });
      }
      if (!response.value.meta.hasNextPage) return users;
    }
    return null;
  }
  const lists = await Promise.all([loadModerators("ADMIN"), loadModerators("SUPER_ADMIN")]);
  const moderators = lists.flatMap(list => list ?? []).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const moderatorsUnavailable = lists.some(list => list === null);

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
    if (assignee) p.set("assignee", assignee);
    if (moderatorId) p.set("moderatorId", moderatorId);
    return `/gestao-editorial/denuncias?${p}`;
  };

  const statusTabHref = (s: string) => {
    const p = new URLSearchParams({ status: s });
    if (target) p.set("target", target);
    if (assignee) p.set("assignee", assignee);
    if (moderatorId) p.set("moderatorId", moderatorId);
    return `/gestao-editorial/denuncias?${p}`;
  };

  return (
    <AdminShell title="Denúncias" current="reports">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Moderação</p>
        <h2>Central de denúncias</h2>
        <p>Consulte a situação e abra o contexto antes de registrar uma decisão.</p>
      </div>

      <nav aria-label="Filas de trabalho" style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <Link className={styles.btnSecondary} href="/gestao-editorial/denuncias?status=ALL&assignee=me" prefetch={false}>Atribuídas a mim</Link>
        <Link className={styles.btnSecondary} href="/gestao-editorial/denuncias?status=ALL&assignee=unassigned" prefetch={false}>Sem responsável</Link>
        <Link className={styles.btnSecondary} href="/gestao-editorial/denuncias?status=IN_REVIEW" prefetch={false}>Em andamento</Link>
        <Link className={styles.btnSecondary} href="/gestao-editorial/denuncias?status=RESOLVED" prefetch={false}>Resolvidas</Link>
      </nav>

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

          <label>
            Responsável
            <select name="assignee" defaultValue={moderatorId || assignee}>
              <option value="">Todos</option>
              <option value="me">Atribuídas a mim</option>
              <option value="unassigned">Sem responsável</option>
              {moderatorId && !moderators.some(user => user.id === moderatorId) && <option value={moderatorId}>Administrador selecionado</option>}
              {moderators.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </label>

          <button type="submit">
            <IconFilter size={15} style={{ verticalAlign: "middle", marginRight: "0.3rem" }} />
            Filtrar
          </button>
        </Form>
        {moderatorsUnavailable && <p>Não foi possível carregar todos os administradores para o filtro.</p>}
      </section>

      {/* Tabela de Denúncias */}
      <section className={styles.panel}>
        {value.data.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Conteúdo denunciado</th>
                  <th>Tipo de Alvo</th>
                  <th>Motivo informado</th>
                  <th>Situação</th>
                  <th>Responsável</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {value.data.map(row => {
                  const targetLabel = row.postId ? "Artigo" : row.commentId ? "Comentário" : "Perfil";
                  return (
                    <tr key={String(row.id)}>
                      <td>
                        <div>{typeof row.targetLabel === "string" && row.targetLabel ? row.targetLabel : "Conteúdo indisponível"}</div>
                        {(row.postId || row.commentId) && <div style={{ display: "flex", alignItems: "center", gap: ".35rem", marginTop: ".3rem" }}><Avatar name={typeof row.authorName === "string" ? row.authorName : "Usuário removido"} src={typeof row.authorPhoto === "string" ? row.authorPhoto : null} size={24} /><span>{typeof row.authorName === "string" ? row.authorName : "Usuário removido"}</span></div>}
                        {row.commentId && <div>{typeof row.postTitle === "string" ? row.postTitle : "Artigo indisponível"}</div>}
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
                      <td>{typeof row.moderatorName === "string" ? row.moderatorName : row.moderatorId ? "Usuário indisponível" : "Sem responsável"}</td>
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
