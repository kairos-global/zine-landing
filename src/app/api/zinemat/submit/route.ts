import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // must use service key for server uploads
);

export async function POST(req: Request) {
  const formData = await req.formData();

  // ---------- Extract Basics ----------
  const title = formData.get("title") as string;
  const date = formData.get("date") as string;
  const userId = formData.get("userId") as string;
  const issueId = formData.get("issueId") as string;

  if (!title || !userId || !issueId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // ---------- Upload Files ----------
  const coverFile = formData.get("cover") as File | null;
  const pdfFile = formData.get("pdf") as File | null;

  const uploads = [];

  if (coverFile) {
    const { data, error } = await supabase.storage
      .from("zineground")
      .upload(`issues/${issueId}/cover.${coverFile.type.split("/")[1]}`, coverFile, {
        upsert: true,
      });
    if (error) return NextResponse.json({ error }, { status: 500 });
    uploads.push({ type: "cover", path: data.path });
  }

  if (pdfFile) {
    const { data, error } = await supabase.storage
      .from("zineground")
      .upload(`issues/${issueId}/zine.pdf`, pdfFile, {
        upsert: true,
      });
    if (error) return NextResponse.json({ error }, { status: 500 });
    uploads.push({ type: "pdf", path: data.path });
  }

  // ---------- Handle Interactivity Links ----------
  const interactiveLinksJson = formData.get("interactiveLinks") as string;
  let interactiveLinks: any[] = [];

  try {
    interactiveLinks = JSON.parse(interactiveLinksJson || "[]");
  } catch (e) {
    console.error("Invalid JSON in interactiveLinks");
    return NextResponse.json({ error: "Invalid interactivity data" }, { status: 400 });
  }

  const processedLinks = await Promise.all(
    interactiveLinks.map(async (link) => {
      const linkId = randomUUID();
      const shortPath = `r/${linkId}`;
      const fullRedirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/${shortPath}`;

      // Generate QR Code
      const qrDataUrl = await QRCode.toDataURL(fullRedirectUrl);
      const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");

      // Upload QR image
      const { data: qrData, error: qrErr } = await supabase.storage
        .from("zineground")
        .upload(`issues/${issueId}/qr/${linkId}.png`, qrBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (qrErr) {
        console.error("QR Upload Error:", qrErr);
        return null;
      }

      // Insert into issue_links table
      const { error: insertErr } = await supabase.from("issue_links").insert({
        id: linkId,
        issue_id: issueId,
        label: link.label,
        url: link.url,
        generate_qr: link.generateQR,
        qr_path: qrData.path,
        redirect_path: shortPath,
      });

      if (insertErr) {
        console.error("Insert Error:", insertErr);
        return null;
      }

      return {
        ...link,
        redirect_path: shortPath,
        qr_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${qrData.path}`,
      };
    })
  );

  return NextResponse.json({
    status: "ok",
    title,
    uploads,
    interactiveLinks: processedLinks.filter(Boolean),
  });
}
