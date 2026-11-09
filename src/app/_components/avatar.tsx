"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./avatar.module.css";

const PHOTO = /^(\/uploads\/profile-photos\/[0-9a-f-]+\.(?:webp|png|jpe?g)|https:\/\/[a-z0-9.-]+\/(?:profile-photos\/)?[0-9a-f-]+\.(?:webp|png|jpe?g))$/i;

export function initialsOf(name?: string | null): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Shows the photo when valid and loadable; otherwise falls back to initials (never a broken image).
export default function Avatar({ name, src, size = 40, className = "" }: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const image = useRef<HTMLImageElement>(null);
  const valid = typeof src === "string" && (PHOTO.test(src) || src.startsWith("blob:")) && failed !== src;
  useEffect(() => {
    const element = image.current;
    // A resposta pode falhar antes de o React hidratar o HTML do servidor.
    if (valid && element?.complete && element.naturalWidth === 0) setFailed(src);
  }, [src, valid]);
  return <span className={`${styles.avatar} ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden="true">
    {valid ? <img ref={image} src={src} alt="" width={size} height={size} onError={() => setFailed(src)} /> : initialsOf(name) || <svg width="55%" height="55%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>}
  </span>;
}
