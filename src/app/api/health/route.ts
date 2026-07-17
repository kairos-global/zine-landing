import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Health check for uptime monitoring (UptimeRobot).
 * Verifies the app is serving AND the database is reachable.
 */
export async function GET() {
  const startedAt = Date.now();
  let db = "ok";
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { error } = await supabase
      .from("issues")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (error) db = "error";
  } catch {
    db = "error";
  }

  const healthy = db === "ok";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      db,
      latency_ms: Date.now() - startedAt,
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
