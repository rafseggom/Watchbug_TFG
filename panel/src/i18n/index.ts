import en from "./en.json";
import es from "./es.json";

const dicts = { en, es } as const;

export type Lang = "en" | "es";

function resolveInitialLang(): Lang {
  try {
    const stored = localStorage.getItem("watchbug_lang") as Lang | null;
    if (stored === "en" || stored === "es") return stored;
  } catch {
    // localStorage not available
  }
  try {
    const navLang = (navigator.language || "en").toLowerCase();
    if (navLang.startsWith("es")) return "es";
  } catch {
    // navigator not available
  }
  return "en";
}

let lang: Lang = resolveInitialLang();

export function t(key: string): string {
  const dict = dicts[lang] as Record<string, string>;
  return dict[key] ?? key;
}

export function getLang(): Lang {
  return lang;
}

export function setLang(l: Lang): void {
  if (l !== "en" && l !== "es") return;
  lang = l;
  try {
    localStorage.setItem("watchbug_lang", l);
  } catch {
    // ignore
  }
  try {
    document.documentElement.lang = l;
  } catch {
    // ignore
  }
}

export function initI18n(): void {
  try {
    document.documentElement.lang = lang;
  } catch {
    // ignore
  }
}
