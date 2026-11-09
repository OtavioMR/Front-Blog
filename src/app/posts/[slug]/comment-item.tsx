"use client";

import { useEffect, useId, useRef, useState } from "react";
import ConfirmDialog from "@/app/_components/confirm-dialog";
import Avatar from "@/app/_components/avatar";
import { showToast } from "@/app/_components/toast";
import { authenticatedFetchForSubject } from "@/lib/session-client";
import { useCommentSession } from "./comment-session";
import { manageComment } from "./comment-manage";
import type { Comment } from "./comments";
import styles from "./post.module.css";
import CommentLike from "./comment-like";
import { ReportForm } from "./report-form";

export default function CommentItem({ item, postAuthorId, onDeleted }: { item: Comment; postAuthorId?: string; onDeleted?: () => void }) {
  const session = useCommentSession();
  const { profile } = session;
  const [current, setCurrent] = useState(item);
  const [text, setText] = useState(item.content);
  const [editing, setEditing] = useState(false);
  const [editingSubject, setEditingSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState("");
  const [reportOwner, setReportOwner] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const own = !!profile && !!current.author.id && profile.id === current.author.id;
  const mayEdit = own || profile?.role === "ADMIN";
  const mayDelete = mayEdit || (!!profile && profile.id === postAuthorId);
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); buttonRef.current?.focus(); } };
    const close = () => setMenuOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    document.addEventListener("comment-menu-open", close);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); document.removeEventListener("comment-menu-open", close); };
  }, [menuOpen]);

  async function mutate(method: "PATCH" | "DELETE") {
    if (!profile || busy || uncertain) return;
    if ((method === "PATCH" && !mayEdit) || (method === "DELETE" && !mayDelete)) { setMessage("Você não tem permissão para esta ação."); return; }
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

  return <div className={styles.comment}><div className={styles.commentHeader}><div className={styles.commentAuthor}><Avatar name={current.author.name} src={current.author.profilePhoto} size={36} /><div><strong>{current.author.name}</strong><time dateTime={current.createdAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(current.createdAt))}</time></div></div>
    {current.isActive && profile && !editing && <div className={styles.commentMenu} ref={menuRef}><button ref={buttonRef} type="button" className={styles.commentMenuTrigger} aria-label="Ações do comentário" aria-expanded={menuOpen} aria-controls={menuId} onClick={() => { if (!menuOpen) document.dispatchEvent(new Event("comment-menu-open")); setMenuOpen(!menuOpen); }}>⋯</button>{menuOpen && <div id={menuId} className={styles.commentMenuPanel}>
      {mayEdit && <button className={styles.commentMenuAction} type="button" disabled={busy || uncertain} onClick={() => { if (!mayEdit || !profile) return; setEditingSubject(profile.id); setText(current.content); setEditing(true); setMenuOpen(false); }}>Editar comentário</button>}
      {mayDelete && <button className={styles.commentMenuAction} type="button" disabled={busy || uncertain} onClick={() => { setConfirming(profile.id); setMenuOpen(false); }}>Excluir comentário</button>}
      {!own && <button className={styles.commentMenuAction} type="button" onClick={() => { setReportOwner(profile.id); setMenuOpen(false); }}>Denunciar comentário</button>}
    </div>}
    <div style={{ display: "none" }} aria-hidden="true">
      {mayEdit && <button type="button" disabled={busy || uncertain} onClick={() => { if (!mayEdit || !profile) return; setEditingSubject(profile.id); setText(current.content); setEditing(true); }}>Editar</button>}
      {mayDelete && <button type="button" disabled={busy || uncertain} onClick={() => setConfirming(profile.id)}>Desativar</button>}
    </div>
    </div>}</div>
    {editing ? <form className={styles.commentEdit} onSubmit={event => { event.preventDefault(); void mutate("PATCH"); }}><label>Editar comentário<textarea className={styles.commentEditInput} value={text} onChange={event => setText(event.target.value)} maxLength={1000} readOnly={busy || uncertain} /></label><button className={styles.commentEditAction} type="submit" disabled={busy || uncertain}>{busy ? "Salvando…" : "Salvar"}</button><button className={styles.commentEditAction} type="button" disabled={busy || uncertain} onClick={() => { setEditing(false); setText(current.content); }}>Cancelar</button></form> : <p>{current.isActive ? current.content : "Comentário excluído"}</p>}
    {current.editedAt && current.isActive && <span>Editado</span>}
    {current.isActive && <CommentLike commentId={current.id} />}
    {current.isActive && reportOwner && <ReportForm target="COMMENT" targetId={current.id} session={session} initialOwner={reportOwner} onClose={() => { setReportOwner(""); requestAnimationFrame(() => buttonRef.current?.focus({ preventScroll: true })); }} onSuccess={() => { setReportOwner(""); setMenuOpen(false); showToast("Denúncia enviada com sucesso.", "success"); requestAnimationFrame(() => buttonRef.current?.focus({ preventScroll: true })); }} />}
    {busy && !editing && <p role="status">Excluindo comentário…</p>}
    {confirming && <ConfirmDialog title={"Desativar coment\u00e1rio?"} description={"O coment\u00e1rio ser\u00e1 desativado. As respostas ser\u00e3o preservadas."} confirmLabel={"Desativar coment\u00e1rio"} onCancel={() => setConfirming("")} onConfirm={() => { setConfirming(""); if (profile?.id === confirming) void mutate("DELETE"); else setMessage("A conta mudou. Confira sua sess\u00e3o antes de tentar novamente."); }} />}
    {message && <p role="status">{message}</p>}{uncertain && <button type="button" className={styles.repliesButton} onClick={() => window.location.reload()}>Recarregar página</button>}
  </div>;
}
