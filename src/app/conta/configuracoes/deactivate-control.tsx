"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/app/_components/confirm-dialog";
import { authenticatedFetchForSubject, getOwnProfile, invalidateSessionForSubject, notifyProfileChanged, subscribeSession } from "@/lib/session-client";
import { deactivateAccount } from "./deactivate-account";
import styles from "./settings.module.css";

export default function DeactivateControl() {
  const [id, setId] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "signed-out" | "error" | "busy" | "deleted" | "uncertain">("loading");
  const [openedBy, setOpenedBy] = useState("");
  const [message, setMessage] = useState("");
  const revision = useRef(0);
  const load = useCallback(async () => {
    const current = ++revision.current;
    setId(""); setOpenedBy(""); setMessage(""); setStatus("loading");
    try {
      const profile = await getOwnProfile();
      if (current !== revision.current) return;
      setId(profile?.id || ""); setStatus(profile ? "ready" : "signed-out");
    } catch { if (current === revision.current) setStatus("error"); }
  }, []);
  useEffect(() => {
    let active = true; const generation = revision;
    const unsubscribe = subscribeSession(() => { void load(); });
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; generation.current++; unsubscribe(); };
  }, [load]);
  async function confirm() {
    const subject = openedBy;
    setOpenedBy("");
    if (!subject || subject !== id || status !== "ready") { setMessage("A conta mudou. Verifique sua sessão antes de continuar."); return; }
    const current = revision.current;
    setStatus("busy"); setMessage("");
    const result = await deactivateAccount(authenticatedFetchForSubject, invalidateSessionForSubject, subject);
    if (result === "deleted" || result === "uncertain") notifyProfileChanged();
    if (current !== revision.current) return;
    if (result === "deleted") setStatus("deleted");
    else if (result === "uncertain") setStatus("uncertain");
    else if (result === "unauthorized") setStatus("signed-out");
    else if (result === "changed") { setStatus("error"); setMessage("A sessão pode ter mudado. Verifique a conta antes de tentar novamente."); }
    else { setStatus("ready"); setMessage("Esta conta não tem permissão para realizar a ação."); }
  }
  return <>
    <p>A desativação impede o acesso à conta e encerra as sessões. Esta ação não pode ser desfeita por esta página.</p>
    {status === "loading" && <p role="status">Verificando sua sessão…</p>}
    {status === "busy" && <p role="status">Desativando conta…</p>}
    {status === "ready" && <button type="button" className={styles.danger} onClick={() => setOpenedBy(id)}>Desativar minha conta</button>}
    {status === "signed-out" && <p><Link href="/entrar">Entre na conta</Link> para gerenciar a desativação.</p>}
    {status === "error" && <><p role="alert">{message || "Não foi possível verificar sua conta."}</p><button type="button" className={styles.retry} onClick={() => void load()}>Verificar novamente</button></>}
    {status === "deleted" && <p role="status">Conta desativada. Suas sessões foram encerradas.</p>}
    {status === "uncertain" && <p role="alert">Não foi possível confirmar se a conta foi desativada. Verifique o acesso antes de tentar novamente; não enviamos outra tentativa automaticamente.</p>}
    {status === "ready" && message && <p role="alert">{message}</p>}
    {!!openedBy && <ConfirmDialog title="Desativar sua conta?" description="Sua conta será desativada e suas sessões serão encerradas. Você perderá o acesso e não poderá desfazer esta ação por esta página." confirmLabel="Desativar conta" onCancel={() => setOpenedBy("")} onConfirm={() => void confirm()} />}
  </>;
}
