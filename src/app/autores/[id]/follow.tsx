"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
import styles from "./profile.module.css";

type State = "loading" | "signed-out" | "self" | "ready" | "error" | "uncertain";
export default function Follow({ authorId }: { authorId: string }) {
  const [state, setState] = useState<State>("loading");
  const [subject, setSubject] = useState("");
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const running = useRef(false);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setState("loading"); setSubject("");
    try {
      const profile = await getOwnProfile();
      if (current !== generation.current) return;
      if (!profile) { setState("signed-out"); return; }
      if (profile.id === authorId) { setState("self"); return; }
      const response = await authenticatedFetchForSubject(profile.id, `/api/v1/authors/${encodeURIComponent(authorId)}/follow`, { cache: "no-store" });
      if (current !== generation.current) return;
      if (response.status === 401) { setState("signed-out"); return; }
      if (!response.ok) throw new Error();
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !("following" in data) || typeof data.following !== "boolean") throw new Error();
      if (current !== generation.current) return;
      setSubject(profile.id); setFollowing(data.following); setState("ready");
    } catch { if (current === generation.current) setState("error"); }
  }, [authorId]);
  useEffect(() => {
    let active = true;
    const revision = generation;
    const unsubscribe = subscribeSession(() => { void load(); });
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; revision.current++; unsubscribe(); };
  }, [load]);
  async function toggle() {
    if (state !== "ready" || !subject || running.current) return;
    const current = generation.current, next = !following;
    running.current = true; setBusy(true);
    try {
      const response = await authenticatedFetchForSubject(subject, `/api/v1/authors/${encodeURIComponent(authorId)}/follow`, { method: next ? "PUT" : "DELETE", cache: "no-store" });
      if (current !== generation.current) return;
      if (response.status === 401) { setState("signed-out"); return; }
      if ([400, 403, 404, 409, 429].includes(response.status)) { setState("error"); return; }
      if (response.status !== 204) throw new Error();
      setFollowing(next);
    } catch { if (current === generation.current) setState("uncertain"); }
    finally { running.current = false; setBusy(false); }
  }
  if (state === "self") return null;
  if (state === "loading") return <p role="status">Verificando acompanhamento…</p>;
  if (state === "signed-out") return <p><Link className={styles.followLink} href={`/entrar?next=${encodeURIComponent(`/autores/${authorId}`)}`}>Entre para acompanhar este autor</Link></p>;
  if (state === "error" || state === "uncertain") return <div className={styles.followControl}><p role="alert">{state === "uncertain" ? "Não foi possível confirmar a alteração. Atualize o estado antes de tentar novamente." : "Não foi possível verificar o acompanhamento agora."}</p><button className={styles.followButton} onClick={() => void load()}>Atualizar estado</button></div>;
  return <div className={styles.followControl}><button className={styles.followButton} type="button" disabled={busy} onClick={() => void toggle()}>{busy ? "Aguarde…" : following ? "Deixar de seguir" : "Seguir autor"}</button><span role="status">{following ? "Você acompanha este autor." : "Acompanhe novas publicações deste autor."}</span></div>;
}
