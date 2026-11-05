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
          <span className={styles.brandMark} aria-hidden="true">✳</span>
          entrelinhas<span className={styles.brandDot}>.</span>
        </Link>
        <nav className={styles.nav} aria-label="Navegação principal">
          <Link href="/categorias">Categorias</Link>
          <Link href="/sobre">Sobre</Link>
          <Link href="/#artigos">Artigos</Link>
          <SessionNav />
        </nav>
      </div>
    </header>
  );
}

