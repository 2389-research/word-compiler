export type Theme = "dark" | "light";

const STORAGE_KEY = "word-compiler-theme";

function getInitialTheme(): Theme {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  }
  if (typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

class ThemeStore {
  current = $state<Theme>(getInitialTheme());

  constructor() {
    $effect(() => {
      document.documentElement.setAttribute("data-theme", this.current);
      localStorage.setItem(STORAGE_KEY, this.current);
    });
  }

  toggle() {
    this.current = this.current === "dark" ? "light" : "dark";
  }

  set(theme: Theme) {
    this.current = theme;
  }
}

export const theme = new ThemeStore();
