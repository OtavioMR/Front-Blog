"use client";

import { useSyncExternalStore } from "react";
import { IconMoon, IconSun } from "./icons";
import styles from "../admin.module.css";

type Theme = "system" | "light" | "dark";
const eventName = "entrelinhas-theme-change";

function getTheme(): Theme {
  try {
    const value = localStorage.getItem("entrelinhas-theme");
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return document.documentElement.dataset.theme === "dark" ? "dark" : document.documentElement.dataset.theme === "light" ? "light" : "system";
  }
}

function subscribe(callback: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key !== "entrelinhas-theme" && event.key !== null) return;
    const theme = getTheme();
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    callback();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(eventName, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(eventName, callback);
  };
}

function applyTheme(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem("entrelinhas-theme");
    else localStorage.setItem("entrelinhas-theme", theme);
  } catch {
    // Current tab still applies the theme choice when localStorage is restricted.
  }
  window.dispatchEvent(new Event(eventName));
}

export function AdminThemeToggle() {
  const currentTheme = useSyncExternalStore(subscribe, getTheme, () => "system");

  function cycleTheme() {
    if (currentTheme === "dark") applyTheme("light");
    else if (currentTheme === "light") applyTheme("dark");
    else {
      // If system, switch to the opposite of what's currently rendered
      const isDark = document.documentElement.dataset.theme === "dark" || window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme(isDark ? "light" : "dark");
    }
  }

  const isDark = currentTheme === "dark" || (currentTheme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

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
