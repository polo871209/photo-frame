import { useEffect, useState } from "preact/hooks";

export type Theme = "light" | "dark";

const listeners = new Set<(theme: Theme) => void>();

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState(currentTheme);
  useEffect(() => {
    listeners.add(setTheme);
    return () => listeners.delete(setTheme);
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("frame.theme", next);
    for (const listener of listeners) listener(next);
  };
  return [theme, toggle];
}
