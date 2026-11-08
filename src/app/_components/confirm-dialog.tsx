"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./confirm-dialog.module.css";

type Props = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "neutral";
  isAlert?: boolean;
  onCancel: () => void;
  onConfirm?: () => void;
  children?: ReactNode;
};

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  isAlert = false,
  onCancel,
  onConfirm,
  children,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!element.open) element.showModal();
    return () => {
      if (element.open) element.close();
    };
  }, []);

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    else onCancel();
  };

  const confirmClass = variant === "primary" ? styles.confirmPrimary : styles.confirmDanger;

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) {
          onCancel();
        }
      }}
    >
      <h2 id={titleId} className={styles.title}>{title}</h2>
      <p id={descriptionId} className={styles.description}>{description}</p>
      {children}
      <div className={styles.actions}>
        {!isAlert && (
          <button type="button" className={styles.cancel} onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
        )}
        <button
          type="button"
          className={`${styles.confirm} ${confirmClass}`}
          onClick={handleConfirm}
          autoFocus={isAlert}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
