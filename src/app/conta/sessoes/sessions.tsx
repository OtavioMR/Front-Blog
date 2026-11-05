"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
import { parseSessions, type DeviceSession } from "./data";
import AccountBack from "@/app/conta/account-back";
import styles from "./sessions.module.css";

type State = "loading" | "ready" | "signed-out" | "error" | "uncertain";
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function Sessions() {
  const [state, setState] = useState<State>("loading");
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [subject, setSubject] = useState<string | null>(null);
  const [selected, setSelected] = useState<DeviceSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const revision = useRef(0);

  useEffect(() => {
    let active = true;
    const revisionRef = revision;
    function load() {
      const request = ++revisionRef.current;
      setState("loading"); setSessions([]); setSubject(null); setSelected(null);
      getOwnProfile().then(async profile => {
        if (!profile) return null;
        const response = await authenticatedFetchForSubject(profile.id, "/api/v1/auth/sessions");
        if (response.status === 409) { if (active && request === revisionRef.current) setReload(value => value + 1); return null; }
        if (response.status === 401) return null;
        if (!response.ok) throw new Error("Serviço indisponível.");
        return { subject: profile.id, items: parseSessions(await response.json()) };
      }).then(result => {
        if (active && request === revisionRef.current) { setSubject(result?.subject || null); setSessions(result?.items || []); setState(result ? "ready" : "signed-out"); }
      }).catch(() => { if (active && request === revisionRef.current) setState("error"); });
    }
    const unsubscribe = subscribeSession(load);
    load();
    return () => { active = false; revisionRef.current++; unsubscribe(); };
  }, [reload]);

  async function revoke() {
    if (!selected || !subject || busy) return;
    const item = selected;
    const request = ++revision.current;
    setBusy(true); setMessage("");
    try {
      const response = await authenticatedFetchForSubject(subject, `/api/v1/auth/sessions/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (request !== revision.current) return;
      if (response.status === 409) { setReload(value => value + 1); return; }
      if (response.status === 401) { setSessions([]); setSelected(null); setState("signed-out"); return; }
      if (response.status !== 204) { setSessions([]); setSelected(null); setState("uncertain"); return; }
      if (item.current) {
        // A fresh authenticated read invalidates the revoked local token and notifies other tabs.
        const check = await authenticatedFetchForSubject(subject, "/api/v1/auth/sessions");
        if (request !== revision.current) return;
        setSessions([]); setSelected(null);
        if (check.status === 401) setState("signed-out");
        else if (check.status === 409 || check.ok) { setMessage("Sessão encerrada. Atualizando a conta atual."); setReload(value => value + 1); }
        else setState("uncertain");
        return;
      }
      setSessions(previous => previous.filter(session => session.id !== item.id));
      setSelected(null); setMessage("Sessão encerrada.");
    } catch {
      if (request === revision.current) { setSessions([]); setSelected(null); setState("uncertain"); }
    } finally { setBusy(false); }
  }

  return <main className={styles.page}><section className={styles.content}><AccountBack /><p className={styles.eyebrow}>SUA CONTA</p><h1>Sessões e dispositivos.</h1><p>Confira as sessões ativas e encerre as que não reconhecer.</p>
    {state === "loading" && <p role="status">Carregando sessões…</p>}
    {state === "signed-out" && <p role="status">Sua sessão terminou. <Link href="/entrar">Entre novamente</Link>.</p>}
    {state === "error" && <><p role="alert">Não foi possível carregar as sessões agora.</p><button onClick={() => setReload(value => value + 1)}>Tentar novamente</button></>}
    {state === "uncertain" && <><p role="alert">Não foi possível confirmar se a sessão foi encerrada. Atualize a lista antes de tentar novamente. Se sua sessão atual foi encerrada, entre novamente.</p><button onClick={() => setReload(value => value + 1)}>Atualizar lista</button> <Link href="/entrar">Entrar</Link></>}
    {state === "ready" && <>{message && <p role="status">{message}</p>}{sessions.length === 0 ? <p>Nenhuma sessão ativa encontrada.</p> : <ul className={styles.list}>{sessions.map(item => <li className={styles.item} key={item.id}><div><h2>{item.current ? "Esta sessão" : "Outra sessão"}</h2><p className={styles.agent}>{item.userAgent || "Dispositivo não identificado"}</p><p>Início: {date(item.createdAt)}<br />Último uso: {date(item.lastUsedAt)}<br />Expira: {date(item.expiresAt)}</p></div><button type="button" disabled={busy} onClick={() => setSelected(item)}>Encerrar{item.current ? " esta sessão" : " sessão"}</button></li>)}</ul>}</>}
    {selected && state === "ready" && <div className={styles.confirm}><p>{selected.current ? "Você sairá desta conta neste navegador. Deseja continuar?" : "Deseja encerrar esta sessão? O dispositivo precisará entrar novamente."}</p><button type="button" onClick={revoke} disabled={busy}>{busy ? "Encerrando…" : "Confirmar"}</button> <button type="button" disabled={busy} onClick={() => setSelected(null)}>Cancelar</button></div>}
    
  </section></main>;
}
