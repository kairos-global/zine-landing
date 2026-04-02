/**
 * Canonical base URL for the app (no trailing slash).
 * Used when generating QR redirect URLs so scans always point to this origin.
 */
export function getSiteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.zineground.com";
}
