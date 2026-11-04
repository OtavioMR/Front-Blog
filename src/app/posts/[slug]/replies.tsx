"use client";

import { useRef, useState } from "react";
import type { Comment } from "./comments";
import { fetchReplies } from "./replies-data";
import CommentForm from "./comment-form";
import styles from "./post.module.css";

export default function Replies({ postId, rootId, initial, total, slug, page, canReply }: { postId: string; rootId: string; initial: Comment[]; total: number; slug: string; page: number; canReply: boolean }) {
  const [replying, setReplying] = useState(false);
  return <div>
    <ReplyList key={`${rootId}-${total}`} postId={postId} rootId={rootId} initial={initial} total={total} />
    {canReply && <><button type="button" className={styles.repliesButton} aria-expanded={replying} onClick={() => setReplying(value => !value)}>{replying ? "Fechar resposta" : "Responder"}</button>{replying && <CommentForm postId={postId} slug={slug} page={page} replyToId={rootId} />}</>}
  </div>;
}

function ReplyList({ postId, rootId, initial, total }: { postId: string; rootId: string; initial: Comment[]; total: number }) {
  const [items, setItems] = useState(initial);
  const [nextPage, setNextPage] = useState(2);
  const [hasMore, setHasMore] = useState(total > initial.length);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const running = useRef(false);

  async function loadMore() {
    if (running.current) return;
    running.current = true; setBusy(true); setError(false);
    try {
      const result = await fetchReplies(postId, rootId, nextPage);
      setItems(previous => {
        const ids = new Set(previous.map(item => item.id));
        return [...previous, ...result.data.filter(item => !ids.has(item.id))];
      });
      setNextPage(result.meta.page + 1); setHasMore(result.meta.hasNextPage);
    } catch { setError(true); }
    finally { running.current = false; setBusy(false); }
  }

  return <div>
    {items.length > 0 && <ol className={styles.replies} id={`respostas-${rootId}`}>{items.map(reply => <li className={styles.comment} key={reply.id}><strong>{reply.author.name}</strong><time dateTime={reply.createdAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(reply.createdAt))}</time><p>{reply.isActive ? reply.content : "Comentário excluído"}</p>{reply.editedAt && reply.isActive && <span>Editado</span>}</li>)}</ol>}
    {error && <p role="alert">Não foi possível carregar as respostas. Tente novamente.</p>}
    {hasMore && <button type="button" className={styles.repliesButton} onClick={loadMore} disabled={busy} aria-controls={items.length ? `respostas-${rootId}` : undefined}>{busy ? "Carregando respostas…" : error ? "Tentar carregar respostas novamente" : "Ver mais respostas"}</button>}
  </div>;
}
