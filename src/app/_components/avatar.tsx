"use client";

import { useState } from "react";
import styles from "./avatar.module.css";

const PHOTO = /^\/uploads\/profile-photos\/[0-9a-f-]+\.(?:webp|png|jpe?g)$/i;

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Shows the photo when valid and loadable; otherwise falls back to initials (never a broken image).
export default function Avatar({ name, src, size = 40, className = "" }: { name: string; src?: string | null; size?: number; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const valid = src && (PHOTO.test(src) || src.startsWith("blob:")) && failed !== src;
  return <span className={`${styles.avatar} ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden="true">
    {valid ? <img src={src} alt="" width={size} height={size} onError={() => setFailed(src)} /> : initialsOf(name)}
  </span>;
}