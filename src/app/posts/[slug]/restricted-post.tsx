"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
import { publicCoverPath } from "@/lib/public-post";
import styles from "./post.module.css";

export default function RestrictedPostUnlocker({
  slug,
  fallback,
}: {
  slug: string;
  fallback: ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const revision = useRef(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const current = ++revision.current;
      try {
        const profile = await getOwnProfile();
        if (!active || current !== revision.current) return;
        if (!profile) {
          setUnlocked(false);
          return;
        }

        const response = await authenticatedFetchForSubject(profile.id, `/api/v1/posts/${encodeURIComponent(slug)}`, {
          cache: "no-store",
        });
        if (!active || current !== revision.current) return;
        if (!response.ok) {
          setUnlocked(false);
          return;
        }

        const data: unknown = await response.json();
        if (data && typeof data === "object" && "content" in data && typeof data.content === "string") {
          const coverUrl = "coverImage" in data && typeof data.coverImage === "string" ? publicCoverPath(data.coverImage) : null;
          setContent(data.content);
          setCover(coverUrl);
          setUnlocked(true);
        } else {
          setUnlocked(false);
        }
      } catch {
        if (active && current === revision.current) {
          setUnlocked(false);
        }
      }
    };

    const unsubscribe = subscribeSession(() => {
      void load();
    });

    void load();

    return () => {
      active = false;
      revision.current++;
      unsubscribe();
    };
  }, [slug]);

  if (!unlocked || !content) {
    return <>{fallback}</>;
  }

  const plainText = !/<[a-z][\s\S]*?>/i.test(content);

  return (
    <>
      {cover && (
        <div className={styles.cover}>
          <Image className={styles.coverBackdrop} src={cover} alt="" width={1920} height={1080} unoptimized />
          <Image src={cover} alt="" width={1920} height={1080} unoptimized />
        </div>
      )}
      <div
        className={plainText ? `${styles.content} ${styles.plainContent}` : styles.content}
        data-reading-body
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </>
  );
}
