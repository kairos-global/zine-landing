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

type InteractiveLink = { 
  id?: string;
  label: string; 
  url: string;
  generateQR?: boolean;
};
type ProcessedLink = InteractiveLink & { id: string; qr_path: string; redirect_path: string };

interface IssueUpdate {
  id?: string;
  title: string;
  slug: string;
  cover_img_url: string | null;
  pdf_url: string | null;
  status: "draft" | "published";
  profile_id: string;
  published_at?: string;
}

// 🔒 fetch-only: don’t auto-insert profiles
async function getProfileId(clerkId: string) {
  const { data: existing, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (error) throw error;
  if (!existing?.id) {
    throw new Error("Profile not found for this user. Ensure profile is created at signup.");
  }

  return existing.id;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const title = formData.get("title") as string;
    const issueId = formData.get("issueId") as string;
    if (!title || !issueId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

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

    // ✅ fetch the existing profile ID
    const profileId = await getProfileId(userId);

    // ✅ check if issue already exists
    const { data: existing } = await supabase
      .from("issues")
      .select("id, published_at")
      .eq("id", issueId)
      .maybeSingle();

    const updates: IssueUpdate = {
      title,
      slug,
      cover_img_url,
      pdf_url,
      status: "published",
      profile_id: profileId,
    };

    // Only set published_at if this is the first time publishing
    if (!existing?.published_at) {
      updates.published_at = new Date().toISOString();
    }

    if (existing) {
      await supabase.from("issues").update(updates).eq("id", issueId);
    } else {
      updates.id = issueId;
      if (!updates.published_at) {
        updates.published_at = new Date().toISOString();
      }
      await supabase.from("issues").insert(updates);
    }

    // 🔗 Interactive links + QR
    const interactiveLinksRaw = formData.get("interactiveLinks");
    const processedLinks: ProcessedLink[] = [];

    if (interactiveLinksRaw) {
      const interactiveLinks: InteractiveLink[] = JSON.parse(interactiveLinksRaw.toString() || "[]");

      for (const link of interactiveLinks) {
        // Use existing ID or generate new one
        const linkId = link.id || randomUUID();
        const redirect_path = `/qr/${issueId}/${linkId}`;
        
        // Only generate QR if requested
        let qr_path: string | null = null;
        if (link.generateQR !== false) {
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
          } else {
            qr_path = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zineground/${qrData.path}`;
          }
        }

        await supabase.from("issue_links").upsert({
          id: linkId,
          issue_id: issueId,
          label: link.label,
          url: link.url,
          qr_path,
          redirect_path,
        });

        processedLinks.push({ ...link, id: linkId, qr_path: qr_path || "", redirect_path });
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
