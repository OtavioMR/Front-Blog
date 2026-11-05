"use client";

import { useEffect, useId, useRef } from "react";
import styles from "./confirm-dialog.module.css";

type Props = {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({ title, description, confirmLabel, onCancel, onConfirm }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    return () => { element.close(); };
  }, []);

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id={titleId} className={styles.title}>{title}</h2>
    <p id={descriptionId} className={styles.description}>{description}</p>
    <div className={styles.actions}>
      <button type="button" className={styles.cancel} onClick={onCancel} autoFocus>Cancelar</button>
      <button type="button" className={styles.confirm} onClick={onConfirm}>{confirmLabel}</button>
    </div>
  </dialog>;
}
