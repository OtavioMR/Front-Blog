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
};

export default function StudioHeader({
  activeTab,
  editorialEnabled = true,
  onLeaveNavigate,
}: StudioHeaderProps) {
  function handleClick(href: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (onLeaveNavigate) onLeaveNavigate(event, href);
    };
  }

  return (
    <header className={styles.header}>
      <div className={styles.topRow}>
        <Link
          href="/conta"
          className={backStyles.back}
          onClick={handleClick("/conta")}
        >
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>Minha conta</span>
        </Link>
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

          <Link
            href="/studio/novo"
            className={styles.cta}
            onClick={handleClick("/studio/novo")}
          >
            <PenLine size={16} strokeWidth={2} aria-hidden="true" />
            <span>Novo conto</span>
          </Link>
        </nav>
      )}
    </header>
  );
}
