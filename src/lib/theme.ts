import { useEffect, useState } from "preact/hooks";

export type Theme = "light" | "dark";

const listeners = new Set<(theme: Theme) => void>();

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  if (theme === currentTheme()) return;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("frame.theme", theme);
  for (const listener of listeners) listener(theme);
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState(currentTheme);
  useEffect(() => {
    listeners.add(setTheme);
    return () => listeners.delete(setTheme);
  }, []);
  return [theme, () => applyTheme(theme === "dark" ? "light" : "dark")];
}
