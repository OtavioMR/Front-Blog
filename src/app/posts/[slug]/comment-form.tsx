"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
import { createComment } from "./comment-create";
import styles from "./post.module.css";

type State = "checking" | "ready" | "signed-out" | "unavailable" | "disabled" | "locked";
export default function CommentForm({ postId, slug, page, replyToId }: { postId: string; slug: string; page: number; replyToId?: string }) {
  const router = useRouter();
  const fieldId = useId();
  const [state, setState] = useState<State>("checking");
  const [owner, setOwner] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const revision = useRef(0);

  useEffect(() => {
    let active = true;
    const generation = revision;
    const current = ++generation.current;
    const unsubscribe = subscribeSession(() => {
      generation.current++;
      setState("locked"); setMessage("A sessão mudou. Seu texto permanece aqui; copie-o antes de entrar novamente.");
    });
    void getOwnProfile().then(profile => {
      if (!active || current !== generation.current) return;
      if (!profile) setState("signed-out");
      else { setOwner(profile.id); setState("ready"); }
    }).catch(() => { if (active && current === generation.current) setState("unavailable"); });
    return () => { active = false; generation.current++; unsubscribe(); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current || state !== "ready") return;
    const current = ++revision.current;
    running.current = true; setBusy(true); setMessage("");
    const result = await createComment(authenticatedFetchForSubject, owner, postId, content, replyToId);
    if (current === revision.current) {
      if (result === "created") {
        setContent(""); setMessage("Comentário publicado.");
        if (page === 1 || replyToId) router.refresh(); else router.push(`/posts/${encodeURIComponent(slug)}#comentarios`);
      } else if (result === "invalid") setMessage("Escreva um comentário de até 1000 caracteres.");
      else if (result === "rate-limited") setMessage("Muitas tentativas. Aguarde um pouco antes de enviar novamente.");
      else if (result === "disabled") { setState("disabled"); setMessage("Os comentários foram desativados neste artigo."); }
      else if (result === "unauthorized") { setState("locked"); setMessage("Sua sessão terminou. Copie o texto antes de entrar novamente."); }
      else if (result === "changed") { setState("locked"); setMessage("A conta mudou. Copie o texto e entre novamente antes de comentar."); }
      else if (result === "missing") { setState("locked"); setMessage("Este artigo não está mais disponível para comentários."); }
      else { setState("locked"); setMessage("Não foi possível confirmar o envio. Copie seu texto e atualize os comentários para verificar antes de tentar novamente."); }
    }
    running.current = false; setBusy(false);
  }

  return <div className={styles.commentForm}>
    {state === "checking" && <p role="status">Verificando sessão…</p>}
    {state === "signed-out" && <p><Link href="/entrar">Entre na sua conta</Link> para comentar.</p>}
    {state === "unavailable" && <p>Não foi possível verificar sua sessão agora. Atualize a página para tentar novamente.</p>}
    {(state === "ready" || state === "locked" || state === "disabled") && <form method="post" onSubmit={submit}>
      <label htmlFor={fieldId}>{replyToId ? "Sua resposta" : "Participe da conversa"}</label><textarea id={fieldId} value={content} onChange={event => setContent(event.target.value)} maxLength={1000} rows={4} required readOnly={busy || state !== "ready"} aria-describedby={`${fieldId}-limit`} />
      <p id={`${fieldId}-limit`}>{content.length}/1000 caracteres</p><button type="submit" disabled={busy || state !== "ready" || !/\S/u.test(content)}>{busy ? "Enviando…" : "Publicar comentário"}</button>
    </form>}
    {message && <p role="status">{message}</p>}{state === "locked" && <p><Link href="/entrar">Ir para entrada</Link></p>}
  </div>;
}
