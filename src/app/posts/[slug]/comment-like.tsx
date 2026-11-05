"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetchForSubject } from "@/lib/session-client";
import { useCommentSession } from "./comment-session";
import { parseCommentLike, type CommentLikeStatus } from "./comment-like-data";
import styles from "./post.module.css";

export default function CommentLike({ commentId }: { commentId: string }) {
  const { status, profile } = useCommentSession();
  const [value, setValue] = useState<CommentLikeStatus | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "uncertain">("loading");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const running = useRef(false);
  const subject = status === "signed-in" ? profile?.id : undefined;
  const load = useCallback(async () => {
    const current = ++generation.current;
    setValue(null); setState("loading");
    if (!subject) return;
    try {
      const response = await authenticatedFetchForSubject(subject, `/api/v1/comments/${encodeURIComponent(commentId)}/like`, { cache: "no-store" });
      if (current !== generation.current) return;
      if (!response.ok) throw new Error();
      const result = parseCommentLike(await response.json());
      if (current === generation.current) { setValue(result); setState("ready"); }
    } catch { if (current === generation.current) setState("error"); }
  }, [commentId, subject]);
  useEffect(() => {
    let active = true;
    const revision = generation;
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; revision.current++; };
  }, [load]);
  async function toggle() {
    if (!subject || !value || state !== "ready" || running.current) return;
    const current = generation.current;
    running.current = true; setBusy(true);
    try {
      const response = await authenticatedFetchForSubject(subject, `/api/v1/comments/${encodeURIComponent(commentId)}/like`, { method: value.liked ? "DELETE" : "PUT", cache: "no-store" });
      if (current !== generation.current) return;
      if (response.status !== 204) throw new Error();
      const refreshed = await authenticatedFetchForSubject(subject, `/api/v1/comments/${encodeURIComponent(commentId)}/like`, { cache: "no-store" });
      if (current !== generation.current) return;
      if (!refreshed.ok) throw new Error();
      const result = parseCommentLike(await refreshed.json());
      if (current === generation.current) setValue(result);
    } catch { if (current === generation.current) { setValue(null); setState("uncertain"); } }
    finally { running.current = false; setBusy(false); }
  }
  if (status === "loading") return null;
  if (status === "signed-out") return <p><Link className={styles.commentLikeLink} href="/entrar">Entre para curtir</Link></p>;
  if (status === "error") return <p>Não foi possível verificar sua sessão para curtir.</p>;
  if (state === "loading") return <p role="status">Carregando curtidas…</p>;
  if (state === "error" || state === "uncertain") return <div><p role="status">{state === "uncertain" ? "Não foi possível confirmar a curtida. Atualize o estado antes de tentar novamente." : "Não foi possível carregar as curtidas."}</p><button type="button" className={styles.commentLikeButton} onClick={() => void load()}>Atualizar curtidas</button></div>;
  return <button type="button" className={styles.commentLikeButton} aria-pressed={value?.liked} disabled={busy} onClick={() => void toggle()}>{busy ? "Atualizando…" : value?.liked ? "Descurtir" : "Curtir"} · {value?.likes} {value?.likes === 1 ? "curtida" : "curtidas"}</button>;
}
