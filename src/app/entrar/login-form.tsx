"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { login } from "@/lib/session-client";
import styles from "./session.module.css";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { await login(email.trim(), password, code); setPassword(""); router.push("/conta"); }
    catch (error) { setPassword(""); setMessage(error instanceof Error ? error.message : "Não foi possível entrar agora."); }
    finally { setBusy(false); }
  }
  return <main className={styles.page}><header><Link href="/" className={styles.brand}>✳ entrelinhas.</Link></header><div className={styles.card}>
    <p className={styles.eyebrow}>BEM-VINDO DE VOLTA</p><h1>Entre na sua conta.</h1><p>Continue acompanhando as histórias que importam para você.</p>
    <form onSubmit={submit} className={styles.form}>
      <label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" required maxLength={255} value={email} onChange={event => setEmail(event.target.value)} />
      <label htmlFor="password">Senha</label><input id="password" type="password" autoComplete="current-password" required maxLength={72} value={password} onChange={event => setPassword(event.target.value)} />
      <label htmlFor="code">Código do autenticador <span>(se ativado)</span></label><input id="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value)} />
      {message && <p role="alert" className={styles.error}>{message}</p>}
      <button disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
    </form><nav aria-label="Opções da conta"><Link className={styles.back} href="/cadastro">Criar conta</Link>{" · "}<Link className={styles.back} href="/recuperar-senha">Esqueci minha senha</Link></nav><p><Link className={styles.back} href="/">← Voltar ao início</Link></p>
  </div></main>;
}
