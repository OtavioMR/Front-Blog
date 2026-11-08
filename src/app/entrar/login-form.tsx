"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { login, verify2fa } from "@/lib/session-client";
import styles from "./session.module.css";

export default function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "2fa">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [preAuthToken, setPreAuthToken] = useState("");
  const [isRecoveryCode, setIsRecoveryCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await login(email.trim(), password);
      if (result && "requires2fa" in result && result.requires2fa) {
        setPreAuthToken(result.preAuthToken);
        setStep("2fa");
        setPassword("");
        setCode("");
        setTimeout(() => codeRef.current?.focus(), 100);
      } else {
        setPassword("");
        router.push("/conta");
      }
    } catch (error) {
      setPassword("");
      setMessage(error instanceof Error ? error.message : "Não foi possível entrar agora.");
    } finally {
      setBusy(false);
    }
  }

  async function submit2fa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const cleanCode = code.trim();
    if (!isRecoveryCode && !/^\d{6}$/.test(cleanCode)) {
      setMessage("Informe o código de 6 dígitos do Google Authenticator.");
      codeRef.current?.focus();
      return;
    }
    if (isRecoveryCode && cleanCode.length < 8) {
      setMessage("Informe um código de recuperação válido.");
      codeRef.current?.focus();
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await verify2fa(preAuthToken, cleanCode);
      setCode("");
      router.push("/conta");
    } catch (error) {
      setCode("");
      setMessage(error instanceof Error ? error.message : "Código de autenticação inválido ou expirado.");
    } finally {
      setBusy(false);
    }
  }

  function backToCredentials() {
    setStep("credentials");
    setPreAuthToken("");
    setCode("");
    setIsRecoveryCode(false);
    setMessage("");
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        {step === "credentials" ? (
          <>
            <p className={styles.eyebrow}>BEM-VINDO DE VOLTA</p>
            <h1>Entre na sua conta.</h1>
            <p>Continue acompanhando as histórias que importam para você.</p>
            <form onSubmit={submitCredentials} className={styles.form} aria-busy={busy}>
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                maxLength={255}
                value={email}
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
              />
              <label htmlFor="password">Senha</label>
              <div className={styles.passwordRow}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  maxLength={72}
                  value={password}
                  disabled={busy}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              {message && <p role="alert" className={styles.error}>{message}</p>}
              <button disabled={busy} type="submit">{busy ? "Verificando…" : "Entrar"}</button>
            </form>
            <nav aria-label="Opções da conta">
              <Link className={styles.back} href="/cadastro">Criar conta</Link>
              {" · "}
              <Link className={styles.back} href="/recuperar-senha">Esqueci minha senha</Link>
            </nav>
            <p><Link className={styles.back} href="/">← Voltar ao início</Link></p>
          </>
        ) : (
          <>
            <p className={styles.eyebrow}>VERIFICAÇÃO DE SEGURANÇA</p>
            <h1>{isRecoveryCode ? "Código de recuperação." : "Autenticação em duas etapas."}</h1>
            <p>
              {isRecoveryCode
                ? "Digite um dos seus códigos de recuperação de uso único gerados durante a ativação do 2FA."
                : "Abra o Google Authenticator e informe o código temporário de 6 dígitos gerado para o Grifório."}
            </p>
            <form onSubmit={submit2fa} className={styles.form} aria-busy={busy}>
              <label htmlFor="code">
                {isRecoveryCode ? "Código de recuperação" : "Código do autenticador (6 dígitos)"}
              </label>
              <input
                id="code"
                ref={codeRef}
                type="text"
                inputMode={isRecoveryCode ? "text" : "numeric"}
                autoComplete={isRecoveryCode ? "off" : "one-time-code"}
                pattern={isRecoveryCode ? "[a-zA-Z0-9-]+" : "[0-9]{6}"}
                maxLength={isRecoveryCode ? 16 : 6}
                required
                value={code}
                disabled={busy}
                placeholder={isRecoveryCode ? "ex: 12ab-c3d4" : "000000"}
                onChange={(event) => {
                  const val = event.target.value;
                  setCode(isRecoveryCode ? val.trim() : val.replace(/\D/g, ""));
                }}
                autoFocus
              />
              {message && <p role="alert" className={styles.error}>{message}</p>}
              <button disabled={busy} type="submit">{busy ? "Verificando…" : "Verificar e entrar"}</button>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => {
                  setIsRecoveryCode((v) => !v);
                  setCode("");
                  setMessage("");
                  setTimeout(() => codeRef.current?.focus(), 50);
                }}
                disabled={busy}
              >
                {isRecoveryCode ? "Usar código do Google Authenticator" : "Usar código de recuperação"}
              </button>
              <Link className={styles.back} href="/recuperar-autenticador">Perdi o autenticador e os códigos de recuperação</Link>
              <button
                type="button"
                className={styles.ghost}
                onClick={backToCredentials}
                disabled={busy}
              >
                ← Entrar com outra conta
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
