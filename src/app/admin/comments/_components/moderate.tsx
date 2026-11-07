"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../admin.module.css";

export default function ModerateComment({ id, action, csrf, kind = "comments" }: { id: string; action: "hide" | "restore"; csrf: string; kind?: "comments" | "posts" }) {
  const router = useRouter(), busy = useRef(false);
  const [reason, setReason] = useState(""), [pending, setPending] = useState(false), [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = reason.trim();
    if (busy.current || uncertain || note.length < 5 || note.length > 1000) return;
    if (!window.confirm(`${action === "hide" ? "Ocultar" : "Restaurar"} ${kind === "posts" ? "este artigo" : "este comentário"}?`)) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const body = new URLSearchParams({ csrf, action, reason: note });
      const response = await fetch(`/admin/${kind}/${id}/moderate`, { method: "POST", body, cache: "no-store" });
      if (response.ok) { setReason(""); setMessage("Moderação registrada."); router.refresh(); }
      else if (response.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (response.status === 403) setMessage("Você não tem permissão para esta ação.");
      else if (response.status === 409) setMessage("O conteúdo foi alterado. Atualize a página.");
      else if (response.status === 400 || response.status === 404 || response.status === 429) setMessage("Não foi possível concluir. Confira os dados e tente novamente.");
      else { setUncertain(true); setMessage("Resultado incerto. Atualize a página e confira o conteúdo antes de tentar novamente."); }
    } catch { setUncertain(true); setMessage("Resultado incerto. Atualize a página e confira o conteúdo antes de tentar novamente."); }
    finally { busy.current = false; setPending(false); }
  }
  return <form className={styles.moderate} onSubmit={submit}><label>Justificativa<textarea required minLength={5} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} disabled={pending || uncertain} /></label><button disabled={pending || uncertain}>{pending ? "Aguarde…" : action === "hide" ? "Ocultar" : "Restaurar"}</button>{message && <p role="status">{message}</p>}</form>;
}
