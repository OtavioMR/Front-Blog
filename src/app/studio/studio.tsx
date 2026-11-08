"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
import { canWriteArticles } from "@/lib/permissions";
import { acceptedRules, parseOwnArticles, parseRules, type OwnArticles, type Rules } from "./contracts";
import backStyles from "@/app/_components/back-button.module.css";
import ConfirmDialog from "@/app/_components/confirm-dialog";
import styles from "./studio.module.css";
import { canConfirmRemoval, removeArticleRequest } from "./remove-article";

type View = "loading" | "signed-out" | "reader" | "author" | "denied" | "error";
const labels: Record<string, string> = { DRAFT: "Rascunho", PENDING: "Em revisão", APPROVED: "Aprovado", REJECTED: "Rejeitado" };

export default function Studio({ editorialEnabled }: { editorialEnabled: boolean }) {
  const [view, setView] = useState<View>("loading");
  const [rules, setRules] = useState<Rules | null>(null);
  const [subject, setSubject] = useState("");
  const [articles, setArticles] = useState<OwnArticles | null>(null);
  const [page, setPage] = useState(1);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [removal, setRemoval] = useState<{ id: string; title: string; subject: string } | null>(null);
  const revision = useRef(0);
  const load = useCallback(async (requestedPage: number) => {
    const current = ++revision.current;
    setView("loading"); setArticles(null); setRules(null); setSubject(""); setChecked(false); setFeedback("");
    try {
      const profile = await getOwnProfile();
      if (current !== revision.current) return;
      if (!profile) { setView("signed-out"); return; }
      if (profile.role === "READER") {
        const response = await fetch("/api/v1/users/author-rules", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const value = parseRules(await response.json());
        if (current === revision.current) { setSubject(profile.id); setRules(value); setView("reader"); }
      } else if (canWriteArticles(profile.role)) {
        const response = await authenticatedFetchForSubject(profile.id, `/api/v1/posts/me?page=${requestedPage}&limit=10`, { cache: "no-store" });
        if (current !== revision.current) return;
        if (response.status === 409) { setView("error"); return; }
        if (response.status === 401) { setView("signed-out"); return; }
        if (response.status === 403) { setView("denied"); return; }
        if (!response.ok) throw new Error();
        const value = parseOwnArticles(await response.json());
        if (current === revision.current) { setSubject(profile.id); setArticles(value); setPage(value.meta.page); setView("author"); }
      } else setView("denied");
    } catch { if (current === revision.current) setView("error"); }
  }, []);

  useEffect(() => {
    let active = true;
    const generation = revision;
    const unsubscribe = subscribeSession(() => { setRemoval(null); setUncertain(false); void load(1); });
    queueMicrotask(() => { if (active) void load(1); });
    return () => { active = false; generation.current++; unsubscribe(); };
  }, [load]);

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject || !rules || !checked || busy || uncertain) return;
    const current = revision.current;
    setBusy(true); setFeedback("");
    try {
      const response = await authenticatedFetchForSubject(subject, "/api/v1/users/me/author", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: rules.version, accepted: true }), cache: "no-store" });
      if (current !== revision.current) return;
      if (response.status === 409) { await load(1); return; }
      if (response.status === 401) { setView("signed-out"); return; }
      if (response.status === 403) { setFeedback("Não foi possível liberar a autoria para esta conta. Verifique se ela está ativa, com e-mail confirmado e elegível."); return; }
      if (response.status === 400) { setFeedback("As regras ou o aceite precisam ser atualizados. Recarregue as regras antes de tentar novamente."); setUncertain(true); return; }
      if (!response.ok || !acceptedRules(await response.json(), rules.version)) throw new Error();
      setUncertain(false);
      await load(1);
    } catch { if (current === revision.current) { setUncertain(true); setFeedback("Não foi possível confirmar o resultado. Atualize o estado antes de tentar novamente."); } }
    finally { setBusy(false); }
  }

  async function removeArticle(id: string, openedBy: string) {
    if (!canConfirmRemoval(openedBy, subject) || busy || uncertain) return;
    const current = revision.current;
    setBusy(true); setFeedback("");
    try {
      const result = await removeArticleRequest(authenticatedFetchForSubject, openedBy, id);
      if (current !== revision.current) return;
      if (result === "changed") { await load(1); return; }
      if (result === "unauthorized") { setView("signed-out"); return; }
      if (result === "forbidden") { setFeedback("Você não tem permissão para desativar este artigo."); return; }
      if (result === "missing") { setFeedback("Artigo não encontrado. Atualize a lista."); setUncertain(true); return; }
      if (result !== "deleted") throw new Error();
      setArticles(previous => previous ? { ...previous, data: previous.data.filter(article => article.id !== id) } : previous);
      setFeedback("Artigo desativado com sucesso.");
    } catch { if (current === revision.current) { setUncertain(true); setFeedback("Não foi possível confirmar a desativação. Atualize a lista antes de tentar novamente."); } }
    finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <section className={styles.content}>
      <Link href="/conta" className={backStyles.back}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 8H3M7.5 3.5 3 8l4.5 4.5" /></svg><span>Voltar</span></Link>
      <header className={styles.hero}>
        <div><p className={styles.eyebrow}>SEU ESPAÇO DE ESCRITA</p><h1>Studio<span>.</span></h1><p className={styles.intro}>Um espaço para suas ideias ganharem forma.</p></div>
        {view === "author" && editorialEnabled && <Link className={styles.primaryAction} href="/studio/novo"><span aria-hidden="true">+</span> Escrever artigo</Link>}
      </header>
      {view === "loading" && <p role="status">Carregando seu espaço…</p>}
      {view === "signed-out" && <div className={styles.panel}><h2>Suas histórias começam aqui</h2><p>Entre na sua conta para acessar o Studio.</p><Link className={styles.primaryAction} href="/entrar">Entrar na conta</Link></div>}
      {view === "denied" && <p role="alert">Sua conta não tem acesso a este espaço.</p>}
      {view === "error" && <div className={styles.panel}><p role="alert">Não foi possível carregar o Studio agora.</p><button onClick={() => void load(page)}>Tentar novamente</button></div>}
      {view === "reader" && rules && <div className={styles.panel}><h2>Compartilhe suas histórias</h2><p>Para começar, leia e aceite as regras de publicação. Seu primeiro artigo passa por revisão.</p><ul className={styles.rules}>{rules.rules.map((rule, index) => <li key={index}>{rule}</li>)}</ul><p className={styles.version}>Versão {rules.version}</p><form onSubmit={accept}><label className={styles.check}><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} disabled={busy || uncertain} required /> Li e aceito as regras de autoria.</label><button disabled={!checked || busy || uncertain}>{busy ? "Enviando…" : "Aceitar e tornar-me autor"}</button></form>{feedback && <p role="alert">{feedback}</p>}{uncertain && <button onClick={() => { setUncertain(false); void load(1); }}>Atualizar estado</button>}</div>}
      {view === "author" && articles && <>
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>SUA BIBLIOTECA</p><h2>Seus artigos</h2><p>Acompanhe suas histórias e o andamento de cada publicação.</p></div>{editorialEnabled && <Link className={styles.secondaryAction} href="/studio/series">Minhas séries <span aria-hidden="true">↗</span></Link>}</div>
        {!editorialEnabled && <p className={styles.notice}>A criação e a edição de artigos estarão disponíveis em breve.</p>}
        {feedback && <p role="status">{feedback}</p>}{uncertain && <button onClick={() => { setUncertain(false); void load(page); }}>Atualizar lista</button>}
        {articles.data.length === 0 ? <div className={styles.empty}><span className={styles.emptyIcon} aria-hidden="true">✎</span><h3>Nenhum artigo por aqui</h3><p>{page === 1 ? "Toda boa história começa com uma ideia. Que tal dar o primeiro passo?" : "Não há artigos nesta página."}</p>{editorialEnabled && page === 1 && <Link className={styles.primaryAction} href="/studio/novo">Começar a escrever <span aria-hidden="true">→</span></Link>}</div> : <ul className={styles.list}>{articles.data.map(article => <li key={article.id}><div className={styles.articleInfo}><strong>{article.title}</strong><span className={styles.status}>{article.published ? "Publicado" : article.scheduledAt ? "Agendado" : labels[article.reviewStatus] || "Status indisponível"}</span></div><span className={styles.rowActions}>{article.published && <Link href={`/posts/${encodeURIComponent(article.slug)}`}>Ver artigo</Link>}{editorialEnabled && article.reviewStatus !== "PENDING" && <Link href={`/studio/${encodeURIComponent(article.id)}`}>Editar artigo</Link>}<button type="button" disabled={busy || uncertain || article.reviewStatus === "PENDING"} title={article.reviewStatus === "PENDING" ? "Artigos em revisão não podem ser desativados." : undefined} onClick={() => setRemoval({ id: article.id, title: article.title, subject })} aria-label={`Desativar artigo ${article.title}`}>{busy ? "Aguarde…" : "Desativar"}</button></span></li>)}</ul>}
        {(articles.meta.hasPreviousPage || articles.meta.hasNextPage) && <nav className={styles.pagination} aria-label="Paginação dos seus artigos"><button disabled={busy || !articles.meta.hasPreviousPage} onClick={() => void load(page - 1)}>Anterior</button><span>Página {page}</span><button disabled={busy || !articles.meta.hasNextPage} onClick={() => void load(page + 1)}>Próxima</button></nav>}
      </>}
    </section>{removal && <ConfirmDialog title="Desativar artigo?" description={`“${removal.title}” será removido das listagens e deixará de estar publicado.`} confirmLabel="Desativar artigo" onCancel={() => setRemoval(null)} onConfirm={() => { const { id, subject: openedBy } = removal; setRemoval(null); void removeArticle(id, openedBy); }} />}</main>;
}
