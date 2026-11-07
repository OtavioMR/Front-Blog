import Link from "next/link";
import sanitizeHtml from "sanitize-html";
import { AdminFailure, AdminShell } from "../../_components/shell";
import { adminCsrf, adminIdentity, adminReportDetail, adminReportHistory, adminReportsRead, record } from "../../_lib/data";
import ResolveReport from "../_components/resolve";
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

export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params, raw = await searchParams, page = typeof raw.page === "string" && raw.page ? raw.page : "1";
  if (!uuid.test(id) || Array.isArray(raw.page) || !/^[1-9]\d{0,5}$/.test(page)) {
    const access = await adminReportsRead(new URLSearchParams({ page: "1", limit: "1" }));
    if (!access.ok) return <AdminFailure reason={access.reason} />;
    return (
      <AdminShell title="Denúncia" current="reports">
        <section className={styles.panel}>
          <h2>Endereço inválido</h2>
          <Link href="/admin/reports">Voltar às denúncias</Link>
        </section>
      </AdminShell>
    );
  }

  const [detailResult, historyResult, actor, csrf] = await Promise.all([
    adminReportDetail(id),
    adminReportHistory(id, page),
    adminIdentity(),
    adminCsrf(),
  ]);
  if (!detailResult.ok) return <AdminFailure reason={detailResult.reason} />;
  if (!historyResult.ok) return <AdminFailure reason={historyResult.reason} />;
  if (!csrf) return <AdminFailure reason="session" />;

  const detail = detailResult.value, history = historyResult.value;

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
    history.data.some(row => !record(row) || !text(row.id, 36) || !uuid.test(row.id) || !text(row.action, 80) || !nullableText(row.actorId, 36) || !date(row.createdAt))
  ) {
    return <AdminFailure reason="unavailable" />;
  }

  const target = detail.target as { type?: string; id?: string; title?: string; content?: string; name?: string } | null;
  const targetType = target && typeof target.type === "string" && ["POST", "COMMENT", "USER"].includes(target.type) ? (target.type as "POST" | "COMMENT" | "USER") : null;

  return (
    <AdminShell title="Denúncia" current="reports">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Moderação</p>
        <h2>Detalhes da denúncia</h2>
        <p>Identificador: {id} · Situação: {statusLabels[String(detail.status)] ?? String(detail.status)}</p>
      </div>

      <section className={styles.panel}>
        <h2>Motivo e descrição</h2>
        <p><strong>Motivo informado:</strong> {String(detail.reason)}</p>
        {detail.reasonCategory ? <p><strong>Categoria:</strong> {categoryLabels[String(detail.reasonCategory)] ?? String(detail.reasonCategory)}</p> : null}
        {detail.description ? <p><strong>Detalhamento:</strong> {String(detail.description)}</p> : null}
        <p><strong>Data de recebimento:</strong> {new Date(detail.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
        {detail.moderatorId ? <p><strong>Moderador atribuído:</strong> {String(detail.moderatorId)}</p> : null}
        {detail.moderationNote ? <p><strong>Justificativa da decisão:</strong> {String(detail.moderationNote)}</p> : null}
      </section>

      <section className={styles.panel}>
        <h2>Conteúdo denunciado</h2>
        {target ? (
          <div>
            <p><strong>Tipo de alvo:</strong> {targetType === "POST" ? "Artigo" : targetType === "COMMENT" ? "Comentário" : "Perfil de usuário"}</p>
            <p><strong>Identificador do alvo:</strong> {String(target.id)}</p>
            {targetType === "USER" && target.name && <p><strong>Nome do perfil:</strong> {String(target.name)}</p>}
            {targetType === "POST" && (
              <div>
                {target.title ? <h3>{String(target.title)}</h3> : null}
                {target.content ? (
                  <div
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
            {targetType === "COMMENT" && target.content && <p className={styles.commentText}>{String(target.content)}</p>}
          </div>
        ) : (
          <p>O conteúdo denunciado não está mais disponível ou foi removido.</p>
        )}
      </section>

      {["PENDING", "IN_REVIEW"].includes(String(detail.status)) && (
        <section className={styles.panel}>
          <h2>Decisão de moderação</h2>
          <ResolveReport
            id={id}
            targetType={targetType}
            currentModeratorId={detail.moderatorId ? String(detail.moderatorId) : null}
            actorId={actor?.id}
            csrf={csrf}
          />
        </section>
      )}

      <section className={styles.panel}>
        <h2>Histórico de moderação</h2>
        {history.data.length ? (
          <ul className={styles.list}>
            {history.data.map(row => (
              <li key={String(row.id)}>
                {new Date(String(row.createdAt)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {String(row.action)} · Responsável: {String(row.actorId || "Sistema")}
                {record(row.details) && text(row.details.reason, 1000) ? ` · ${row.details.reason}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma ação registrada para esta denúncia.</p>
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

      <p>
        <Link href="/admin/reports" prefetch={false}>
          Voltar às denúncias
        </Link>
      </p>
    </AdminShell>
  );
}
