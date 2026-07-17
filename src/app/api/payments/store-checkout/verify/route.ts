import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processStoreOrder } from "@/lib/billing";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/payments/store-checkout/verify
 * Verify-on-return for store orders: confirms payment with Stripe directly and
 * buys the shipping label. Webhook stays as a backup. Body: { sessionId }
 */
export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    await processStoreOrder(sessionId, supabase);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[StoreCheckoutVerify] Error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
