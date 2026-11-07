"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../../admin.module.css";

export default function RoleForm({ id, current, csrf, suggested = "" }: { id: string; current: string; csrf: string; suggested?: string }) {
  const router = useRouter(), busy = useRef(false);
  const [role, setRole] = useState(suggested !== current ? suggested : ""), [reason, setReason] = useState(""), [code, setCode] = useState("");
  const [pending, setPending] = useState(false), [uncertain, setUncertain] = useState(false), [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const note = reason.trim();
    if (busy.current || uncertain || !role || note.length < 5 || note.length > 1000 || !/^\d{6}$/.test(code)) return;
    const warning = role === "ADMIN" || role === "SUPER_ADMIN" ? " Esta função concede acesso administrativo e responsabilidade sobre os dados e a operação da plataforma." : "";
    if (!window.confirm(`Alterar a função para ${role}? As sessões da conta serão revogadas.${warning}`)) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const response = await fetch(`/gestao-editorial/usuarios/${id}/funcao/alterar`, { method: "POST", body: new URLSearchParams({ csrf, role, reason: note, code }), cache: "no-store" });
      setCode("");
      if (response.ok) { setRole(""); setReason(""); setMessage("Função alterada e sessões revogadas."); router.refresh(); }
      else if (response.status === 401) setMessage("Sessão expirada ou código TOTP inválido, reutilizado ou não configurado.");
      else if (response.status === 403) setMessage("A conta não tem permissão para esta alteração.");
      else if (response.status === 409) setMessage("A conta não atende aos requisitos ou foi alterada. Atualize os dados.");
      else if ([400, 404, 429].includes(response.status)) setMessage("Não foi possível concluir. Confira os dados ou aguarde antes de tentar novamente.");
      else { setUncertain(true); setMessage("Resultado incerto. Confira a função antes de tentar novamente."); }
    } catch { setCode(""); setUncertain(true); setMessage("Resultado incerto. Confira a função antes de tentar novamente."); }
    finally { busy.current = false; setPending(false); }
  }
  return <form className={styles.moderate} onSubmit={submit}><label>Nova função<select value={role} onChange={e => setRole(e.target.value)} required disabled={pending || uncertain}><option value="">Selecione</option>{["READER", "AUTHOR", "ADMIN", "SUPER_ADMIN"].filter(r => r !== current).map(r => <option key={r} value={r}>{r}</option>)}</select></label><label>Justificativa<textarea required minLength={5} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} disabled={pending || uncertain} /></label><label>Código atual do autenticador<input type="password" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value)} disabled={pending || uncertain} /></label><button disabled={pending || uncertain}>{pending ? "Aguarde…" : "Alterar função"}</button>{message && <p role="status">{message}</p>}</form>;
}
