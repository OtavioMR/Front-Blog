"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { ArrowLeft, FileText, Layers, PenLine } from "lucide-react";
import backStyles from "@/app/_components/back-button.module.css";
import styles from "./studio-header.module.css";

type StudioHeaderProps = {
  activeTab: "contos" | "series";
  editorialEnabled?: boolean;
  onLeaveNavigate?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  backAction?: { label: string; onClick: () => void; disabled?: boolean };
};

export default function StudioHeader({
  activeTab,
  editorialEnabled = true,
  onLeaveNavigate,
  backAction,
}: StudioHeaderProps) {
  function handleClick(href: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (onLeaveNavigate) onLeaveNavigate(event, href);
    };
  }

  return (
    <header className={`${styles.header} ${backAction ? styles.headerCompact : ""}`}>
      <div className={styles.topRow}>
        {backAction ? (
          <button type="button" className={backStyles.back} data-back-button onClick={backAction.onClick} disabled={backAction.disabled}>
            <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>{backAction.label}</span>
          </button>
        ) : (
          <Link
            href="/conta"
            className={backStyles.back}
            data-back-button
            onClick={handleClick("/conta")}
          >
            <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>Minha conta</span>
          </Link>
        )}
      </div>

      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>ESTÚDIO EDITORIAL</p>
          <h1 className={styles.title}>
            Studio<span className={styles.titleDot}>.</span>
          </h1>
          <p className={styles.subtitle}>
            Um espaço calmo e organizado para suas histórias e séries ganharem forma.
          </p>
        </div>
      </div>

      {editorialEnabled && (
        <nav className={styles.navBar} aria-label="Navegação do Studio">
          <div className={styles.tabs}>
            <Link
              href="/studio"
              className={`${styles.tab} ${activeTab === "contos" ? styles.tabActive : ""}`}
              aria-current={activeTab === "contos" ? "page" : undefined}
              onClick={handleClick("/studio")}
            >
              <FileText size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Contos</span>
            </Link>
            <Link
              href="/studio/series"
              className={`${styles.tab} ${activeTab === "series" ? styles.tabActive : ""}`}
              aria-current={activeTab === "series" ? "page" : undefined}
              onClick={handleClick("/studio/series")}
            >
              <Layers size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Minhas séries</span>
            </Link>
          </div>

          {activeTab === "contos" && (
            <Link
              href="/studio/novo"
              className={styles.cta}
              onClick={handleClick("/studio/novo")}
            >
              <PenLine size={16} strokeWidth={2} aria-hidden="true" />
              <span>Novo conto</span>
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
