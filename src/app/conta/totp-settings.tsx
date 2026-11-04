"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authenticatedFetchForSubject, invalidateSessionForSubject } from "@/lib/session-client";
import styles from "./account.module.css";

type Step = "idle" | "setup" | "disable" | "done";
type Setup = { secret: string; otpauthUri: string };

// The API does not expose whether TOTP is enabled; the server answers 409 when it already is.
export default function TotpSettings({ userId }: { userId: string }) {
  const [step, setStep] = useState<Step>("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState("");

  function reset(next: Step) { setStep(next); setPassword(""); setCode(""); setSetup(null); setMessage(""); }
  async function call(path: string, body: object) {
    return authenticatedFetchForSubject(userId, `/api/v1/auth/totp/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  }
  function failure(status: number): string {
    if (status === 401) return "Senha ou código inválidos, ou sessão expirada.";
    if (status === 400) return "Confira os dados. O código tem 6 dígitos e a configuração expira em 10 minutos.";
    if (status === 409) return "A verificação em duas etapas já está ativada nesta conta.";
    if (status === 429) return "Muitas tentativas. Aguarde um minuto.";
    if (status === 503) return "Recurso indisponível no servidor no momento.";
    return "Não foi possível concluir a operação. Tente novamente.";
  }
  async function start(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage("");
    try {
      const response = await call("setup", { password }); setPassword("");
      if (!response.ok) { setMessage(failure(response.status)); return; }
      const value: unknown = await response.json();
      if (!value || typeof value !== "object" || !("secret" in value) || typeof value.secret !== "string" || !("otpauthUri" in value) || typeof value.otpauthUri !== "string") throw new Error();
      setSetup({ secret: value.secret, otpauthUri: value.otpauthUri });
    } catch { setMessage("Não foi possível iniciar a configuração. Tente novamente."); }
    finally { setBusy(false); }
  }
  async function finish(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage("");
    try {
      const response = await call("enable", { code }); setCode("");
      if (!response.ok) { setMessage(failure(response.status)); return; }
      await invalidateSessionForSubject(userId).catch(() => false);
      setDone("Verificação em duas etapas ativada. Por segurança, todas as sessões foram encerradas: entre novamente."); setStep("done"); setSetup(null);
    } catch { setMessage("Não foi possível confirmar a ativação. Tente novamente."); }
    finally { setBusy(false); }
  }
  async function disable(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage("");
    try {
      const response = await call("disable", { password, code }); setPassword(""); setCode("");
      if (!response.ok) { setMessage(response.status === 401 ? "Senha ou código inválidos, ou a verificação em duas etapas não está ativada." : failure(response.status)); return; }
      await invalidateSessionForSubject(userId).catch(() => false);
      setDone("Verificação em duas etapas desativada. Por segurança, todas as sessões foram encerradas: entre novamente."); setStep("done");
    } catch { setMessage("Não foi possível confirmar a desativação. Tente novamente."); }
    finally { setBusy(false); }
  }
  const codeInput = <><label htmlFor="totp-code">Código de 6 dígitos</label><input id="totp-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={busy} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} /></>;
  const passwordInput = <><label htmlFor="totp-password">Senha atual</label><input id="totp-password" type="password" autoComplete="current-password" required maxLength={72} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></>;
  return <div className={styles.totp}>
    <p className={styles.muted}>Adicione uma camada extra de segurança com um aplicativo autenticador. Depois de ativar, o login passará a pedir o código.</p>
    {step === "idle" && <div className={styles.actions}><button className={styles.primary} onClick={() => reset("setup")}>Ativar verificação em duas etapas</button><button className={styles.secondary} onClick={() => reset("disable")}>Desativar</button></div>}
    {step === "setup" && !setup && <form className={styles.stack} onSubmit={start}>{passwordInput}<div className={styles.actions}><button className={styles.primary} disabled={busy}>{busy ? "Gerando…" : "Continuar"}</button><button type="button" className={styles.secondary} onClick={() => reset("idle")} disabled={busy}>Cancelar</button></div></form>}
    {step === "setup" && setup && <form className={styles.stack} onSubmit={finish}>
      <p>1. No aplicativo autenticador, adicione uma conta manualmente com esta chave:</p><code className={styles.secret}>{setup.secret}</code>
      <p className={styles.muted}>Ou, no celular, abra o <a href={setup.otpauthUri}>link de configuração</a>. A chave expira em 10 minutos.</p>
      <p>2. Informe o código gerado para confirmar:</p>{codeInput}
      <div className={styles.actions}><button className={styles.primary} disabled={busy}>{busy ? "Confirmando…" : "Confirmar e ativar"}</button><button type="button" className={styles.secondary} onClick={() => reset("idle")} disabled={busy}>Cancelar</button></div></form>}
    {step === "disable" && <form className={styles.stack} onSubmit={disable}>{passwordInput}{codeInput}<div className={styles.actions}><button className={styles.danger} disabled={busy}>{busy ? "Desativando…" : "Desativar verificação"}</button><button type="button" className={styles.secondary} onClick={() => reset("idle")} disabled={busy}>Cancelar</button></div></form>}
    {step === "done" && <><p role="status" className={styles.success}>{done}</p><Link className={styles.primary} href="/entrar">Entrar novamente</Link></>}
    {message && <p role="alert" className={styles.error}>{message}</p>}
  </div>;
}