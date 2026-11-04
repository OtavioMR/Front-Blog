"use client";

import { useRouter } from "next/navigation";
import styles from "./back-button.module.css";

const AUTH_PATHS = ["/entrar", "/cadastro", "/recuperar-senha", "/reset-password", "/confirmar-email", "/reenviar-verificacao"];

// Goes back in the SPA history when the previous page is a suitable in-app page; otherwise uses `fallback`.
export default function BackButton({ fallback = "/", label = "Voltar", className = "", confirmMessage }: { fallback?: string; label?: string; className?: string; confirmMessage?: string }) {
  const router = useRouter();
  function goBack() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    let previous: string | null = null;
    try { previous = sessionStorage.getItem("blog-nav-prev"); } catch { /* use fallback */ }
    const usable = previous && previous.startsWith("/") && !previous.startsWith("//") && !AUTH_PATHS.some(path => previous === path || previous!.startsWith(`${path}/`)) && window.history.length > 1;
    if (usable) router.back(); else router.push(fallback);
  }
  return (
    <button
      type="button"
      data-back-button="true"
      className={`${styles.back} ${className}`}
      onClick={goBack}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M13 8H3M7.5 3.5 3 8l4.5 4.5" />
      </svg>
      <span>{label}</span>
    </button>
  );
}