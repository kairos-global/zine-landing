export type ScanResult = {
  kind: "native" | "website" | "email" | "phone" | "wifi" | "contact" | "text";
  title: string;
  value: string;
  url?: string;
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const nativePath = new RegExp(`^/(?:qr/${UUID}/${UUID}|collect/${UUID})/?$`, "i");

/** Only our exact HTTPS origins and existing QR routes may open automatically. */
export function classifyQRCode(raw: string, siteUrl: string): ScanResult {
  const value = raw.trim();
  try {
    const url = new URL(value);
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) {
      const origins = new Set(["https://zineground.com", "https://www.zineground.com"]);
      try {
        const configured = new URL(siteUrl);
        if (configured.protocol === "https:") origins.add(configured.origin);
      } catch { /* A misconfigured site URL must not broaden automatic navigation. */ }
      const native = origins.has(url.origin) && nativePath.test(url.pathname) && !url.search && !url.hash;
      return {
        kind: native ? "native" : "website",
        title: native ? "Zineground code" : url.host,
        value,
        url: url.href,
      };
    }
  } catch { /* Non-URL QR payloads are displayed as text, never executed. */ }
  if (/^mailto:/i.test(value)) return { kind: "email", title: "Email address", value };
  if (/^tel:/i.test(value)) return { kind: "phone", title: "Phone number", value };
  if (/^WIFI:/i.test(value)) return { kind: "wifi", title: "Wi-Fi details", value };
  if (/^(BEGIN:VCARD|MECARD:)/i.test(value)) return { kind: "contact", title: "Contact details", value };
  return { kind: "text", title: "QR content", value };
}
