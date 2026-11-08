import Link from "next/link";
import { eventTitles } from "../../_lib/audit-labels";
import Avatar from "@/app/_components/avatar";
import { AdminFailure, AdminShell } from "../../_components/shell";
import { adminCsrf, adminIdentity, adminUserDetail, adminUserHistory, adminUsersRead, count, record } from "../../_lib/data";
import UserModerationActions from "../_components/user-moderation";
import { IconShield, IconReports } from "../../_components/icons";
import styles from "../../admin.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const nullableText = (v: unknown, max: number) => v === null || text(v, max);
const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));

function userRoleBadgeClass(role: string) {
  switch (role) {
    case "SUPER_ADMIN":
      return styles.roleBadgeSuperAdmin;
    case "ADMIN":
      return styles.roleBadgeAdmin;
    case "AUTHOR":
      return styles.roleBadgeAuthor;
    default:
      return styles.roleBadgeReader;
  }
}

export default async function UserDetailPage({
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
    const access = await adminUsersRead(new URLSearchParams({ page: "1", limit: "1" }));
    if (!access.ok) return <AdminFailure reason={access.reason} />;
    return (
      <AdminShell title="Usuário" current="users">
        <section className={styles.panel}>
          <h2>Endereço inválido</h2>
          <p>O identificador informado não é um usuário válido.</p>
          <Link href="/gestao-editorial/usuarios" className={styles.btnSecondary}>
            Voltar aos usuários
          </Link>
        </section>
      </AdminShell>
    );
  }

  const [detailResult, historyResult, actor, csrf] = await Promise.all([
    adminUserDetail(id),
    adminUserHistory(id, page),
    adminIdentity(),
    adminCsrf(),
  ]);

  if (!detailResult.ok) return <AdminFailure reason={detailResult.reason} />;
  if (!historyResult.ok) return <AdminFailure reason={historyResult.reason} />;
  if (!csrf) return <AdminFailure reason="session" />;

  const detail = detailResult.value,
    history = historyResult.value;

  if (
    !record(detail) ||
    detail.id !== id ||
    !text(detail.name, 255) ||
    !text(detail.email, 255) ||
    !["READER", "AUTHOR", "ADMIN", "SUPER_ADMIN"].includes(String(detail.role)) ||
    typeof detail.isActive !== "boolean" ||
    typeof detail.moderationSuspended !== "boolean" ||
    typeof detail.emailVerified !== "boolean" ||
    !date(detail.createdAt) ||
    !record(detail.counts) ||
    !count(detail.counts.posts) ||
    !count(detail.counts.comments) ||
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
        !text(row.action, 80) ||
        !nullableText(row.actorId, 36) ||
        !date(row.createdAt)
    )
  ) {
    return <AdminFailure reason="unavailable" />;
  }

  const isSelf = actor?.id === id;
  const canModerate =
    !isSelf &&
    (["READER", "AUTHOR"].includes(String(detail.role)) ||
      (detail.role === "ADMIN" && actor?.role === "SUPER_ADMIN"));
  const canManageRole = actor?.role === "SUPER_ADMIN" && !isSelf && detail.isActive;

  const situation = detail.moderationSuspended ? "Suspensa" : detail.isActive ? "Ativa" : "Inativa";

  return (
    <AdminShell
      title="Conta de usuário"
      current="users"
      actions={
        <Link href="/gestao-editorial/usuarios" className={styles.btnSecondary} style={{ padding: "0.4rem 0.8rem", fontSize: "0.82rem" }} prefetch={false}>
          Voltar aos usuários
        </Link>
      }
    >
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Comunidade</p>
        <h2>{detail.name}</h2>
        <p>
          Identificador: <span style={{ fontFamily: "monospace" }}>{id}</span> · Papel:{" "}
          <span className={userRoleBadgeClass(String(detail.role))}>{String(detail.role)}</span> · Situação:{" "}
          {detail.moderationSuspended ? (
            <span className={styles.badgeSuspended}>{situation}</span>
          ) : detail.isActive ? (
            <span className={styles.badgeActive}>{situation}</span>
          ) : (
            <span className={styles.badgeDismissed}>{situation}</span>
          )}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 28rem), 1fr))", gap: "1.5rem" }}>
        {/* Coluna 1: Informações da Conta e Métricas */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <section className={styles.panel} style={{ margin: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
              <Avatar name={detail.name} src={typeof detail.profilePhoto === "string" ? detail.profilePhoto : null} size={64} />
              <div>
                <h3 style={{ margin: "0 0 0.25rem", fontFamily: "var(--font-serif)", fontSize: "1.35rem" }}>
                  {detail.name}
                </h3>
                <span className={userRoleBadgeClass(String(detail.role))}>
                  {String(detail.role) === "SUPER_ADMIN" && <IconShield size={12} />}
                  {String(detail.role)}
                </span>
              </div>
            </div>

            <h2>Informações da conta</h2>
            <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.92rem", lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}>
                <strong>E-mail:</strong> {detail.email} ({detail.emailVerified ? "verificado" : "não verificado"})
              </p>
              <p style={{ margin: 0 }}>
                <strong>Data de cadastro:</strong>{" "}
                {new Date(detail.createdAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Produção:</strong> {`Artigos: ${detail.counts.posts} · Comentários: ${detail.counts.comments}`}
              </p>
            </div>

            <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link
                href={`/gestao-editorial/usuarios/${id}/denuncias`}
                className={styles.btnSecondary}
                style={{ fontSize: "0.82rem", padding: "0.45rem 0.85rem" }}
                prefetch={false}
              >
                <IconReports size={14} />
                <span>Ver denúncias relacionadas</span>
              </Link>
              {canManageRole && (
                <Link
                  href={`/gestao-editorial/usuarios/${id}/funcao`}
                  className={styles.btnPrimary}
                  style={{ fontSize: "0.82rem", padding: "0.45rem 0.85rem" }}
                  prefetch={false}
                >
                  <IconShield size={14} />
                  <span>Gerenciar função administrativa</span>
                </Link>
              )}
            </div>
          </section>

          {/* Ações Administrativas */}
          <section className={styles.panel} style={{ margin: 0 }}>
            <h2>Ações administrativas</h2>
            <p>Gerencie o acesso, suspensão e sessões da conta com registro de auditoria.</p>
            <UserModerationActions
              id={id}
              userName={detail.name}
              isSuspended={detail.moderationSuspended}
              canModerate={canModerate}
              csrf={csrf}
            />
          </section>
        </div>

        {/* Coluna 2: Histórico Administrativo */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <section className={styles.panel} style={{ margin: 0 }}>
            <h2>Histórico administrativo</h2>
            {history.data.length ? (
              <ul className={styles.list}>
                {history.data.map((row, idx) => (
                  <li key={idx} style={{ marginBottom: "0.5rem" }}>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>
                      {new Date(String(row.createdAt)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </span>{" "}
                    · <span className={styles.badgeInReview} style={{ fontSize: "0.72rem" }}>{eventTitles[String(row.action)] ?? "Evento administrativo registrado"}</span>{" "}
                    · Responsável: {typeof row.actorName === "string" ? row.actorName : row.actorId ? "Usuário indisponível" : "Sistema"}
                    {record(row.details) && text(row.details.reason, 1000) ? (
                      <span style={{ display: "block", color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
                        Justificativa: {row.details.reason}
                      </span>
                    ) : (
                      ""
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, color: "var(--text-muted)" }}>Nenhuma ação registrada para esta conta.</p>
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
        <Link href="/gestao-editorial/usuarios" className={styles.btnSecondary} prefetch={false}>
          Voltar aos usuários
        </Link>
      </p>
    </AdminShell>
  );
}
