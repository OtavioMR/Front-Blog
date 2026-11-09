"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { authenticatedFetchForSubject } from "@/lib/session-client";
import { useSession, type SessionView } from "@/lib/use-session";
import styles from "./post.module.css";

export function ReportForm({ target, targetId, session, initialOwner, onClose, onSuccess }: { target: "POST" | "COMMENT"; targetId: string; session: SessionView; initialOwner?: string; onClose?: () => void; onSuccess?: () => void }) {
  const id = useId();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const running = useRef(false);
  const [owner, setOwner] = useState(initialOwner || "");
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = target === "POST" ? "artigo" : "comentário";
  useEffect(() => {
    const element = dialog.current;
    if (!element || !owner || target !== "COMMENT") return;
    element.showModal();
    return () => { if (element.open) element.close(); };
  }, [owner, target]);

  function close() {
    if (running.current) return;
    setOwner(""); setCategory(""); setReason(""); setMessage(""); setLocked(false); onClose?.();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current || locked || !owner) return;
    if (session.profile?.id !== owner) { setMessage("A conta mudou. Seu texto foi preservado; entre com a conta original para enviar."); return; }
    const trimmed = reason.trim();
    if (trimmed.length < 5 || trimmed.length > 1000) { setMessage("Informe um motivo entre 5 e 1000 caracteres."); return; }
    running.current = true; setBusy(true); setMessage("");
    try {
      const response = await authenticatedFetchForSubject(owner, "/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, targetId, reason: trimmed, reasonCategory: category || undefined }),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 201) {
        const value: unknown = await response.json();
        if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value.id) || !("status" in value) || value.status !== "PENDING") throw new Error("Resposta inválida");
        if (target === "COMMENT" && onSuccess) { setReason(""); onSuccess(); }
        else { setReason(""); setLocked(true); setMessage("Denúncia enviada para análise."); }
      } else if (response.status === 401) setMessage("Entre novamente para enviar a denúncia.");
      else if (response.status === 403) setMessage("Você não tem permissão para enviar esta denúncia.");
      else if (response.status === 409) { setLocked(true); setMessage("Já pode existir uma denúncia pendente ou a conta mudou. Confira sua sessão antes de tentar novamente."); }
      else if (response.status === 404) setMessage("Este conteúdo não está mais disponível.");
      else if (response.status === 400) setMessage("Confira o motivo informado e tente novamente.");
      else if (response.status === 429) setMessage("Muitas tentativas. Aguarde antes de tentar novamente.");
      else { setLocked(true); setMessage("Não foi possível confirmar o envio. A denúncia pode ter sido recebida; confira antes de tentar novamente."); }
    } catch { setLocked(true); setMessage("Não foi possível confirmar o envio. A denúncia pode ter sido recebida; confira antes de tentar novamente."); }
    finally { running.current = false; setBusy(false); }
  }

  if (!owner && session.status === "signed-out") return <p><Link className={styles.commentLikeLink} href="/entrar">Entre para denunciar {label}</Link></p>;
  if (!owner && session.status !== "signed-in") return null;
  if (!owner) return <button type="button" className={styles.repliesButton} onClick={() => { setOwner(session.profile!.id); setMessage(""); }}>Denunciar {label}</button>;
  const form = <form className={styles.reportForm} onSubmit={submit}>
    <label htmlFor={`${id}-cat`}>Categoria da denúncia</label>
    <select
      id={`${id}-cat`}
      value={category}
      onChange={e => setCategory(e.target.value)}
      className={styles.reportCategory}
      style={{ minHeight: "44px", padding: "8px 12px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
      disabled={busy || locked}
    >
      <option value="">Selecione uma categoria (opcional)...</option>
      <option value="INCORRECT_RATING">Classificação etária incorreta</option>
      <option value="AI_OMISSION">Omissão de IA ou declaração enganosa</option>
      <option value="COPYRIGHT">Violação de direitos autorais ou plágio</option>
      <option value="ABUSIVE">Conteúdo ofensivo ou discurso de ódio</option>
      <option value="ILLEGAL">Conteúdo potencialmente ilegal ou exploração</option>
      <option value="SPAM">Spam ou autopromoção desordenada</option>
      <option value="OTHER">Outro motivo</option>
    </select>
    <label htmlFor={id}>Motivo detalhado da denúncia do {label}</label>
    <textarea className={styles.reportReason} id={id} value={reason} onChange={event => setReason(event.target.value)} minLength={5} maxLength={1000} required readOnly={busy || locked} />
    <div><button type="submit" className={styles.repliesButton} disabled={busy || locked}>{busy ? "Enviando…" : "Enviar denúncia"}</button>{!locked && <button type="button" className={styles.repliesButton} disabled={busy} onClick={close}>Cancelar</button>}</div>
    <p role="status">{message}</p>
  </form>;
  if (target !== "COMMENT") return form;
  return <dialog ref={dialog} className={styles.reportDialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }}>
    <div className={styles.reportHeading}><h2 id={titleId}>Denunciar comentário</h2><button type="button" className={styles.reportClose} aria-label="Fechar denúncia" disabled={busy} onClick={close}>×</button></div>
    {form}
  </dialog>;
}

export function PostReport({ postId }: { postId: string }) {
  const session = useSession();
  return <ReportForm target="POST" targetId={postId} session={session} />;
}
