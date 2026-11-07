"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../admin.module.css";

export default function Review({ id, csrf }: { id: string; csrf: string }) {
  const router = useRouter(),
    busy = useRef(false);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED"),
    [reason, setReason] = useState("");
  const [pending, setPending] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = decision === "REJECTED" ? reason.trim() : "";
    if (busy.current || uncertain || (decision === "REJECTED" && (note.length < 5 || note.length > 1000))) return;
    if (
      !window.confirm(
        decision === "APPROVED"
          ? "Aprovar e publicar este primeiro artigo? O autor terá a permissão de publicação liberada."
          : "Rejeitar este artigo com a justificativa informada?"
      )
    )
      return;

    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/gestao-editorial/artigos/${id}/revisar`, {
        method: "POST",
        body: new URLSearchParams({ csrf, decision, reason: note }),
        cache: "no-store",
      });
      if (response.ok) {
        setMessage("Decisão registrada com sucesso.");
        router.refresh();
      } else if (response.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (response.status === 403) setMessage("A conta não pode decidir esta revisão.");
      else if (response.status === 409) setMessage("A revisão foi alterada simultaneamente. Atualize a página.");
      else if ([400, 404, 429].includes(response.status))
        setMessage("Não foi possível concluir. Confira os dados e tente novamente.");
      else {
        setUncertain(true);
        setMessage("Resultado incerto. Confira a revisão antes de tentar novamente.");
      }
    } catch {
      setUncertain(true);
      setMessage("Resultado incerto. Confira a revisão antes de tentar novamente.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <form className={styles.moderate} onSubmit={submit}>
      <label>
        Decisão editorial sobre a primeira publicação
        <select
          value={decision}
          onChange={e => setDecision(e.target.value as "APPROVED" | "REJECTED")}
          disabled={pending || uncertain}
        >
          <option value="APPROVED">Aprovar e publicar imediatamente</option>
          <option value="REJECTED">Rejeitar com justificativa fundamentada</option>
        </select>
      </label>

      {decision === "REJECTED" && (
        <label>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Justificativa da rejeição (mínimo 5 caracteres)</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{reason.trim().length} / 1000</span>
          </div>
          <textarea
            required
            minLength={5}
            maxLength={1000}
            value={reason}
            onChange={e => setReason(e.target.value)}
            disabled={pending || uncertain}
            placeholder="Explique os pontos que precisam ser corrigidos pelo autor..."
          />
        </label>
      )}

      <button
        type="submit"
        className={decision === "APPROVED" ? styles.btnPrimary : styles.btnDanger}
        disabled={pending || uncertain || (decision === "REJECTED" && reason.trim().length < 5)}
      >
        {pending ? "Aguarde…" : decision === "APPROVED" ? "Aprovar e publicar" : "Registrar rejeição"}
      </button>

      {message && (
        <p
          role="status"
          style={{
            fontSize: "0.85rem",
            marginTop: "0.5rem",
            padding: "0.6rem 0.85rem",
            borderRadius: "0.5rem",
            background: "var(--surface-subtle)",
            fontWeight: 500,
          }}
        >
          {message}
        </p>
      )}
    </form>
  );
}
