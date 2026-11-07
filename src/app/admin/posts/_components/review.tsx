"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../admin.module.css";

export default function Review({ id, csrf }: { id: string; csrf: string }) {
  const router = useRouter(), busy = useRef(false);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED"), [reason, setReason] = useState("");
  const [pending, setPending] = useState(false), [uncertain, setUncertain] = useState(false), [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = decision === "REJECTED" ? reason.trim() : "";
    if (busy.current || uncertain || (decision === "REJECTED" && (note.length < 5 || note.length > 1000))) return;
    if (!window.confirm(decision === "APPROVED" ? "Aprovar e publicar este primeiro artigo?" : "Rejeitar este artigo com a justificativa informada?")) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const response = await fetch(`/admin/posts/${id}/review`, { method: "POST", body: new URLSearchParams({ csrf, decision, reason: note }), cache: "no-store" });
      if (response.ok) { setMessage("Decisão registrada."); router.refresh(); }
      else if (response.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (response.status === 403) setMessage("A conta não pode decidir esta revisão.");
      else if (response.status === 409) setMessage("A revisão foi alterada. Atualize a página.");
      else if ([400, 404, 429].includes(response.status)) setMessage("Não foi possível concluir. Confira os dados e tente novamente.");
      else { setUncertain(true); setMessage("Resultado incerto. Confira a revisão antes de tentar novamente."); }
    } catch { setUncertain(true); setMessage("Resultado incerto. Confira a revisão antes de tentar novamente."); }
    finally { busy.current = false; setPending(false); }
  }
  return <form className={styles.moderate} onSubmit={submit}><label>Decisão<select value={decision} onChange={e => setDecision(e.target.value as "APPROVED" | "REJECTED")} disabled={pending || uncertain}><option value="APPROVED">Aprovar e publicar</option><option value="REJECTED">Rejeitar</option></select></label>{decision === "REJECTED" && <label>Justificativa<textarea required minLength={5} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} disabled={pending || uncertain} /></label>}<button disabled={pending || uncertain}>{pending ? "Aguarde…" : "Registrar decisão"}</button>{message && <p role="status">{message}</p>}</form>;
}
