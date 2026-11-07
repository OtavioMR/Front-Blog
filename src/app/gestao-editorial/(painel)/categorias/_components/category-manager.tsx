"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../admin.module.css";

export function CategoryCreateForm({ csrf }: { csrf: string }) {
  const router = useRouter(), busy = useRef(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanName = name.trim(), cleanDesc = description.trim();
    if (busy.current || uncertain || cleanName.length < 2 || cleanName.length > 100 || cleanDesc.length > 255) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const body = new URLSearchParams({ csrf, action: "create", name: cleanName, description: cleanDesc });
      const res = await fetch("/gestao-editorial/categorias/acao", { method: "POST", body, cache: "no-store" });
      if (res.ok) {
        setName("");
        setDescription("");
        setMessage("Categoria criada com sucesso.");
        router.refresh();
      } else if (res.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (res.status === 403) setMessage("Sem permissão para esta ação.");
      else if (res.status === 409) setMessage("Já existe uma categoria com este nome ou endereço.");
      else setMessage("Não foi possível criar. Confira os dados informados.");
    } catch {
      setUncertain(true);
      setMessage("Resultado incerto. Atualize a página e confira a lista antes de tentar novamente.");
    } finally {
      busy.current = false; setPending(false);
    }
  }

  return (
    <form className={styles.moderate} onSubmit={submit}>
      <label>
        Nome da categoria
        <input required minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} disabled={pending || uncertain} placeholder="Ex: Tecnologia" />
      </label>
      <label>
        Descrição (opcional)
        <textarea maxLength={255} value={description} onChange={e => setDescription(e.target.value)} disabled={pending || uncertain} placeholder="Breve resumo sobre a categoria" />
      </label>
      <button disabled={pending || uncertain}>{pending ? "Criando…" : "Criar categoria"}</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}

export function CategoryRowActions({
  id,
  currentName,
  currentSlug,
  currentDescription,
  isActive,
  csrf,
}: {
  id: string;
  currentName: string;
  currentSlug: string;
  currentDescription: string;
  isActive: boolean;
  csrf: string;
}) {
  const router = useRouter(), busy = useRef(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [slug, setSlug] = useState(currentSlug);
  const [description, setDescription] = useState(currentDescription);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanName = name.trim(), cleanSlug = slug.trim(), cleanDesc = description.trim();
    if (busy.current || uncertain || cleanName.length < 2 || cleanName.length > 100 || cleanSlug.length < 2 || cleanSlug.length > 120 || cleanDesc.length > 255) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const body = new URLSearchParams({ csrf, action: "edit", id, name: cleanName, slug: cleanSlug, description: cleanDesc });
      const res = await fetch("/gestao-editorial/categorias/acao", { method: "POST", body, cache: "no-store" });
      if (res.ok) {
        setEditing(false);
        setMessage("Categoria atualizada.");
        router.refresh();
      } else if (res.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (res.status === 403) setMessage("Sem permissão para esta ação.");
      else if (res.status === 409) setMessage("Conflito: slug ou nome já em uso.");
      else setMessage("Não foi possível atualizar.");
    } catch {
      setUncertain(true);
      setMessage("Resultado incerto. Atualize a página antes de tentar novamente.");
    } finally {
      busy.current = false; setPending(false);
    }
  }

  async function handleDelete() {
    if (busy.current || uncertain) return;
    if (!window.confirm(`Desativar a categoria "${currentName}"? Ela deixará de aparecer publicamente, mas artigos e associações serão mantidos.`)) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const body = new URLSearchParams({ csrf, action: "delete", id });
      const res = await fetch("/gestao-editorial/categorias/acao", { method: "POST", body, cache: "no-store" });
      if (res.ok) {
        setMessage("Categoria desativada.");
        router.refresh();
      } else if (res.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (res.status === 403) setMessage("Sem permissão para esta ação.");
      else setMessage("Não foi possível desativar.");
    } catch {
      setUncertain(true);
      setMessage("Resultado incerto. Atualize a página antes de tentar novamente.");
    } finally {
      busy.current = false; setPending(false);
    }
  }

  async function handleReactivate() {
    if (busy.current || uncertain) return;
    if (!window.confirm(`Reativar a categoria "${currentName}"? Ela voltará a aparecer na listagem pública.`)) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const body = new URLSearchParams({ csrf, action: "reactivate", id });
      const res = await fetch("/gestao-editorial/categorias/acao", { method: "POST", body, cache: "no-store" });
      if (res.ok) {
        setMessage("Categoria reativada com sucesso.");
        router.refresh();
      } else if (res.status === 401) setMessage("Sessão expirada. Entre novamente.");
      else if (res.status === 403) setMessage("Sem permissão para esta ação.");
      else setMessage("Não foi possível reativar.");
    } catch {
      setUncertain(true);
      setMessage("Resultado incerto. Atualize a página antes de tentar novamente.");
    } finally {
      busy.current = false; setPending(false);
    }
  }

  return (
    <div>
      <div className={styles.actions} style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
        <button type="button" onClick={() => setEditing(!editing)} disabled={pending || uncertain} style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", cursor: "pointer" }}>
          {editing ? "Cancelar" : "Editar"}
        </button>
        {isActive ? (
          <button type="button" onClick={handleDelete} disabled={pending || uncertain} style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", cursor: "pointer", background: "#733" }}>
            {pending ? "…" : "Desativar"}
          </button>
        ) : (
          <button type="button" onClick={handleReactivate} disabled={pending || uncertain} style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", cursor: "pointer", background: "var(--accent, #0066cc)" }}>
            {pending ? "…" : "Reativar"}
          </button>
        )}
      </div>
      {editing && (
        <form className={styles.moderate} onSubmit={handleEdit} style={{ marginTop: "0.5rem" }}>
          <label>
            Nome
            <input required minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} disabled={pending || uncertain} />
          </label>
          <label>
            Endereço (slug)
            <input required minLength={2} maxLength={120} value={slug} onChange={e => setSlug(e.target.value)} disabled={pending || uncertain} />
          </label>
          <label>
            Descrição
            <textarea maxLength={255} value={description} onChange={e => setDescription(e.target.value)} disabled={pending || uncertain} />
          </label>
          <button disabled={pending || uncertain}>{pending ? "Salvando…" : "Salvar alterações"}</button>
        </form>
      )}
      {message && <p role="status" style={{ fontSize: "0.8rem", margin: "0.25rem 0 0" }}>{message}</p>}
    </div>
  );
}
