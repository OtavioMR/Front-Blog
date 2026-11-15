"use client";

import sanitizeHtml from "sanitize-html";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
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
          setContent(sanitizeHtml(data.content, { allowedTags: ["p", "br", "strong", "em", "b", "i", "u", "s", "ul", "ol", "li", "blockquote", "pre", "code", "h2", "h3", "h4", "a"], allowedAttributes: { a: ["href", "title"] }, allowedSchemes: ["http", "https", "mailto"], allowProtocolRelative: false }));
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
      <div
        className={plainText ? `${styles.content} ${styles.plainContent}` : styles.content}
        data-reading-body
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </>
  );
}
