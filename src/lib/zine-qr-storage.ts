import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { builtInQrLabels, qrPath, qrPngOptions, qrUrl, type BuiltInQr } from "./zine-qr";
import { getSiteBaseUrl } from "./site-url";

type ReaderLink = { id?: string; label: string; url: string; generateQR?: boolean };

function builtInId(issueId: string, kind: BuiltInQr) {
  const hash = createHash("sha256").update(`zinemat:${issueId}:${kind}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function syncZineLinks(supabase: SupabaseClient, issueId: string, slug: string, links: ReaderLink[]) {
  const { data: existing, error } = await supabase
    .from("issue_links").select("id, label, redirect_path, qr_path").eq("issue_id", issueId);
  if (error) throw new Error("Couldn’t load the existing QR links.");

  const builtIns = Object.entries(builtInQrLabels).map(([key, label]) => {
    const kind = key as BuiltInQr;
    return {
      id: existing.find(link => link.label === label)?.id ?? builtInId(issueId, kind),
      label,
      url: kind === "issue" ? `${getSiteBaseUrl()}/issues/${slug}` : `${getSiteBaseUrl()}/collect/${issueId}`,
      generateQR: true,
      code: kind,
    };
  });

  const readers = links.filter(link => !Object.values(builtInQrLabels).some(label => label === link.label))
    .map(link => {
      const id = link.id || randomUUID();
      const url = new URL(link.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Use an HTTP or HTTPS link.");
      return { ...link, id, code: id };
    });

  const bucket = supabase.storage.from("zineground");
  const rows = await Promise.all([...builtIns, ...readers].map(async link => {
    const redirect_path = qrPath(issueId, link.code);
    const previous = existing.find(item => item.id === link.id);
    let qr_path = link.generateQR !== false && previous?.redirect_path === redirect_path ? previous.qr_path : null;
    if (link.generateQR !== false && !qr_path) {
      const png = await QRCode.toBuffer(qrUrl(issueId, link.code), qrPngOptions);
      const path = `qr-codes/${issueId}/${link.id}.png`;
      const { error } = await bucket.upload(path, png, { contentType: "image/png", upsert: true });
      if (error) throw new Error("Couldn’t store the QR code.");
      qr_path = bucket.getPublicUrl(path).data.publicUrl;
    }
    return { id: link.id, issue_id: issueId, label: link.label, url: link.url, qr_path, redirect_path };
  }));

  const newRows = rows.filter(row => !existing.some(link => link.id === row.id));
  if (newRows.length) {
    // Primary keys can be supplied by the client. Only update rows scoped to the owned issue.
    const { error } = await supabase.from("issue_links").upsert(newRows, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error("Couldn’t register the QR links.");
  }
  await Promise.all(rows.map(async ({ id, issue_id, ...fields }) => {
    const { data, error } = await supabase.from("issue_links").update(fields).eq("id", id).eq("issue_id", issue_id).select("id").maybeSingle();
    if (error || !data) throw new Error("Couldn’t save the QR link.");
  }));

  return rows.filter(row => readers.some(link => link.id === row.id));
}
