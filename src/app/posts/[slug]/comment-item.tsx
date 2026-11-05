"use client";

import { useState } from "react";
import ConfirmDialog from "@/app/_components/confirm-dialog";
import { authenticatedFetchForSubject } from "@/lib/session-client";
import { useCommentSession } from "./comment-session";
import { manageComment } from "./comment-manage";
import type { Comment } from "./comments";
import styles from "./post.module.css";
import CommentLike from "./comment-like";

export default function CommentItem({ item, postAuthorId, onDeleted }: { item: Comment; postAuthorId?: string; onDeleted?: () => void }) {
  const { profile } = useCommentSession();
  const [current, setCurrent] = useState(item);
  const [text, setText] = useState(item.content);
  const [editing, setEditing] = useState(false);
  const [editingSubject, setEditingSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState("");
  const own = !!profile && !!current.author.id && profile.id === current.author.id;
  const mayEdit = own || profile?.role === "ADMIN";
  const mayDelete = mayEdit || (!!profile && profile.id === postAuthorId);

  async function mutate(method: "PATCH" | "DELETE") {
    if (!profile || busy || uncertain) return;
    if (method === "PATCH" && editingSubject !== profile.id) { setMessage("A conta mudou. Seu texto foi preservado; entre novamente com a conta original para salvar."); return; }
    if (method === "PATCH" && (!text.trim() || text.length > 1000)) { setMessage("Escreva um comentário de até 1000 caracteres."); return; }
    setBusy(true); setMessage("");
    const result = await manageComment(authenticatedFetchForSubject, profile.id, current.id, method, text);
    if (result.kind === "updated") { setCurrent(previous => ({ ...previous, content: result.content, editedAt: result.editedAt })); setEditing(false); setMessage("Comentário atualizado."); }
    else if (result.kind === "deleted") { setCurrent(previous => ({ ...previous, isActive: false, content: "Comentário excluído" })); setEditing(false); setMessage("Comentário desativado."); onDeleted?.(); }
    else if (result.kind === "unauthorized") setMessage("Entre novamente para continuar.");
    else if (result.kind === "forbidden") setMessage("Você não tem permissão para esta ação.");
    else if (result.kind === "invalid" || result.kind === "missing") { setMessage("O comentário não está disponível para esta ação. Recarregue a página."); setUncertain(true); }
    else if (result.kind === "changed") { setMessage("A conta mudou. Seu texto foi preservado; copie-o antes de recarregar."); setUncertain(true); }
    else { setUncertain(true); setMessage("Não foi possível confirmar o resultado. Copie seu texto e recarregue a página antes de tentar novamente."); }
    setBusy(false);
  }

  return <div className={styles.comment}><strong>{current.author.name}</strong><time dateTime={current.createdAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(current.createdAt))}</time>
    {editing ? <form className={styles.commentEdit} onSubmit={event => { event.preventDefault(); void mutate("PATCH"); }}><label>Editar comentário<textarea className={styles.commentEditInput} value={text} onChange={event => setText(event.target.value)} maxLength={1000} readOnly={busy || uncertain} /></label><button className={styles.commentEditAction} type="submit" disabled={busy || uncertain}>Salvar</button><button className={styles.commentEditAction} type="button" disabled={busy || uncertain} onClick={() => { setEditing(false); setText(current.content); }}>Cancelar</button></form> : <p>{current.isActive ? current.content : "Comentário excluído"}</p>}
    {current.editedAt && current.isActive && <span>Editado</span>}
    {current.isActive && <CommentLike commentId={current.id} />}
    {current.isActive && !editing && <div>{mayEdit && <button type="button" className={styles.repliesButton} disabled={busy || uncertain} onClick={() => { setEditingSubject(profile!.id); setEditing(true); }}>Editar</button>}{mayDelete && <button type="button" className={styles.repliesButton} disabled={busy || uncertain} onClick={() => setConfirming(profile!.id)}>{busy ? "Aguarde…" : "Desativar"}</button>}</div>}
    {confirming && <ConfirmDialog title={"Desativar coment\u00e1rio?"} description={"O coment\u00e1rio ser\u00e1 desativado. As respostas ser\u00e3o preservadas."} confirmLabel={"Desativar coment\u00e1rio"} onCancel={() => setConfirming("")} onConfirm={() => { setConfirming(""); if (profile?.id === confirming) void mutate("DELETE"); else setMessage("A conta mudou. Confira sua sess\u00e3o antes de tentar novamente."); }} />}
    {message && <p role="status">{message}</p>}{uncertain && <button type="button" className={styles.repliesButton} onClick={() => window.location.reload()}>Recarregar página</button>}
  </div>;
}
