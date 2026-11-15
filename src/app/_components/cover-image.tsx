"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { publicCoverPath } from "@/lib/public-post";
import styles from "./cover-image.module.css";

type CoverImageProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  fallbackLabel?: string;
  iconSize?: number;
};

/**
 * Renders an article or series cover image with automatic fallback to a
 * Griforio editorial placeholder when missing, invalid, or broken on load.
 */
export default function CoverImage({
  src,
  alt = "",
  className = "",
  fallbackLabel,
  iconSize = 22,
}: CoverImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const resolved = src?.startsWith("blob:") ? src : publicCoverPath(src ?? null);
  const valid = Boolean(resolved) && failedSrc !== resolved;

  useEffect(() => {
    const el = imgRef.current;
    if (valid && resolved && el?.complete && el.naturalWidth === 0) {
      setFailedSrc(resolved);
    }
  }, [resolved, valid]);

  return (
    <div className={`${styles.frame} ${className}`}>
      {valid && resolved ? (
        <img
          ref={imgRef}
          src={resolved}
          alt={alt}
          className={styles.img}
          onError={() => setFailedSrc(resolved)}
        />
      ) : (
        <div className={styles.placeholder} aria-hidden={!alt || undefined}>
          <BookOpen size={iconSize} strokeWidth={1.6} aria-hidden="true" />
          {fallbackLabel && <span className={styles.label}>{fallbackLabel}</span>}
        </div>
      )}
    </div>
  );
}
