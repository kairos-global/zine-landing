// Categories for zines. Mirrors the `zine_category` Postgres enum.
// To add a new category, also run: alter type zine_category add value '<key>';
export const ZINE_CATEGORIES = [
  { key: "comic", label: "Comic" },
  { key: "art", label: "Art" },
  { key: "photography", label: "Photography" },
  { key: "music", label: "Music" },
  { key: "product_catalog", label: "Product Catalog" },
  { key: "menu", label: "Menu" },
  { key: "event_calendar", label: "Event Calendar" },
] as const;

export type ZineCategoryKey = (typeof ZINE_CATEGORIES)[number]["key"];

export function zineCategoryLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  const found = ZINE_CATEGORIES.find((c) => c.key === key);
  return found ? found.label : null;
}

export function isZineCategoryKey(value: unknown): value is ZineCategoryKey {
  return (
    typeof value === "string" &&
    ZINE_CATEGORIES.some((c) => c.key === value)
  );
}
