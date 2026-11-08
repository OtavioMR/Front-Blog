"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { authenticatedFetchForSubject } from '@/lib/session-client';
import styles from './account.module.css';

type Status = { email: string | null; verified: boolean; pendingEmail: string | null; availableAt: string | null };
export default function RecoveryEmailSettings({ userId, totpEnabled, onVerified, statusOnly = false }: { userId: string; totpEnabled: boolean; onVerified?: (value: boolean) => void; statusOnly?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [code, setCode] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const revision = useRef(0), running = useRef(false);
  const load = useCallback(async () => {
    const current = ++revision.current;
    try {
      const response = await authenticatedFetchForSubject(userId, '/api/v1/auth/recovery-email', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const value: unknown = await response.json();
      if (!value || typeof value !== 'object' || !('email' in value) || !(value.email === null || typeof value.email === 'string') || !('verified' in value) || typeof value.verified !== 'boolean' || !('pendingEmail' in value) || !(value.pendingEmail === null || typeof value.pendingEmail === 'string') || !('availableAt' in value) || !(value.availableAt === null || (typeof value.availableAt === 'string' && Number.isFinite(Date.parse(value.availableAt))))) throw new Error();
      if (current !== revision.current) return;
      setStatus(value as Status); onVerified?.(value.verified); setUncertain(false);
    } catch { if (current === revision.current) { setError(true); setMessage('Não foi possível consultar seu e-mail de recuperação. Atualize o estado ou entre novamente.'); onVerified?.(false); } }
  }, [userId, onVerified]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    const refresh = () => { if (document.visibilityState === 'visible' && !running.current) void load(); };
    window.addEventListener('focus', refresh);
    const generation = revision;
    return () => { active = false; generation.current++; window.removeEventListener('focus', refresh); };
  }, [load]);
  async function submit(event: FormEvent, remove = false) {
    event.preventDefault();
    if (remove && (!password || (totpEnabled && !/^\d{6}$/.test(code)))) { setError(true); setMessage("Informe sua senha atual e, se necessário, o código do autenticador."); return; }
    if (running.current || uncertain) return;
    const current = revision.current;
    running.current = true; setBusy(true); setMessage(''); setError(false);
    try {
      const response = await authenticatedFetchForSubject(userId, `/api/v1/auth/recovery-email/${remove ? 'remove-request' : 'request'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ ...(!remove && { email: email.trim() }), password, ...(totpEnabled && { code }) }) });
      if (current !== revision.current) return;
      if (!response.ok) { setError(true); setMessage(response.status === 401 ? 'Senha, código do autenticador ou sessão inválida.' : response.status === 400 ? 'Use um e-mail válido, diferente do principal e do endereço de recuperação atual.' : response.status === 429 ? 'Muitas solicitações. Aguarde antes de tentar novamente.' : 'Não foi possível confirmar o envio. Atualize o estado antes de repetir.'); if (![400, 401, 429].includes(response.status)) setUncertain(true); return; }
      const value = await response.json();
      if (value?.sent !== true) throw new Error();
      setMessage(remove ? 'Enviamos um link para o e-mail de recuperação atual. Confirme a remoção em até 30 minutos.' : 'Enviamos um link para o novo e-mail de recuperação. Abra-o em até 30 minutos e confirme. Depois, atualize o estado aqui.');
      setEmail(''); await load();
    } catch { if (current === revision.current) { setError(true); setUncertain(true); setMessage('Resultado incerto. Confira sua caixa de e-mail e atualize o estado antes de repetir.'); } }
    finally { running.current = false; setPassword(''); setCode(''); setBusy(false); }
  }
  if (statusOnly) return status?.verified ? null : <p className={styles.badgeWarn}>Confirme seu <a href="/conta/email-recuperacao">e-mail de recuperação</a> antes de ativar a verificação em duas etapas.</p>;
  return <section aria-labelledby="recovery-email-title"><h3 id="recovery-email-title">E-mail de recuperação</h3><p>Cadastre um endereço diferente do principal e confirme que ele é seu. A confirmação é obrigatória para ativar o 2FA. Guarde o acesso a esse e-mail separado do autenticador.</p>
    {status?.verified ? <p><span className={styles.badgeOk}>Confirmado</span> {status.email} · Disponível para recuperação do autenticador e ativação do 2FA.</p> : <p className={styles.badgeWarn}>Nenhum e-mail de recuperação confirmado.</p>}
    {status?.pendingEmail && <p>Aguardando confirmação de {status.pendingEmail}.</p>}
    <form className={styles.stack} onSubmit={event => void submit(event)} aria-busy={busy}>
      <label htmlFor="recovery-email">{status?.verified ? 'Novo e-mail de recuperação' : 'E-mail de recuperação'}</label><input id="recovery-email" type="email" autoComplete="email" required maxLength={255} value={email} onChange={event => setEmail(event.target.value)} disabled={busy || uncertain} />
      <label htmlFor="recovery-email-password">Senha atual para cadastrar o endereço</label><input id="recovery-email-password" type="password" autoComplete="current-password" required maxLength={72} value={password} onChange={event => setPassword(event.target.value)} disabled={busy || uncertain} />
      {totpEnabled && <><label htmlFor="recovery-email-code">Código atual do autenticador</label><input id="recovery-email-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} disabled={busy || uncertain} /></>}
      <div className={styles.actions}><button className={styles.primary} disabled={busy || uncertain}>{busy ? 'Enviando…' : 'Enviar confirmação do e-mail'}</button><button className={styles.secondary} type="button" disabled={busy} onClick={() => void load()}>Atualizar estado do e-mail</button></div>
    </form>{status?.verified && <div className={styles.actions}><button className={styles.secondary} type="button" disabled={busy || uncertain} onClick={event => void submit(event, true)}>Solicitar remoção do e-mail</button><p>A remoção exige confirmação no e-mail atual. O 2FA continuará ativo, mas a recuperação por e-mail ficará indisponível.</p></div>}{message && <p role={error ? 'alert' : 'status'}>{message}</p>}
  </section>;
}
