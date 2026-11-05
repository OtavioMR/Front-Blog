"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
import ConfirmDialog from "@/app/_components/confirm-dialog";
import { parseOwnArticles, type OwnArticles } from "../contracts";
import { confirmedItems, parseDetail, parseSeries, parseSeriesList, type Detail, type Item, type Series } from "./contracts";
import styles from "./series.module.css";

type View = "loading" | "ready" | "signed-out" | "denied" | "error";
type Confirmation = "delete" | "items" | null;

export default function SeriesManager() {
  const router = useRouter();
  const [view, setView] = useState<View>("loading");
  const [owner, setOwner] = useState("");
  const [series, setSeries] = useState<Series[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [articles, setArticles] = useState<OwnArticles | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const revision = useRef(0);
  const running = useRef(false);
  const changedItems = !!detail && JSON.stringify(items.map(i => i.id)) !== JSON.stringify(detail.posts.map(i => i.id));
  const changedInfo = !!detail && (title !== detail.title || description !== detail.description);
  const dirty = changedItems || changedInfo || (!detail && Boolean(title || description));

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const load = useCallback(async () => {
    const current = ++revision.current;
    setView("loading"); setOwner(""); setDetail(null); setArticles(null); setConfirmation(null); setUncertain(false); setMessage("");
    try {
      const profile = await getOwnProfile();
      if (current !== revision.current) return;
      if (!profile) { setView("signed-out"); return; }
      if (profile.role !== "AUTHOR" && profile.role !== "ADMIN") { setView("denied"); return; }
      const response = await authenticatedFetchForSubject(profile.id, "/api/v1/series/me", { cache: "no-store" });
      if (current !== revision.current) return;
      if (response.status === 401) { setView("signed-out"); return; }
      if (response.status === 403) { setView("denied"); return; }
      if (!response.ok) throw new Error();
      const list = parseSeriesList(await response.json(), profile.id);
      if (current !== revision.current) return;
      setOwner(profile.id); setSeries(list); setTitle(""); setDescription(""); setView("ready");
    } catch { if (current === revision.current) setView("error"); }
  }, []);

  useEffect(() => {
    let active = true;
    const generation = revision;
    const unsubscribe = subscribeSession(() => { revision.current++; setOwner(""); setDetail(null); setArticles(null); setView("signed-out"); setConfirmation(null); });
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; generation.current++; unsubscribe(); };
  }, [load]);

  async function fetchDetail(id: string, subject = owner) {
    const response = await authenticatedFetchForSubject(subject, `/api/v1/series/${id}/manage`, { cache: "no-store" });
    if (!response.ok) throw new Error();
    return parseDetail(await response.json(), subject, id);
  }
  async function loadArticles(page: number, subject = owner) {
    const response = await authenticatedFetchForSubject(subject, `/api/v1/posts/me?page=${page}&limit=10`, { cache: "no-store" });
    if (!response.ok) throw new Error();
    const result = parseOwnArticles(await response.json());
    if (result.meta.page !== page) throw new Error();
    return result;
  }
  async function open(item: Series) {
    if (running.current || dirty) { if (dirty) setMessage("Salve ou descarte as alterações antes de trocar de série."); return; }
    const current = revision.current; setBusy(true); running.current = true; setMessage("");
    try {
      const [data, page] = await Promise.all([fetchDetail(item.id), loadArticles(1)]);
      if (current !== revision.current) return;
      setDetail(data); setItems(data.posts); setTitle(data.title); setDescription(data.description); setArticles(page);
    } catch { if (current === revision.current) setMessage("Não foi possível carregar esta série. Tente novamente."); }
    finally { running.current = false; setBusy(false); }
  }
  async function changePage(page: number) {
    if (running.current) return;
    const current = revision.current; setBusy(true); running.current = true;
    try { const result = await loadArticles(page); if (current === revision.current) setArticles(result); }
    catch { if (current === revision.current) setMessage("Não foi possível carregar os artigos desta página."); }
    finally { running.current = false; setBusy(false); }
  }
  async function saveInfo(event: FormEvent) {
    event.preventDefault();
    if (!owner || running.current || uncertain || !title.trim() || title.length > 150 || description.length > 1000) return;
    const current = revision.current, id = detail?.id; setBusy(true); running.current = true; setMessage("");
    try {
      if (detail) { const latest = await fetchDetail(detail.id); if (current !== revision.current) return; if (latest.updatedAt !== detail.updatedAt) { setUncertain(true); setMessage("A série mudou em outra sessão. Atualize antes de continuar."); return; } }
      const response = await authenticatedFetchForSubject(owner, id ? `/api/v1/series/${id}` : "/api/v1/series", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), description }), cache: "no-store" });
      if (current !== revision.current) return;
      if ([400, 401, 403, 404, 409, 422, 429].includes(response.status)) { setMessage("Não foi possível salvar. Verifique os dados, sua sessão e o estado da série."); return; }
      if (!response.ok) throw new Error();
      const saved = parseSeries(await response.json(), owner);
      if (id && saved.id !== id) throw new Error();
      if (current !== revision.current) return;
      setSeries(previous => id ? previous.map(item => item.id === id ? saved : item) : [saved, ...previous].slice(0, 100));
      if (detail) setDetail({ ...saved, posts: detail.posts });
      setTitle(saved.title); setDescription(saved.description); setMessage(id ? "Série atualizada." : "Série criada. Selecione-a para organizar os artigos.");
      if (!id) { setTitle(""); setDescription(""); }
    } catch { if (current === revision.current) { setUncertain(true); setMessage("Não foi possível confirmar o resultado. Atualize antes de tentar novamente."); } }
    finally { running.current = false; setBusy(false); }
  }
  async function confirm() {
    const action = confirmation; setConfirmation(null);
    if (!detail || !owner || !action || running.current || uncertain || changedInfo) return;
    const current = revision.current, id = detail.id, ids = items.map(item => item.id); setBusy(true); running.current = true; setMessage("");
    try {
      const latest = await fetchDetail(id);
      if (current !== revision.current) return;
      if (latest.updatedAt !== detail.updatedAt || JSON.stringify(latest.posts.map(p => p.id)) !== JSON.stringify(detail.posts.map(p => p.id))) { setUncertain(true); setMessage("A série mudou em outra sessão. Atualize antes de continuar."); return; }
      const response = await authenticatedFetchForSubject(owner, action === "delete" ? `/api/v1/series/${id}` : `/api/v1/series/${id}/items`, action === "delete" ? { method: "DELETE", cache: "no-store" } : { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postIds: ids }), cache: "no-store" });
      if (current !== revision.current) return;
      if ([400, 401, 403, 404, 409, 422, 429].includes(response.status)) { setUncertain(true); setMessage("Não foi possível alterar a série. Atualize os dados; um artigo pode pertencer a outra série."); return; }
      if (action === "delete") { if (response.status !== 204) throw new Error(); setDetail(null); setItems([]); setSeries(previous => previous.filter(item => item.id !== id)); setTitle(""); setDescription(""); setMessage("Série excluída. Os artigos foram preservados."); }
      else { if (!response.ok || !confirmedItems(await response.json(), ids)) throw new Error(); const refreshed = await fetchDetail(id); if (current !== revision.current) return; if (JSON.stringify(refreshed.posts.map(p => p.id)) !== JSON.stringify(ids)) throw new Error(); setDetail(refreshed); setItems(refreshed.posts); setSeries(previous => previous.map(item => item.id === id ? refreshed : item)); setMessage("Ordem dos artigos salva."); }
    } catch { if (current === revision.current) { setUncertain(true); setMessage("Não foi possível confirmar o resultado. Atualize antes de tentar novamente."); } }
    finally { running.current = false; setBusy(false); }
  }
  function move(index: number, direction: number) { setItems(previous => { const next = [...previous], target = index + direction; if (target < 0 || target >= next.length) return previous; [next[index], next[target]] = [next[target], next[index]]; return next; }); }

  return <main className={styles.page}>
    <Link href="/studio" className={styles.back} onNavigate={event => { if (dirty) { event.preventDefault(); setConfirmLeave(true); } }}>← Voltar ao Studio</Link><h1>Minhas séries.</h1>
    {view === "loading" && <p role="status">Carregando séries…</p>}
    {view === "signed-out" && <p>Entre novamente para acessar suas séries. <Link href="/entrar">Entrar</Link></p>}
    {view === "denied" && <p role="alert">Este espaço é disponível para autores.</p>}
    {view === "error" && <><p role="alert">Não foi possível carregar as séries.</p><button className={styles.button} onClick={() => void load()}>Tentar novamente</button></>}
    {view === "ready" && <>
      <p>Organize seus artigos em sequência. Rascunhos aparecem apenas nesta área privada.</p>
      {message && <p role="status" className={styles.notice}>{message}</p>}
      {uncertain && <button className={styles.button} onClick={() => void load()}>Atualizar dados</button>}
      <section aria-labelledby="series-list"><h2 id="series-list">Suas séries</h2>
        {series.length === 100 && <p>São exibidas até 100 séries mais recentes.</p>}
        {!series.length ? <p>Você ainda não criou uma série.</p> : <ul className={styles.list}>{series.map(item => <li key={item.id}><button className={styles.linkButton} disabled={busy || uncertain} onClick={() => void open(item)}>{item.title}</button></li>)}</ul>}
        {detail && <button className={styles.button} disabled={busy || uncertain || changedItems || changedInfo} onClick={() => { setDetail(null); setItems([]); setTitle(""); setDescription(""); }}>Criar outra série</button>}
      </section>
      <section aria-labelledby="series-form-title"><h2 id="series-form-title">{detail ? "Editar série" : "Criar série"}</h2>
        {dirty && <button className={styles.button} disabled={busy || uncertain} onClick={() => { setTitle(detail?.title ?? ""); setDescription(detail?.description ?? ""); setItems(detail?.posts ?? []); setMessage("Alterações descartadas."); }}>Descartar alterações</button>}
        <form className={styles.form} onSubmit={saveInfo}>
          <label>Título <input required maxLength={150} value={title} onChange={event => setTitle(event.target.value)} disabled={busy || uncertain} /></label>
          <label>Descrição <textarea maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} disabled={busy || uncertain} /></label>
          <button className={styles.button} disabled={busy || uncertain || !title.trim() || (detail !== null && !changedInfo)}>{detail ? "Salvar informações" : "Criar série"}</button>
        </form>
      </section>
      {detail && <section aria-labelledby="series-items"><h2 id="series-items">Artigos da série</h2>
        <p>Até 100 artigos. A ordem salva é substituída integralmente; alterações simultâneas em outras abas podem ser sobrescritas.</p>
        {!items.length ? <p>Nenhum artigo nesta série.</p> : <ol className={styles.list}>{items.map((item, index) => <li key={item.id}><strong>{item.title}</strong> <span>{item.published ? "Publicado" : "Rascunho"}{!item.isActive && " · inativo"}</span><div className={styles.actions}><button className={styles.button} disabled={busy || uncertain || index === 0} onClick={() => move(index, -1)} aria-label={`Subir ${item.title}`}>Subir</button><button className={styles.button} disabled={busy || uncertain || index === items.length - 1} onClick={() => move(index, 1)} aria-label={`Descer ${item.title}`}>Descer</button><button className={styles.button} disabled={busy || uncertain} onClick={() => setItems(old => old.filter(i => i.id !== item.id))} aria-label={`Remover ${item.title} da série`}>Remover</button></div></li>)}</ol>}
        <button className={styles.button} disabled={busy || uncertain || changedInfo || !changedItems} onClick={() => setConfirmation("items")}>Salvar ordem e artigos</button>
        {articles && <><h3>Adicionar artigos</h3><ul className={styles.list}>{articles.data.map(article => <li key={article.id}>{article.title} · {article.published ? "Publicado" : "Rascunho"} <button className={styles.button} disabled={busy || uncertain || items.length >= 100 || items.some(item => item.id === article.id)} onClick={() => setItems(old => [...old, { id: article.id, title: article.title, slug: article.slug, published: article.published, isActive: true, position: old.length + 1 }])} aria-label={`Adicionar ${article.title} à série`}>Adicionar</button></li>)}</ul><nav className={styles.actions} aria-label="Paginação dos artigos"><button className={styles.button} disabled={busy || !articles.meta.hasPreviousPage} onClick={() => void changePage(articles.meta.page - 1)}>Anterior</button><span>Página {articles.meta.page}</span><button className={styles.button} disabled={busy || !articles.meta.hasNextPage} onClick={() => void changePage(articles.meta.page + 1)}>Próxima</button></nav></>}
        <button className={styles.button} disabled={busy || uncertain || changedInfo || changedItems} onClick={() => setConfirmation("delete")}>Excluir série</button>
      </section>}
    </>}
    {confirmation && <ConfirmDialog title={confirmation === "delete" ? "Excluir série?" : "Salvar artigos e ordem?"} description={confirmation === "delete" ? "A série será excluída. Seus artigos serão preservados." : "A lista completa e a ordem atuais substituirão as que estiverem salvas."} confirmLabel={confirmation === "delete" ? "Excluir série" : "Salvar ordem"} onCancel={() => setConfirmation(null)} onConfirm={() => void confirm()} />}
    {confirmLeave && <ConfirmDialog title="Sair sem salvar?" description="Suas alterações na série serão descartadas." confirmLabel="Sair sem salvar" onCancel={() => setConfirmLeave(false)} onConfirm={() => { setConfirmLeave(false); router.push("/studio"); }} />}
  </main>;
}
