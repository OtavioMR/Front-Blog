"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import ConfirmDialog from "@/app/_components/confirm-dialog";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
import { parseCollection, parseCollections, parseCollectionPosts, type Collection, type CollectionPost } from "./collections-data";
import styles from "./collections.module.css";

export default function Collections({ saved }: { saved: { id: string; title: string }[] }) {
  const [owner, setOwner] = useState(""); const [collections, setCollections] = useState<Collection[]>([]); const [selected, setSelected] = useState("");
  const [posts, setPosts] = useState<CollectionPost[]>([]); const [page, setPage] = useState(1); const [previous, setPrevious] = useState(false); const [next, setNext] = useState(false);
  const [name, setName] = useState(""); const [postId, setPostId] = useState(""); const [busy, setBusy] = useState(false); const [locked, setLocked] = useState(false); const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<{ owner: string; collection: string; post?: string } | null>(null); const revision = useRef(0);
  useEffect(() => {
    let active = true; const counter = revision;
    async function load() { const current = ++counter.current; setOwner(""); setCollections([]); setSelected(""); setPosts([]); setConfirmation(null); setName(""); setPostId(""); setBusy(false); setLocked(false); setMessage("");
      try { const profile = await getOwnProfile(); if (!profile || !active || current !== counter.current) return; const response = await authenticatedFetchForSubject(profile.id, "/api/v1/collections"); if (!response.ok) throw new Error(); const result = parseCollections(await response.json()); if (active && current === counter.current) { setOwner(profile.id); setCollections(result); } }
      catch { if (active && current === counter.current) setMessage("Não foi possível carregar suas coleções."); }
    }
    const unsubscribe = subscribeSession(() => { void load(); }); void load(); return () => { active = false; counter.current++; unsubscribe(); };
  }, []);
  async function loadPosts(collection: string, target: number) {
    const current = ++revision.current; setBusy(true); setPosts([]); setMessage("");
    try { const response = await authenticatedFetchForSubject(owner, `/api/v1/collections/${collection}/posts?page=${target}&limit=10`); if (!response.ok) throw new Error(); const result = parseCollectionPosts(await response.json(), target); if (current === revision.current) { setSelected(collection); setPage(target); setPosts(result.items); setPrevious(result.previous); setNext(result.next); } }
    catch { if (current === revision.current) { setSelected(""); setMessage("Não foi possível carregar os artigos da coleção."); } }
    finally { if (current === revision.current) setBusy(false); }
  }
  async function mutate(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: { name: string }, expectedId?: string) {
    if (!owner || busy || locked) return false;
    const current = ++revision.current; setBusy(true); setMessage("");
    try {
      const response = await authenticatedFetchForSubject(owner, path, { method, ...(body && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
      if (current !== revision.current) return false;
      if (response.status === 409) { setLocked(true); setMessage("O nome pode estar em uso ou a sessão pode ter mudado. Recarregue antes de continuar."); return false; }
      if ([400, 401, 403, 404, 429].includes(response.status)) { setMessage("Não foi possível concluir. Confira sua sessão e os dados informados."); return false; }
      if ((method === "POST" && response.status === 201) || (method === "PATCH" && response.status === 200)) {
        const item = parseCollection(await response.json()); if (expectedId && item.id !== expectedId) throw new Error();
        if (current !== revision.current) return false;
        setCollections(old => method === "POST" ? [item, ...old] : old.map(x => x.id === item.id ? item : x));
      } else if (response.status !== 204 || !["PUT", "DELETE"].includes(method)) throw new Error();
      return true;
    } catch { if (current === revision.current) { setLocked(true); setMessage("Não foi possível confirmar o resultado. Recarregue a página e confira suas coleções antes de tentar novamente."); } return false; }
    finally { if (current === revision.current) setBusy(false); }
  }
  async function saveName(event: FormEvent) { event.preventDefault(); const trimmed = name.trim(); if (!trimmed || trimmed.length > 100) { setMessage("Informe um nome de até 100 caracteres."); return; } const ok = await mutate(selected ? `/api/v1/collections/${selected}` : "/api/v1/collections", selected ? "PATCH" : "POST", { name: trimmed }, selected || undefined); if (ok) { setName(""); setMessage(selected ? "Coleção renomeada." : "Coleção criada."); } }
  async function confirmDelete() { const target = confirmation; setConfirmation(null); if (!target || target.owner !== owner || target.collection !== selected) { setMessage("A conta ou a coleção mudou. Verifique antes de continuar."); return; } const ok = await mutate(`/api/v1/collections/${target.collection}${target.post ? `/posts/${target.post}` : ""}`, "DELETE"); if (ok) { if (target.post) setPosts(old => old.filter(x => x.id !== target.post)); else { setCollections(old => old.filter(x => x.id !== target.collection)); setSelected(""); setPosts([]); } setMessage(target.post ? "Artigo removido da coleção; ele continua salvo." : "Coleção excluída; seus artigos continuam salvos."); } }
  return <section className={styles.section} aria-labelledby="collections-title"><h2 id="collections-title">Coleções privadas</h2><p>Organize seus artigos salvos. Apenas você pode acessar suas coleções.</p>
    {owner && <><form className={styles.form} onSubmit={saveName}><label htmlFor="collection-name">{selected ? "Renomear coleção" : "Nome da nova coleção"}</label><input id="collection-name" value={name} maxLength={100} onChange={event => setName(event.target.value)} disabled={busy || locked} required /><button disabled={busy || locked}>{selected ? "Renomear" : "Criar coleção"}</button></form>
      <div className={styles.row}><label htmlFor="collection-select">Coleção</label><select id="collection-select" value={selected} disabled={busy || locked} onChange={event => { setName(""); if (event.target.value) void loadPosts(event.target.value, 1); else { setSelected(""); setPosts([]); } }}><option value="">Nova coleção / selecionar</option>{collections.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      {!collections.length && <p>Você ainda não criou coleções.</p>}
      {selected && <><button type="button" disabled={busy || locked} onClick={() => setConfirmation({ owner, collection: selected })}>Excluir coleção</button><h3>Artigos da coleção</h3>{posts.length ? <ul>{posts.map(post => <li key={post.id}><Link href={`/posts/${encodeURIComponent(post.slug)}`}>{post.title}</Link> <button type="button" disabled={busy || locked} onClick={() => setConfirmation({ owner, collection: selected, post: post.id })}>Remover</button></li>)}</ul> : <p>Nenhum artigo nesta página da coleção.</p>}
        {(previous || next) && <nav aria-label="Paginação da coleção"><button type="button" disabled={!previous || busy || locked} onClick={() => void loadPosts(selected, page - 1)}>Anterior</button> Página {page} <button type="button" disabled={!next || busy || locked} onClick={() => void loadPosts(selected, page + 1)}>Próxima</button></nav>}
        <div className={styles.row}><label htmlFor="saved-select">Adicionar artigo salvo desta página</label><select id="saved-select" value={postId} disabled={busy || locked} onChange={event => setPostId(event.target.value)}><option value="">Selecione um artigo</option>{saved.map(post => <option key={post.id} value={post.id}>{post.title}</option>)}</select><button type="button" disabled={!postId || busy || locked} onClick={async () => { if (await mutate(`/api/v1/collections/${selected}/posts/${postId}`, "PUT")) { setPostId(""); await loadPosts(selected, 1); setMessage("Artigo adicionado à coleção."); } }}>Adicionar</button></div>
      </>}
    </>}
    {message && <p role="status">{message}</p>}{locked && <button type="button" onClick={() => window.location.reload()}>Recarregar página</button>}
    {confirmation && <ConfirmDialog title={confirmation.post ? "Remover artigo da coleção?" : "Excluir coleção?"} description="Os artigos permanecerão na sua lista de salvos." confirmLabel={confirmation.post ? "Remover artigo" : "Excluir coleção"} onCancel={() => setConfirmation(null)} onConfirm={() => void confirmDelete()} />}
  </section>;
}
