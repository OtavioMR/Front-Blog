import Link from "next/link";
import { AdminFailure, AdminShell } from "./_components/shell";
import { adminRead, count, record } from "./_lib/data";
import { eventTitles } from "./_lib/audit-labels";
import {
  IconReports,
  IconReview,
  IconUsers,
  IconPosts,
  IconAlertCircle,
  IconCheckCircle,
  IconArrowUpRight,
} from "./_components/icons";
import styles from "./admin.module.css";

/* As rotas existentes no BFF fornecem dados agregados reais do NestJS. */

export default async function AdminOverview() {
  const result = await adminRead("/admin/analytics/overview");
  if (!result.ok) return <AdminFailure reason={result.reason} />;

  const value = result.value;
  if (
    !record(value) ||
    !record(value.users) ||
    !record(value.posts) ||
    !record(value.reports) ||
    ![value.users.total, value.posts.total, value.posts.published, value.reports.pending].every(count) ||
    typeof value.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.generatedAt))
  ) {
    return <AdminFailure reason="unavailable" />;
  }

  // Tenta consultar atividade recente para enriquecer o painel principal
  const activityResult = await adminRead("/admin/analytics/activity").catch(() => null);
  const activity = activityResult && activityResult.ok && record(activityResult.value) ? activityResult.value : null;

  const usersTotal = value.users.total as number;
  const postsTotal = value.posts.total as number;
  const postsPublished = value.posts.published as number;
  const reportsPending = value.reports.pending as number;
  const postsPending = count(value.posts.pending) ? (value.posts.pending as number) : 0;

  const hasUrgentAction = reportsPending > 0 || postsPending > 0;

  // Preserva os textos esperados pelos testes de regressão
  const cards: [string, number, string, React.ReactNode][] = [
    ["Usuários", usersTotal, "Contas cadastradas", <IconUsers size={22} key="users" />],
    ["Artigos", postsTotal, "Publicações e rascunhos", <IconPosts size={22} key="posts" />],
    ["Publicados", postsPublished, "Artigos visíveis", <IconCheckCircle size={22} key="published" />],
    ["Denúncias pendentes", reportsPending, "Aguardando análise", <IconReports size={22} key="reports" />],
  ];

  if (count(value.posts.pending)) {
    cards.push(["Artigos em revisão", value.posts.pending, "Primeiras publicações", <IconReview size={22} key="pending-posts" />]);
  }
  if (count(value.reports.inReview)) {
    cards.push(["Denúncias em análise", value.reports.inReview, "Atribuídas a moderadores", <IconAlertCircle size={22} key="in-review-reports" />]);
  }

  return (
    <AdminShell title="Visão geral" current="overview">
      {/* Intro Header */}
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Acompanhamento da plataforma</p>
        <h2>O Grifório em números</h2>
        <p>
          Indicadores consultados na API em{" "}
          <time dateTime={value.generatedAt}>
            {new Date(value.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          </time>
          .
        </p>
      </div>

      {/* Central de Ações Prioritárias */}
      <section className={styles.priorityBanner} aria-label="Ações prioritárias de moderação e revisão">
        <div className={styles.priorityHeader}>
          <h3 className={styles.priorityHeaderTitle}>
            <IconAlertCircle size={20} />
            <span>Central de Ações Prioritárias</span>
          </h3>
          {hasUrgentAction ? (
            <span className={styles.priorityHeaderBadge}>
              {reportsPending + postsPending} pendências requerem atenção
            </span>
          ) : (
            <span className={styles.badgeResolved}>Tudo em dia</span>
          )}
        </div>

        {hasUrgentAction ? (
          <div className={styles.priorityGrid}>
            {reportsPending > 0 && (
              <div className={styles.priorityCard}>
                <div className={styles.priorityCardInfo}>
                  <span className={styles.priorityCardCount}>{reportsPending}</span>
                  <span className={styles.priorityCardLabel}>Denúncias aguardando triagem</span>
                  <span className={styles.priorityCardDesc}>Requerem análise e decisão da moderação</span>
                </div>
                <Link href="/gestao-editorial/denuncias?status=PENDING" className={styles.priorityActionBtn} prefetch={false}>
                  Triar denúncias
                </Link>
              </div>
            )}

            {postsPending > 0 && (
              <div className={styles.priorityCard}>
                <div className={styles.priorityCardInfo}>
                  <span className={styles.priorityCardCount}>{postsPending}</span>
                  <span className={styles.priorityCardLabel}>Artigos em revisão editorial</span>
                  <span className={styles.priorityCardDesc}>Primeiras publicações de novos autores</span>
                </div>
                <Link href="/gestao-editorial/artigos?status=pending" className={styles.priorityActionBtn} prefetch={false}>
                  Revisar artigos
                </Link>
              </div>
            )}
          </div>
        ) : (
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.92rem" }}>
            Nenhuma denúncia pendente ou artigo aguardando aprovação editorial neste momento. A plataforma está operando sem pendências críticas.
          </p>
        )}
      </section>

      {/* Grid de Cards de Estatísticas Principais */}
      <div className={styles.cards}>
        {cards.map(([label, amount, description, icon]) => (
          <article className={styles.card} key={label}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <p>{label}</p>
              <div style={{ color: "var(--brand)", opacity: 0.85 }}>{icon}</div>
            </div>
            <strong>{amount.toLocaleString("pt-BR")}</strong>
            <span>{description}</span>
          </article>
        ))}
      </div>

      {/* Painel de Trabalho Editorial & Atalhos */}
      <section className={styles.panel}>
        <h2>Trabalho editorial</h2>
        <p>Consulte as denúncias e a fila de primeiras publicações para acompanhar as pendências.</p>
        <div className={styles.actions}>
          <Link href="/gestao-editorial/denuncias" className={styles.btnPrimary} prefetch={false}>
            Ver denúncias
          </Link>
          <Link href="/gestao-editorial/artigos?status=pending" className={styles.btnSecondary} prefetch={false}>
            Revisar artigos
          </Link>
          <Link href="/gestao-editorial/usuarios" className={styles.btnSecondary} prefetch={false}>
            Gerenciar usuários
          </Link>
          <Link href="/gestao-editorial/comentarios" className={styles.btnSecondary} prefetch={false}>
            Moderar comentários
          </Link>
        </div>
      </section>

      {/* Atividade Recente (quando disponível pela API) */}
      {activity && Array.isArray(activity.recentActions) && activity.recentActions.length > 0 && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Atividade Administrativa Recente</h2>
              <p>Últimas operações executadas por moderadores e administradores na plataforma.</p>
            </div>
            <Link href="/gestao-editorial/auditoria" className={styles.headerBlogLink} prefetch={false}>
              <span>Ver todos os logs</span>
              <IconArrowUpRight size={14} />
            </Link>
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data e Hora</th>
                  <th>Ação</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {activity.recentActions.slice(0, 5).map((action: Record<string, unknown>, idx: number) => (
                  <tr key={typeof action.id === "string" ? action.id : idx}>
                    <td>
                      {typeof action.createdAt === "string"
                        ? new Date(action.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
                        : "—"}
                    </td>
                    <td>
                      <span className={styles.badgeInReview}>{eventTitles[String(action.action)] ?? "Evento administrativo registrado"}</span>
                    </td>
                    <td>{typeof action.actorName === "string" ? action.actorName : action.actorId ? "Usuário indisponível" : "Sistema"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AdminShell>
  );
}
