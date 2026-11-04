"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
import { isPendingResponse, parseDraft, validDraftId } from "./editor-contracts";
import styles from "./studio.module.css";

type State = "loading" | "ready" | "signed-out" | "denied" | "error";
export default function Editor({ initialId }: { initialId?: string }) {
  const [state, setState] = useState<State>("loading");
  const [owner, setOwner] = useState("");
  const [id, setId] = useState(initialId || "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [savedTitle, setSavedTitle] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const running = useRef(false);
  const revision = useRef(0);
  const dirty = title !== savedTitle || content !== savedContent;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function preventUnsavedNavigation(event: { preventDefault: () => void }) {
    if (dirty && !window.confirm("Você tem alterações não salvas. Deseja sair mesmo assim?")) event.preventDefault();
  }

  useEffect(() => {
    let active = true;
    const generation = revision;
    const load = async () => {
      const current = ++generation.current;
      try {
        const profile = await getOwnProfile();
        if (!active || current !== generation.current) return;
        if (!profile) { setState("signed-out"); return; }
        if (profile.role !== "AUTHOR" && profile.role !== "ADMIN") { setState("denied"); return; }
        setOwner(profile.id);
        if (initialId) {
          if (!validDraftId(initialId)) { setState("error"); return; }
          const response = await authenticatedFetchForSubject(profile.id, `/api/v1/posts/${initialId}`);
          if (!active || current !== generation.current) return;
          if (response.status === 401) { setState("signed-out"); return; }
          if (response.status === 403 || response.status === 409) { setState("denied"); return; }
          if (!response.ok) throw new Error();
          const draft = parseDraft(await response.json(), profile.id);
          if (!active || current !== generation.current) return;
          if (draft.published) { setState("denied"); return; }
          setTitle(draft.title); setContent(draft.content); setSavedTitle(draft.title); setSavedContent(draft.content); setStatus(draft.reviewStatus); setScheduledAt(draft.scheduledAt);
        }
        setState("ready");
      } catch { if (active && current === generation.current) setState("error"); }
    };
    const unsubscribe = subscribeSession(() => {
      generation.current++;
      setLocked(true); setFeedback("A sessão mudou. Seu texto continua nesta tela; copie-o antes de sair e reabra o rascunho com a conta correta.");
    });
    void load();
    return () => { active = false; generation.current++; unsubscribe(); };
  }, [initialId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current || locked || status === "PENDING") return;
    const operation = ++revision.current;
    running.current = true; setBusy(true); setFeedback("");
    try {
      const response = await authenticatedFetchForSubject(owner, id ? `/api/v1/posts/${id}` : "/api/v1/posts", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content }) });
      if (operation !== revision.current) return;
      if (response.status === 400 || response.status === 429) { setFeedback(response.status === 400 ? "Confira o título e o conteúdo e tente novamente." : "Muitas tentativas. Aguarde antes de tentar novamente."); return; }
      if ([401, 403, 404, 409].includes(response.status)) { setLocked(true); setFeedback("A conta ou o rascunho não permite esta alteração. Copie o texto e confira o estado no Studio antes de tentar novamente."); return; }
      if (!response.ok) throw new Error();
      const draft = parseDraft(await response.json(), owner);
      if (operation !== revision.current) return;
      if (draft.published || (id && draft.id !== id)) throw new Error();
      setId(draft.id); setTitle(draft.title); setContent(draft.content); setSavedTitle(draft.title); setSavedContent(draft.content); setStatus(draft.reviewStatus); setScheduledAt(draft.scheduledAt);
      if (!id) window.history.replaceState(window.history.state, "", `/studio/${draft.id}`);
      setFeedback("Rascunho salvo.");
    } catch { if (operation === revision.current) { setLocked(true); setFeedback("Não foi possível confirmar o salvamento. Seu texto foi preservado; copie-o e confira seus artigos antes de tentar novamente."); } }
    finally { running.current = false; setBusy(false); }
  }

  async function submitReview() {
    if (!id || dirty || locked || running.current || status === "PENDING" || scheduledAt !== null) return;
    const operation = ++revision.current;
    running.current = true; setBusy(true); setFeedback("");
    try {
      const response = await authenticatedFetchForSubject(owner, `/api/v1/post-reviews/${id}/submit`, { method: "POST" });
      if (operation !== revision.current) return;
      if ([401, 403, 404, 409].includes(response.status)) { setLocked(true); setFeedback("Não foi possível enviar para revisão. Confira a conta e o estado do artigo no Studio."); return; }
      if (response.status === 400 || response.status === 429) { setFeedback("Não foi possível enviar agora. Confira os dados ou aguarde antes de tentar novamente."); return; }
      if (response.status !== 201 || !isPendingResponse(await response.json())) throw new Error();
      if (operation !== revision.current) return;
      setStatus("PENDING"); setConfirmSubmit(false); setFeedback("Artigo enviado para revisão.");
    } catch { if (operation === revision.current) { setLocked(true); setFeedback("Não foi possível confirmar o envio. Confira o estado do artigo no Studio antes de tentar novamente."); } }
    finally { running.current = false; setBusy(false); }
  }

  return <main className={styles.page}><header className={styles.header}><Link className={styles.brand} href="/" onNavigate={preventUnsavedNavigation}>✳ entrelinhas.</Link><Link href="/studio" onNavigate={preventUnsavedNavigation}>Voltar ao Studio</Link></header><section className={styles.content}><p className={styles.eyebrow}>SEU ESPAÇO DE ESCRITA</p><h1>{initialId ? "Editar rascunho." : "Novo rascunho."}</h1>
    {state === "loading" && <p role="status">Carregando editor…</p>}{state === "signed-out" && <p>Entre para acessar o editor. <Link className={styles.link} href="/entrar">Entrar</Link></p>}{state === "denied" && <p role="alert">Este artigo não está disponível para edição nesta conta.</p>}{state === "error" && <p role="alert">Não foi possível carregar o rascunho. Verifique a conexão e retorne ao Studio.</p>}
    {state === "ready" && <><p>{status === "PENDING" ? "Este artigo aguarda revisão e não pode ser alterado." : scheduledAt ? `Publicação agendada para ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date(scheduledAt))}, no seu horário local. Este agendamento não pode ser alterado neste editor.` : status === "REJECTED" ? "Artigo rejeitado: revise o texto antes de reenviar." : "Seu artigo permanece privado até a publicação."}</p>
      <form method="post" onSubmit={save} className={styles.editor}><label>Título<input required minLength={3} maxLength={150} value={title} onChange={event => { setTitle(event.target.value); setConfirmSubmit(false); }} readOnly={busy || locked || status === "PENDING"} /></label><label>Conteúdo<textarea required minLength={10} maxLength={50000} rows={16} value={content} onChange={event => { setContent(event.target.value); setConfirmSubmit(false); }} readOnly={busy || locked || status === "PENDING"} /></label><button disabled={busy || locked || status === "PENDING"}>{busy ? "Salvando…" : "Salvar rascunho"}</button></form>
      {id && status !== "PENDING" && !locked && (scheduledAt ? <p>Artigos agendados não podem ser enviados para revisão. Cancele o agendamento antes de enviar.</p> : <><button type="button" disabled={busy || dirty} onClick={() => setConfirmSubmit(true)}>Enviar para revisão</button>{dirty && <p>Salve suas alterações antes de enviar para revisão.</p>}{confirmSubmit && !dirty && <div><p>Após o envio, o rascunho ficará bloqueado até a decisão. Confirmar?</p><button type="button" disabled={busy} onClick={submitReview}>Confirmar envio</button> <button type="button" disabled={busy} onClick={() => setConfirmSubmit(false)}>Cancelar</button></div>}</>)}
      {feedback && <p role="status">{feedback}</p>}
    </>}
  </section></main>;
}
