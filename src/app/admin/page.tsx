import { AdminFailure, AdminShell } from "./_components/shell";
import Link from "next/link";
import { adminRead, count, record } from "./_lib/data";
import styles from "./admin.module.css";
/* A fila existente é um Route Handler que entrega um documento HTML completo. */

export default async function AdminOverview() {
  const result = await adminRead("/admin/analytics/overview");
  if (!result.ok) return <AdminFailure reason={result.reason} />;
  const value = result.value;
  if (!record(value) || !record(value.users) || !record(value.posts) || !record(value.reports) || ![value.users.total, value.posts.total, value.posts.published, value.reports.pending].every(count) || typeof value.generatedAt !== "string" || !Number.isFinite(Date.parse(value.generatedAt))) return <AdminFailure reason="unavailable" />;
  const cards: [string, number, string][] = [
    ["Usuários", value.users.total as number, "Contas cadastradas"],
    ["Artigos", value.posts.total as number, "Publicações e rascunhos"],
    ["Publicados", value.posts.published as number, "Artigos visíveis"],
    ["Denúncias pendentes", value.reports.pending as number, "Aguardando análise"],
  ];
  if (count(value.posts.pending)) cards.push(["Artigos em revisão", value.posts.pending, "Primeiras publicações"]);
  if (count(value.reports.inReview)) cards.push(["Denúncias em análise", value.reports.inReview, "Atribuídas a moderadores"]);
  return <AdminShell title="Visão geral" current="overview"><div className={styles.intro}><p className={styles.eyebrow}>Acompanhamento da plataforma</p><h2>O Grifório em números</h2><p>Indicadores consultados na API em <time dateTime={value.generatedAt}>{new Date(value.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time>.</p></div><div className={styles.cards}>{cards.map(([label, amount, description]) => <article className={styles.card} key={label}><p>{label}</p><strong>{amount.toLocaleString("pt-BR")}</strong><span>{description}</span></article>)}</div><section className={styles.panel}><h2>Trabalho editorial</h2><p>Consulte as denúncias e a fila de primeiras publicações para acompanhar as pendências.</p><div className={styles.actions}><Link href="/admin/reports" prefetch={false}>Ver denúncias</Link><Link href="/admin/posts?status=pending" prefetch={false}>Revisar artigos</Link></div></section></AdminShell>;
}
