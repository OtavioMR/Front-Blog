"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authenticatedFetchForSubject, invalidateSessionForSubject } from "@/lib/session-client";
import styles from "./account.module.css";

type Step = "idle" | "setup_password" | "setup_qr" | "recovery_codes" | "disable" | "regen_codes" | "done";
type SetupData = { secret: string; otpauthUri: string; qrCode: string };

function formatKeyChunks(raw: string): string {
  return raw.replace(/(.{4})/g, "$1 ").trim();
}

export default function TotpSettings({ userId, initialTotpEnabled = false }: { userId: string; initialTotpEnabled?: boolean }) {
  const [step, setStep] = useState<Step>("idle");
  const [totpEnabled, setTotpEnabled] = useState(initialTotpEnabled);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showKey, setShowKey] = useState(true);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState("");

  function reset(next: Step) {
    setStep(next);
    setPassword("");
    setCode("");
    setMessage("");
    setCopiedKey(false);
    setCopiedCodes(false);
  }

  async function call(path: string, body: object) {
    return authenticatedFetchForSubject(userId, `/api/v1/auth/totp/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  }

  function failure(status: number): string {
    if (status === 401) return "Senha ou código inválidos, ou sessão expirada.";
    if (status === 400) return "Confira os dados informados. O código deve conter 6 dígitos do autenticador ou o formato de recuperação (ex: xxxx-xxxx).";
    if (status === 403) return "Contas com privilégios administrativos são obrigadas a manter a autenticação de dois fatores ativa.";
    if (status === 409) return "A autenticação em dois fatores já está ativada nesta conta.";
    if (status === 429) return "Muitas tentativas. Aguarde um minuto e tente novamente.";
    if (status === 503) return "Recurso indisponível no servidor no momento.";
    return "Não foi possível concluir a operação. Tente novamente.";
  }

  async function startSetup(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await call("setup", { password });
      setPassword("");
      if (!response.ok) {
        setMessage(failure(response.status));
        return;
      }
      const value: unknown = await response.json();
      if (
        !value ||
        typeof value !== "object" ||
        !("secret" in value) ||
        typeof value.secret !== "string" ||
        !("otpauthUri" in value) ||
        typeof value.otpauthUri !== "string" ||
        !("qrCode" in value) ||
        typeof value.qrCode !== "string"
      ) {
        throw new Error();
      }
      setSetup({ secret: value.secret, otpauthUri: value.otpauthUri, qrCode: value.qrCode });
      setStep("setup_qr");
    } catch {
      setMessage("Não foi possível iniciar a configuração. Confira sua senha e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function finishSetup(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await call("enable", { code });
      setCode("");
      if (!response.ok) {
        setMessage(failure(response.status));
        return;
      }
      const value: unknown = await response.json();
      const codes = value && typeof value === "object" && "recoveryCodes" in value && Array.isArray(value.recoveryCodes)
        ? (value.recoveryCodes as string[])
        : [];
      setRecoveryCodes(codes);
      setTotpEnabled(true);
      setStep("recovery_codes");
      await invalidateSessionForSubject(userId).catch(() => false);
    } catch {
      setMessage("Não foi possível confirmar o código. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await call("disable", { password, code: code.trim() });
      setPassword("");
      setCode("");
      if (!response.ok) {
        setMessage(failure(response.status));
        return;
      }
      setTotpEnabled(false);
      setDone("Autenticação em dois fatores desativada com sucesso. Por segurança, suas sessões foram encerradas.");
      setStep("done");
      await invalidateSessionForSubject(userId).catch(() => false);
    } catch {
      setMessage("Não foi possível confirmar a desativação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerateCodes(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await call("recovery-codes", { password, code });
      setPassword("");
      setCode("");
      if (!response.ok) {
        setMessage(failure(response.status));
        return;
      }
      const value: unknown = await response.json();
      const codes = value && typeof value === "object" && "recoveryCodes" in value && Array.isArray(value.recoveryCodes)
        ? (value.recoveryCodes as string[])
        : [];
      setRecoveryCodes(codes);
      setStep("recovery_codes");
    } catch {
      setMessage("Não foi possível gerar novos códigos de recuperação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function copyManualKey() {
    if (!setup?.secret) return;
    navigator.clipboard.writeText(setup.secret).then(() => {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    });
  }

  function copyAllCodes() {
    if (!recoveryCodes.length) return;
    navigator.clipboard.writeText(recoveryCodes.join("\n")).then(() => {
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2500);
    });
  }

  function downloadCodes() {
    if (!recoveryCodes.length) return;
    const text = `CÓDIGOS DE RECUPERAÇÃO - GRIFÓRIO\nData: ${new Date().toLocaleDateString("pt-BR")}\nConta: ${userId}\n\nCada código só pode ser usado uma vez:\n\n${recoveryCodes.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nGuarde este arquivo em um local seguro.`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `codigos-recuperacao-griforio.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const codeInput = (
    <>
      <label htmlFor="totp-code">Código de 6 dígitos do Google Authenticator</label>
      <input
        id="totp-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        placeholder="000000"
        value={code}
        disabled={busy}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        autoFocus
      />
    </>
  );

  const passwordInput = (
    <>
      <label htmlFor="totp-password">Senha atual para confirmar sua identidade</label>
      <input
        id="totp-password"
        type="password"
        autoComplete="current-password"
        required
        maxLength={72}
        value={password}
        disabled={busy}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
      />
    </>
  );

  return (
    <div className={styles.totp}>
      <p className={styles.muted}>
        Adicione uma camada extra de segurança com o <strong>Google Authenticator</strong>. Após ativar, o acesso à sua conta e operações críticas exigirão o código temporário de 6 dígitos.
      </p>

      {step === "idle" && (
        <div>
          {totpEnabled && (
            <div style={{ marginBottom: "1rem" }}>
              <span className={styles.badgeOk}>Autenticação em dois fatores ativada</span>
            </div>
          )}
          <div className={styles.actions}>
            {!totpEnabled ? (
              <button className={styles.primary} onClick={() => reset("setup_password")}>
                Ativar autenticação de dois fatores
              </button>
            ) : (
              <>
                <button className={styles.secondary} onClick={() => reset("regen_codes")}>
                  Gerar novos códigos de recuperação
                </button>
                <button className={styles.danger} onClick={() => reset("disable")}>
                  Desativar 2FA
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {step === "setup_password" && (
        <form className={styles.stack} onSubmit={startSetup}>
          <h3>Proteja sua conta</h3>
          <p className={styles.muted}>Informe sua senha atual para gerar a chave e o QR Code de autenticação.</p>
          {passwordInput}
          <div className={styles.actions}>
            <button className={styles.primary} disabled={busy}>
              {busy ? "Gerando chave…" : "Continuar"}
            </button>
            <button type="button" className={styles.secondary} onClick={() => reset("idle")} disabled={busy}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {step === "setup_qr" && setup && (
        <form className={styles.stack} onSubmit={finishSetup} style={{ maxWidth: "560px" }}>
          <h3>Proteja sua conta</h3>
          <p className={styles.muted}>
            Cadastre a conta no <strong>Google Authenticator</strong> escolhendo uma das duas opções abaixo:
          </p>

          <div style={{ margin: "1rem 0" }}>
            <strong>Opção 1: Escanear o QR Code</strong>
            <p className={styles.muted} style={{ fontSize: "13px" }}>
              No aplicativo Google Authenticator, toque no botão <strong>+</strong> e selecione <strong>Escanear código QR</strong>.
            </p>
            <div className={styles.qrWrapper}>
              <div className={styles.qrCard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={setup.qrCode} alt="Código QR do Google Authenticator" className={styles.qrImg} />
              </div>
            </div>
          </div>

          <div className={styles.manualKeyBox}>
            <div className={styles.keyHeader}>
              <span>Opção 2: Inserir chave de configuração manualmente</span>
              <div className={styles.keyActions}>
                <button
                  type="button"
                  className={styles.btnMini}
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? "Ocultar" : "Mostrar"}
                </button>
                <button
                  type="button"
                  className={styles.btnMini}
                  onClick={copyManualKey}
                >
                  {copiedKey ? "Copiado!" : "Copiar chave"}
                </button>
              </div>
            </div>
            <div className={styles.keyDisplay}>
              <span className={styles.keyChunks}>
                {showKey ? formatKeyChunks(setup.secret) : "•••• •••• •••• •••• •••• •••• •••• ••••"}
              </span>
            </div>
            <span className={styles.muted} style={{ fontSize: "12px" }}>
              Tipo de chave: Baseada no tempo (TOTP) · Conta: Grifório
            </span>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <strong>Confirmação</strong>
            <p className={styles.muted} style={{ fontSize: "13px" }}>
              Digite o código de 6 dígitos exibido no aplicativo para validar e concluir a ativação:
            </p>
            {codeInput}
          </div>

          <div className={styles.actions}>
            <button className={styles.primary} disabled={busy || code.length !== 6}>
              {busy ? "Validando código…" : "Verificar e ativar"}
            </button>
            <button type="button" className={styles.secondary} onClick={() => reset("idle")} disabled={busy}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {step === "recovery_codes" && (
        <div className={styles.recoveryBox}>
          <h3>Códigos de recuperação de emergência</h3>
          <p className={styles.muted}>
            Se você perder o acesso ao seu aplicativo autenticador, poderá usar estes códigos de uso único para entrar na sua conta. <strong>Guarde-os em um local seguro</strong>, pois eles não serão exibidos novamente.
          </p>
          <div className={styles.recoveryGrid}>
            {recoveryCodes.map((c, i) => (
              <div key={i} className={styles.recoveryCode}>
                {c}
              </div>
            ))}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={copyAllCodes}>
              {copiedCodes ? "Códigos copiados!" : "Copiar todos os códigos"}
            </button>
            <button type="button" className={styles.secondary} onClick={downloadCodes}>
              Baixar códigos (.txt)
            </button>
            <button type="button" className={styles.primary} onClick={() => reset("idle")}>
              Concluir
            </button>
          </div>
        </div>
      )}

      {step === "disable" && (
        <form className={styles.stack} onSubmit={handleDisable}>
          <h3>Desativar autenticação de dois fatores</h3>
          <p className={styles.muted}>
            Para sua segurança, informe sua senha e o código de 6 dígitos atual ou um código de recuperação para confirmar a desativação.
          </p>
          {passwordInput}
          <label htmlFor="disable-code">Código atual do autenticador ou código de recuperação</label>
          <input
            id="disable-code"
            required
            placeholder="123456 ou xxxx-xxxx"
            value={code}
            disabled={busy}
            onChange={(e) => setCode(e.target.value.trim())}
          />
          <div className={styles.actions}>
            <button className={styles.danger} disabled={busy}>
              {busy ? "Desativando…" : "Confirmar e desativar"}
            </button>
            <button type="button" className={styles.secondary} onClick={() => reset("idle")} disabled={busy}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {step === "regen_codes" && (
        <form className={styles.stack} onSubmit={handleRegenerateCodes}>
          <h3>Gerar novos códigos de recuperação</h3>
          <p className={styles.muted}>
            Ao gerar novos códigos, todos os códigos de recuperação anteriores serão imediatamente invalidados.
          </p>
          {passwordInput}
          {codeInput}
          <div className={styles.actions}>
            <button className={styles.primary} disabled={busy || code.length !== 6}>
              {busy ? "Gerando novos códigos…" : "Gerar novos códigos"}
            </button>
            <button type="button" className={styles.secondary} onClick={() => reset("idle")} disabled={busy}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {step === "done" && (
        <div>
          <p role="status" className={styles.success}>
            {done}
          </p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/entrar">
              Entrar novamente
            </Link>
          </div>
        </div>
      )}

      {message && (
        <p role="alert" className={styles.error} style={{ marginTop: "1rem" }}>
          {message}
        </p>
      )}
    </div>
  );
}
