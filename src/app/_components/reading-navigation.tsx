"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./reading-navigation.module.css";

/** Article pages track the article body; other pages track the whole document. */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    const target = document.querySelector<HTMLElement>("[data-reading-body]") || document.documentElement;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = target.getBoundingClientRect();
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const value = target === document.documentElement
        ? (scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0)
        : (rect.height > 0 ? ((window.innerHeight - rect.top) / rect.height) * 100 : 0);
      setProgress(Math.round(Math.max(0, Math.min(100, value))));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(target);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return <div className={styles.progress} role="progressbar" aria-label="Progresso de leitura" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${progress}% da leitura`}><span style={{ width: `${progress}%` }} /><small aria-hidden="true">{progress}%</small></div>;
}

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);

  function goToTop() {
    window.scrollTo({ top: 0, behavior: "instant" });
    const destination = document.querySelector<HTMLElement>("main header a")
      ?? document.querySelector<HTMLElement>("main");
    if (destination) {
      // A main element is not normally focusable, but is a useful fallback on error pages.
      if (destination.tagName === "MAIN" && !destination.hasAttribute("tabindex")) {
        destination.setAttribute("tabindex", "-1");
      }
      destination.focus({ preventScroll: true });
    }
  }

  return <button type="button" className={`${styles.top} ${visible ? styles.visible : ""}`} onClick={goToTop} tabIndex={visible ? 0 : -1} aria-hidden={!visible}>↑ <span>Voltar ao topo</span></button>;
}
