"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/app/_components/confirm-dialog";
import { formatRoleName } from "@/lib/permissions";
import styles from "../../../admin.module.css";

export default function RoleForm({
  id,
  current,
  csrf,
  suggested = "",
  totpEnabled,
}: {
  id: string;
  current: string;
  csrf: string;
  suggested?: string;
  totpEnabled: boolean;
}) {
  const router = useRouter();
  const busy = useRef(false);
  const [currentRole, setCurrentRole] = useState(current);
  const [role, setRole] = useState(suggested !== current && (suggested !== "ADMIN" || totpEnabled) ? suggested : "");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [checkingState, setCheckingState] = useState(false);
  const [message, setMessage] = useState("");

  function requestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = reason.trim();
    if (busy.current || uncertain || !role || (role === "ADMIN" && !totpEnabled) || note.length < 5 || note.length > 1000 || !/^\d{6}$/.test(code)) {
      return;
    }
    setShowConfirm(true);
  }

  async function executeChange() {
    setShowConfirm(false);
    const note = reason.trim();
    if (busy.current || uncertain || !role || (role === "ADMIN" && !totpEnabled) || note.length < 5 || note.length > 1000 || !/^\d{6}$/.test(code)) {
      return;
    }
    const targetRole = role;
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/gestao-editorial/usuarios/${id}/funcao/alterar`, {
        method: "POST",
        body: new URLSearchParams({ csrf, role: targetRole, reason: note, code }),
        cache: "no-store",
      });
      setCode("");
      if (response.ok) {
        setCurrentRole(targetRole);
        setRole("");
        setReason("");
        setUncertain(false);
        setMessage(`Função alterada com sucesso para ${formatRoleName(targetRole)} e sessões revogadas.`);
        router.refresh();
      } else {
        const errorJson = await response.json().catch(() => null);
        if (errorJson?.message) {
          setMessage(errorJson.message);
        } else if (response.status === 401) {
          setMessage("Sessão expirada ou código do autenticador inválido.");
        } else if (response.status === 403) {
          setMessage("A conta executora não possui permissão para esta alteração.");
        } else if (response.status === 409) {
          setMessage("A conta alvo não atende aos requisitos necessários (e-mail confirmado e conta ativa).");
        } else if ([400, 404, 429].includes(response.status)) {
          setMessage("Não foi possível concluir. Confira os dados ou aguarde antes de tentar novamente.");
        } else {
          setUncertain(true);
          setMessage("Resultado incerto devido a tempo de resposta. Consulte o estado atual antes de tentar novamente.");
        }
      }
    } catch {
      setCode("");
      setUncertain(true);
      setMessage("Falha de conexão com o servidor. Consulte o estado atual da conta para verificar se a alteração foi aplicada.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function checkCurrentState() {
    if (checkingState) return;
    setCheckingState(true);
    try {
      const res = await fetch(`/gestao-editorial/usuarios/${id}/funcao/alterar`, {
        method: "GET",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const serverRole = data.role;
        setCurrentRole(serverRole);
        if (role && serverRole === role) {
          setMessage(`Operação confirmada: a conta já consta como ${formatRoleName(serverRole)} (${serverRole}) no sistema.`);
          setUncertain(false);
          setRole("");
          setReason("");
          router.refresh();
        } else {
          setMessage(`A conta consta atualmente como ${formatRoleName(serverRole)} (${serverRole}). A alteração anterior não foi aplicada. Você pode tentar novamente com um novo código.`);
          setUncertain(false);
        }
      } else {
        setMessage("Não foi possível verificar o estado atual no momento. Tente novamente em alguns segundos.");
      }
    } catch {
      setMessage("Erro de rede ao consultar o estado atual.");
    } finally {
      setCheckingState(false);
    }
  }

  const isPromotion = role === "ADMIN";

  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <p style={{ margin: 0, fontSize: "14px", color: "var(--admin-muted, #666)" }}>
          Função atual: <strong>{formatRoleName(currentRole)}</strong> ({currentRole})
        </p>
      </div>

      <form className={styles.moderate} onSubmit={requestSubmit}>
        <label>
          Nova função
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            disabled={pending || uncertain}
          >
            <option value="">Selecione</option>
            {["READER", "AUTHOR", "ADMIN"]
              .filter((r) => r !== currentRole)
              .map((r) => (
                <option key={r} value={r} disabled={r === "ADMIN" && !totpEnabled}>
                  {formatRoleName(r)} ({r})
                </option>
              ))}
          </select>
        </label>
        {!totpEnabled && currentRole !== "ADMIN" && <p className={styles.note}>Para ser administrador, o titular precisa ativar a autenticação em dois fatores na segurança da própria conta.</p>}
        <label>
          Justificativa (mínimo 5 caracteres)
          <textarea
            required
            minLength={5}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={pending || uncertain}
            placeholder="Informe o motivo da alteração de permissão para fins de auditoria..."
          />
        </label>
        <label>
          Código do Google Authenticator (6 dígitos)
          <input
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={pending || uncertain}
            placeholder="000000"
          />
        </label>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={pending || uncertain || !role || reason.trim().length < 5 || code.length !== 6}
          >
            {pending ? "Processando alteração…" : "Alterar função"}
          </button>
          {uncertain && (
            <button
              type="button"
              className={styles.secondary}
              disabled={checkingState}
              onClick={checkCurrentState}
            >
              {checkingState ? "Consultando…" : "Consultar estado atual da conta"}
            </button>
          )}
        </div>
        {message && (
          <p role="status" className={styles.note} style={{ marginTop: "1rem" }}>
            {message}
          </p>
        )}
      </form>

      {showConfirm && (
        <ConfirmDialog
          title={isPromotion ? "Promover a Administrador?" : `Alterar função para ${formatRoleName(role)}?`}
          description={`As sessões ativas desta conta serão revogadas imediatamente. A alteração será registrada com seu usuário no log de auditoria.${
            isPromotion
              ? " A conta receberá privilégios administrativos sobre a plataforma mantendo suas capacidades autorais."
              : ""
          }`}
          confirmLabel={isPromotion ? "Promover a Administrador" : "Confirmar alteração"}
          variant={isPromotion ? "primary" : "danger"}
          onCancel={() => setShowConfirm(false)}
          onConfirm={executeChange}
        />
      )}
    </>
  );
}
