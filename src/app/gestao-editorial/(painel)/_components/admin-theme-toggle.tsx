"use client";

import { useSyncExternalStore } from "react";
import { IconMoon, IconSun } from "./icons";
import styles from "../admin.module.css";

export type AdminTheme = "system" | "light" | "dark";

export const ADMIN_THEME_STORAGE_KEY = "admin-theme";
export const ADMIN_THEME_COOKIE_NAME = "admin-theme";
export const ADMIN_THEME_EVENT = "griforio-admin-theme-change";

export function getAdminTheme(): AdminTheme {
  if (typeof window === "undefined") return "system";
  try {
    const value = localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
    if (value === "system") return "system";
  } catch {}

  try {
    const match = document.cookie.match(/(?:^|;\s*)admin-theme=(light|dark|system)(?:;|$)/);
    if (match) return match[1] as AdminTheme;
  } catch {}

  const ds = typeof document !== "undefined" ? document.documentElement.dataset.theme : undefined;
  return ds === "dark" ? "dark" : ds === "light" ? "light" : "system";
}

export function subscribeAdminTheme(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  function onStorage(event: StorageEvent) {
    if (event.key !== ADMIN_THEME_STORAGE_KEY && event.key !== null) return;
    const theme = getAdminTheme();
    if (theme === "system") {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = theme;
    }
    callback();
  }

  function onMediaChange() {
    callback();
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener(ADMIN_THEME_EVENT, callback);

  let media: MediaQueryList | null = null;
  try {
    media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", onMediaChange);
  } catch {}

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(ADMIN_THEME_EVENT, callback);
    try {
      media?.removeEventListener("change", onMediaChange);
    } catch {}
  };
}

export function applyAdminTheme(theme: AdminTheme) {
  if (typeof window === "undefined") return;

  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }

  try {
    if (theme === "system") {
      localStorage.removeItem(ADMIN_THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(ADMIN_THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Current tab still applies the theme choice when localStorage is restricted.
  }

  try {
    const maxAge = 365 * 24 * 60 * 60;
    const isSecure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${ADMIN_THEME_COOKIE_NAME}=${theme}; path=/gestao-editorial; max-age=${maxAge}; SameSite=Lax${isSecure}`;
  } catch {}

  window.dispatchEvent(new Event(ADMIN_THEME_EVENT));
}

const emptySubscribe = () => () => {};

export function AdminThemeToggle({ initialTheme = "system" }: { initialTheme?: AdminTheme }) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const currentTheme = useSyncExternalStore(
    subscribeAdminTheme,
    getAdminTheme,
    () => initialTheme
  );

  function cycleTheme() {
    let isCurrentlyDark: boolean;
    if (currentTheme === "dark") {
      isCurrentlyDark = true;
    } else if (currentTheme === "light") {
      isCurrentlyDark = false;
    } else {
      isCurrentlyDark =
        document.documentElement.dataset.theme === "dark" ||
        (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }

    applyAdminTheme(isCurrentlyDark ? "light" : "dark");
  }

  // Hydration safety:
  // During SSR and initial hydration pass (!mounted):
  // We must strictly match what the server rendered:
  // If initialTheme is "dark", the server rendered dark (isDark = true).
  // Otherwise, the server rendered isDark = false (Moon icon, "Escuro").
  // Once mounted === true:
  // We calculate true isDark, taking system preferences into account.
  const isDark = mounted
    ? currentTheme === "dark" ||
      (currentTheme === "system" &&
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    : initialTheme === "dark";

  return (
    <button
      type="button"
      className={styles.themeToggleBtn}
      onClick={cycleTheme}
      title={`Tema atual: ${currentTheme === "system" ? "Sistema" : currentTheme === "dark" ? "Escuro" : "Claro"}. Clique para alternar.`}
      aria-label="Alternar tema de aparência"
    >
      {isDark ? <IconSun size={17} /> : <IconMoon size={17} />}
      <span className={styles.themeToggleLabel}>{isDark ? "Claro" : "Escuro"}</span>
    </button>
  );
}
