import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type InteractiveLink = { label: string; url: string };
type ProcessedLink = InteractiveLink & { id: string; qr_path: string; redirect_path: string };

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const title = formData.get("title") as string;
    const issueId = formData.get("issueId") as string;
    if (!title || !issueId) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const slug = title.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, "-");

    let cover_img_url: string | null = null;
    let pdf_url: string | null = null;

    const coverFile = formData.get("cover") as File | null;
    const pdfFile = formData.get("pdf") as File | null;

    if (coverFile) {
      const extension = coverFile.type.split("/")[1] || "png";
      const { data, error } = await supabase.storage
        .from("zineground")
        .upload(`covers/${issueId}.${extension}`, coverFile, { upsert: true });
      if (!error && data) {
        cover_img_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${data.path}`;
      }
    }

    if (pdfFile) {
      const { data, error } = await supabase.storage
        .from("zineground")
        .upload(`issues/${issueId}.pdf`, pdfFile, { upsert: true });
      if (!error && data) {
        pdf_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${data.path}`;
      }
    }

    await supabase.from("issues").upsert({
      id: issueId,
      title,
      slug,
      cover_img_url,
      pdf_url,
      status: "published",
      published_at: new Date().toISOString(),
      profile_id: userId,
    });

    const interactiveLinksRaw = formData.get("interactiveLinks");
    let processedLinks: ProcessedLink[] = [];
    if (interactiveLinksRaw) {
      const interactiveLinks: InteractiveLink[] = JSON.parse(interactiveLinksRaw.toString() || "[]");
      for (const link of interactiveLinks) {
        const linkId = randomUUID();
        const redirect_path = `/qr/${issueId}/${linkId}`;
        const qrPngBuffer = await QRCode.toBuffer(
          `${process.env.NEXT_PUBLIC_SITE_URL}${redirect_path}`,
          { type: "png", width: 400 }
        );
        const { data: qrData, error: qrErr } = await supabase.storage
          .from("zineground")
          .upload(`qr-codes/${linkId}.png`, qrPngBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (qrErr || !qrData) {
          console.error("QR Upload Error:", qrErr);
          continue;
        }

        const qr_path = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${qrData.path}`;

        await supabase.from("issue_links").insert({
          id: linkId,
          issue_id: issueId,
          label: link.label,
          url: link.url,
          qr_path,
          redirect_path,
        });

        processedLinks.push({ ...link, id: linkId, qr_path, redirect_path });
      }
    }

    return NextResponse.json({
      status: "published",
      issueId,
      slug,
      cover_img_url,
      pdf_url,
      interactiveLinks: processedLinks,
    });
  } catch (err) {
    console.error("🔥 Publish error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
