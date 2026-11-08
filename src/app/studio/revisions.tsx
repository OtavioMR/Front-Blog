"use client";

import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/app/_components/confirm-dialog";
import { authenticatedFetchForSubject, subscribeSession } from "@/lib/session-client";
import type { Draft } from "./editor-contracts";
import { parseRestored, parseRevision, parseRevisions, type Revision } from "./revisions-contracts";
import styles from "./editor.module.css";

export default function Revisions({ id, owner, isAdmin, dirty, pending, busy, setBusy, onRestore, onUncertain }: { id: string; owner: string; isAdmin: boolean; dirty: boolean; pending: boolean; busy: boolean; setBusy: (value: boolean) => void; onRestore: (draft: Draft) => void; onUncertain: () => void }) {
  const [open, setOpen] = useState(false); const [page, setPage] = useState(1);
  const [items, setItems] = useState<Revision[]>([]); const [previous, setPrevious] = useState(false); const [next, setNext] = useState(false);
  const [selected, setSelected] = useState<Revision | null>(null); const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false); const [message, setMessage] = useState(""); const [uncertain, setUncertain] = useState(false);
  const generation = useRef(0);
  useEffect(() => { const counter = generation; const unsubscribe = subscribeSession(() => { counter.current++; setOpen(false); setItems([]); setSelected(null); setConfirm(false); setMessage("A sessão mudou. Recarregue o editor antes de acessar o histórico."); setUncertain(true); }); return () => { counter.current++; unsubscribe(); }; }, []);
  async function list(target: number) {
    const current = ++generation.current; setLoading(true); setSelected(null); setMessage("");
    try { const response = await authenticatedFetchForSubject(owner, `/api/v1/posts/${id}/revisions?page=${target}&limit=10`); if (!response.ok) throw new Error(); const value = parseRevisions(await response.json(), target); if (current !== generation.current) return; setItems(value.items); setPrevious(value.hasPrevious); setNext(value.hasNext); setPage(target); setOpen(true); }
    catch { if (current === generation.current) setMessage("Não foi possível carregar o histórico. Confira sua sessão e tente novamente."); }
    finally { if (current === generation.current) setLoading(false); }
  }
  async function detail(revisionId: string) {
    const current = ++generation.current; setLoading(true); setSelected(null); setMessage("");
    try { const response = await authenticatedFetchForSubject(owner, `/api/v1/posts/${id}/revisions/${revisionId}`); if (!response.ok) throw new Error(); const value = parseRevision(await response.json(), revisionId); if (current === generation.current) setSelected(value); }
    catch { if (current === generation.current) setMessage("Não foi possível carregar esta versão."); }
    finally { if (current === generation.current) setLoading(false); }
  }
  async function restore() {
    setConfirm(false); if (!selected || dirty || pending || busy || uncertain) return;
    const current = ++generation.current; setBusy(true); setMessage("");
    try {
      const response = await authenticatedFetchForSubject(owner, `/api/v1/posts/${id}/revisions/${selected.id}/restore`, { method: "POST" });
      if ([400, 401, 403, 404, 409].includes(response.status)) { if (current === generation.current) setMessage("Não foi possível restaurar. Confira a sessão e o estado do artigo."); return; }
      if (response.status !== 201) throw new Error();
      const draft = parseRestored(await response.json(), owner, isAdmin, id);
      if (current === generation.current) { onRestore(draft); setSelected(null); setOpen(false); setMessage("Versão restaurada."); }
    } catch { if (current === generation.current) { setUncertain(true); onUncertain(); setMessage("Não foi possível confirmar a restauração. Recarregue o editor e confira o artigo antes de tentar novamente."); } }
    finally { setBusy(false); }
  }
  return <section className={styles.sideCard} aria-labelledby="revisions-title"><h2 id="revisions-title">Histórico de versões</h2><p className={styles.cardHint}>Consulte versões anteriores de título e conteúdo.</p>
    {!open && <button type="button" className={styles.btnSecondary} disabled={loading || busy || uncertain} onClick={() => void list(1)}>Ver histórico</button>}
    {loading && <p role="status">Carregando histórico…</p>}
    {selected && <div><h3>{selected.title}</h3><pre className={styles.revisionPreview}>{selected.content}</pre><button type="button" className={styles.btnSecondary} disabled={dirty || pending || busy || uncertain} onClick={() => setConfirm(true)}>Restaurar esta versão</button>{dirty && <p>Salve suas alterações antes de restaurar.</p>}{pending && <p>Uma versão não pode ser restaurada enquanto o artigo aguarda revisão.</p>}</div>}
    {open && <><button type="button" className={styles.btnSecondary} onClick={() => { generation.current++; setOpen(false); setItems([]); setSelected(null); setLoading(false); }}>Fechar histórico</button>{items.length === 0 ? <p>Nenhuma versão encontrada.</p> : <ul>{items.map(item => <li key={item.id}><button type="button" className={styles.btnSecondary} disabled={loading || busy} onClick={() => void detail(item.id)}>{item.title} — {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</button></li>)}</ul>}<p>Página {page}</p><button type="button" className={styles.btnSecondary} disabled={!previous || loading || busy} onClick={() => void list(page - 1)}>Anterior</button> <button type="button" className={styles.btnSecondary} disabled={!next || loading || busy} onClick={() => void list(page + 1)}>Próxima</button></>}
    {message && <p role="status">{message}</p>}
    {confirm && <ConfirmDialog title="Restaurar esta versão?" description="O título e o conteúdo atuais serão substituídos pela versão selecionada. As demais propriedades e o estado de publicação serão mantidos." confirmLabel="Restaurar versão" onCancel={() => setConfirm(false)} onConfirm={() => void restore()} />}
  </section>;
}
