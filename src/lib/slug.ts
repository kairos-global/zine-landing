import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Turn a title into a URL-safe slug (no uniqueness check).
 */
export function slugFromTitle(title: string): string {
  const base = (title || "untitled").trim().toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, "-");
  return base || "untitled";
}

/**
 * Return a slug that does not violate the unique constraint on issues.slug.
 * If baseSlug is already taken by another issue, appends a short suffix from issueId.
 */
export async function ensureUniqueSlug(
  supabase: SupabaseClient,
  baseSlug: string,
  issueId: string
): Promise<string> {
  const { data } = await supabase
    .from("issues")
    .select("id")
    .eq("slug", baseSlug)
    .maybeSingle();

  if (data && data.id !== issueId) {
    return `${baseSlug}-${issueId.slice(0, 8)}`;
  }
  return baseSlug;
}
