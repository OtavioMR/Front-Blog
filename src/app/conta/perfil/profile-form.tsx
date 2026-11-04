"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
import { parseProfile, profilePayload, type ProfileFields } from "./contracts";
import BackButton from "@/app/_components/back-button";
import styles from "./profile.module.css";

type Status = "loading" | "ready" | "signed-out" | "error";
const empty: ProfileFields = { name: "", bio: "", websiteUrl: "", socialUrl: "" };

export default function ProfileForm() {
  const [status, setStatus] = useState<Status>("loading");
  const [fields, setFields] = useState(empty);
  const [id, setId] = useState("");
  const [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const load = useCallback(async () => {
    const current = ++revision.current;
    setStatus("loading"); setId(""); setFields(empty); setMessage("");
    try {
      const profile = await getOwnProfile();
      if (current !== revision.current) return;
      if (!profile) { setStatus("signed-out"); return; }
      const parsed = parseProfile(profile);
      setId(profile.id); setFields(parsed); setUncertain(false); setStatus("ready");
    } catch { if (current === revision.current) setStatus("error"); }
  }, []);

  useEffect(() => {
    let active = true;
    const generation = revision;
    const unsubscribe = subscribeSession(() => { void load(); });
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; generation.current++; unsubscribe(); };
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || busy || uncertain) return;
    let payload: ReturnType<typeof profilePayload>;
    try { payload = profilePayload(fields); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Confira os campos."); return; }
    const current = revision.current;
    setBusy(true); setMessage("");
    try {
      const response = await authenticatedFetchForSubject(id, `/api/v1/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
      if (current !== revision.current) return;
      if (response.status === 401) { setStatus("signed-out"); return; }
      if (response.status === 403) { setMessage("Sua conta não tem permissão para editar este perfil."); return; }
      if (response.status === 409) { setUncertain(true); setMessage("A sessão ou o perfil mudou. Recarregue os dados antes de continuar."); return; }
      if (response.status === 400) { setMessage("Confira os campos e tente novamente."); return; }
      if (!response.ok) throw new Error();
      const value: unknown = await response.json();
      if (!value || typeof value !== "object" || !("id" in value) || value.id !== id) throw new Error();
      const saved = parseProfile(value);
      if (current === revision.current) { setFields(saved); setMessage("Perfil atualizado."); }
    } catch { if (current === revision.current) { setUncertain(true); setMessage("Não foi possível confirmar o salvamento. Recarregue o perfil para verificar antes de tentar novamente."); } }
    finally { setBusy(false); }
  }
  function change(key: keyof ProfileFields, value: string) { setFields(previous => ({ ...previous, [key]: value })); }

  return <main className={styles.page}><section className={styles.content}>
    <BackButton fallback="/conta" /><p className={styles.eyebrow}>SEU ESPAÇO</p><h1>Seu perfil.</h1>
    {status === "loading" && <p role="status">Carregando perfil…</p>}
    {status === "signed-out" && <><p>Entre novamente para editar seu perfil.</p><Link className={styles.link} href="/entrar">Entrar</Link></>}
    {status === "error" && <><p role="alert">Não foi possível carregar seu perfil.</p><button onClick={() => void load()}>Tentar novamente</button></>}
    {status === "ready" && <><p>Nome, biografia e links podem aparecer no seu perfil público de autor.</p><form onSubmit={save} className={styles.form}>
      <label htmlFor="name">Nome</label><input id="name" value={fields.name} onChange={event => change("name", event.target.value)} minLength={2} maxLength={100} required disabled={busy || uncertain} />
      <label htmlFor="bio">Biografia</label><textarea id="bio" value={fields.bio} onChange={event => change("bio", event.target.value)} maxLength={500} disabled={busy || uncertain} />
      <label htmlFor="website">Site</label><input id="website" type="url" value={fields.websiteUrl} onChange={event => change("websiteUrl", event.target.value)} maxLength={500} placeholder="https://exemplo.com" disabled={busy || uncertain} />
      <label htmlFor="social">Rede social</label><input id="social" type="url" value={fields.socialUrl} onChange={event => change("socialUrl", event.target.value)} maxLength={500} placeholder="https://exemplo.com/perfil" disabled={busy || uncertain} />
      <button disabled={busy || uncertain}>{busy ? "Salvando…" : "Salvar perfil"}</button>
    </form>{message && <p role={uncertain ? "alert" : "status"}>{message}</p>}{uncertain && <button onClick={() => void load()}>Recarregar perfil</button>}</>}
    
  </section></main>;
}
