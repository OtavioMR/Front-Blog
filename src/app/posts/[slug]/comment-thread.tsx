"use client";

import { useState } from "react";
import type { Comment } from "./comments";
import CommentItem from "./comment-item";
import Replies from "./replies";

export default function CommentThread({ item, postAuthorId, slug, page }: { item: Comment & { replies: { data: Comment[]; meta: { total: number } } }; postAuthorId?: string; slug: string; page: number }) {
  const [active, setActive] = useState(item.isActive);
  return <><CommentItem item={item} postAuthorId={postAuthorId} onDeleted={() => setActive(false)} /><Replies postId={item.postId} rootId={item.id} initial={item.replies.data} total={item.replies.meta.total} slug={slug} page={page} canReply={active} postAuthorId={postAuthorId} /></>;
}
