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
  const router = useRouter(), busy = useRef(false);
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
    if (!window.confirm(`Confirmar suspensão da conta de "${userName}"? As sessões serão invalidadas imediatamente.`)) return;

    busy.current = true; setPending(true); setMessage("");
    try {
      const body = new URLSearchParams({ csrf, action: "suspend", reason: cleanReason, ...(endsAt ? { endsAt } : {}) });
      const res = await fetch(`/admin/users/${id}/moderate`, { method: "POST", body, cache: "no-store" });
      if (res.ok) {
        setReason("");
        setEndsAt("");
        setActiveForm("none");
        setMessage("Conta suspensa e sessões revogadas.");
        router.refresh();
      } else if (res.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (res.status === 403) setMessage("Sem permissão para suspender esta conta.");
      else if (res.status === 409) setMessage("A conta já está inativa ou suspensa.");
      else setMessage("Não foi possível suspender. Confira os dados informados.");
    } catch {
      setUncertain(true);
      setMessage("Resultado incerto. Atualize a página antes de tentar novamente.");
    } finally {
      busy.current = false; setPending(false);
    }
  }

  async function handleRestore() {
    if (busy.current || uncertain) return;
    if (!window.confirm(`Restaurar a conta de "${userName}"?`)) return;

    busy.current = true; setPending(true); setMessage("");
    try {
      const body = new URLSearchParams({ csrf, action: "restore" });
      const res = await fetch(`/admin/users/${id}/moderate`, { method: "POST", body, cache: "no-store" });
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
      busy.current = false; setPending(false);
    }
  }

  async function handleRevokeSessions(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (busy.current || uncertain || cleanReason.length < 5 || cleanReason.length > 1000) return;
    if (!window.confirm(`Revogar todas as sessões ativas de "${userName}"? O usuário precisará fazer login novamente.`)) return;

    busy.current = true; setPending(true); setMessage("");
    try {
      const body = new URLSearchParams({ csrf, action: "revoke-sessions", reason: cleanReason });
      const res = await fetch(`/admin/users/${id}/moderate`, { method: "POST", body, cache: "no-store" });
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
      busy.current = false; setPending(false);
    }
  }

  return (
    <div>
      <div className={styles.actions} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        {canModerate && !isSuspended && (
          <button
            type="button"
            onClick={() => setActiveForm(activeForm === "suspend" ? "none" : "suspend")}
            disabled={pending || uncertain}
            style={{ padding: "0.4rem 0.8rem", cursor: "pointer", background: "#733" }}
          >
            {activeForm === "suspend" ? "Cancelar suspensão" : "Suspender conta"}
          </button>
        )}

        {canModerate && isSuspended && (
          <button
            type="button"
            onClick={handleRestore}
            disabled={pending || uncertain}
            style={{ padding: "0.4rem 0.8rem", cursor: "pointer" }}
          >
            {pending ? "Restaurando…" : "Restaurar conta"}
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveForm(activeForm === "revoke" ? "none" : "revoke")}
          disabled={pending || uncertain}
          style={{ padding: "0.4rem 0.8rem", cursor: "pointer" }}
        >
          {activeForm === "revoke" ? "Cancelar revogação" : "Revogar sessões ativas"}
        </button>
      </div>

      {activeForm === "suspend" && (
        <form className={styles.moderate} onSubmit={handleSuspend} style={{ marginTop: "1rem" }}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
            A suspensão invalida todas as sessões ativas da conta. Se a data de término não for informada, o bloqueio será permanente.
          </p>
          <label>
            Justificativa da suspensão (mínimo 5 caracteres)
            <textarea
              required
              minLength={5}
              maxLength={1000}
              value={reason}
              onChange={e => setReason(e.target.value)}
              disabled={pending || uncertain}
              placeholder="Descreva o motivo da suspensão..."
            />
          </label>
          <label>
            Término opcional (data e hora futura, ex: 2026-12-31T23:59)
            <input
              type="datetime-local"
              value={endsAt}
              onChange={e => setEndsAt(e.target.value)}
              disabled={pending || uncertain}
            />
          </label>
          <button disabled={pending || uncertain}>{pending ? "Aplicando…" : "Confirmar suspensão"}</button>
        </form>
      )}

      {activeForm === "revoke" && (
        <form className={styles.moderate} onSubmit={handleRevokeSessions} style={{ marginTop: "1rem" }}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
            A revogação de sessões invalida tokens de acesso imediatamente sem alterar o cadastro. O evento é auditado.
          </p>
          <label>
            Justificativa da revogação (mínimo 5 caracteres)
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
          <button disabled={pending || uncertain}>{pending ? "Revogando…" : "Confirmar revogação de sessões"}</button>
        </form>
      )}

      {message && <p role="status" style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>{message}</p>}
    </div>
  );
}
