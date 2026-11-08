"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "../../admin.module.css";

export default function UnblockAuthor({ id, csrf }: { id: string; csrf: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [finished, setFinished] = useState(false), [message, setMessage] = useState("");
  const running = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current || finished) return;
    const form = event.currentTarget;
    const body = new URLSearchParams();
    new FormData(form).forEach((value, key) => { if (typeof value === "string") body.append(key, value); });
    running.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch(`/gestao-editorial/usuarios/${id}/liberar-autoria`, { method: "POST", body, cache: "no-store" });
      if (response.ok && (await response.json()).allowed === true) { form.reset(); setFinished(true); setMessage("Solicitação liberada. O titular poderá aceitar as regras no Studio para se tornar autor."); router.refresh(); }
      else if ([400, 401, 403, 409, 429].includes(response.status)) setMessage("Não foi possível liberar. Verifique a conta, sua sessão e o código do autenticador.");
      else { setFinished(true); setMessage("Resultado incerto. Atualize a página e consulte o histórico antes de tentar novamente."); }
    } catch { setFinished(true); setMessage("Resultado incerto. Atualize a página e consulte o histórico antes de tentar novamente."); }
    finally { running.current = false; setBusy(false); }
  }
  return <section className={styles.panel}><h2>Liberar solicitação de autoria</h2><p>A autoria está bloqueada. Ao liberar, o titular ainda precisará aceitar as regras no Studio.</p><form onSubmit={submit} className={styles.moderate}><input type="hidden" name="csrf" value={csrf} /><label>Motivo<textarea name="reason" minLength={5} maxLength={1000} required disabled={busy || finished} /></label><label>Seu código atual do autenticador<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy || finished} /></label><button className={styles.btnPrimary} disabled={busy || finished}>{busy ? "Liberando…" : "Liberar solicitação"}</button></form>{message && <p role="status">{message}</p>}</section>;
}
