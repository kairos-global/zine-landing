import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import QRCode from "qrcode";
import { builtInQrLabels, qrPath, qrPngOptions, qrUrl } from "./zine-qr";
import { getSiteBaseUrl } from "./site-url";

function collectionLinkId(issueId: string) {
  const hash = createHash("sha256").update(`zinemat:${issueId}:collection`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function ensureCollectionQr(supabase: SupabaseClient, issueId: string, slug: string) {
  const label = builtInQrLabels.collection;
  const { data: existing, error: lookupError } = await supabase
    .from("issue_links").select("id, issue_id, label, url, redirect_path, qr_path")
    .eq("issue_id", issueId).eq("label", label).order("id").limit(1).maybeSingle();
  if (lookupError) throw lookupError;

  const id = existing?.id ?? collectionLinkId(issueId);
  const redirect_path = qrPath(issueId, "collection");
  const url = `${getSiteBaseUrl()}/issues/${encodeURIComponent(slug)}?save=1`;
  let qr_path = existing?.redirect_path === redirect_path ? existing.qr_path : null;
  if (existing && qr_path && existing.url === url) return existing;
  if (!qr_path) {
    const png = await QRCode.toBuffer(qrUrl(issueId, "collection"), qrPngOptions);
    const bucket = supabase.storage.from("zineground");
    const path = `qr-codes/${issueId}/${id}.png`;
    const { error } = await bucket.upload(path, png, { contentType: "image/png", upsert: true });
    if (error) throw error;
    qr_path = bucket.getPublicUrl(path).data.publicUrl;
  }
  const row = { id, issue_id: issueId, label, url, redirect_path, qr_path };
  const { error } = await supabase.from("issue_links").upsert(row, { onConflict: "id" });
  if (error) throw error;
  return row;
}
