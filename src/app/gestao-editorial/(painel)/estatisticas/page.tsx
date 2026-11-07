import { AdminFailure, AdminShell } from "../_components/shell";
import { adminRead, count, record } from "../_lib/data";
import styles from "../admin.module.css";

const date = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));

export default async function ActivityAnalytics() {
  const result = await adminRead("/admin/analytics/activity");
  if (!result.ok) return <AdminFailure reason={result.reason} />;

  const value = result.value;
  if (
    !record(value) ||
    !date(value.from) ||
    !date(value.to) ||
    !Array.isArray(value.series) ||
    value.series.length > 367 ||
    !Array.isArray(value.recentPosts) ||
    value.recentPosts.length > 10 ||
    !Array.isArray(value.recentActions) ||
    value.recentActions.length > 10 ||
    value.series.some(
      row =>
        !record(row) ||
        !date(row.day) ||
        ![row.users, row.posts, row.reports, row.subscribers].every(count)
    ) ||
    value.recentPosts.some(
      row =>
        !record(row) ||
        typeof row.id !== "string" ||
        typeof row.title !== "string" ||
        row.title.length > 255 ||
        !(row.publishedAt === null || date(row.publishedAt))
    ) ||
    value.recentActions.some(
      row =>
        !record(row) ||
        typeof row.id !== "string" ||
        typeof row.action !== "string" ||
        row.action.length > 80 ||
        !date(row.createdAt)
    )
  ) {
    return <AdminFailure reason="unavailable" />;
  }

  return (
    <AdminShell title="Atividade" current="analytics">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Acompanhamento</p>
        <h2>Movimentação da plataforma</h2>
        <p>
          Eventos entre {new Date(value.from).toLocaleDateString("pt-BR", { timeZone: "UTC" })} e{" "}
          {new Date(value.to).toLocaleDateString("pt-BR", { timeZone: "UTC" })}. Os dias usam o fuso configurado no banco.
        </p>
      </div>

      {/* Painel: Evolução Diária */}
      <section className={styles.panel}>
        <h2>Evolução diária</h2>
        <p>Cadastros, artigos, denúncias e primeiros registros de inscrição na newsletter.</p>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Dia</th>
                <th>Usuários</th>
                <th>Artigos</th>
                <th>Denúncias</th>
                <th>Inscrições</th>
              </tr>
            </thead>
            <tbody>
              {value.series.map(row => (
                <tr key={String(row.day)}>
                  <td>
                    <strong>{new Date(String(row.day)).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</strong>
                  </td>
                  <td>
                    <span className={styles.badgeActive}>{String(row.users)}</span>
                  </td>
                  <td>
                    <span className={styles.badgeInReview}>{String(row.posts)}</span>
                  </td>
                  <td>
                    <span className={Number(row.reports) > 0 ? styles.badgePending : styles.badgeDismissed}>
                      {String(row.reports)}
                    </span>
                  </td>
                  <td>
                    <span className={styles.badgeDraft}>{String(row.subscribers)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {value.series.length === 0 && (
          <p style={{ padding: "1rem 0", textAlign: "center", color: "var(--text-muted)" }}>
            Nenhum dado para o período.
          </p>
        )}
      </section>

      {/* Colunas: Publicações e Ações Recentes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 28rem), 1fr))", gap: "1.5rem" }}>
        <section className={styles.panel} style={{ margin: 0 }}>
          <h2>Publicações recentes</h2>
          <p style={{ margin: "0 0 1rem", fontSize: "0.88rem" }}>
            Últimos artigos publicados na plataforma.
          </p>
          {value.recentPosts.length ? (
            <ul className={styles.list}>
              {value.recentPosts.map(row => (
                <li key={String(row.id)} style={{ marginBottom: "0.4rem" }}>
                  <strong style={{ color: "var(--text)" }}>{String(row.title)}</strong>
                  {row.publishedAt && (
                    <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                      {" "}· {new Date(String(row.publishedAt)).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, color: "var(--text-muted)" }}>Nenhuma publicação recente.</p>
          )}
        </section>

        <section className={styles.panel} style={{ margin: 0 }}>
          <h2>Ações administrativas recentes</h2>
          <p style={{ margin: "0 0 1rem", fontSize: "0.88rem" }}>
            Eventos auditados executados por administradores.
          </p>
          {value.recentActions.length ? (
            <ul className={styles.list}>
              {value.recentActions.map(row => (
                <li key={String(row.id)} style={{ marginBottom: "0.4rem" }}>
                  <span className={styles.badgeInReview} style={{ fontSize: "0.75rem" }}>
                    {String(row.action)}
                  </span>{" "}
                  ·{" "}
                  <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                    {new Date(String(row.createdAt)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, color: "var(--text-muted)" }}>Nenhuma ação recente.</p>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
