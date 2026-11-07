"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../admin.module.css";

export function TagCreateForm({ csrf }: { csrf: string }) {
  const router = useRouter(), busy = useRef(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanName = name.trim();
    if (busy.current || uncertain || cleanName.length < 1 || cleanName.length > 50) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const body = new URLSearchParams({ csrf, action: "create", name: cleanName });
      const res = await fetch("/gestao-editorial/tags/acao", { method: "POST", body, cache: "no-store" });
      if (res.ok) {
        setName("");
        setMessage("Tag criada com sucesso.");
        router.refresh();
      } else if (res.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (res.status === 403) setMessage("Sem permissão para esta ação.");
      else if (res.status === 409) setMessage("Já existe uma tag com este slug.");
      else setMessage("Não foi possível criar. Confira o nome informado.");
    } catch {
      setUncertain(true);
      setMessage("Resultado incerto. Atualize a página e confira a lista.");
    } finally {
      busy.current = false; setPending(false);
    }
  }

  return (
    <form className={styles.moderate} onSubmit={submit}>
      <label>
        Nome da tag
        <input required minLength={1} maxLength={50} value={name} onChange={e => setName(e.target.value)} disabled={pending || uncertain} placeholder="Ex: Inteligência Artificial" />
      </label>
      <button disabled={pending || uncertain}>{pending ? "Criando…" : "Criar tag"}</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}

export function TagRowActions({
  id,
  currentName,
  postCount,
  csrf,
}: {
  id: string;
  currentName: string;
  postCount: number;
  csrf: string;
}) {
  const router = useRouter(), busy = useRef(false);
  const [mode, setMode] = useState<"idle" | "edit" | "merge">("idle");
  const [name, setName] = useState(currentName);
  const [targetId, setTargetId] = useState("");
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanName = name.trim();
    if (busy.current || uncertain || cleanName.length < 1 || cleanName.length > 50) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const body = new URLSearchParams({ csrf, action: "edit", id, name: cleanName });
      const res = await fetch("/gestao-editorial/tags/acao", { method: "POST", body, cache: "no-store" });
      if (res.ok) {
        setMode("idle");
        setMessage("Tag renomeada.");
        router.refresh();
      } else if (res.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (res.status === 403) setMessage("Sem permissão para esta ação.");
      else if (res.status === 409) setMessage("Conflito: slug já existe.");
      else setMessage("Não foi possível renomear.");
    } catch {
      setUncertain(true);
      setMessage("Resultado incerto. Atualize a página antes de tentar.");
    } finally {
      busy.current = false; setPending(false);
    }
  }

  async function handleDelete() {
    if (busy.current || uncertain) return;
    if (postCount > 0) {
      alert(`A tag possui ${postCount} artigo(s) associado(s). Mescle a tag em outra antes de excluí-la.`);
      return;
    }
    if (!window.confirm(`Excluir a tag "${currentName}"? Esta ação é definitiva.`)) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const body = new URLSearchParams({ csrf, action: "delete", id });
      const res = await fetch("/gestao-editorial/tags/acao", { method: "POST", body, cache: "no-store" });
      if (res.ok) {
        setMessage("Tag excluída.");
        router.refresh();
      } else if (res.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (res.status === 403) setMessage("Sem permissão para esta ação.");
      else if (res.status === 409) setMessage("A tag está em uso e não pode ser excluída.");
      else setMessage("Não foi possível excluir.");
    } catch {
      setUncertain(true);
      setMessage("Resultado incerto. Atualize a página antes de tentar.");
    } finally {
      busy.current = false; setPending(false);
    }
  }

  async function handleMerge(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanTarget = targetId.trim();
    if (busy.current || uncertain || !cleanTarget || cleanTarget === id) return;
    if (!window.confirm(`Mesclar a tag "${currentName}" no identificador de destino? Todos os artigos associados serão transferidos e esta tag será excluída.`)) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const body = new URLSearchParams({ csrf, action: "merge", id, targetId: cleanTarget });
      const res = await fetch("/gestao-editorial/tags/acao", { method: "POST", body, cache: "no-store" });
      if (res.ok) {
        setMode("idle");
        setMessage("Tags mescladas com sucesso.");
        router.refresh();
      } else if (res.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (res.status === 403) setMessage("Sem permissão para esta ação.");
      else if (res.status === 404) setMessage("Tag de destino não encontrada.");
      else setMessage("Não foi possível mesclar.");
    } catch {
      setUncertain(true);
      setMessage("Resultado incerto. Atualize a página antes de tentar.");
    } finally {
      busy.current = false; setPending(false);
    }
  }

  return (
    <div>
      <div className={styles.actions} style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
        <button type="button" onClick={() => setMode(mode === "edit" ? "idle" : "edit")} disabled={pending || uncertain} style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", cursor: "pointer" }}>
          {mode === "edit" ? "Cancelar" : "Renomear"}
        </button>
        <button type="button" onClick={() => setMode(mode === "merge" ? "idle" : "merge")} disabled={pending || uncertain} style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", cursor: "pointer" }}>
          {mode === "merge" ? "Cancelar" : "Mesclar"}
        </button>
        <button type="button" onClick={handleDelete} disabled={pending || uncertain} style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", cursor: "pointer", background: postCount > 0 ? "var(--border)" : "#733" }}>
          {pending ? "…" : "Excluir"}
        </button>
      </div>

      {mode === "edit" && (
        <form className={styles.moderate} onSubmit={handleEdit} style={{ marginTop: "0.5rem" }}>
          <label>
            Novo nome
            <input required minLength={1} maxLength={50} value={name} onChange={e => setName(e.target.value)} disabled={pending || uncertain} />
          </label>
          <button disabled={pending || uncertain}>{pending ? "Salvando…" : "Salvar"}</button>
        </form>
      )}

      {mode === "merge" && (
        <form className={styles.moderate} onSubmit={handleMerge} style={{ marginTop: "0.5rem" }}>
          <label>
            ID da tag de destino (para onde os artigos serão transferidos)
            <input required pattern="^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$" placeholder="UUID da tag de destino" value={targetId} onChange={e => setTargetId(e.target.value)} disabled={pending || uncertain} />
          </label>
          <button disabled={pending || uncertain}>{pending ? "Mesclando…" : "Confirmar mesclagem"}</button>
        </form>
      )}

      {message && <p role="status" style={{ fontSize: "0.8rem", margin: "0.25rem 0 0" }}>{message}</p>}
    </div>
  );
}
