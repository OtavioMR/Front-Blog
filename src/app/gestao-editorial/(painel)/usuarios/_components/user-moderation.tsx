"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../admin.module.css";

export default function UserModerationActions({
  id,
  userName,
  isSuspended,
  canModerate,
  csrf,
}: {
  id: string;
  userName: string;
  isSuspended: boolean;
  canModerate: boolean;
  csrf: string;
}) {
  const router = useRouter(),
    busy = useRef(false);
  const [activeForm, setActiveForm] = useState<"none" | "suspend" | "revoke">("none");
  const [reason, setReason] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSuspend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (busy.current || uncertain || cleanReason.length < 5 || cleanReason.length > 1000) return;
    if (
      !window.confirm(
        `Confirmar suspensão da conta de "${userName}"? As sessões ativas serão invalidadas imediatamente.`
      )
    )
      return;

    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const body = new URLSearchParams({
        csrf,
        action: "suspend",
        reason: cleanReason,
        ...(endsAt ? { endsAt } : {}),
      });
      const res = await fetch(`/gestao-editorial/usuarios/${id}/moderar`, { method: "POST", body, cache: "no-store" });
      if (res.ok) {
        setReason("");
        setEndsAt("");
        setActiveForm("none");
        setMessage("Conta suspensa e sessões revogadas com sucesso.");
        router.refresh();
      } else if (res.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (res.status === 403) setMessage("Sem permissão para suspender esta conta.");
      else if (res.status === 409) setMessage("A conta já está inativa ou suspensa.");
      else setMessage("Não foi possível suspender. Confira os dados informados.");
    } catch {
      setUncertain(true);
      setMessage("Resultado incerto. Atualize a página antes de tentar novamente.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function handleRestore() {
    if (busy.current || uncertain) return;
    if (!window.confirm(`Restaurar o acesso da conta de "${userName}"?`)) return;

    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const body = new URLSearchParams({ csrf, action: "restore" });
      const res = await fetch(`/gestao-editorial/usuarios/${id}/moderar`, { method: "POST", body, cache: "no-store" });
      if (res.ok) {
        setMessage("Conta restaurada com sucesso.");
        router.refresh();
      } else if (res.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (res.status === 403) setMessage("Sem permissão para restaurar esta conta.");
      else if (res.status === 409) setMessage("A conta não está suspensa.");
      else setMessage("Não foi possível restaurar.");
    } catch {
      setUncertain(true);
      setMessage("Resultado incerto. Atualize a página antes de tentar novamente.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function handleRevokeSessions(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (busy.current || uncertain || cleanReason.length < 5 || cleanReason.length > 1000) return;
    if (
      !window.confirm(
        `Revogar todas as sessões ativas de "${userName}"? O usuário precisará fazer login novamente em todos os dispositivos.`
      )
    )
      return;

    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const body = new URLSearchParams({ csrf, action: "revoke-sessions", reason: cleanReason });
      const res = await fetch(`/gestao-editorial/usuarios/${id}/moderar`, { method: "POST", body, cache: "no-store" });
      if (res.ok) {
        setReason("");
        setActiveForm("none");
        setMessage("Todas as sessões da conta foram revogadas.");
        router.refresh();
      } else if (res.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (res.status === 403) setMessage("Sem permissão para revogar sessões desta conta.");
      else setMessage("Não foi possível revogar sessões.");
    } catch {
      setUncertain(true);
      setMessage("Resultado incerto. Atualize a página antes de tentar novamente.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <div>
      <div className={styles.actions} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        {canModerate && !isSuspended && (
          <button
            type="button"
            onClick={() => setActiveForm(activeForm === "suspend" ? "none" : "suspend")}
            disabled={pending || uncertain}
            className={styles.btnDanger}
          >
            {activeForm === "suspend" ? "Cancelar suspensão" : "Suspender conta"}
          </button>
        )}

        {canModerate && isSuspended && (
          <button
            type="button"
            onClick={handleRestore}
            disabled={pending || uncertain}
            className={styles.btnPrimary}
          >
            {pending ? "Restaurando…" : "Restaurar conta"}
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveForm(activeForm === "revoke" ? "none" : "revoke")}
          disabled={pending || uncertain}
          className={styles.btnSecondary}
        >
          {activeForm === "revoke" ? "Cancelar revogação" : "Revogar sessões ativas"}
        </button>
      </div>

      {activeForm === "suspend" && (
        <form className={styles.moderate} onSubmit={handleSuspend} style={{ marginTop: "1.25rem", padding: "1.25rem", borderRadius: "0.75rem", border: "1px solid rgba(185, 28, 28, 0.3)", background: "rgba(185, 28, 28, 0.04)" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "var(--text)" }}>
            <strong>Atenção:</strong> A suspensão bloqueia o acesso à conta e invalida todas as sessões ativas imediatamente. Se a data de término não for informada, o bloqueio será por tempo indeterminado.
          </p>
          <label>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Justificativa da suspensão (mínimo 5 caracteres)</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{reason.trim().length} / 1000</span>
            </div>
            <textarea
              required
              minLength={5}
              maxLength={1000}
              value={reason}
              onChange={e => setReason(e.target.value)}
              disabled={pending || uncertain}
              placeholder="Descreva detalhadamente o motivo da suspensão..."
            />
          </label>
          <label>
            Término opcional da suspensão (data e hora futura)
            <input
              type="datetime-local"
              value={endsAt}
              onChange={e => setEndsAt(e.target.value)}
              disabled={pending || uncertain}
            />
          </label>
          <button type="submit" className={styles.btnDanger} disabled={pending || uncertain || reason.trim().length < 5}>
            {pending ? "Aplicando suspensão…" : "Confirmar suspensão"}
          </button>
        </form>
      )}

      {activeForm === "revoke" && (
        <form className={styles.moderate} onSubmit={handleRevokeSessions} style={{ marginTop: "1.25rem", padding: "1.25rem", borderRadius: "0.75rem", border: "1px solid var(--border)", background: "var(--surface-subtle)" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            A revogação de sessões encerra imediatamente todos os tokens emitidos para esta conta. O cadastro não é afetado, e o titular precisará autenticar novamente.
          </p>
          <label>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Justificativa da revogação (mínimo 5 caracteres)</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{reason.trim().length} / 1000</span>
            </div>
            <textarea
              required
              minLength={5}
              maxLength={1000}
              value={reason}
              onChange={e => setReason(e.target.value)}
              disabled={pending || uncertain}
              placeholder="Descreva o motivo da revogação de sessões..."
            />
          </label>
          <button type="submit" className={styles.btnPrimary} disabled={pending || uncertain || reason.trim().length < 5}>
            {pending ? "Revogando sessões…" : "Confirmar revogação de sessões"}
          </button>
        </form>
      )}

      {message && (
        <p
          role="status"
          style={{
            fontSize: "0.85rem",
            marginTop: "0.75rem",
            padding: "0.6rem 0.85rem",
            borderRadius: "0.5rem",
            background: "var(--surface-subtle)",
            fontWeight: 500,
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
