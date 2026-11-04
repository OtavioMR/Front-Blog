"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { login } from "@/lib/session-client";
import styles from "./session.module.css";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [useCode, setUseCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (useCode && !/^\d{6}$/.test(code.trim())) { setMessage("Informe o código de 6 dígitos do autenticador."); codeRef.current?.focus(); return; }
    setBusy(true); setMessage("");
    try {
      await login(email.trim(), password, useCode ? code.trim() : "");
      setPassword(""); setCode(""); router.push("/conta");
    } catch (error) {
      setPassword(""); setCode("");
      setMessage(error instanceof Error ? error.message : "Não foi possível entrar agora.");
    }
    finally { setBusy(false); }
  }
  return <main className={styles.page}><div className={styles.card}>
    <p className={styles.eyebrow}>BEM-VINDO DE VOLTA</p><h1>Entre na sua conta.</h1><p>Continue acompanhando as histórias que importam para você.</p>
    <form onSubmit={submit} className={styles.form} aria-busy={busy}>
      <label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" required maxLength={255} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} />
      <label htmlFor="password">Senha</label>
      <div className={styles.passwordRow}><input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required maxLength={72} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /><button type="button" className={styles.ghost} onClick={() => setShowPassword(value => !value)} aria-pressed={showPassword}>{showPassword ? "Ocultar" : "Mostrar"}</button></div>
      {useCode && <><label htmlFor="code">Código do autenticador</label><input id="code" ref={codeRef} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={busy} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} autoFocus /></>}
      {message && <p role="alert" className={styles.error}>{message}</p>}
      <button disabled={busy}>{busy ? "Entrando…" : useCode ? "Verificar e entrar" : "Entrar"}</button>
      <button type="button" className={styles.ghost} onClick={() => { setUseCode(value => !value); setCode(""); setMessage(""); }} disabled={busy}>{useCode ? "Minha conta não usa autenticador" : "Minha conta usa autenticador (2FA)"}</button>
    </form><nav aria-label="Opções da conta"><Link className={styles.back} href="/cadastro">Criar conta</Link>{" · "}<Link className={styles.back} href="/recuperar-senha">Esqueci minha senha</Link></nav><p><Link className={styles.back} href="/">← Voltar ao início</Link></p>
  </div></main>;
}