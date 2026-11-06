"use client";

import { useSyncExternalStore } from "react";
import styles from "./bg-tone-control.module.css";

export type BgTone = "neutral" | "warm";
const eventName = "entrelinhas-bg-tone-change";

export function getBgTone(): BgTone {
  try {
    const value = localStorage.getItem("entrelinhas-bg-tone");
    return value === "warm" ? "warm" : "neutral";
  } catch {
    return document.documentElement.dataset.bgTone === "warm" ? "warm" : "neutral";
  }
}

function subscribe(callback: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key !== "entrelinhas-bg-tone" && event.key !== null) return;
    const tone = getBgTone();
    document.documentElement.dataset.bgTone = tone;
    callback();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(eventName, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(eventName, callback);
  };
}

export function applyBgTone(tone: BgTone) {
  document.documentElement.dataset.bgTone = tone;
  try {
    localStorage.setItem("entrelinhas-bg-tone", tone);
  } catch {
    /* If storage is blocked, dataset remains applied in current tab */
  }
  window.dispatchEvent(new Event(eventName));
}

export default function BackgroundToneControl() {
  const tone = useSyncExternalStore(subscribe, getBgTone, () => "neutral");

  return (
    <div className={styles.wrapper}>
      <div>
        <p className={styles.labelHeading}>Tonalidade do fundo</p>
        <p className={styles.labelHelp}>
          Escolha o tom de fundo desejado para leitura e navegação na página inicial.
        </p>
      </div>

      <div className={styles.grid} role="radiogroup" aria-label="Tonalidade do fundo">
        <button
          type="button"
          role="radio"
          aria-checked={tone === "neutral"}
          className={`${styles.toneCard} ${tone === "neutral" ? styles.toneCardActive : ""}`}
          onClick={() => applyBgTone("neutral")}
        >
          <div className={styles.toneHeader}>
            <span className={styles.toneTitle}>Neutro</span>
            {tone === "neutral" && <span className={styles.activeBadge}>Ativo</span>}
          </div>
          <div className={styles.swatch} aria-hidden="true">
            <div className={`${styles.swatchHalf} ${styles.swatchNeutralLight}`}>
              <span>Aa</span>
            </div>
            <div className={`${styles.swatchHalf} ${styles.swatchNeutralDark}`}>
              <span>Aa</span>
            </div>
          </div>
          <p className={styles.toneDescription}>
            Preto ou cinza profundo no escuro, branco limpo no claro. Visual minimalista e sem tons alaranjados.
          </p>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={tone === "warm"}
          className={`${styles.toneCard} ${tone === "warm" ? styles.toneCardActive : ""}`}
          onClick={() => applyBgTone("warm")}
        >
          <div className={styles.toneHeader}>
            <span className={styles.toneTitle}>Quente</span>
            {tone === "warm" && <span className={styles.activeBadge}>Ativo</span>}
          </div>
          <div className={styles.swatch} aria-hidden="true">
            <div className={`${styles.swatchHalf} ${styles.swatchWarmLight}`}>
              <span>Aa</span>
            </div>
            <div className={`${styles.swatchHalf} ${styles.swatchWarmDark}`}>
              <span>Aa</span>
            </div>
          </div>
          <p className={styles.toneDescription}>
            Tons suaves de creme no claro, carvão levemente aquecido no escuro. Atmosfera acolhedora e sutil.
          </p>
        </button>
      </div>
    </div>
  );
}
