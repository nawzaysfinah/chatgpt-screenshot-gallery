import Script from "next/script";

const themeInitScript = `
(() => {
  try {
    const stored = window.localStorage.getItem("dialogue-diaries-theme");
    const theme = stored === "light" ? "light" : "dark";
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
  } catch {
    document.documentElement.classList.add("dark");
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

export default function ThemeScript() {
  return <Script id="theme-init" strategy="beforeInteractive">{themeInitScript}</Script>;
}

