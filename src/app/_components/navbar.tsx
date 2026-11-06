"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import SessionNav from "./session-nav";
import styles from "./navbar.module.css";

const SCROLL_THRESHOLD_DOWN = 20;
const SCROLL_THRESHOLD_UP = 10;
const TOP_OFFSET = 20;

export default function Navbar() {
  const pathname = usePathname();
  return <NavbarForRoute key={pathname} />;
}

function NavbarForRoute() {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const scrollDownAccum = useRef(0);
  const scrollUpAccum = useRef(0);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let ticking = false;
    lastScrollY.current = window.scrollY;

    function handleScroll() {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = Math.max(window.scrollY, 0);

          // 1. When at or near the top of the page, always keep navbar visible
          if (currentY <= TOP_OFFSET) {
            setHidden(false);
            lastScrollY.current = currentY;
            scrollDownAccum.current = 0;
            scrollUpAccum.current = 0;
            ticking = false;
            return;
          }

          // If user is hovering or interacting with navbar, keep it visible
          if (navRef.current?.matches(":hover, :focus-within")) {
            setHidden(false);
            lastScrollY.current = currentY;
            scrollDownAccum.current = 0;
            scrollUpAccum.current = 0;
            ticking = false;
            return;
          }

          // Prevent rubber-banding effect at bottom of document
          const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          if (maxScroll > 0 && currentY > maxScroll) {
            ticking = false;
            return;
          }

          const delta = currentY - lastScrollY.current;

          if (Math.abs(delta) >= 1) {
            if (delta > 0) {
              // Scrolling DOWN
              scrollDownAccum.current += delta;
              scrollUpAccum.current = 0;
              if (scrollDownAccum.current > SCROLL_THRESHOLD_DOWN) {
                setHidden(true);
              }
            } else {
              // Scrolling UP
              scrollUpAccum.current += Math.abs(delta);
              scrollDownAccum.current = 0;
              if (scrollUpAccum.current > SCROLL_THRESHOLD_UP) {
                setHidden(false);
              }
            }
            lastScrollY.current = currentY;
          }

          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      ref={navRef}
      className={`${styles.navbar} ${hidden ? styles.hidden : ""}`}
      aria-label="Navegação do site"
    >
      <div className={styles.inner}>
        <Link className={styles.brand} href="/" aria-label="Entrelinhas, página inicial">
          <span className={styles.brandBookWrap} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/branding/icone-livro-claro.svg" alt="" className={styles.bookIconLight} width="32" height="34" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/branding/icone-livro-escuro.svg" alt="" className={styles.bookIconDark} width="32" height="34" />
          </span>
          <span className={styles.brandWordmark}>
            entrelinhas<span className={styles.brandDot}>.</span>
          </span>
        </Link>
        <nav className={styles.nav} aria-label="Navegação principal">
          <Link href="/categorias">Categorias</Link>
          <Link href="/sobre">Sobre</Link>
          <Link href="/#artigos">Artigos</Link>
          <Link className={styles.settings} href="/configuracoes"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>Configurações</Link>
          <SessionNav />
        </nav>
      </div>
    </header>
  );
}

