import { AdminFailure, AdminShell } from "../_components/shell";
import { adminRead, count, record } from "../_lib/data";
import styles from "../admin.module.css";

const date = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));

export default async function ActivityAnalytics() {
  const result = await adminRead("/admin/analytics/activity");
  if (!result.ok) return <AdminFailure reason={result.reason} />;
  const value = result.value;
  if (!record(value) || !date(value.from) || !date(value.to) || !Array.isArray(value.series) || value.series.length > 367 || !Array.isArray(value.recentPosts) || value.recentPosts.length > 10 || !Array.isArray(value.recentActions) || value.recentActions.length > 10
    || value.series.some(row => !record(row) || !date(row.day) || ![row.users, row.posts, row.reports, row.subscribers].every(count))
    || value.recentPosts.some(row => !record(row) || typeof row.id !== "string" || typeof row.title !== "string" || row.title.length > 255 || !(row.publishedAt === null || date(row.publishedAt)))
    || value.recentActions.some(row => !record(row) || typeof row.id !== "string" || typeof row.action !== "string" || row.action.length > 80 || !date(row.createdAt))) return <AdminFailure reason="unavailable" />;
  return <AdminShell title="Atividade" current="analytics">
    <div className={styles.intro}><p className={styles.eyebrow}>Acompanhamento</p><h2>Movimentação da plataforma</h2><p>Eventos entre {new Date(value.from).toLocaleDateString("pt-BR", { timeZone: "UTC" })} e {new Date(value.to).toLocaleDateString("pt-BR", { timeZone: "UTC" })}. Os dias usam o fuso configurado no banco.</p></div>
    <section className={styles.panel}><h2>Evolução diária</h2><p>Cadastros, artigos, denúncias e primeiros registros de inscrição na newsletter.</p><div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Dia</th><th>Usuários</th><th>Artigos</th><th>Denúncias</th><th>Inscrições</th></tr></thead><tbody>{value.series.map(row => <tr key={row.day}><td>{new Date(row.day).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td>{row.users}</td><td>{row.posts}</td><td>{row.reports}</td><td>{row.subscribers}</td></tr>)}</tbody></table></div>{value.series.length === 0 && <p>Nenhum dado para o período.</p>}</section>
    <section className={styles.panel}><h2>Publicações recentes</h2>{value.recentPosts.length ? <ul className={styles.list}>{value.recentPosts.map(row => <li key={row.id}>{row.title}{row.publishedAt && <> · {new Date(row.publishedAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</>}</li>)}</ul> : <p>Nenhuma publicação recente.</p>}</section>
    <section className={styles.panel}><h2>Ações administrativas recentes</h2>{value.recentActions.length ? <ul className={styles.list}>{value.recentActions.map(row => <li key={row.id}>{row.action} · {new Date(row.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</li>)}</ul> : <p>Nenhuma ação recente.</p>}</section>
  </AdminShell>;
}
