"use client";

import { useSyncExternalStore } from "react";
import styles from "./theme-control.module.css";

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
  return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(eventName, callback); };
}
function applyTheme(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem("entrelinhas-theme");
    else localStorage.setItem("entrelinhas-theme", theme);
  } catch { /* The current tab still applies the choice when storage is unavailable. */ }
  window.dispatchEvent(new Event(eventName));
}

export default function ThemeControl() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "system");
  return <label className={styles.control}>
    <span>Aparência</span>
    <select value={theme} onChange={event => applyTheme(event.target.value as Theme)}>
      <option value="system">Sistema</option>
      <option value="light">Claro</option>
      <option value="dark">Escuro</option>
    </select>
  </label>;
}
