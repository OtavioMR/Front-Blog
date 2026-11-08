"use client";
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import styles from '../recuperar-autenticador/recovery.module.css';

export default function Confirmation() {
  const [token, setToken] = useState(''), [cancel, setCancel] = useState(false), [remove, setRemove] = useState(false), [done, setDone] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const running = useRef(false);
  useEffect(() => {
    const readFragment = () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const value = fragment.get('cancel') ?? fragment.get('remove') ?? fragment.get('token') ?? '';
      const cancelling = fragment.has('cancel');
      window.history.replaceState(null, '', window.location.pathname);
      queueMicrotask(() => { if (/^[A-Za-z0-9_-]{43}$/.test(value)) { setToken(value); setCancel(cancelling); setRemove(fragment.has('remove')); setDone(false); setMessage(''); } });
    };
    readFragment(); window.addEventListener('hashchange', readFragment);
    return () => window.removeEventListener('hashchange', readFragment);
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (running.current || !token) return;
    running.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/v1/auth/recovery-email/${cancel ? 'cancel' : remove ? 'remove-confirm' : 'confirm'}`, { method: 'POST', credentials: 'omit', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), signal: AbortSignal.timeout(15000) });
      const value = await response.json();
      if (!response.ok || (cancel ? value?.cancelled !== true : remove ? value?.removed !== true : value?.verified !== true)) { setMessage('Não foi possível confirmar a operação. O link pode ter expirado ou já ter sido usado. Confira o estado na sua conta.'); return; }
      setDone(true); setToken('');
    } catch { setMessage('Não foi possível confirmar o resultado. Confira o estado na sua conta antes de repetir.'); }
    finally { running.current = false; setBusy(false); }
  }
  return <main className={styles.page}><section className={styles.card}><h1>{cancel ? 'Cancelar alteração.' : remove ? 'Remover e-mail de recuperação.' : 'Confirmar e-mail de recuperação.'}</h1>{done ? <p role="status">{cancel ? 'Alteração cancelada. O endereço anterior foi preservado.' : remove ? 'E-mail de recuperação removido. Seu autenticador continua ativo.' : 'E-mail confirmado. Você já pode ativar o 2FA e usar este endereço para solicitar a recuperação do autenticador.'}</p> : token ? <form onSubmit={submit} className={styles.form}><p>{cancel ? 'Confirme para cancelar a alteração do e-mail de recuperação.' : remove ? 'Confirme a remoção. Seu autenticador continuará ativo, mas a recuperação por este e-mail ficará indisponível.' : 'Confirme que você tem acesso a este endereço e deseja usá-lo para recuperar o autenticador da sua conta.'}</p><button className={styles.button} disabled={busy}>{busy ? 'Aguarde…' : cancel ? 'Cancelar alteração do e-mail' : remove ? 'Confirmar remoção' : 'Confirmar e-mail de recuperação'}</button></form> : <p>Abra o link recebido por e-mail. Se ele expirou, solicite outra confirmação na sua conta.</p>}{message && <p role="alert">{message}</p>}<Link className={styles.link} href="/conta#security-title">Voltar à segurança da conta</Link></section></main>;
}
