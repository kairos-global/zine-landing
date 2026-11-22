import { getSiteBaseUrl } from "./site-url";

export const builtInQrLabels = {
  issue: "__issue_qr__",
  collection: "__collection_qr__",
} as const;

export type BuiltInQr = keyof typeof builtInQrLabels;

export function qrPath(issueId: string, linkId: string) {
  return `/qr/${issueId}/${linkId}`;
}

export function qrUrl(issueId: string, linkId: string) {
  return `${getSiteBaseUrl()}${qrPath(issueId, linkId)}`;
}

export const qrPngOptions = { type: "png", width: 640, margin: 4, errorCorrectionLevel: "M" } as const;
