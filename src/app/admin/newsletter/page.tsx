import { AdminFailure, AdminShell } from "../_components/shell";
import { adminRead, count, record } from "../_lib/data";
import styles from "../admin.module.css";

export default async function NewsletterAnalytics() {
  const result = await adminRead("/admin/analytics/newsletter");
  if (!result.ok) return <AdminFailure reason={result.reason} />;
  const value = result.value;
  if (!record(value) || !record(value.subscribers) || !record(value.deliveries) || ![value.subscribers.total, value.subscribers.active, value.subscribers.pending, value.deliveries.pending, value.deliveries.retrying, value.deliveries.sent].every(count) || typeof value.generatedAt !== "string" || !Number.isFinite(Date.parse(value.generatedAt))) return <AdminFailure reason="unavailable" />;
  const cards: [string, number, string][] = [["Inscrições", value.subscribers.total as number, "Total de registros"], ["Confirmadas", value.subscribers.active as number, "Inscrições ativas"], ["Aguardando confirmação", value.subscribers.pending as number, "Dentro do prazo"], ["Envios pendentes", value.deliveries.pending as number, "Ainda não enviados"], ["Em nova tentativa", value.deliveries.retrying as number, "Entregas pendentes"], ["Envios concluídos", value.deliveries.sent as number, "Entregas registradas"]];
  return <AdminShell title="Newsletter" current="newsletter"><div className={styles.intro}><p className={styles.eyebrow}>Operação</p><h2>Inscrições e entregas</h2><p>Contagens agregadas consultadas em <time dateTime={value.generatedAt}>{new Date(value.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time>.</p></div><div className={styles.cards}>{cards.map(([label, amount, description]) => <article className={styles.card} key={label}><p>{label}</p><strong>{amount.toLocaleString("pt-BR")}</strong><span>{description}</span></article>)}</div></AdminShell>;
}
