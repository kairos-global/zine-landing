// app/api/clerk-webhook/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Webhook } from "svix";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";           // svix needs node, not edge
export const dynamic = "force-dynamic";

// --- Supabase (service role) ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service key -> bypasses RLS for webhooks
);

// Minimal typing for Clerk webhook events we care about
type ClerkEmail = { id: string; email_address: string };
type ClerkEventData = {
  id: string;
  email_addresses?: ClerkEmail[];
  primary_email_address_id?: string | null;
};
type ClerkWebhookEvent = {
  type: string;       // "user.created" | "user.updated" | "user.deleted" | ...
  data: ClerkEventData;
};

function getPrimaryEmail(data: ClerkEventData): string | null {
  if (!data.email_addresses || data.email_addresses.length === 0) return null;
  const primaryId = data.primary_email_address_id;
  if (primaryId) {
    const match = data.email_addresses.find(e => e.id === primaryId);
    if (match) return match.email_address;
  }
  return data.email_addresses[0].email_address ?? null;
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error("❌ Missing CLERK_WEBHOOK_SECRET env var");
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  // 1) Grab raw body + headers (headers() is synchronous)
  const payload = await req.text();
  const h = await headers();
  const svix_id = h.get("svix-id") ?? "";
  const svix_timestamp = h.get("svix-timestamp") ?? "";
  const svix_signature = h.get("svix-signature") ?? "";

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  // 2) Verify signature
  let evt: ClerkWebhookEvent;
  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error("❌ Webhook verification failed:", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  // 3) Handle events
  const { type: eventType, data } = evt;
  const clerkId = data?.id;

  try {
    if (eventType === "user.created" || eventType === "user.updated") {
      const email = getPrimaryEmail(data);

      // Upsert profile (idempotent on clerk_id)
      const { error: upsertErr } = await supabase
        .from("profiles")
        .upsert(
          {
            clerk_id: clerkId,
            email: email ?? null,
            // role defaults to 'creator' in DB; you can also set it explicitly:
            // role: "creator",
          },
          { onConflict: "clerk_id" } // ensure you have a unique index on profiles.clerk_id
        );

      if (upsertErr) {
        console.error("❌ Supabase upsert profile error:", upsertErr);
        // Return 500 so Clerk retries (recommended for transient failures)
        return new NextResponse("Upsert failed", { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    if (eventType === "user.deleted") {
      // Optional: clean up profile if a user is deleted in Clerk
      const { error: delErr } = await supabase
        .from("profiles")
        .delete()
        .eq("clerk_id", clerkId);

      if (delErr) {
        console.error("❌ Supabase delete profile error:", delErr);
        return new NextResponse("Delete failed", { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    // Ignore other events
    return NextResponse.json({ ok: true, ignored: eventType });
  } catch (err) {
    console.error("❌ Webhook handler crashed:", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
