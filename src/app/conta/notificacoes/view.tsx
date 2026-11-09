"use client";

import Link from "next/link";
import AccountBack from "@/app/conta/account-back";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
import { parseNotifications, type Notifications, type Notice } from "./data";
import styles from "../feed/view.module.css";

const labels: Record<Notice["type"], string> = { post_like: "curtiu seu artigo", comment: "comentou em seu artigo", reply: "respondeu a um comentário", comment_like: "curtiu seu comentário", follow: "começou a acompanhar você", post_approved: "aprovou seu artigo", post_rejected: "rejeitou seu artigo", post_hidden: "ocultou seu artigo por moderação", post_restored: "restaurou seu artigo", comment_hidden: "ocultou seu comentário por moderação", comment_restored: "restaurou seu comentário", role_changed: "alterou sua função", sessions_revoked: "encerrou suas sessões", account_suspended: "suspendeu sua conta", account_restored: "restaurou sua conta", report_assigned: "atribuiu uma denúncia a você", content_rating_changed: "reclassificou a faixa etária do seu artigo" };
export default function NotificationsView() {
  const [state, setState] = useState<"loading" | "ready" | "signed-out" | "error">("loading");
  const [data, setData] = useState<Notifications | null>(null);
  const [owner, setOwner] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const revision = useRef(0);
  const running = useRef(false);
  const load = useCallback(async (requestedPage: number) => {
    const current = ++revision.current;
    setData(null); setOwner(""); setState("loading"); setMessage(""); setUncertain(false);
    try {
      const profile = await getOwnProfile();
      if (current !== revision.current) return;
      if (!profile) { setState("signed-out"); return; }
      const response = await authenticatedFetchForSubject(profile.id, `/api/v1/notifications?page=${requestedPage}&limit=10`, { cache: "no-store" });
      if (current !== revision.current) return;
      if (response.status === 401) { setState("signed-out"); return; }
      if (!response.ok) throw new Error();
      const result = parseNotifications(await response.json(), requestedPage);
      if (current !== revision.current) return;
      setOwner(profile.id); setData(result); setPage(requestedPage); setState("ready");
    } catch { if (current === revision.current) setState("error"); }
  }, []);
  useEffect(() => {
    let active = true;
    const generation = revision;
    const unsubscribe = subscribeSession(() => { void load(1); });
    queueMicrotask(() => { if (active) void load(1); });
    return () => { active = false; generation.current++; unsubscribe(); };
  }, [load]);
  async function mark(id?: string) {
    if (!owner || running.current || uncertain || state !== "ready") return;
    const current = revision.current;
    running.current = true; setBusy(true); setMessage("");
    try {
      const response = await authenticatedFetchForSubject(owner, id ? `/api/v1/notifications/${encodeURIComponent(id)}/read` : "/api/v1/notifications/read-all", { method: "PATCH", cache: "no-store" });
      if (current !== revision.current) return;
      if (response.status === 401) { setState("signed-out"); setData(null); return; }
      if ([400, 403, 404, 409, 429].includes(response.status)) { setUncertain(true); setMessage("Não foi possível atualizar a leitura. Atualize a lista antes de tentar novamente."); return; }
      if (response.status !== 204) throw new Error();
      await load(page);
    } catch { if (current === revision.current) { setUncertain(true); setMessage("Não foi possível confirmar o resultado. Atualize a lista antes de tentar novamente."); } }
    finally { running.current = false; setBusy(false); }
  }
  return <main className={styles.page}>
    <AccountBack /><h1>Notificações.</h1>
    {state === "loading" && <p role="status">Carregando notificações…</p>}
    {state === "signed-out" && <p>Entre para ver suas notificações. <Link className={styles.link} href="/entrar">Entrar</Link></p>}
    {state === "error" && <><p role="alert">Não foi possível carregar suas notificações.</p><button className={styles.button} onClick={() => void load(page)}>Tentar novamente</button></>}
    {state === "ready" && data && <>
      <p role="status">{data.unread === 1 ? "1 notificação não lida" : `${data.unread} notificações não lidas`}</p>
      {message && <p role="alert">{message}</p>}
      {uncertain ? <button className={styles.button} onClick={() => void load(page)}>Atualizar lista</button> : <button className={styles.button} disabled={busy || data.unread === 0} onClick={() => void mark()}>Marcar todas como lidas</button>}
      {!data.data.length ? (
        <p>Nenhuma notificação nesta página.</p>
      ) : (
        <ul className={styles.list}>
          {data.data.map(item => {
            const isModerationAction = ["post_hidden", "comment_hidden", "content_rating_changed", "account_suspended"].includes(item.type);
            const reason = item.details && typeof item.details.reason === "string" ? item.details.reason : null;

            return (
              <li key={item.id}>
                <article>
                  <p><strong>{item.actor.name}</strong> {labels[item.type]}.</p>
                  {reason && (
                    <p style={{ fontSize: "14px", fontStyle: "italic", margin: "4px 0 8px", color: "var(--text-muted)" }}>
                      Motivo: &ldquo;{reason}&rdquo;
                    </p>
                  )}
                  {item.postId && (item.type === "post_approved" || item.type === "post_rejected") && (
                    <p><Link className={styles.link} href={`/studio/${encodeURIComponent(item.postId)}`}>Ver artigo e resultado da revisão</Link></p>
                  )}
                  {isModerationAction && (
                    <p>
                      <Link className={styles.link} href={`/contato?assunto=recurso&notificacao=${encodeURIComponent(item.id)}`}>
                        Solicitar recurso contra esta decisão (prazo de resposta: 15 dias)
                      </Link>
                    </p>
                  )}
                  <p>
                    <time dateTime={item.createdAt}>
                      {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}
                    </time> · {item.readAt ? "Lida" : "Não lida"}
                  </p>
                  {!item.readAt && (
                    <button className={styles.button} disabled={busy || uncertain} onClick={() => void mark(item.id)} aria-label={`Marcar notificação de ${item.actor.name} como lida`}>
                      Marcar como lida
                    </button>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
      {(data.meta.hasPreviousPage || data.meta.hasNextPage) && <nav className={styles.pagination} aria-label="Paginação das notificações"><button className={styles.button} disabled={busy || !data.meta.hasPreviousPage} onClick={() => void load(page - 1)}>Anterior</button><span>Página {page}</span><button className={styles.button} disabled={busy || !data.meta.hasNextPage} onClick={() => void load(page + 1)}>Próxima</button></nav>}
    </>}
  </main>;
}
