"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./toast.module.css";

export type ToastKind = "success" | "error" | "warning" | "info";
type Toast = { id: string; message: string; kind: ToastKind; duration: number };
const eventName = "entrelinhas:toast";

export function showToast(message: string, kind: ToastKind = "info", duration = 5000) {
  window.dispatchEvent(new CustomEvent(eventName, { detail: { id: crypto.randomUUID(), message, kind, duration } }));
}

function ToastItem({ toast, remove }: { toast: Toast; remove: (id: string) => void }) {
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setClosing(true), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.duration]);
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => remove(toast.id), 180);
    return () => window.clearTimeout(timer);
  }, [closing, remove, toast.id]);
  return <div className={`${styles.toast} ${styles[toast.kind]} ${closing ? styles.closing : ""}`}>
    <p role={toast.kind === "error" ? "alert" : "status"}>{toast.message}</p>
    <button type="button" className={styles.close} aria-label="Fechar notificação" onClick={() => setClosing(true)}>×</button>
  </div>;
}

export default function Toasts() {
  const [items, setItems] = useState<Toast[]>([]);
  const remove = useCallback((id: string) => setItems(current => current.filter(item => item.id !== id)), []);
  useEffect(() => {
    const add = (event: Event) => setItems(current => [...current, (event as CustomEvent<Toast>).detail]);
    window.addEventListener(eventName, add);
    return () => window.removeEventListener(eventName, add);
  }, []);
  return <div className={styles.container} aria-label="Notificações">
    {items.map(item => <ToastItem key={item.id} toast={item} remove={remove} />)}
  </div>;
}
