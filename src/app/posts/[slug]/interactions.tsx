"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
import { changeInteraction, parseInteraction, type Interaction, type InteractionKind } from "./interaction-data";
import styles from "./interactions.module.css";

type View = "loading" | "signed-out" | "ready" | "unavailable" | "uncertain" | "denied";

export default function Interactions({ postId }: { postId: string }) {
  const [view, setView] = useState<View>("loading");
  const [identity, setIdentity] = useState("");
  const [state, setState] = useState<Interaction | null>(null);
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const submitting = useRef(false);

  const load = useCallback(async () => {
    const current = ++revision.current;
    setIdentity(""); setState(null); setView("loading");
    try {
      const profile = await getOwnProfile();
      if (current !== revision.current) return;
      if (!profile) { setView("signed-out"); return; }
      const response = await authenticatedFetchForSubject(profile.id, `/api/v1/posts/${postId}/interaction`, { cache: "no-store" });
      if (current !== revision.current) return;
      if (response.status === 401 || response.status === 409) { setView("signed-out"); return; }
      if (response.status === 403) { setView("denied"); return; }
      if (!response.ok) throw new Error();
      const value = parseInteraction(await response.json());
      if (current === revision.current) { setIdentity(profile.id); setState(value); setView("ready"); }
    } catch { if (current === revision.current) setView("unavailable"); }
  }, [postId]);

  useEffect(() => {
    let active = true;
    const generation = revision;
    const unsubscribe = subscribeSession(() => { void load(); });
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; generation.current++; unsubscribe(); };
  }, [load]);

  async function toggle(kind: InteractionKind) {
    if (!state || !identity || submitting.current) return;
    const current = revision.current;
    submitting.current = true; setBusy(true);
    try {
      const response = await changeInteraction(authenticatedFetchForSubject, identity, postId, kind, state);
      if (current !== revision.current) return;
      if (response.status === 401 || response.status === 409) { setState(null); setView("signed-out"); return; }
      if (response.status === 403) { setState(null); setView("denied"); return; }
      if (response.status !== 204) throw new Error();
      await load();
    } catch { if (current === revision.current) { setState(null); setView("uncertain"); } }
    finally { submitting.current = false; setBusy(false); }
  }

  return <section className={styles.interactions} aria-label="Interações com o artigo">
    {view === "loading" && <p role="status">Carregando interações…</p>}
    {view === "signed-out" && <p><Link href="/entrar">Entre na sua conta</Link> para curtir ou salvar esta leitura.</p>}
    {view === "denied" && <p role="status">Sua conta não pode interagir com este artigo.</p>}
    {view === "unavailable" && <><p role="status">Não foi possível carregar as interações.</p><button onClick={() => void load()}>Tentar novamente</button></>}
    {view === "uncertain" && <><p role="status">Não foi possível confirmar a alteração. Consulte o estado atual antes de tentar novamente.</p><button onClick={() => void load()}>Consultar estado</button></>}
    {view === "ready" && state && <><button disabled={busy} aria-pressed={state.liked} onClick={() => void toggle("like")}>{state.liked ? "♥ Curtido" : "♡ Curtir"}</button><span>{state.likes} {state.likes === 1 ? "curtida" : "curtidas"}</span><button disabled={busy} aria-pressed={state.saved} onClick={() => void toggle("save")}>{state.saved ? "✓ Salvo" : "+ Salvar"}</button></>}
  </section>;
}
