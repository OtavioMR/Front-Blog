"use client";

import Link from "next/link";
import { useSession } from "@/lib/use-session";
import { canWritePosts } from "@/lib/permissions";
import styles from "./post.module.css";

// Visual convenience only: the API and the editor both re-check that the signed-in user owns the post.
export default function EditPostLink({ postId, authorId }: { postId: string; authorId?: string }) {
  const { status, profile } = useSession();
  if (status !== "signed-in" || !profile || !authorId || profile.id !== authorId || !canWritePosts(profile.role)) return null;
  return <Link className={styles.editLink} href={`/studio/${encodeURIComponent(postId)}`}>Editar conto</Link>;
}