import Link from "next/link";
import { AdminFailure, AdminShell } from "../../_components/shell";
import { adminCsrf, adminIdentity, adminUserDetail, adminUserHistory, adminUsersRead, count, record } from "../../_lib/data";
import UserModerationActions from "../_components/user-moderation";
import styles from "../../admin.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const nullableText = (v: unknown, max: number) => v === null || text(v, max);
const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));

export default async function UserDetailPage({
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
      <AdminShell title="Usuário" current="users">
        <section className={styles.panel}>
          <h2>Endereço inválido</h2>
          <Link href="/admin/users">Voltar aos usuários</Link>
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

  const detail = detailResult.value, history = historyResult.value;

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
    <AdminShell title="Conta de usuário" current="users">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Comunidade</p>
        <h2>{detail.name}</h2>
        <p>Identificador: {id} · Papel: {String(detail.role)} · Situação: {situation}</p>
      </div>

      <section className={styles.panel}>
        <h2>Informações da conta</h2>
        <p><strong>E-mail:</strong> {detail.email} ({detail.emailVerified ? "verificado" : "não verificado"})</p>
        <p><strong>Data de cadastro:</strong> {new Date(detail.createdAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</p>
        <p><strong>Produção:</strong> {`Artigos: ${detail.counts.posts} · Comentários: ${detail.counts.comments}`}</p>
        <div style={{ marginTop: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <Link href={`/admin/users/${id}/reports`} prefetch={false}>
            Ver denúncias relacionadas
          </Link>
          {canManageRole && (
            <Link href={`/admin/users/${id}/role`} prefetch={false}>
              Gerenciar função administrativa
            </Link>
          )}
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Ações administrativas</h2>
        <UserModerationActions
          id={id}
          userName={detail.name}
          isSuspended={detail.moderationSuspended}
          canModerate={canModerate}
          csrf={csrf}
        />
      </section>

      <section className={styles.panel}>
        <h2>Histórico administrativo</h2>
        {history.data.length ? (
          <ul className={styles.list}>
            {history.data.map((row, idx) => (
              <li key={idx}>
                {new Date(String(row.createdAt)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {String(row.action)} · Responsável: {String(row.actorId || "Sistema")}
                {record(row.details) && text(row.details.reason, 1000) ? ` · Justificativa: ${row.details.reason}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma ação registrada para esta conta.</p>
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
        <Link href="/admin/users" prefetch={false}>
          Voltar aos usuários
        </Link>
      </p>
    </AdminShell>
  );
}
