import Link from "next/link";
import sanitizeHtml from "sanitize-html";
import Avatar from "@/app/_components/avatar";
import { AdminFailure, AdminShell } from "../../_components/shell";
import { adminCsrf, adminIdentity, adminReportDetail, adminReportHistory, adminReportsRead, adminUsersRead, record } from "../../_lib/data";
import ResolveReport from "../_components/resolve";
import { IconPosts, IconComments, IconUsers } from "../../_components/icons";
import styles from "../../admin.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const nullableText = (v: unknown, max: number) => v === null || text(v, max);
const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  IN_REVIEW: "Em análise",
  RESOLVED: "Resolvida (Procedente)",
  DISMISSED: "Improcedente",
};

const categoryLabels: Record<string, string> = {
  SPAM: "Spam",
  HARASSMENT: "Assédio",
  HATE_SPEECH: "Discurso de ódio",
  INAPPROPRIATE: "Conteúdo inadequado",
  COPYRIGHT: "Violação de direitos autorais",
  MISINFORMATION: "Desinformação",
  OTHER: "Outro",
};

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

export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params,
    raw = await searchParams,
    page = typeof raw.page === "string" && raw.page ? raw.page : "1",
    moderatorPage = typeof raw.moderatorPage === "string" && raw.moderatorPage ? raw.moderatorPage : "1";

  if (!uuid.test(id) || Array.isArray(raw.page) || Array.isArray(raw.moderatorPage) || !/^[1-9]\d{0,5}$/.test(page) || !/^[1-9]\d{0,5}$/.test(moderatorPage)) {
    const access = await adminReportsRead(new URLSearchParams({ page: "1", limit: "1" }));
    if (!access.ok) return <AdminFailure reason={access.reason} />;
    return (
      <AdminShell title="Denúncia" current="reports">
        <section className={styles.panel}>
          <h2>Endereço inválido</h2>
          <p>O identificador da denúncia é inválido.</p>
          <Link href="/gestao-editorial/denuncias" className={styles.btnSecondary}>
            Voltar às denúncias
          </Link>
        </section>
      </AdminShell>
    );
  }

  const [detailResult, historyResult, actor, csrf, admins, supers] = await Promise.all([
    adminReportDetail(id),
    adminReportHistory(id, page),
    adminIdentity(),
    adminCsrf(),
    adminUsersRead(new URLSearchParams({ page: moderatorPage, limit: "20", role: "ADMIN", status: "active", sort: "name", order: "ASC" })),
    adminUsersRead(new URLSearchParams({ page: moderatorPage, limit: "20", role: "SUPER_ADMIN", status: "active", sort: "name", order: "ASC" })),
  ]);

  if (!detailResult.ok) return <AdminFailure reason={detailResult.reason} />;
  if (!historyResult.ok) return <AdminFailure reason={historyResult.reason} />;
  if (!csrf) return <AdminFailure reason="session" />;

  const detail = detailResult.value,
    history = historyResult.value;
  const moderators = [admins, supers].flatMap(result => result.ok && record(result.value) && Array.isArray(result.value.data) ? result.value.data : []).filter((row): row is { id: string; name: string } => record(row) && typeof row.id === "string" && uuid.test(row.id) && typeof row.name === "string");
  const moreModerators = [admins, supers].some(result => result.ok && record(result.value) && record(result.value.meta) && result.value.meta.hasNextPage === true);

  if (
    !record(detail) ||
    detail.id !== id ||
    !text(detail.reason, 1000) ||
    !nullableText(detail.reasonCategory, 50) ||
    !nullableText(detail.description, 2000) ||
    !["PENDING", "IN_REVIEW", "RESOLVED", "DISMISSED"].includes(String(detail.status)) ||
    !nullableText(detail.moderatorId, 36) ||
    !nullableText(detail.moderationNote, 1000) ||
    !date(detail.createdAt) ||
    !(detail.target === null || record(detail.target)) ||
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
        !nullableText(row.actorId, 36) ||
        !date(row.createdAt)
    )
  ) {
    return <AdminFailure reason="unavailable" />;
  }

  const target = detail.target as {
    type?: string;
    id?: string;
    title?: string;
    content?: string;
    name?: string;
    author?: { name?: string; profilePhoto?: string | null } | null;
    post?: { id?: string; title?: string } | null;
  } | null;

  const targetType =
    target && typeof target.type === "string" && ["POST", "COMMENT", "USER"].includes(target.type)
      ? (target.type as "POST" | "COMMENT" | "USER")
      : null;

  return (
    <AdminShell
      title="Denúncia"
      current="reports"
      actions={
        <Link href="/gestao-editorial/denuncias" className={styles.btnSecondary} style={{ padding: "0.4rem 0.8rem", fontSize: "0.82rem" }} prefetch={false}>
          Voltar às denúncias
        </Link>
      }
    >
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Moderação</p>
        <h2>Detalhes da denúncia</h2>
        <p>
          Identificador: <span style={{ fontFamily: "monospace" }}>{id}</span> · Situação:{" "}
          <span className={statusBadgeClass(String(detail.status))}>
            {statusLabels[String(detail.status)] ?? String(detail.status)}
          </span>
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 30rem), 1fr))", gap: "1.5rem" }}>
        {/* Coluna 1: Informações e Conteúdo Denunciado */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Motivo e Informações */}
          <section className={styles.panel} style={{ margin: 0 }}>
            <h2>Relato de quem denunciou</h2>
            <p className={styles.reportExplanation}>Texto enviado pela pessoa que fez a denúncia.</p>
            <div style={{ display: "grid", gap: "0.75rem", fontSize: "0.92rem", lineHeight: 1.5 }}>
              <div className={styles.reportQuote}><strong>O que a pessoa escreveu</strong><p>{String(detail.reason)}</p></div>
              {detail.reasonCategory ? (
                <p style={{ margin: 0 }}>
                  <strong>Categoria:</strong>{" "}
                  <span className={styles.badgePending}>
                    {categoryLabels[String(detail.reasonCategory)] ?? String(detail.reasonCategory)}
                  </span>
                </p>
              ) : null}
              {detail.description ? (
                <div style={{ marginTop: "0.25rem", padding: "0.75rem", borderRadius: "0.5rem", background: "var(--surface-subtle)" }}>
                  <strong style={{ display: "block", marginBottom: "0.25rem" }}>Detalhamento:</strong>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{String(detail.description)}</p>
                </div>
              ) : null}
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.82rem" }}>
                <strong>Data de recebimento:</strong>{" "}
                {new Date(detail.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              </p>
              {detail.moderatorId ? (
                <p style={{ margin: 0, fontSize: "0.85rem" }}>
                  <strong>Moderador atribuído:</strong> {record(detail.moderator) && text(detail.moderator.name, 200) ? detail.moderator.name : "Usuário indisponível"}{record(detail.moderator) && typeof detail.moderator.role === "string" ? ` (${detail.moderator.role})` : ""}
                </p>
              ) : null}
              {date(detail.assignedAt) && <p style={{ margin: 0, fontSize: "0.85rem" }}><strong>Assumido em:</strong> {new Date(detail.assignedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>}
              {detail.moderationNote ? (
                <div style={{ marginTop: "0.5rem", padding: "0.75rem", borderRadius: "0.5rem", background: "var(--brand-light)", border: "1px solid rgba(178, 67, 28, 0.2)" }}>
                  <strong>Justificativa da decisão:</strong> {String(detail.moderationNote)}
                </div>
              ) : null}
            </div>
          </section>

          {/* Conteúdo Denunciado */}
          <section className={styles.panel} style={{ margin: 0 }}>
            <h2>Conteúdo denunciado</h2>
            <p className={styles.reportExplanation}>Este é o conteúdo denunciado, separado do relato acima.</p>
            {target ? (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span className={styles.badgeInReview}>
                    {targetType === "POST" && <IconPosts size={14} />}
                    {targetType === "COMMENT" && <IconComments size={14} />}
                    {targetType === "USER" && <IconUsers size={14} />}
                    {targetType === "POST" ? "Artigo" : targetType === "COMMENT" ? "Comentário" : "Perfil de usuário"}
                  </span>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                    ID: {String(target.id)}
                  </span>
                </div>

                {targetType === "USER" && target.name && (
                  <p style={{ margin: 0 }}>
                    <strong>Nome do perfil:</strong> {String(target.name)}
                  </p>
                )}

                {targetType === "POST" && (
                  <div style={{ padding: "1rem", borderRadius: "0.6rem", border: "1px solid var(--border)", background: "var(--surface)" }}>
                    {target.title ? (
                      <h3 style={{ margin: "0 0 0.5rem", fontFamily: "var(--font-serif)", fontSize: "1.2rem" }}>
                        {String(target.title)}
                      </h3>
                    ) : null}
                    {target.content ? (
                      <div
                        style={{ fontSize: "0.92rem", lineHeight: 1.6 }}
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(target.content, {
                            allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "blockquote", "h2", "h3"],
                            allowedAttributes: {},
                          }),
                        }}
                      />
                    ) : null}
                  </div>
                )}

                {targetType === "COMMENT" && !target.content && <p>O texto do comentário não está disponível.</p>}
                {targetType === "COMMENT" && target.content && (
                  <div style={{ padding: "1rem", borderRadius: "0.6rem", border: "1px solid var(--border)", background: "var(--surface)" }}>
                    <p><Avatar name={target.author?.name || "Usuário removido"} src={target.author?.profilePhoto || null} size={24} /> <strong>Autor:</strong> {target.author?.name || "Usuário removido"}</p>
                    <p><strong>Artigo:</strong> {target.post?.title || "Conteúdo indisponível"}</p>
                    <strong>Texto do comentário denunciado</strong>
                    <p className={`${styles.commentText} ${styles.reportQuoteText}`}>
                      {String(target.content)}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ margin: 0, color: "var(--text-muted)" }}>
                O conteúdo denunciado não está mais disponível ou foi removido.
              </p>
            )}
          </section>
        </div>

        {/* Coluna 2: Ação de Moderação & Histórico */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {["PENDING", "IN_REVIEW"].includes(String(detail.status)) && (
            <section className={styles.panel} style={{ margin: 0, border: "1px solid rgba(178, 67, 28, 0.3)" }}>
              <h2>Decisão de moderação</h2>
              <ResolveReport
                id={id}
                targetType={targetType}
                currentModeratorId={detail.moderatorId ? String(detail.moderatorId) : null}
                actorId={actor?.id}
                canRelease={actor?.role === "SUPER_ADMIN"}
                moderators={moderators}
                csrf={csrf}
              />
              {(Number(moderatorPage) > 1 || moreModerators) && <nav className={styles.pagination} aria-label="Paginação de administradores para encaminhamento">
                {Number(moderatorPage) > 1 && <Link href={`?page=${page}&moderatorPage=${Number(moderatorPage) - 1}`} prefetch={false}>Administradores anteriores</Link>}
                <span>Página {moderatorPage}</span>
                {moreModerators && <Link href={`?page=${page}&moderatorPage=${Number(moderatorPage) + 1}`} prefetch={false}>Próximos administradores</Link>}
              </nav>}
            </section>
          )}

          {/* Histórico de Moderação */}
          <section className={styles.panel} style={{ margin: 0 }}>
            <h2>Histórico de moderação</h2>
            {history.data.length ? (
              <ul className={styles.list}>
                {history.data.map(row => (
                  <li key={String(row.id)} style={{ marginBottom: "0.35rem" }}>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>
                      {new Date(String(row.createdAt)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </span>{" "}
                    · <span className={styles.badgeInReview} style={{ fontSize: "0.72rem" }}>{({ "report.assign": "Análise atribuída", "report.release": "Análise liberada", "report.review": "Decisão registrada", "report.created": "Denúncia criada" } as Record<string, string>)[String(row.action)] ?? "Evento registrado"}</span>{" "}
                    · Responsável: {typeof row.actorName === "string" ? row.actorName : row.actorId ? "Usuário indisponível" : "Sistema"}
                    {record(row.details) && text(row.details.note, 1000) ? ` · ${row.details.note}` : record(row.details) && text(row.details.reason, 1000) ? ` · ${row.details.reason}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, color: "var(--text-muted)" }}>
                Nenhuma ação registrada para esta denúncia.
              </p>
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
        <Link href="/gestao-editorial/denuncias" className={styles.btnSecondary} prefetch={false}>
          Voltar às denúncias
        </Link>
      </p>
    </AdminShell>
  );
}
