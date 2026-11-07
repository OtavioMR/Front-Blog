"use client";

import { useRef, useState } from "react";
import styles from "./entrar.module.css";

const messages: Record<number, string> = {
  400: "Confira os dados informados e tente novamente.",
  401: "E-mail, senha ou código do autenticador inválidos.",
  403: "Esta conta não possui acesso administrativo.",
  429: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
};

export function LoginForm({ csrf }: { csrf: string }) {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setPending(true); setMessage("");
    const form = event.currentTarget;
    const data = new URLSearchParams();
    new FormData(form).forEach((value, key) => { if (typeof value === "string") data.set(key, value); });
    try {
      const response = await fetch("/gestao-editorial/entrar/sessao", { method: "POST", body: data, redirect: "manual", cache: "no-store" });
      if (response.type === "opaqueredirect" || response.status === 303) { window.location.assign("/gestao-editorial"); return; }
      (form.elements.namedItem("password") as HTMLInputElement).value = "";
      (form.elements.namedItem("totpCode") as HTMLInputElement).value = "";
      setMessage(messages[response.status] ?? "Não foi possível confirmar a entrada agora. Tente novamente.");
    } catch {
      setMessage("Não foi possível confirmar a entrada agora. Tente novamente.");
    } finally { busy.current = false; setPending(false); }
  }

  return (
    <form className={styles.form} method="post" action="/gestao-editorial/entrar/sessao" onSubmit={submit} noValidate={false}>
      <input type="hidden" name="csrf" value={csrf} />
      <label className={styles.field}>E-mail
        <input className={styles.input} name="email" type="email" required maxLength={255} autoComplete="username" disabled={pending} />
      </label>
      <label className={styles.field}>Senha
        <input className={styles.input} name="password" type="password" required maxLength={72} autoComplete="current-password" disabled={pending} />
      </label>
      <label className={styles.field}>Código do autenticador <span className={styles.hint}>(se ativado)</span>
        <input className={styles.input} name="totpCode" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" disabled={pending} />
      </label>
      <button type="submit" className={styles.submit} disabled={pending || !csrf}>{pending ? "Verificando…" : "Entrar"}</button>
      <p className={styles.error} role="alert" aria-live="assertive">{message}</p>
    </form>
  );
}
