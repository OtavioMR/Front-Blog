"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import styles from './recovery.module.css';

type Setup = { secret: string; qrCode: string; expiresIn: number };
const validToken = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);

export default function RecoveryForm() {
  const [token, setToken] = useState('');
  const [cancel, setCancel] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestPassword, setRequestPassword] = useState('');
  const running = useRef(false);
  useEffect(() => {
    const readFragment = () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const recoveryToken = fragment.get('token'), cancelToken = fragment.get('cancel');
      window.history.replaceState(null, '', window.location.pathname);
      const value = validToken(cancelToken ?? '') ? cancelToken : recoveryToken;
      if (validToken(value ?? '')) queueMicrotask(() => {
        setToken(value!); setCancel(validToken(cancelToken ?? '')); setSetup(null); setDone(false); setCodes([]); setMessage(''); setPassword(''); setCode('');
      });
    };
    readFragment(); window.addEventListener('hashchange', readFragment);
    return () => window.removeEventListener('hashchange', readFragment);
  }, []);

  async function requestRecovery(event: FormEvent) {
    event.preventDefault(); if (running.current) return;
    running.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/v1/auth/totp-recovery/request', { method: 'POST', credentials: 'omit', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: requestEmail.trim(), password: requestPassword }), signal: AbortSignal.timeout(15000) });
      const value = await response.json();
      if (!response.ok || typeof value?.message !== 'string') { setMessage(response.status === 429 ? 'Muitas solicitações. Aguarde antes de tentar novamente.' : 'Não foi possível processar a solicitação agora. Tente novamente mais tarde.'); return; }
      const retryAt = typeof value.retryAt === 'string' ? new Date(value.retryAt) : null;
      setMessage(retryAt && Number.isFinite(retryAt.getTime()) ? `Uma solicitação recente impede um novo envio. Tente novamente após ${retryAt.toLocaleString('pt-BR')}.` : 'Se os dados estiverem corretos e a conta for elegível, enviaremos as instruções ao e-mail de recuperação cadastrado. Confira também a pasta de spam.');
    } catch { setMessage('Não foi possível confirmar o envio. Confira seu e-mail de recuperação antes de tentar novamente.'); }
    finally { running.current = false; setBusy(false); setRequestPassword(''); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (running.current || !validToken(token)) return;
    running.current = true; setBusy(true); setMessage('');
    const action = cancel ? 'cancel' : setup ? 'complete' : 'setup';
    try {
      const response = await fetch(`/api/v1/auth/totp-recovery/${action}`, {
        method: 'POST', cache: 'no-store', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...(!cancel && { password }), ...(setup && !cancel && { code }) }), signal: AbortSignal.timeout(15000),
      });
      const value = await response.json();
      if (response.status === 409 && typeof value.availableAt === 'string' && Number.isFinite(Date.parse(value.availableAt))) {
        setMessage(`A recuperação estará disponível em ${new Date(value.availableAt).toLocaleString('pt-BR')}. O autenticador atual continua ativo.`); return;
      }
      if (!response.ok) { setMessage(response.status === 429 ? 'Muitas tentativas. Aguarde antes de tentar novamente.' : 'Não foi possível validar a recuperação. Confira os dados; a autorização pode ter expirado ou atingido o limite de tentativas.'); return; }
      if (action === 'setup' && typeof value.secret === 'string' && /^[A-Z2-7]+$/.test(value.secret) && typeof value.qrCode === 'string' && value.qrCode.startsWith('data:image/png;base64,') && value.expiresIn === 600) { setSetup(value); return; }
      if (action === 'complete' && value.recovered === true && Array.isArray(value.recoveryCodes) && value.recoveryCodes.length === 8 && value.recoveryCodes.every((item: unknown) => typeof item === 'string' && /^[a-f0-9]{4}-[a-f0-9]{4}$/.test(item))) { setCodes(value.recoveryCodes); }
      else if (!(action === 'cancel' && value.cancelled === true)) throw new Error();
      setDone(true); setToken(''); setPassword(''); setCode(''); setSetup(null);
    } catch { setMessage('Não foi possível confirmar o resultado. Se você já confirmou o novo código, tente entrar com o novo autenticador antes de repetir a recuperação.'); }
    finally { running.current = false; setBusy(false); }
  }

  return <main className={styles.page}><section className={styles.card}><h1>Recuperar autenticador.</h1>
    {done ? <><p role="status">{cancel ? 'Recuperação cancelada. Seu autenticador continua ativo.' : 'Autenticador substituído. As sessões e os códigos anteriores foram invalidados.'}</p>{codes.length > 0 && <><h2>Guarde seus novos códigos</h2><p>Eles serão mostrados apenas agora. Cada código pode ser usado uma vez. Salve-os fora do celular do autenticador.</p><ul className={styles.codes}>{codes.map(item => <li key={item}><code>{item}</code></li>)}</ul><button className={styles.button} onClick={() => window.print()}>Imprimir ou salvar em PDF</button></>}</>
      : !token ? <><p>Se perdeu o autenticador, você ainda pode entrar com um código de recuperação salvo. Se não tem um código, solicite a recuperação abaixo.</p><p>O link será enviado somente ao e-mail de recuperação previamente confirmado. O endereço principal receberá um aviso com opção de cancelar. Se você não cadastrou um endereço de recuperação, procure o responsável pela plataforma.</p><form className={styles.form} onSubmit={requestRecovery} aria-busy={busy}><label htmlFor="request-recovery-email">E-mail principal da conta</label><input className={styles.input} id="request-recovery-email" type="email" autoComplete="username" required maxLength={255} value={requestEmail} onChange={event => setRequestEmail(event.target.value)} disabled={busy} /><label htmlFor="request-recovery-password">Senha atual da conta</label><input className={styles.input} id="request-recovery-password" type="password" autoComplete="current-password" required maxLength={72} value={requestPassword} onChange={event => setRequestPassword(event.target.value)} disabled={busy} /><button className={styles.button} disabled={busy}>{busy ? 'Enviando…' : 'Enviar instruções para o e-mail de recuperação'}</button></form></>
      : <form onSubmit={submit} className={styles.form} aria-busy={busy}>
        {cancel ? <p>Confirme para cancelar esta recuperação. O autenticador existente será mantido.</p> : <><p>A autorização não remove seu autenticador atual. A substituição ocorre somente quando você confirma o novo código.</p><label htmlFor="recovery-password">Senha atual</label><input className={styles.input} id="recovery-password" type="password" autoComplete="current-password" maxLength={72} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
          {setup && <><h2>Cadastre o novo autenticador</h2><p>Escaneie o QR Code no seu aplicativo ou digite a chave. Confirme em até dez minutos.</p>{/* QR local gerado pelo backend; nenhum serviço externo recebe o segredo. */}<Image unoptimized className={styles.qr} src={setup.qrCode} width={280} height={280} alt="QR Code para cadastrar o novo autenticador" /><code className={styles.secret}>{setup.secret}</code><label htmlFor="recovery-code">Código do novo autenticador</label><input className={styles.input} id="recovery-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} disabled={busy} /></>}
        </>}
        <button className={styles.button} disabled={busy}>{busy ? 'Aguarde…' : cancel ? 'Cancelar recuperação' : setup ? 'Confirmar novo autenticador' : 'Iniciar configuração'}</button>
      </form>}
    {message && <p role="alert">{message}</p>}<Link className={styles.link} href="/entrar">Voltar para a entrada</Link>
  </section></main>;
}
