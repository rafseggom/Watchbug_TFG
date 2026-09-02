import { getLang } from "../i18n/index";

export function formatDate(iso: string, lang?: string): string {
  const effectiveLang = lang ?? getLang();
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(effectiveLang, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}
