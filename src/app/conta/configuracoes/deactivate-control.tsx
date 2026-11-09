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
    <p>
      O encerramento definitivo da conta impede o acesso futuro e despublica imediatamente todos os seus artigos.
      Seus dados pessoais serão anonimizados ou eliminados em conformidade com a LGPD (meta operacional de até 30 dias).
      Seus comentários permanecerão na plataforma para garantir o encadeamento das discussões, porém anonimizados como &ldquo;Conta encerrada&rdquo;, desvinculados de seu nome e foto.
    </p>
    {status === "loading" && <p role="status">Verificando sua sessão…</p>}
    {status === "busy" && <p role="status">Desativando conta…</p>}
    {status === "ready" && <button type="button" className={styles.danger} onClick={() => setOpenedBy(id)}>Desativar minha conta</button>}
    {status === "signed-out" && <p><Link href="/entrar">Entre na conta</Link> para gerenciar a desativação.</p>}
    {status === "error" && <><p role="alert">{message || "Não foi possível verificar sua conta."}</p><button type="button" className={styles.retry} onClick={() => void load()}>Verificar novamente</button></>}
    {status === "deleted" && (
      <div role="status" style={{ padding: "16px", background: "var(--surface-subtle)", border: "1px solid var(--border)", borderRadius: "6px", marginTop: "12px" }}>
        <p style={{ margin: 0, fontWeight: 700 }}>Conta desativada. Suas sessões foram encerradas.</p>
        <p style={{ margin: "6px 0 0", fontSize: "14px" }}>
          Sua solicitação de encerramento foi processada com sucesso. Seus artigos foram retirados do ar e seus dados pessoais anonimizados conforme a LGPD.
        </p>
      </div>
    )}
    {status === "uncertain" && <p role="alert">Não foi possível confirmar se a conta foi desativada. Verifique o acesso antes de tentar novamente; não enviamos outra tentativa automaticamente.</p>}
    {status === "ready" && message && <p role="alert">{message}</p>}
    {!!openedBy && (
      <ConfirmDialog
        title="Encerrar e desativar sua conta?"
        description="Ao confirmar, todos os seus artigos publicados serão despublicados imediatamente e seus dados pessoais serão anonimizados (meta de até 30 dias pela LGPD). Comentários em postagens serão mantidos de forma anônima como 'Conta encerrada'. Suas sessões serão encerradas e você não poderá desfazer esta operação."
        confirmLabel="Desativar conta"
        onCancel={() => setOpenedBy("")}
        onConfirm={() => void confirm()}
      />
    )}
  </>;
}
