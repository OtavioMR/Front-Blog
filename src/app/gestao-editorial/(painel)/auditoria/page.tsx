import Link from "next/link";
import Form from "next/form";
import { AdminFailure, AdminShell } from "../_components/shell";
import { adminAuditRead, adminUsersRead, record } from "../_lib/data";
import { IconFilter } from "../_components/icons";
import styles from "../admin.module.css";
import { eventTitles } from "../_lib/audit-labels";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const single = (value: string | string[] | undefined) => (typeof value === "string" ? value.trim() : "");
const validDay = (day: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(day) &&
  Number.isFinite(Date.parse(`${day}T00:00:00.000Z`)) &&
  new Date(`${day}T00:00:00.000Z`).toISOString().slice(0, 10) === day;

const roleLabels: Record<string, string> = { READER: "Leitor", AUTHOR: "Autor", ADMIN: "Administrador", SUPER_ADMIN: "Superadministrador" };
const statusLabels: Record<string, string> = { RESOLVED: "Resolvida", DISMISSED: "Improcedente", APPROVED: "Aprovado", REJECTED: "Rejeitado", PENDING: "Pendente" };

const resourceLabels: Record<string, string> = { user: "Usuário", post: "Artigo", comment: "Comentário", report: "Denúncia", category: "Categoria", tag: "Tag", session: "Sessão" };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams,
    page = single(raw.page) || "1",
    moderatorPage = single(raw.moderatorPage) || "1",
    actorId = single(raw.actorId),
    targetId = single(raw.targetId),
    action = single(raw.action),
    targetType = single(raw.targetType),
    search = single(raw.search),
    from = single(raw.from),
    to = single(raw.to);

  const invalid =
    [raw.page, raw.moderatorPage, raw.actorId, raw.targetId, raw.action, raw.targetType, raw.search, raw.from, raw.to].some(Array.isArray) ||
    !/^[1-9]\d{0,5}$/.test(page) ||
    !/^[1-9]\d{0,5}$/.test(moderatorPage) ||
    !!(actorId && !uuid.test(actorId)) ||
    !!(targetId && !uuid.test(targetId)) ||
    action.length > 100 ||
    targetType.length > 100 ||
    search.length > 100 ||
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
  if (search) query.set("search", search);
  if (from) query.set("from", `${from}T00:00:00.000Z`);
  if (to) query.set("to", `${to}T23:59:59.999Z`);

  const [result, admins, supers] = await Promise.all([
    adminAuditRead(query),
    adminUsersRead(new URLSearchParams({ page: moderatorPage, limit: "20", role: "ADMIN", sort: "name", order: "ASC" })),
    adminUsersRead(new URLSearchParams({ page: moderatorPage, limit: "20", role: "SUPER_ADMIN", sort: "name", order: "ASC" })),
  ]);
  if (!result.ok) return <AdminFailure reason={result.reason} />;
  const moderators = [admins, supers].flatMap(result => result.ok && record(result.value) && Array.isArray(result.value.data) ? result.value.data : []).filter((row): row is Record<string, unknown> => record(row) && typeof row.id === "string" && uuid.test(row.id) && typeof row.name === "string");
  const moreModerators = [admins, supers].some(result => result.ok && record(result.value) && record(result.value.meta) && result.value.meta.hasNextPage === true);

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
    if (moderatorPage !== "1") p.set("moderatorPage", moderatorPage);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return `/gestao-editorial/auditoria?${p}`;
  };
  const moderatorHref = (n: number) => {
    const params = new URLSearchParams(query);
    params.delete("limit");
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("moderatorPage", String(n));
    return `/gestao-editorial/auditoria?${params}`;
  };

  return (
    <AdminShell title="Auditoria" current="audit">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Histórico</p>
        <h2>Histórico de atividades</h2>
        <p>Acompanhe acessos, alterações e decisões de moderação. Os eventos mais recentes aparecem primeiro.</p>
      </div>

      {/* Painel de Filtros */}
      <section className={styles.panel}>
        <h2>Encontrar atividades</h2>
        <p>Busque por nome, e-mail ou conteúdo e combine os filtros para refinar os resultados. As datas usam UTC.</p>
        <Form className={styles.filters} action="/gestao-editorial/auditoria" prefetch={false}>
          <label>
            Pesquisar por nome, e-mail ou conteúdo
            <input name="search" defaultValue={search} maxLength={100} />
          </label>
          <label>
            Administrador responsável
            <select name="actorId" defaultValue={actorId}>
              <option value="">Todos</option>
              {actorId && !moderators.some(row => row.id === actorId) && <option value={actorId}>Responsável selecionado</option>}
              {moderators.map(row => <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>)}
            </select>
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
            Tipo de evento
            <select name="action" defaultValue={action}>
              <option value="">Todos</option>
              {action && !Object.hasOwn(eventTitles, action) && <option value={action}>{action}</option>}
              {Object.entries(eventTitles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label>
            Categoria
            <select name="targetType" defaultValue={targetType}>
              <option value="">Todas</option>
              {targetType && !Object.hasOwn(resourceLabels, targetType) && <option value={targetType}>{targetType}</option>}
              {Object.entries(resourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
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
            Aplicar filtros
          </button>
          <Link className={styles.btnSecondary} href="/gestao-editorial/auditoria">Limpar filtros</Link>
        </Form>
        {(Number(moderatorPage) > 1 || moreModerators) && <nav className={styles.pagination} aria-label="Paginação de responsáveis">
          {Number(moderatorPage) > 1 && <Link href={moderatorHref(Number(moderatorPage) - 1)} prefetch={false}>Responsáveis anteriores</Link>}
          <span>Página {moderatorPage}</span>
          {moreModerators && <Link href={moderatorHref(Number(moderatorPage) + 1)} prefetch={false}>Próximos responsáveis</Link>}
        </nav>}
      </section>

      <section className={styles.panel}>
        <div className={styles.auditHeading}><div><h2>Atividades registradas</h2><p>Abra um registro relacionado ou consulte outras atividades da mesma pessoa ou recurso.</p></div><span>Página {page}</span></div>
        <div className={styles.auditList}>
          {value.data.map(row => {
            const details = record(row.details) ? row.details : {};
            const reason = typeof details.reason === "string" ? details.reason : typeof details.note === "string" ? details.note : null;
            const resource = resourceLabels[String(row.targetType)] ?? "Recurso";
            const targetLabel = typeof row.targetLabel === "string" && row.targetLabel ? row.targetLabel : typeof details.name === "string" && details.name ? details.name : null;
            const result = typeof details.status === "string" ? details.status : typeof details.decision === "string" ? details.decision : null;
            const paths: Record<string, string> = { user: "usuarios", post: "artigos", comment: "comentarios", report: "denuncias" };
            const targetPath = paths[String(row.targetType)];
            return <article key={String(row.id)} className={styles.auditCard}>
              <div className={styles.auditCardHeader}><div><span className={styles.auditBadge}>{resource}</span><h3>{eventTitles[String(row.action)] ?? "Evento registrado"}</h3></div><time dateTime={String(row.createdAt)}>{new Date(String(row.createdAt)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time></div>
              <div className={styles.auditPeople}>
                <div><span>Quem realizou</span><strong>{typeof row.actorName === "string" ? row.actorName : row.actorId ? "Usuário indisponível" : "Sistema"}</strong>{typeof row.actorEmail === "string" && <small>{row.actorEmail}</small>}</div>
                {row.targetType !== "session" && <div><span>{resource} afetado</span><strong>{targetLabel ?? "Registro indisponível"}</strong>{typeof row.targetEmail === "string" && <small>{row.targetEmail}</small>}</div>}
              </div>
              {typeof details.previousRole === "string" && typeof details.role === "string" && <p><strong>Alteração:</strong> {roleLabels[details.previousRole] ?? details.previousRole} → {roleLabels[details.role] ?? details.role}</p>}
              {result && <p><strong>Resultado:</strong> {statusLabels[result] ?? result}</p>}
              {typeof details.provider === "string" && <p><strong>Provedor:</strong> {details.provider}</p>}
              {typeof details.endsAt === "string" && Number.isFinite(Date.parse(details.endsAt)) && <p><strong>Suspensão até:</strong> {new Date(details.endsAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>}
              {reason && <p><strong>Justificativa:</strong> {reason}</p>}
              <div className={styles.auditActions}>
                {row.actorId && <Link href={`/gestao-editorial/auditoria?actorId=${row.actorId}`} prefetch={false}>Atividades desta pessoa →</Link>}
                {targetPath && targetLabel && <Link href={`/gestao-editorial/${targetPath}/${row.targetId}`} prefetch={false}>Abrir {resource.toLowerCase()} →</Link>}
                <Link href={`/gestao-editorial/auditoria?targetId=${row.targetId}`} prefetch={false}>Histórico deste recurso →</Link>
              </div>
              {typeof details.reportId === "string" && uuid.test(details.reportId) && <p><Link href={`/gestao-editorial/denuncias/${details.reportId}`} prefetch={false}>Ver denúncia relacionada</Link></p>}
              <details><summary>Detalhes técnicos</summary>
                <p>Ação: {String(row.action)} · Tipo: {String(row.targetType)} · Identificador: {String(row.targetId)}</p>
                {row.actorId && <p>Identificador do responsável: {String(row.actorId)}</p>}


              </details>
            </article>;
          })}
        </div>

        {value.data.length === 0 && (
          <p style={{ padding: "1.5rem 0", textAlign: "center", color: "var(--text-muted)" }}>
            Nenhuma atividade encontrada. Tente ajustar ou limpar os filtros.
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
