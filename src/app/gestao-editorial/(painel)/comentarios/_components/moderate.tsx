"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/app/_components/confirm-dialog";
import styles from "../../admin.module.css";

export default function ModerateComment({
  id,
  action,
  csrf,
  kind = "comments",
}: {
  id: string;
  action: "hide" | "restore";
  csrf: string;
  kind?: "comments" | "posts";
}) {
  const router = useRouter(),
    busy = useRef(false);
  const [reason, setReason] = useState(""),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = reason.trim();
    if (busy.current || uncertain || note.length < 5 || note.length > 1000) return;
    setShowConfirm(true);
  }

  async function executeModerate() {
    setShowConfirm(false);
    const note = reason.trim();
    if (busy.current || uncertain || note.length < 5 || note.length > 1000) return;

    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const body = new URLSearchParams({ csrf, action, reason: note });
      const response = await fetch(`/gestao-editorial/${kind === "posts" ? "artigos" : "comentarios"}/${id}/moderar`, {
        method: "POST",
        body,
        cache: "no-store",
      });
      if (response.ok) {
        setReason("");
        setMessage("Moderação registrada com sucesso.");
        router.refresh();
      } else if (response.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (response.status === 403) setMessage("Você não tem permissão para esta ação.");
      else if (response.status === 409) setMessage("O conteúdo foi alterado simultaneamente. Atualize a página.");
      else if (response.status === 400 || response.status === 404 || response.status === 429)
        setMessage("Não foi possível concluir. Confira a justificativa e tente novamente.");
      else {
        setUncertain(true);
        setMessage("Resultado incerto. Atualize a página e confira o conteúdo antes de tentar novamente.");
      }
    } catch {
      setUncertain(true);
      setMessage("Resultado incerto. Atualize a página e confira o conteúdo antes de tentar novamente.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  const labelItem = kind === "posts" ? "artigo" : "comentário";

  return (
    <>
      <form className={styles.moderate} onSubmit={handleSubmit}>
        <label>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Justificativa da moderação (mínimo 5 caracteres)</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{reason.trim().length} / 1000</span>
          </div>
          <textarea
            required
            minLength={5}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={pending || uncertain}
            placeholder={`Informe o motivo para ${action === "hide" ? "ocultar" : "restaurar"} o ${labelItem}...`}
          />
        </label>
        <button
          type="submit"
          className={action === "hide" ? styles.btnDanger : styles.btnPrimary}
          disabled={pending || uncertain || reason.trim().length < 5}
        >
          {pending ? "Aguarde…" : action === "hide" ? "Ocultar" : "Restaurar"}
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

      {showConfirm && (
        <ConfirmDialog
          title={`${action === "hide" ? "Ocultar" : "Restaurar"} este ${labelItem}?`}
          description={
            action === "hide"
              ? `O ${labelItem} será ocultado do público e a justificativa informada ficará registrada na moderação.`
              : `O ${labelItem} voltará a ser visível publicamente no blog.`
          }
          confirmLabel={action === "hide" ? `Ocultar ${labelItem}` : `Restaurar ${labelItem}`}
          variant={action === "hide" ? "danger" : "primary"}
          onCancel={() => setShowConfirm(false)}
          onConfirm={executeModerate}
        />
      )}
    </>
  );
}
