import Link from "next/link";
import { eventTitles } from "../../_lib/audit-labels";
import sanitizeHtml from "sanitize-html";
import { AdminFailure, AdminShell } from "../../_components/shell";
import { adminCsrf, adminPostDetail, adminPostHistory, adminPostsRead, record } from "../../_lib/data";
import ModerateComment from "../../comentarios/_components/moderate";
import Review from "../_components/review";
import { IconReview } from "../../_components/icons";
import styles from "../../admin.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));

export default async function PostDetail({
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
    const access = await adminPostsRead(new URLSearchParams({ page: "1", limit: "1" }));
    if (!access.ok) return <AdminFailure reason={access.reason} />;
    return (
      <AdminShell title="Artigo" current="posts">
        <section className={styles.panel}>
          <h2>Endereço inválido</h2>
          <p>O identificador do artigo informado não é válido.</p>
          <Link href="/gestao-editorial/artigos" className={styles.btnSecondary}>
            Voltar aos artigos
          </Link>
        </section>
      </AdminShell>
    );
  }

  const [detailResult, historyResult] = await Promise.all([adminPostDetail(id), adminPostHistory(id, page)]);
  if (!detailResult.ok) return <AdminFailure reason={detailResult.reason} />;
  if (!historyResult.ok) return <AdminFailure reason={historyResult.reason} />;

  const detail = detailResult.value,
    history = historyResult.value,
    csrf = await adminCsrf();
  if (!csrf) return <AdminFailure reason="session" />;

  if (
    !record(detail) ||
    detail.id !== id ||
    !text(detail.title, 255) ||
    !text(detail.content, 1000000) ||
    !text(detail.authorId, 36) ||
    !uuid.test(detail.authorId) ||
    typeof detail.published !== "boolean" ||
    typeof detail.isActive !== "boolean" ||
    typeof detail.moderationHidden !== "boolean" ||
    !["DRAFT", "PENDING", "APPROVED", "REJECTED"].includes(String(detail.reviewStatus)) ||
    !(detail.reviewNote === null || text(detail.reviewNote, 1000)) ||
    !(detail.author === null || (record(detail.author) && text(detail.author.name, 255))) ||
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
        !(row.actorId === null || (text(row.actorId, 36) && uuid.test(row.actorId))) ||
        !date(row.createdAt)
    )
  ) {
    return <AdminFailure reason="unavailable" />;
  }

  const content = sanitizeHtml(detail.content, {
    allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "blockquote", "h2", "h3", "h4"],
    allowedAttributes: {},
  });

  const authorName = record(detail.author) && typeof detail.author.name === "string" ? detail.author.name : "Usuário removido";
  const isPendingReview = detail.reviewStatus === "PENDING" && detail.isActive;
  const canModerateVisibility = (detail.published && detail.isActive) || detail.moderationHidden;

  return (
    <AdminShell
      title="Artigo"
      current="posts"
      actions={
        <Link href="/gestao-editorial/artigos" className={styles.btnSecondary} style={{ padding: "0.4rem 0.8rem", fontSize: "0.82rem" }} prefetch={false}>
          Voltar aos artigos
        </Link>
      }
    >
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Gestão editorial</p>
        <h2>{detail.title}</h2>
        <p>
          Autor: {authorName} · Revisão: <span className={styles.badgeInReview}>{String(detail.reviewStatus)}</span>
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 30rem), 1fr))", gap: "1.5rem" }}>
        {/* Coluna 1: Artigo e Conteúdo */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <section className={styles.panel} style={{ margin: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <span className={detail.moderationHidden ? styles.badgeHidden : detail.published && detail.isActive ? styles.badgeApproved : styles.badgeDismissed}>
                {detail.moderationHidden
                  ? "Oculto pela moderação"
                  : detail.published && detail.isActive
                    ? "Publicado"
                    : "Não público"}
              </span>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                ID: {id}
              </span>
            </div>

            {detail.reviewNote && (
              <div style={{ padding: "0.85rem", borderRadius: "0.55rem", background: "var(--brand-light)", border: "1px solid rgba(178, 67, 28, 0.25)", marginBottom: "1.25rem" }}>
                <strong>Justificativa editorial:</strong> {String(detail.reviewNote)}
              </div>
            )}

            <div
              style={{
                padding: "1.5rem",
                borderRadius: "0.75rem",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                lineHeight: 1.7,
                fontFamily: "var(--font-reading)",
                fontSize: "1.05rem",
              }}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </section>
        </div>

        {/* Coluna 2: Ações Editoriais, Moderação e Histórico */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {isPendingReview && (
            <section className={styles.panel} style={{ margin: 0, border: "1px solid rgba(178, 67, 28, 0.35)", background: "var(--brand-light)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <IconReview size={18} />
                <h2 style={{ margin: 0 }}>Revisão de Primeira Publicação</h2>
              </div>
              <p style={{ margin: "0 0 1rem", fontSize: "0.88rem" }}>
                Este autor submeteu seu primeiro artigo para aprovação da equipe editorial.
              </p>
              <Review id={id} csrf={csrf} />
            </section>
          )}

          {canModerateVisibility && (
            <section className={styles.panel} style={{ margin: 0 }}>
              <h2>Moderação de Visibilidade</h2>
              <p style={{ margin: "0 0 1rem", fontSize: "0.88rem" }}>
                {detail.moderationHidden
                  ? "Este artigo foi ocultado da exibição pública. Você pode restaurá-lo fundamentando a decisão."
                  : "Oculte o artigo em caso de denúncias ou violações graves dos termos editoriais."}
              </p>
              <ModerateComment
                id={id}
                kind="posts"
                action={detail.moderationHidden ? "restore" : "hide"}
                csrf={csrf}
              />
            </section>
          )}

          {/* Histórico Editorial */}
          <section className={styles.panel} style={{ margin: 0 }}>
            <h2>Histórico editorial</h2>
            {history.data.length ? (
              <ul className={styles.list}>
                {history.data.map(row => (
                  <li key={row.id} style={{ marginBottom: "0.4rem" }}>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>
                      {new Date(row.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </span>{" "}
                    · <span className={styles.badgeInReview} style={{ fontSize: "0.72rem" }}>{eventTitles[String(row.action)] ?? "Evento administrativo registrado"}</span>{" "}
                    · {typeof row.actorName === "string" ? row.actorName : row.actorId ? "Usuário indisponível" : "Sistema"}
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
        <Link href="/gestao-editorial/artigos" className={styles.btnSecondary} prefetch={false}>
          Voltar aos artigos
        </Link>
      </p>
    </AdminShell>
  );
}
