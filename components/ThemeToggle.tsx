"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "dialogue-diaries-theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
}

type ThemeToggleProps = {
  className?: string;
};

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const rootTheme = document.documentElement.dataset.theme;
    if (rootTheme === "light" || rootTheme === "dark") {
      setTheme(rootTheme);
      return;
    }

    applyTheme("dark");
    setTheme("dark");
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    setTheme(nextTheme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className={`inline-flex h-11 items-center rounded-full border border-slate-700 bg-slate-900/80 px-4 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-400 dark:hover:bg-slate-900 ${className}`}
    >
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
