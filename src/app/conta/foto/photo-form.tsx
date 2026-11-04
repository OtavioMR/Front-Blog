"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
import { uploadPhoto } from "./photo-upload";
import styles from "../perfil/profile.module.css";

type State = "loading" | "ready" | "signed-out" | "error";

export default function PhotoForm() {
  const [state, setState] = useState<State>("loading");
  const [subject, setSubject] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const revision = useRef(0);
  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const current = ++revision.current;
    setState("loading"); setSubject(""); setFile(null); setMessage("");
    if (input.current) input.current.value = "";
    try {
      const profile = await getOwnProfile();
      if (current !== revision.current) return;
      if (!profile) { setState("signed-out"); return; }
      setSubject(profile.id); setUncertain(false); setState("ready");
    } catch { if (current === revision.current) setState("error"); }
  }, []);

  useEffect(() => {
    let active = true;
    const generation = revision;
    const unsubscribe = subscribeSession(() => { void load(); });
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; generation.current++; unsubscribe(); };
  }, [load]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !subject || !file || uncertain) return;
    const current = revision.current;
    pending.current = true; setBusy(true); setMessage("");
    try {
      const result = await uploadPhoto(subject, file, authenticatedFetchForSubject);
      if (current !== revision.current) return;
      if (result.kind === "signed-out") { setState("signed-out"); return; }
      if (result.kind === "account-changed") { void load(); return; }
      if (result.kind === "invalid") { setMessage(result.message); return; }
      if (result.kind === "uncertain") throw new Error();
      setFile(null);
      if (input.current) input.current.value = "";
      setMessage("Foto atualizada. Ela pode aparecer no seu perfil público.");
    } catch {
      if (current === revision.current) {
        setUncertain(true);
        setMessage("Não foi possível confirmar o envio. Recarregue seu perfil antes de tentar novamente.");
      }
    } finally { pending.current = false; setBusy(false); }
  }

  return <main className={styles.page}><header className={styles.header}><Link className={styles.brand} href="/">✳ entrelinhas.</Link><Link href="/conta">Minha conta</Link></header><section className={styles.content}>
    <p className={styles.eyebrow}>SEU ESPAÇO</p><h1>Foto de perfil.</h1>
    {state === "loading" && <p role="status">Carregando sua conta…</p>}
    {state === "signed-out" && <p>Entre novamente para atualizar sua foto. <Link href="/entrar">Entrar</Link></p>}
    {state === "error" && <><p role="alert">Não foi possível carregar sua conta.</p><button onClick={() => void load()}>Tentar novamente</button></>}
    {state === "ready" && <><p>Escolha uma imagem JPEG, PNG ou WebP de até 5 MiB. Sua foto pode aparecer publicamente.</p>
      <form className={styles.form} onSubmit={upload}><label htmlFor="photo">Imagem</label>
        <input ref={input} id="photo" type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy || uncertain} onChange={event => setFile(event.target.files?.[0] || null)} />
        <button disabled={busy || uncertain || !file}>{busy ? "Enviando…" : "Atualizar foto"}</button>
      </form>
      {message && <p role={uncertain ? "alert" : "status"}>{message}</p>}
      {uncertain && <button onClick={() => void load()}>Recarregar conta</button>}
    </>}
    <p><Link className={styles.link} href="/conta">← Voltar para minha conta</Link></p>
  </section></main>;
}
