// src/app/api/zinemat/submit/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

/** ---------- Supabase (server, service role) ---------- */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // required for server writes

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** ---------- Types for payload parsing ---------- */
type IssuePayload = {
  title: string;
  slug: string;
  status: "draft" | "published";
  published_at: string | null; // yyyy-mm-dd or null
};

type FE = { id: number; name: string; url?: string };
type ADV = { id: number; name: string; website?: string };
type DIST = { id: number; name: string; website?: string };
type LinkItem = { id: number; label: string; url: string };

/** ---------- Helpers ---------- */
function parseJSON<T>(fd: FormData, key: string): T | null {
  const raw = fd.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return null;
  }
}

const normalizeUrl = (u?: string | null): string | null => {
  if (!u) return null;
  const t = u.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
};

/** ---------- POST ---------- */
export async function POST(req: Request) {
  // Require sign-in for ANY write
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { message: "Sign in required." } },
      { status: 401 }
    );
  }

  const form = await req.formData();

  // Payload pieces
  const issue = parseJSON<IssuePayload>(form, "issue");
  const features = parseJSON<FE[]>(form, "features") ?? [];
  const events = parseJSON<FE[]>(form, "events") ?? [];
  const advertisers = parseJSON<ADV[]>(form, "advertisers") ?? [];
  const distributors = parseJSON<DIST[]>(form, "distributors") ?? [];
  const links = parseJSON<LinkItem[]>(form, "links") ?? [];
  const wantQR = Boolean(parseJSON<boolean>(form, "wantQR"));

  if (!issue) {
    return NextResponse.json(
      { ok: false, error: { message: "Bad payload." } },
      { status: 400 }
    );
  }

  // 1) create the issue
  const { data: created, error: insErr } = await sb
    .from("issues")
    .insert({
      title: issue.title,
      slug: issue.slug,
      status: issue.status,
      published_at: issue.published_at,
      created_by: userId,
      created_by_email: null,
    })
    .select("id")
    .single();

  if (insErr || !created) {
    return NextResponse.json(
      { ok: false, error: { message: "Failed to create issue." } },
      { status: 500 }
    );
  }

  const issueId: string = created.id;

  // 2) uploads (cover & pdf)
  const cover = form.get("cover");
  if (cover && cover instanceof File) {
    const path = `issues/${issueId}/cover-${Date.now()}-${cover.name}`;
    const { data: up, error } = await sb.storage
      .from("zine-assets")
      .upload(path, cover, { cacheControl: "3600", upsert: false });
    if (!error && up) {
      const { data: pub } = sb.storage.from("zine-assets").getPublicUrl(up.path);
      await sb.from("issues").update({ cover_img_url: pub.publicUrl }).eq("id", issueId);
    }
  }

  const pdf = form.get("pdf");
  if (pdf && pdf instanceof File) {
    const path = `issues/${issueId}/zine-${Date.now()}-${pdf.name}`;
    const { data: up, error } = await sb.storage
      .from("zine-assets")
      .upload(path, pdf, { cacheControl: "3600", upsert: false });
    if (!error && up) {
      const { data: pub } = sb.storage.from("zine-assets").getPublicUrl(up.path);
      await sb.from("issues").update({ pdf_url: pub.publicUrl }).eq("id", issueId);
    }
  }

  // 3) inserts for tracking data
  if (features.length) {
    await sb.from("features").insert(
      features.map((f) => ({
        issue_id: issueId,
        type: "feature",
        name: f.name,
        url: normalizeUrl(f.url ?? null),
      }))
    );
  }

  if (events.length) {
    await sb.from("features").insert(
      events.map((e) => ({
        issue_id: issueId,
        type: "event",
        name: e.name,
        url: normalizeUrl(e.url ?? null),
      }))
    );
  }

  if (advertisers.length) {
    await sb.from("advertisers").insert(
      advertisers.map((a) => ({
        issue_id: issueId,
        name: a.name,
        website: normalizeUrl(a.website ?? null),
      }))
    );
  }

  if (distributors.length) {
    await sb.from("distributors").insert(
      distributors.map((d) => ({
        issue_id: issueId,
        name: d.name,
        website: normalizeUrl(d.website ?? null),
        active: true,
      }))
    );
  }

  if (links.length) {
    await sb.from("issue_links").insert(
      links.map((l, i) => ({
        issue_id: issueId,
        label: l.label,
        url: normalizeUrl(l.url),
        sort_order: i,
      }))
    );
  }

  // 5) optional QR generation (Option A)
  if (wantQR) {
    try {
      await sb.rpc("generate_missing_redirects_for_issue", { p_issue_id: issueId });
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("QR rpc failed (non-blocking):", err);
      }
    }
  }

  return NextResponse.json({ ok: true, issue_id: issueId });
}
