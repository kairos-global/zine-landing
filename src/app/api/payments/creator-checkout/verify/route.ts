import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { processCreatorPayment } from "@/lib/billing";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/payments/creator-checkout/verify
 * Called when the creator returns to the success URL after Stripe Checkout.
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

    await processCreatorPayment(sessionId, supabase);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[VerifyCreatorPayment] Error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
