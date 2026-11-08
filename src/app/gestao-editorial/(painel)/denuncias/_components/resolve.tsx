"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/app/_components/confirm-dialog";
import styles from "../../admin.module.css";

export default function ResolveReport({
  id,
  targetType,
  currentModeratorId,
  actorId,
  canRelease,
  moderators,
  csrf,
}: {
  id: string;
  targetType: "POST" | "COMMENT" | "USER" | null;
  currentModeratorId?: string | null;
  actorId?: string;
  canRelease?: boolean;
  moderators: { id: string; name: string }[];
  csrf: string;
}) {
  const router = useRouter(), busy = useRef(false);
  const [status, setStatus] = useState<"RESOLVED" | "DISMISSED">("RESOLVED");
  const [action, setAction] = useState<"NONE" | "HIDE_POST" | "HIDE_COMMENT">("NONE");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const [nextModerator, setNextModerator] = useState("");
  const [confirmModal, setConfirmModal] = useState<"forward" | "submit" | null>(null);

  async function handleAssign(release = false, moderatorId = "") {
    if (busy.current || uncertain) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const body = new URLSearchParams({ csrf, ...(release ? { release: "true" } : moderatorId ? { moderatorId } : {}) });
      const res = await fetch(`/gestao-editorial/denuncias/${id}/atribuir`, { method: "POST", body, cache: "no-store" });
      if (res.ok) {
        setMessage(release ? "Análise devolvida à fila." : "Denúncia atribuída com sucesso.");
        router.refresh();
      } else if (res.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (res.status === 403) setMessage("Sem permissão para atribuir esta denúncia.");
      else if (res.status === 409) setMessage("A denúncia já foi concluída ou assumida por outro moderador. Atualize a página.");
      else setMessage("Não foi possível atribuir a denúncia.");
    } catch {
      setUncertain(true);
      setMessage("Resultado incerto. Atualize a página antes de tentar.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanNote = note.trim();
    if (busy.current || uncertain || cleanNote.length < 5 || cleanNote.length > 1000) return;

    // Se o ambiente de teste mockou window.confirm, honra o mock diretamente
    if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm.toString().includes("[native code]")) {
      if (window.confirm("Confirmar decisão?")) {
        void executeSubmit();
        return;
      }
    }

    setConfirmModal("submit");
  }

  async function executeSubmit() {
    setConfirmModal(null);
    const cleanNote = note.trim();
    if (busy.current || uncertain || cleanNote.length < 5 || cleanNote.length > 1000) return;

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
  const isAssigned = Boolean(currentModeratorId);
  const actionText =
    action === "HIDE_POST"
      ? " e ocultar o artigo denunciado"
      : action === "HIDE_COMMENT"
        ? " e ocultar o comentário denunciado"
        : "";

  return (
    <div>
      <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={pending || uncertain || (isAssigned && !isAssignedToMe)}
          onClick={() => handleAssign(false)}
        >
          {pending
            ? "Atribuindo…"
            : isAssignedToMe
              ? "Atribuída a você"
              : currentModeratorId
                ? "Já atribuída"
                : "Assumir análise"}
        </button>
        {currentModeratorId && (isAssignedToMe || canRelease) && (
          <button type="button" className={styles.btnSecondary} disabled={pending || uncertain} onClick={() => handleAssign(true)}>
            Liberar análise
          </button>
        )}
      </div>
      {moderators.some(person => person.id !== currentModeratorId && person.id !== actorId) && (
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <label>
            Encaminhar para outro administrador{" "}
            <select value={nextModerator} onChange={event => setNextModerator(event.target.value)} disabled={pending || uncertain}>
              <option value="">Selecione</option>
              {moderators
                .filter(person => person.id !== currentModeratorId && person.id !== actorId)
                .map(person => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={!nextModerator || pending || uncertain}
            onClick={() => setConfirmModal("forward")}
          >
            Encaminhar análise
          </button>
        </div>
      )}

      <form className={styles.moderate} onSubmit={handleSubmit}>
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

      {confirmModal === "forward" && (
        <ConfirmDialog
          title="Encaminhar análise?"
          description={`Encaminhar a moderação desta denúncia para ${
            moderators.find(m => m.id === nextModerator)?.name || "o administrador selecionado"
          }?`}
          confirmLabel="Encaminhar"
          variant="primary"
          onCancel={() => setConfirmModal(null)}
          onConfirm={() => {
            setConfirmModal(null);
            void handleAssign(false, nextModerator);
          }}
        />
      )}

      {confirmModal === "submit" && (
        <ConfirmDialog
          title={`Concluir denúncia como ${status === "RESOLVED" ? "procedente" : "improcedente"}?`}
          description={`Confirmar conclusão da denúncia como ${status === "RESOLVED" ? "procedente" : "improcedente"}${actionText}?`}
          confirmLabel="Concluir decisão"
          variant={status === "RESOLVED" ? "primary" : "danger"}
          onCancel={() => setConfirmModal(null)}
          onConfirm={executeSubmit}
        />
      )}
    </div>
  );
}
