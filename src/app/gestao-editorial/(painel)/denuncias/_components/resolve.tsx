"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../admin.module.css";

export default function ResolveReport({
  id,
  targetType,
  currentModeratorId,
  actorId,
  csrf,
}: {
  id: string;
  targetType: "POST" | "COMMENT" | "USER" | null;
  currentModeratorId?: string | null;
  actorId?: string;
  csrf: string;
}) {
  const router = useRouter(), busy = useRef(false);
  const [status, setStatus] = useState<"RESOLVED" | "DISMISSED">("RESOLVED");
  const [action, setAction] = useState<"NONE" | "HIDE_POST" | "HIDE_COMMENT">("NONE");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");

  async function handleAssign() {
    if (busy.current || uncertain) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const body = new URLSearchParams({ csrf, ...(actorId ? { moderatorId: actorId } : {}) });
      const res = await fetch(`/gestao-editorial/denuncias/${id}/atribuir`, { method: "POST", body, cache: "no-store" });
      if (res.ok) {
        setMessage("Denúncia atribuída com sucesso.");
        router.refresh();
      } else if (res.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (res.status === 403) setMessage("Sem permissão para atribuir esta denúncia.");
      else if (res.status === 409) setMessage("A denúncia já foi concluída.");
      else setMessage("Não foi possível atribuir a denúncia.");
    } catch {
      setUncertain(true);
      setMessage("Resultado incerto. Atualize a página antes de tentar.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanNote = note.trim();
    if (busy.current || uncertain || cleanNote.length < 5 || cleanNote.length > 1000) return;

    const actionText =
      action === "HIDE_POST"
        ? " e ocultar o artigo denunciado"
        : action === "HIDE_COMMENT"
          ? " e ocultar o comentário denunciado"
          : "";
    if (
      !window.confirm(
        `Confirmar conclusão da denúncia como ${status === "RESOLVED" ? "procedente" : "improcedente"}${actionText}?`
      )
    )
      return;

    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const selectedAction = status === "DISMISSED" ? "NONE" : action;
      const body = new URLSearchParams({ csrf, status, action: selectedAction, note: cleanNote });
      const res = await fetch(`/gestao-editorial/denuncias/${id}/resolver`, { method: "POST", body, cache: "no-store" });
      if (res.ok) {
        setNote("");
        setMessage("Decisão registrada com sucesso.");
        router.refresh();
      } else if (res.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (res.status === 403) setMessage("Sem permissão para esta ação.");
      else if (res.status === 409) setMessage("A denúncia ou o conteúdo já foi alterado. Atualize a página.");
      else if ([400, 404, 429].includes(res.status))
        setMessage("Não foi possível concluir. Confira a justificativa informada.");
      else {
        setUncertain(true);
        setMessage("Resultado incerto. Atualize a página e confira a situação antes de tentar novamente.");
      }
    } catch {
      setUncertain(true);
      setMessage("Resultado incerto. Atualize a página e confira a situação antes de tentar novamente.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  const isAssignedToMe = currentModeratorId === actorId;

  return (
    <div>
      <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleAssign}
          disabled={pending || uncertain}
          className={styles.btnSecondary}
          style={{ padding: "0.45rem 0.85rem", fontSize: "0.82rem" }}
        >
          {pending
            ? "Atribuindo…"
            : isAssignedToMe
              ? "Atribuída a você"
              : currentModeratorId
                ? "Reatribuir a mim"
                : "Assumir denúncia"}
        </button>
        {currentModeratorId && (
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Moderador atual: {isAssignedToMe ? "Você" : currentModeratorId}
          </span>
        )}
      </div>

      <form className={styles.moderate} onSubmit={submit}>
        <label>
          Decisão sobre a denúncia
          <select
            value={status}
            onChange={e => {
              const next = e.target.value as "RESOLVED" | "DISMISSED";
              setStatus(next);
              if (next === "DISMISSED") setAction("NONE");
            }}
            disabled={pending || uncertain}
          >
            <option value="RESOLVED">Procedente (Violação de regras confirmada)</option>
            <option value="DISMISSED">Improcedente (Denúncia rejeitada)</option>
          </select>
        </label>

        {status === "RESOLVED" && targetType && targetType !== "USER" && (
          <label>
            Ação atômica sobre o conteúdo denunciado
            <select
              value={action}
              onChange={e => setAction(e.target.value as "NONE" | "HIDE_POST" | "HIDE_COMMENT")}
              disabled={pending || uncertain}
            >
              <option value="NONE">Nenhuma ação direta sobre o conteúdo</option>
              {targetType === "POST" && <option value="HIDE_POST">Ocultar artigo denunciado</option>}
              {targetType === "COMMENT" && <option value="HIDE_COMMENT">Ocultar comentário denunciado</option>}
            </select>
          </label>
        )}

        <label>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Justificativa da moderação (mínimo 5 caracteres)</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{note.trim().length} / 1000</span>
          </div>
          <textarea
            required
            minLength={5}
            maxLength={1000}
            value={note}
            onChange={e => setNote(e.target.value)}
            disabled={pending || uncertain}
            placeholder="Fundamente com clareza o motivo da decisão tomada pela equipe..."
          />
        </label>

        <button
          type="submit"
          className={styles.btnPrimary}
          disabled={pending || uncertain || note.trim().length < 5}
        >
          {pending ? "Registrando decisão…" : "Registrar decisão"}
        </button>

        {message && (
          <p
            role="status"
            style={{
              padding: "0.65rem 0.85rem",
              borderRadius: "0.5rem",
              background: "var(--surface-subtle)",
              fontSize: "0.85rem",
              fontWeight: 500,
              marginTop: "0.5rem",
            }}
          >
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
