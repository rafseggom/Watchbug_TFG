export function isSafeHref(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith("javascript:")) return false;
  if (trimmed.startsWith("data:text/html")) return false;
  if (trimmed.startsWith("vbscript:")) return false;
  return true;
}
