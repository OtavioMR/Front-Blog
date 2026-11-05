"use client";

import { useState } from "react";
import { authenticatedFetchForSubject } from "@/lib/session-client";
import { useCommentSession } from "./comment-session";
import { manageComment } from "./comment-manage";
import type { Comment } from "./comments";
import styles from "./post.module.css";

export default function CommentItem({ item, postAuthorId }: { item: Comment; postAuthorId?: string }) {
  const { profile } = useCommentSession();
  const [current, setCurrent] = useState(item);
  const [text, setText] = useState(item.content);
  const [editing, setEditing] = useState(false);
  const [editingSubject, setEditingSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const own = !!profile && !!current.author.id && profile.id === current.author.id;
  const mayEdit = own || profile?.role === "ADMIN";
  const mayDelete = mayEdit || (!!profile && profile.id === postAuthorId);

  async function mutate(method: "PATCH" | "DELETE") {
    if (!profile || busy || uncertain) return;
    if (method === "PATCH" && editingSubject !== profile.id) { setMessage("A conta mudou. Seu texto foi preservado; entre novamente com a conta original para salvar."); return; }
    if (method === "PATCH" && (!text.trim() || text.length > 1000)) { setMessage("Escreva um comentário de até 1000 caracteres."); return; }
    if (method === "DELETE" && !window.confirm("Desativar este comentário? As respostas serão preservadas.")) return;
    setBusy(true); setMessage("");
    const result = await manageComment(authenticatedFetchForSubject, profile.id, current.id, method, text);
    if (result.kind === "updated") { setCurrent(previous => ({ ...previous, content: result.content, editedAt: result.editedAt })); setEditing(false); setMessage("Comentário atualizado."); }
    else if (result.kind === "deleted") { window.location.reload(); return; }
    else if (result.kind === "unauthorized") setMessage("Entre novamente para continuar.");
    else if (result.kind === "forbidden") setMessage("Você não tem permissão para esta ação.");
    else if (result.kind === "invalid" || result.kind === "missing") { setMessage("O comentário não está disponível para esta ação. Recarregue a página."); setUncertain(true); }
    else if (result.kind === "changed") { setMessage("A conta mudou. Seu texto foi preservado; copie-o antes de recarregar."); setUncertain(true); }
    else { setUncertain(true); setMessage("Não foi possível confirmar o resultado. Copie seu texto e recarregue a página antes de tentar novamente."); }
    setBusy(false);
  }

  return <div className={styles.comment}><strong>{current.author.name}</strong><time dateTime={current.createdAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(current.createdAt))}</time>
    {editing ? <form className={styles.commentEdit} onSubmit={event => { event.preventDefault(); void mutate("PATCH"); }}><label>Editar comentário<textarea value={text} onChange={event => setText(event.target.value)} maxLength={1000} readOnly={busy || uncertain} /></label><button type="submit" disabled={busy || uncertain}>Salvar</button><button type="button" disabled={busy || uncertain} onClick={() => { setEditing(false); setText(current.content); }}>Cancelar</button></form> : <p>{current.isActive ? current.content : "Comentário excluído"}</p>}
    {current.editedAt && current.isActive && <span>Editado</span>}
    {current.isActive && !editing && <div>{mayEdit && <button type="button" className={styles.repliesButton} disabled={busy || uncertain} onClick={() => { setEditingSubject(profile!.id); setEditing(true); }}>Editar</button>}{mayDelete && <button type="button" className={styles.repliesButton} disabled={busy || uncertain} onClick={() => void mutate("DELETE")}>{busy ? "Aguarde…" : "Desativar"}</button>}</div>}
    {message && <p role="status">{message}</p>}{uncertain && <button type="button" className={styles.repliesButton} onClick={() => window.location.reload()}>Recarregar página</button>}
  </div>;
}
