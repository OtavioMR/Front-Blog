"use client";

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../admin.module.css';

export default function RecoverTotp({ id, csrf }: { id: string; csrf: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const running = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current || uncertain) return;
    const form = event.currentTarget;
    const body = new URLSearchParams();
    new FormData(form).forEach((value, key) => { if (typeof value === 'string') body.append(key, value); });
    running.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch(`/gestao-editorial/usuarios/${id}/recuperar-autenticador`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store' });
      const value = await response.json().catch(() => null);
      if (!response.ok) {
        if (![400, 401, 403, 409, 429].includes(response.status)) setUncertain(true);
        setMessage('Não foi possível confirmar a autorização. Verifique a conta, sua sessão e o código; consulte a auditoria antes de repetir.'); return;
      }
      if (value?.authorized !== true || typeof value.availableAt !== 'string' || !Number.isFinite(Date.parse(value.availableAt))) throw new Error();
      form.reset(); setUncertain(true);
      setMessage(`Autorização enviada ao e-mail cadastrado. Disponível a partir de ${new Date(value.availableAt).toLocaleString('pt-BR')}. O autenticador atual foi mantido.`);
      router.refresh();
    } catch { setUncertain(true); setMessage('Resultado incerto. Consulte a auditoria antes de repetir a autorização.'); }
    finally { running.current = false; setBusy(false); }
  }
  return <section className={styles.panel}><h2>Recuperar autenticador</h2><p>Confirme a identidade do titular por um canal independente antes de autorizar. O link será enviado ao e-mail já verificado. A recuperação exige a senha atual e só troca o fator após a confirmação do novo autenticador.</p>
    <form onSubmit={submit} className={styles.moderate}><input type="hidden" name="csrf" value={csrf} /><label>Verificação realizada e referência do atendimento<textarea name="reason" minLength={10} maxLength={1000} required disabled={busy || uncertain} /></label><label><input type="checkbox" name="verified" value="yes" required disabled={busy || uncertain} /> Verifiquei a identidade do titular por outro canal.</label><label>Seu código atual do autenticador<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy || uncertain} /></label><button className={styles.btnPrimary} disabled={busy || uncertain}>{busy ? 'Enviando…' : 'Autorizar recuperação assistida'}</button></form>{message && <p role="status">{message}</p>}
  </section>;
}
