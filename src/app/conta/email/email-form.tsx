"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import BackButton from "@/app/_components/back-button";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
import { emailPayload, requestEmailChange } from "./contracts";
import styles from "../senha/password.module.css";

type Status = "loading" | "ready" | "signed-out" | "error" | "requested" | "uncertain";

export default function EmailForm() {
  const [status, setStatus] = useState<Status>("loading");
  const [id, setId] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const revision = useRef(0);
  const load = useCallback(async () => {
    const current = ++revision.current;
    setStatus("loading"); setId(""); setCurrentEmail(""); setEmail(""); setPassword(""); setMessage("");
    try {
      const profile = await getOwnProfile();
      if (current !== revision.current) return;
      if (!profile) { setStatus("signed-out"); return; }
      setId(profile.id); setCurrentEmail(profile.email); setStatus("ready");
    } catch { if (current === revision.current) setStatus("error"); }
  }, []);
  useEffect(() => {
    let active = true;
    const generation = revision;
    const unsubscribe = subscribeSession(() => { void load(); });
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; generation.current++; unsubscribe(); };
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || busy || status !== "ready") return;
    let payload: ReturnType<typeof emailPayload>;
    try { payload = emailPayload(email, password, currentEmail); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Confira os campos."); return; }
    const current = revision.current;
    setBusy(true); setMessage("");
    const result = await requestEmailChange(authenticatedFetchForSubject, id, payload);
    setPassword("");
    if (current === revision.current) {
      if (result === "requested") setStatus("requested");
      else if (result === "uncertain") setStatus("uncertain");
      else if (result === "conflict") { setStatus("uncertain"); setMessage("O endereço pode já estar em uso ou a conta pode ter mudado. Verifique sua sessão e o endereço antes de tentar novamente."); }
      else if (result === "unauthorized") setMessage("Senha atual incorreta ou sessão expirada. Confira a senha ou entre novamente.");
      else if (result === "forbidden") setMessage("Esta conta não pode solicitar a alteração.");
      else setMessage("Confira os dados informados e tente novamente.");
    }
    setBusy(false);
  }

  return <main className={styles.page}><section className={styles.content}>
    <BackButton fallback="/conta" /><p className={styles.eyebrow}>SEGURANÇA DA CONTA</p><h1>Alterar e-mail.</h1>
    {status === "loading" && <p role="status">Verificando sua sessão…</p>}
    {status === "signed-out" && <><p>Entre novamente para alterar seu e-mail.</p><Link className={styles.link} href="/entrar">Entrar</Link></>}
    {status === "error" && <><p role="alert">Não foi possível verificar sua conta.</p><button type="button" onClick={() => void load()}>Tentar novamente</button></>}
    {status === "requested" && <><p role="status">Solicitação enviada. Confira a caixa de entrada do novo endereço e cole o código recebido em até 30 minutos. Seu e-mail atual permanece válido até a confirmação, que encerra suas sessões.</p><Link className={styles.link} href="/confirmar-email?type=email-change">Confirmar novo e-mail</Link></>}
    {status === "uncertain" && <><p role="alert">{message || "Não foi possível confirmar a solicitação. Verifique a caixa de entrada do novo endereço antes de tentar novamente; não enviaremos outra solicitação automaticamente."}</p><button type="button" onClick={() => void load()}>Verificar conta e começar novamente</button></>}
    {status === "ready" && <><p>E-mail atual: <strong>{currentEmail}</strong>. Enviaremos um código para o novo endereço; a alteração só será concluída após a confirmação, que encerra suas sessões.</p><form onSubmit={submit} className={styles.form}>
      <label htmlFor="new-email">Novo e-mail</label><input id="new-email" type="email" autoComplete="email" required maxLength={255} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
      <label htmlFor="current-password">Senha atual</label><input id="current-password" type="password" autoComplete="current-password" required maxLength={72} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
      {message && <p role="alert">{message}</p>}<button disabled={busy}>{busy ? "Enviando…" : "Enviar código de confirmação"}</button>
    </form></>}
  </section></main>;
}
