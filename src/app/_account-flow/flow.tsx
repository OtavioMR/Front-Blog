"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import styles from "./flow.module.css";

type Mode = "register" | "confirm" | "resend" | "forgot" | "reset";
const config: Record<Mode, { title: string; description: string; button: string; endpoint: string }> = {
  register: { title: "Crie sua conta.", description: "Faça parte de um espaço para boas leituras.", button: "Criar conta", endpoint: "/users" },
  confirm: { title: "Confirme seu e-mail.", description: "Cole o código recebido no e-mail de cadastro. Ele é válido por 24 horas.", button: "Confirmar e-mail", endpoint: "/users/confirm-email" },
  resend: { title: "Receba um novo código.", description: "Solicite novamente o código de confirmação do cadastro.", button: "Enviar instruções", endpoint: "/users/resend-verification" },
  forgot: { title: "Recupere sua senha.", description: "Informe seu e-mail para receber as instruções de recuperação.", button: "Enviar instruções", endpoint: "/auth/forgot-password" },
  reset: { title: "Escolha uma nova senha.", description: "O link recebido por e-mail é válido por 30 minutos.", button: "Redefinir senha", endpoint: "/auth/reset-password" },
};

export default function AccountFlow({ mode }: { mode: Mode }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    if (mode !== "reset" && mode !== "confirm") return;
    const url = new URL(window.location.href);
    const value = url.searchParams.get("token");
    if (value !== null) {
      url.searchParams.delete("token");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      // Read the browser-only URL after hydration, then remove the secret from the address bar.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(value);
    }
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const get = (key: string) => String(data.get(key) || "");
    const password = get("password");
    if ((mode === "register" || mode === "reset") && (new TextEncoder().encode(password).length > 72 || password !== get("passwordConfirmation"))) {
      setMessage("As senhas devem coincidir e ter no máximo 72 bytes em UTF-8."); return;
    }
    if (mode === "confirm" && !/^[a-f0-9]{64}$/.test(token.trim())) { setMessage("Informe o código hexadecimal completo recebido por e-mail."); return; }
    if (mode === "reset" && !token.trim()) { setMessage("O código de recuperação está ausente. Solicite um novo link."); return; }
    const payload = mode === "register" ? { name: get("name").trim(), email: get("email").trim(), password }
      : mode === "confirm" ? { token: token.trim() }
      : mode === "reset" ? { token: token.trim(), newPassword: password }
      : { email: get("email").trim() };
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/v1${config[mode].endpoint}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload), cache: "no-store", credentials: "omit" });
      if (!response.ok) {
        if (response.status === 429) setMessage("Muitas tentativas. Aguarde um pouco e tente novamente.");
        else if (response.status === 409 && mode === "register") setMessage("Não foi possível criar a conta com esse e-mail. Verifique os dados ou recupere sua senha.");
        else if (response.status === 400 && (mode === "confirm" || mode === "reset")) setMessage("Código inválido ou expirado. Solicite um novo e tente novamente.");
        else if (response.status === 400) setMessage("Confira os dados informados e tente novamente.");
        else setMessage("Não foi possível concluir agora. Tente novamente em instantes.");
        return;
      }
      setToken(""); setSuccess(true);
      setMessage(mode === "register" ? "Conta criada. Confira seu e-mail para obter o código de confirmação." : mode === "confirm" ? "E-mail confirmado com sucesso." : mode === "reset" ? "Senha redefinida com sucesso." : "Se houver uma conta elegível para este e-mail, as instruções serão enviadas.");
    } catch { setMessage("Não foi possível conectar ao serviço. Tente novamente em instantes."); }
    finally { setBusy(false); }
  }

  const info = config[mode];
  return <main className={styles.page}><header className={styles.header}><Link className={styles.brand} href="/">✳ entrelinhas.</Link><Link className={styles.back} href="/">← Voltar ao início</Link></header><section className={styles.panel}><p className={styles.eyebrow}>Sua conta</p><h1>{info.title}</h1><p className={styles.description}>{info.description}</p>
    {message && <p className={styles.message} role={success ? "status" : "alert"}>{message}</p>}
    {!success && <form className={styles.form} method="post" onSubmit={submit}>
      {mode === "register" && <label className={styles.field}>Nome<input name="name" autoComplete="name" minLength={2} maxLength={100} required /></label>}
      {(mode === "register" || mode === "resend" || mode === "forgot") && <label className={styles.field}>E-mail<input name="email" type="email" autoComplete="email" maxLength={255} required /></label>}
      {mode === "confirm" && <label className={styles.field}>Código de confirmação<input value={token} onChange={event => setToken(event.target.value)} autoComplete="off" spellCheck={false} maxLength={64} required /></label>}
      {(mode === "register" || mode === "reset") && <><label className={styles.field}>Senha<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} aria-describedby="password-hint" required /><span className={styles.hint} id="password-hint">Pelo menos 8 caracteres e até 72 bytes em UTF-8.</span></label><label className={styles.field}>Confirme a senha<input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /></label></>}
      <button type="submit" disabled={busy}>{busy ? "Enviando…" : info.button}</button>
    </form>}
    <nav className={styles.links} aria-label="Ajuda com a conta"><Link href="/entrar">Entrar</Link>{mode !== "confirm" && <Link href="/confirmar-email">Confirmar e-mail</Link>}{mode !== "resend" && <Link href="/reenviar-verificacao">Reenviar código</Link>}{mode !== "forgot" && <Link href="/recuperar-senha">Recuperar senha</Link>}</nav>
  </section></main>;
}
