import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { processDistributorSetup } from "@/lib/billing";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/payments/setup-checkout/verify
 * Called when the distributor returns to the success URL after Stripe Setup Checkout.
 * Retrieves the session directly from Stripe — no webhook needed.
 * Body: { sessionId: string }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    await processDistributorSetup(sessionId, supabase);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[VerifyDistributorSetup] Error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
