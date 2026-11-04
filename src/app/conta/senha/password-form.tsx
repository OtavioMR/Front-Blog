"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { authenticatedFetchForSubject, getOwnProfile, invalidateSessionForSubject, subscribeSession } from "@/lib/session-client";
import { passwordPayload } from "./contracts";
import styles from "./password.module.css";

type Status = "loading" | "ready" | "signed-out" | "error" | "changed" | "uncertain";

export default function PasswordForm() {
  const [status, setStatus] = useState<Status>("loading");
  const [id, setId] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const revision = useRef(0);
  const clear = useCallback(() => { setCurrentPassword(""); setPassword(""); setConfirmation(""); }, []);
  const load = useCallback(async () => {
    const current = ++revision.current;
    setStatus("loading"); setId(""); clear(); setMessage("");
    try {
      const profile = await getOwnProfile();
      if (current !== revision.current) return;
      if (!profile) { setStatus("signed-out"); return; }
      setId(profile.id); setStatus("ready");
    } catch { if (current === revision.current) setStatus("error"); }
  }, [clear]);
  useEffect(() => {
    let active = true;
    const generation = revision;
    const unsubscribe = subscribeSession(() => { void load(); });
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; generation.current++; unsubscribe(); };
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || busy) return;
    let payload: ReturnType<typeof passwordPayload>;
    try { payload = passwordPayload(currentPassword, password, confirmation); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Confira os campos."); return; }
    const current = revision.current;
    setBusy(true); setMessage("");
    try {
      const response = await authenticatedFetchForSubject(id, `/api/v1/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
      if (current !== revision.current) return;
      clear();
      if (response.status === 401) { setMessage("Senha atual incorreta ou sessão expirada. Confira a senha ou entre novamente."); return; }
      if (response.status === 400) { setMessage("Confira os dados e tente novamente."); return; }
      if (response.status === 403) { setMessage("Esta conta não pode alterar a senha."); return; }
      if (response.status === 409) { setStatus("signed-out"); return; }
      if (!response.ok) throw new Error();
      await invalidateSessionForSubject(id).catch(() => false);
      if (current === revision.current) setStatus("changed");
    } catch {
      clear();
      await invalidateSessionForSubject(id).catch(() => {});
      if (current === revision.current) setStatus("uncertain");
    } finally { setBusy(false); }
  }

  return <main className={styles.page}><header className={styles.header}><Link className={styles.brand} href="/">✳ entrelinhas.</Link><Link href="/conta">Minha conta</Link></header><section className={styles.content}>
    <p className={styles.eyebrow}>SEGURANÇA DA CONTA</p><h1>Alterar senha.</h1>
    {status === "loading" && <p role="status">Verificando sua sessão…</p>}
    {status === "signed-out" && <><p>Entre novamente para alterar sua senha.</p><Link className={styles.link} href="/entrar">Entrar</Link></>}
    {status === "error" && <><p role="alert">Não foi possível verificar sua conta.</p><button onClick={() => void load()}>Tentar novamente</button></>}
    {status === "changed" && <><p role="status">Senha alterada. Entre novamente com a nova senha; suas sessões anteriores foram invalidadas.</p><Link className={styles.link} href="/entrar">Entrar novamente</Link></>}
    {status === "uncertain" && <><p role="alert">Não foi possível confirmar se a senha foi alterada. Entre novamente para verificar; não enviamos outra tentativa automaticamente.</p><Link className={styles.link} href="/entrar">Entrar novamente</Link></>}
    {status === "ready" && <><p>A mudança encerra suas sessões atuais. Você precisará entrar novamente.</p><form onSubmit={submit} className={styles.form}>
      <label htmlFor="current-password">Senha atual</label><input id="current-password" type="password" autoComplete="current-password" required maxLength={72} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={busy} />
      <label htmlFor="new-password">Nova senha</label><input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
      <label htmlFor="confirm-password">Confirme a nova senha</label><input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} />
      {message && <p role="alert">{message}</p>}<button disabled={busy}>{busy ? "Salvando…" : "Alterar senha"}</button>
    </form></>}
    <Link className={styles.link} href="/conta">← Voltar para minha conta</Link>
  </section></main>;
}
