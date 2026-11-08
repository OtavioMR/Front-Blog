"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "@/app/_components/avatar";
import { AdminThemeToggle, type AdminTheme } from "./admin-theme-toggle";
import {
  IconDashboard,
  IconAnalytics,
  IconReports,
  IconPosts,
  IconReview,
  IconComments,
  IconUsers,
  IconCategories,
  IconTags,
  IconNewsletter,
  IconAudit,
  IconSettings,
  IconArrowUpRight,
  IconMenu,
  IconClose,
  IconShield,
  IconGriforio,
} from "./icons";
import type { AdminActorInfo } from "../_lib/data";
import styles from "../admin.module.css";

export type NavSectionKey =
  | "admins"
  | "account"
  | "overview"
  | "newsletter"
  | "analytics"
  | "audit"
  | "reports"
  | "users"
  | "comments"
  | "posts"
  | "categories"
  | "tags";

interface AdminShellClientProps {
  title: string;
  current: NavSectionKey;
  identity: AdminActorInfo;
  csrf: string;
  expires: number | null;
  actions?: React.ReactNode;
  initialTheme?: AdminTheme;
  children: React.ReactNode;
}

export function AdminShellClient({
  title,
  current,
  identity,
  csrf,
  expires,
  actions,
  initialTheme = "system",
  children,
}: AdminShellClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expiryWarning, setExpiryWarning] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  useEffect(() => {
    const check = () => setExpiryWarning(expires !== null && expires - Date.now() <= 10 * 60 * 1000);
    check();
    const timer = window.setInterval(check, 30000);
    return () => window.clearInterval(timer);
  }, [expires]);

  useEffect(() => {
    let active = false;
    const markActive = () => { active = true; };
    window.addEventListener("pointerdown", markActive);
    window.addEventListener("keydown", markActive);
    const timer = window.setInterval(async () => {
      if (!active || document.visibilityState !== "visible") return;
      active = false;
      try {
        const result = await fetch("/gestao-editorial/atividade", { method: "POST", body: new URLSearchParams({ csrf }), cache: "no-store" });
        setSessionWarning(!result.ok);
      } catch { setSessionWarning(true); }
    }, 5 * 60 * 1000);
    return () => { window.clearInterval(timer); window.removeEventListener("pointerdown", markActive); window.removeEventListener("keydown", markActive); };
  }, [csrf]);

  // Close sidebar when route changes without cascading render effect
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setSidebarOpen(false);
  }

  // Close sidebar on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && sidebarOpen) {
        setSidebarOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

  const userName = identity?.name || (identity?.role === "SUPER_ADMIN" ? "Super Administrador" : "Administrador");
  const userRole = identity?.role || "ADMIN";
  const userEmail = identity?.email;
  const isSuperAdmin = userRole === "SUPER_ADMIN";

  return (
    <div className={styles.shell}>
      {expiryWarning && <div role="alert" style={{ position: "fixed", zIndex: 1000, bottom: "1rem", right: "1rem", maxWidth: "24rem", padding: "1rem", border: "1px solid var(--border)", borderRadius: ".5rem", background: "var(--surface)", color: "var(--text)" }}>Sua sessão administrativa está próxima do limite máximo. Salve seu trabalho; será necessário entrar novamente.</div>}
      {sessionWarning && <div role="alert" style={{ position: "fixed", zIndex: 1001, bottom: "5rem", right: "1rem", maxWidth: "24rem", padding: "1rem", border: "1px solid var(--border)", borderRadius: ".5rem", background: "var(--surface)", color: "var(--text)" }}>Não foi possível confirmar sua sessão. Preserve o texto em edição e confira sua conexão antes de continuar.</div>}
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className={styles.sidebarBackdrop}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Admin Sidebar */}
      <aside
        className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}
        aria-label="Barra lateral administrativa"
      >
        <div className={styles.sidebarHeader}>
          <Link className={styles.brand} href="/gestao-editorial" prefetch={false}>
            <span className={styles.brandIconWrapper}>
              <IconGriforio size={28} />
            </span>
            <span className={styles.brandTextGroup}>
              <span className={styles.brandTitle}>Grifório</span>
              <span className={styles.brandSubtitle}>Administração</span>
            </span>
          </Link>
          <button
            type="button"
            className={styles.sidebarCloseBtn}
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar navegação"
          >
            <IconClose size={20} />
          </button>
        </div>

        {/* User Card in Sidebar (visible on mobile / tablet) */}
        <div className={styles.sidebarUserCard}>
          <Avatar name={userName} src={identity?.profilePhoto} size={38} />
          <div className={styles.sidebarUserInfo}>
            <span className={styles.sidebarUserName}>{userName}</span>
            <span className={isSuperAdmin ? styles.roleBadgeSuperAdmin : styles.roleBadgeAdmin}>
              <IconShield size={11} /> {userRole}
            </span>
          </div>
        </div>

        {/* Grouped Administrative Navigation */}
        <nav className={styles.navigation} aria-label="Navegação administrativa">
          <div className={styles.navGroup}>
            <span className={styles.navGroupHeading}>Visão Geral</span>
            <Link
              href="/gestao-editorial"
              prefetch={false}
              className={styles.navLink}
              aria-current={current === "overview" ? "page" : undefined}
            >
              <IconDashboard size={18} />
              <span>Visão geral</span>
            </Link>
            <Link
              href="/gestao-editorial/estatisticas"
              prefetch={false}
              className={styles.navLink}
              aria-current={current === "analytics" ? "page" : undefined}
            >
              <IconAnalytics size={18} />
              <span>Atividade</span>
            </Link>
          </div>

          <div className={styles.navGroup}>
            <span className={styles.navGroupHeading}>Moderação & Conteúdo</span>
            <Link
              href="/gestao-editorial/denuncias"
              prefetch={false}
              className={styles.navLink}
              aria-current={current === "reports" ? "page" : undefined}
            >
              <IconReports size={18} />
              <span>Denúncias</span>
            </Link>
            <Link
              href="/gestao-editorial/artigos"
              prefetch={false}
              className={styles.navLink}
              aria-current={current === "posts" ? "page" : undefined}
            >
              <IconPosts size={18} />
              <span>Artigos</span>
            </Link>
            <Link
              href="/gestao-editorial/artigos?status=pending"
              prefetch={false}
              className={styles.navLink}
            >
              <IconReview size={18} />
              <span>Revisão editorial</span>
            </Link>
            <Link
              href="/gestao-editorial/comentarios"
              prefetch={false}
              className={styles.navLink}
              aria-current={current === "comments" ? "page" : undefined}
            >
              <IconComments size={18} />
              <span>Comentários</span>
            </Link>
          </div>

          <div className={styles.navGroup}>
            <span className={styles.navGroupHeading}>Comunidade</span>
            <Link
              href="/gestao-editorial/usuarios"
              prefetch={false}
              className={styles.navLink}
              aria-current={current === "users" ? "page" : undefined}
            >
              <IconUsers size={18} />
              <span>Usuários</span>
            </Link>
            {isSuperAdmin && (
              <Link
                href="/gestao-editorial/administradores"
                prefetch={false}
                className={styles.navLink}
                aria-current={current === "admins" ? "page" : undefined}
              >
                <IconShield size={18} />
                <span>Administradores</span>
              </Link>
            )}
          </div>

          <div className={styles.navGroup}>
            <span className={styles.navGroupHeading}>Taxonomia</span>
            <Link
              href="/gestao-editorial/categorias"
              prefetch={false}
              className={styles.navLink}
              aria-current={current === "categories" ? "page" : undefined}
            >
              <IconCategories size={18} />
              <span>Categorias</span>
            </Link>
            <Link
              href="/gestao-editorial/tags"
              prefetch={false}
              className={styles.navLink}
              aria-current={current === "tags" ? "page" : undefined}
            >
              <IconTags size={18} />
              <span>Tags</span>
            </Link>
          </div>

          <div className={styles.navGroup}>
            <span className={styles.navGroupHeading}>Sistema & Auditoria</span>
            <Link
              href="/gestao-editorial/newsletter"
              prefetch={false}
              className={styles.navLink}
              aria-current={current === "newsletter" ? "page" : undefined}
            >
              <IconNewsletter size={18} />
              <span>Newsletter</span>
            </Link>
            <Link
              href="/gestao-editorial/auditoria"
              prefetch={false}
              className={styles.navLink}
              aria-current={current === "audit" ? "page" : undefined}
            >
              <IconAudit size={18} />
              <span>Auditoria</span>
            </Link>
            <Link
              href="/gestao-editorial/conta"
              prefetch={false}
              className={styles.navLink}
              aria-current={current === "account" ? "page" : undefined}
            >
              <IconSettings size={18} />
              <span>Minha sessão</span>
            </Link>
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className={styles.sidebarFooter}>
          <form method="post" action="/gestao-editorial/sair">
            <input type="hidden" name="csrf" value={csrf} />
            <button type="submit" className={styles.returnLink}>
              <span>Sair da administração</span>
              <IconArrowUpRight size={15} />
            </button>
          </form>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className={styles.workspace}>
        {/* Modern Top Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              type="button"
              className={styles.menuToggleBtn}
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu de navegação"
            >
              <IconMenu size={22} />
            </button>
            <div className={styles.headerBreadcrumb}>
              <p>Grifório / Administração</p>
              <h1>{title}</h1>
            </div>
          </div>

          <div className={styles.headerRight}>
            {/* Quick Actions slot if provided */}
            {actions && <div className={styles.headerCustomActions}>{actions}</div>}

            {/* Quick Theme Switcher */}
            <AdminThemeToggle initialTheme={initialTheme} />

            

            {/* Authenticated User Badge & Profile Link */}
            <Link
              href="/gestao-editorial/conta"
              className={styles.userProfilePill}
              prefetch={false}
              title={`Conta: ${userName} (${userRole})${userEmail ? ` • ${userEmail}` : ""}`}
            >
              <Avatar name={userName} src={identity?.profilePhoto} size={32} />
              <div className={styles.userPillText}>
                <span className={styles.userPillName}>{userName}</span>
                <span className={isSuperAdmin ? styles.roleBadgeSuperAdmin : styles.roleBadgeAdmin}>
                  {userRole}
                </span>
              </div>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
