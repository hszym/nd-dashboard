export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatAmount(n: number | null, currency: string = "EUR"): string {
  if (n === null || n === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    // Intl throws on a code it doesn't recognise (e.g. a typo) — fall back to a plain number.
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)} ${currency.toUpperCase()}`;
  }
}

export function formatDate(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const target = new Date(d + "T00:00:00").getTime();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now.getTime()) / (1000 * 60 * 60 * 24));
}
