"use client";

import { useRef, useState } from "react";
import type { Comment } from "./comments";
import { fetchReplies } from "./replies-data";
import CommentForm from "./comment-form";
import CommentItem from "./comment-item";
import styles from "./post.module.css";

export default function Replies({ postId, rootId, initial, total, slug, page, canReply, postAuthorId }: { postId: string; rootId: string; initial: Comment[]; total: number; slug: string; page: number; canReply: boolean; postAuthorId?: string }) {
  const [replying, setReplying] = useState(false);
  return <div>
    <ReplyList key={`${rootId}-${total}`} postId={postId} rootId={rootId} initial={initial} total={total} postAuthorId={postAuthorId} />
    {canReply && <><button type="button" className={styles.repliesButton} aria-expanded={replying} onClick={() => setReplying(value => !value)}>{replying ? "Fechar resposta" : "Responder"}</button>{replying && <CommentForm postId={postId} slug={slug} page={page} replyToId={rootId} />}</>}
  </div>;
}

const STEP = 3;

function ReplyList({ postId, rootId, initial, total, postAuthorId }: { postId: string; rootId: string; initial: Comment[]; total: number; postAuthorId?: string }) {
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(STEP);
  const [nextPage, setNextPage] = useState(2);
  const [hasMore, setHasMore] = useState(total > initial.length);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const running = useRef(false);
  const count = Math.max(total, items.length);

  async function showMore() {
    if (running.current) return;
    if (visible < items.length) { setVisible(value => value + STEP); return; }
    if (!hasMore) return;
    running.current = true; setBusy(true); setError(false);
    try {
      const result = await fetchReplies(postId, rootId, nextPage);
      setItems(previous => {
        const ids = new Set(previous.map(item => item.id));
        return [...previous, ...result.data.filter(item => !ids.has(item.id))];
      });
      setNextPage(result.meta.page + 1); setHasMore(result.meta.hasNextPage); setVisible(value => value + STEP);
    } catch { setError(true); }
    finally { running.current = false; setBusy(false); }
  }
  function toggle() { setOpen(value => !value); setVisible(STEP); setError(false); }

  if (count === 0) return null;
  const shown = items.slice(0, visible);
  const canShowMore = visible < items.length || hasMore;
  return <div>
    <button type="button" className={styles.repliesButton} onClick={toggle} aria-expanded={open} aria-controls={`respostas-${rootId}`}>{open ? "Ocultar respostas" : `Ver ${count} ${count === 1 ? "resposta" : "respostas"}`}</button>
    {open && <>
      <ol className={styles.replies} id={`respostas-${rootId}`}>{shown.map(reply => <li key={reply.id}><CommentItem item={reply} postAuthorId={postAuthorId} /></li>)}</ol>
      {error && <p role="alert">Não foi possível carregar as respostas. Tente novamente.</p>}
      {canShowMore && <button type="button" className={styles.repliesButton} onClick={showMore} disabled={busy}>{busy ? "Carregando respostas…" : error ? "Tentar novamente" : "Mostrar mais respostas"}</button>}
    </>}
  </div>;
}
