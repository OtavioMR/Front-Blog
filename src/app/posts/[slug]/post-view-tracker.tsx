"use client";

import { useEffect, useRef } from "react";
import { trackPostView } from "./track-post-view";

// Mount directly inside the article; its parent is observed, not this marker.
export default function PostViewTracker({ postId }: { postId: string }) {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const article = marker.current?.parentElement;
    if (article) return trackPostView(postId, article);
  }, [postId]);
  return <span ref={marker} hidden aria-hidden="true" />;
}
