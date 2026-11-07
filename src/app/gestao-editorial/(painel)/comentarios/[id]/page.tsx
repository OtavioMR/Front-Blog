import Link from "next/link";
import { AdminFailure, AdminShell } from "../../_components/shell";
import { adminCommentDetail, adminCommentHistory, adminCommentsRead, adminCsrf, record } from "../../_lib/data";
import ModerateComment from "../_components/moderate";
import styles from "../../admin.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));
const text = (v: unknown, limit: number): v is string => typeof v === "string" && v.length <= limit;
const nullableId = (v: unknown) => v === null || (typeof v === "string" && uuid.test(v));

export default async function CommentDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params,
    raw = await searchParams,
    page = typeof raw.page === "string" && raw.page ? raw.page : "1";

  if (!uuid.test(id) || Array.isArray(raw.page) || !/^[1-9]\d{0,5}$/.test(page)) {
    const access = await adminCommentsRead(new URLSearchParams({ page: "1", limit: "1" }));
    if (!access.ok) return <AdminFailure reason={access.reason} />;
    return (
      <AdminShell title="Comentário" current="comments">
        <section className={styles.panel}>
          <h2>Endereço inválido</h2>
          <p>O identificador informado não é um comentário válido.</p>
          <Link href="/gestao-editorial/comentarios" className={styles.btnSecondary}>
            Voltar aos comentários
          </Link>
        </section>
      </AdminShell>
    );
  }

  const [detailResult, historyResult] = await Promise.all([adminCommentDetail(id), adminCommentHistory(id, page)]);
  if (!detailResult.ok) return <AdminFailure reason={detailResult.reason} />;
  if (!historyResult.ok) return <AdminFailure reason={historyResult.reason} />;

  const detail = detailResult.value,
    history = historyResult.value,
    csrf = await adminCsrf();
  if (!csrf) return <AdminFailure reason="session" />;

  if (
    !record(detail) ||
    detail.id !== id ||
    !text(detail.postId, 36) ||
    !uuid.test(detail.postId) ||
    !text(detail.authorId, 36) ||
    !uuid.test(detail.authorId) ||
    !nullableId(detail.rootId) ||
    !nullableId(detail.replyToId) ||
    !text(detail.content, 1000) ||
    typeof detail.isActive !== "boolean" ||
    typeof detail.moderationHidden !== "boolean" ||
    !date(detail.createdAt) ||
    !Array.isArray(detail.reports) ||
    detail.reports.length > 100 ||
    detail.reports.some(
      r =>
        !record(r) ||
        !text(r.id, 36) ||
        !uuid.test(r.id) ||
        !text(r.reason, 1000) ||
        !["PENDING", "IN_REVIEW", "RESOLVED", "DISMISSED"].includes(String(r.status)) ||
        !date(r.createdAt)
    ) ||
    !record(history) ||
    !Array.isArray(history.data) ||
    history.data.length > 10 ||
    !record(history.meta) ||
    history.meta.page !== Number(page) ||
    typeof history.meta.hasPreviousPage !== "boolean" ||
    typeof history.meta.hasNextPage !== "boolean" ||
    (page === "1" && history.meta.hasPreviousPage) ||
    (page === "999999" && history.meta.hasNextPage) ||
    history.data.some(
      row =>
        !record(row) ||
        !text(row.id, 36) ||
        !uuid.test(row.id) ||
        !text(row.action, 80) ||
        !nullableId(row.actorId) ||
        !date(row.createdAt)
    )
  ) {
    return <AdminFailure reason="unavailable" />;
  }

  return (
    <AdminShell
      title="Comentário"
      current="comments"
      actions={
        <Link href="/gestao-editorial/comentarios" className={styles.btnSecondary} style={{ padding: "0.4rem 0.8rem", fontSize: "0.82rem" }} prefetch={false}>
          Voltar aos comentários
        </Link>
      }
    >
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Moderação</p>
        <h2>Contexto do comentário</h2>
        <p>
          Identificador: <span style={{ fontFamily: "monospace" }}>{id}</span>
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 30rem), 1fr))", gap: "1.5rem" }}>
        {/* Coluna 1: Comentário e Ação de Moderação */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <section className={styles.panel} style={{ margin: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
              <span className={detail.moderationHidden ? styles.badgeHidden : detail.isActive ? styles.badgeActive : styles.badgeDismissed}>
                {detail.moderationHidden
                  ? "Oculto pela moderação"
                  : detail.isActive
                    ? "Ativo"
                    : "Desativado por outros meios"}
              </span>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                {new Date(detail.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              </span>
            </div>

            <div style={{ padding: "1.25rem", borderRadius: "0.65rem", border: "1px solid var(--border)", background: "var(--surface)", marginBottom: "1.25rem" }}>
              <p className={styles.commentText} style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.6 }}>
                {detail.content}
              </p>
            </div>

            <div style={{ display: "grid", gap: "0.4rem", fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}>
                <strong>Autor:</strong> <span style={{ fontFamily: "monospace" }}>{detail.authorId}</span>
              </p>
              <p style={{ margin: 0 }}>
                <strong>Artigo:</strong> <span style={{ fontFamily: "monospace" }}>{detail.postId}</span>
              </p>
              <p style={{ margin: 0 }}>
                <strong>Comentário principal:</strong> {String(detail.rootId || "—")} · <strong>Em resposta a:</strong> {String(detail.replyToId || "—")}
              </p>
            </div>

            {(detail.isActive || detail.moderationHidden) && (
              <div style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border-subtle)" }}>
                <h3 style={{ margin: "0 0 0.75rem", fontFamily: "var(--font-serif)", fontSize: "1.1rem" }}>
                  Moderação do comentário
                </h3>
                <ModerateComment id={id} action={detail.isActive ? "hide" : "restore"} csrf={csrf} />
              </div>
            )}
          </section>

          {/* Denúncias Relacionadas */}
          <section className={styles.panel} style={{ margin: 0 }}>
            <h2>Denúncias relacionadas</h2>
            {detail.reports.length ? (
              <ul className={styles.list}>
                {detail.reports.map(r => (
                  <li key={r.id} style={{ marginBottom: "0.4rem" }}>
                    <Link href={`/gestao-editorial/denuncias/${r.id}`} prefetch={false} style={{ color: "var(--brand)", fontWeight: 600 }}>
                      {r.reason}
                    </Link>{" "}
                    · <span className={styles.badgeInReview} style={{ fontSize: "0.72rem" }}>{r.status}</span> ·{" "}
                    {new Date(r.createdAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, color: "var(--text-muted)" }}>Nenhuma denúncia relacionada.</p>
            )}
          </section>
        </div>

        {/* Coluna 2: Histórico de Moderação */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <section className={styles.panel} style={{ margin: 0 }}>
            <h2>Histórico de moderação</h2>
            {history.data.length ? (
              <ul className={styles.list}>
                {history.data.map(row => (
                  <li key={row.id} style={{ marginBottom: "0.4rem" }}>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>
                      {new Date(row.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </span>{" "}
                    · <span className={styles.badgeInReview} style={{ fontSize: "0.72rem" }}>{row.action}</span>{" "}
                    · {row.actorId || "Sistema"}
                    {record(row.details) && text(row.details.reason, 1000) ? ` · ${row.details.reason}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, color: "var(--text-muted)" }}>Nenhuma ação registrada.</p>
            )}

            <nav className={styles.pagination} aria-label="Paginação do histórico">
              {history.meta.hasPreviousPage && (
                <Link href={`?page=${Number(page) - 1}`} prefetch={false}>
                  Anterior
                </Link>
              )}
              <span>Página {page}</span>
              {history.meta.hasNextPage && (
                <Link href={`?page=${Number(page) + 1}`} prefetch={false}>
                  Próxima
                </Link>
              )}
            </nav>
          </section>
        </div>
      </div>

      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/gestao-editorial/comentarios" className={styles.btnSecondary} prefetch={false}>
          Voltar aos comentários
        </Link>
      </p>
    </AdminShell>
  );
}
