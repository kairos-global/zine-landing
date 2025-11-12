import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

import {
  BountyDetail,
  BountySummary,
  BountyStatus,
} from "@/types/bounties";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RawBountyRow = {
  id: string;
  owner_profile_id: string;
  title: string;
  brief: string | null;
  reward_amount: number;
  currency: string;
  status: BountyStatus;
  deadline: string | null;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapRowToSummary(row: RawBountyRow): BountySummary {
  return {
    id: row.id,
    ownerProfileId: row.owner_profile_id,
    title: row.title,
    brief: row.brief,
    rewardAmount: Number(row.reward_amount),
    currency: row.currency,
    status: row.status,
    deadline: row.deadline,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToDetail(row: RawBountyRow): BountyDetail {
  return {
    ...mapRowToSummary(row),
    stripePaymentIntentId: row.stripe_payment_intent_id,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
  };
}

async function getProfileId(clerkId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (error) {
    console.error("[Bounties] Failed to fetch profile", error);
    return null;
  }

  return data?.id ?? null;
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("bounties")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Bounties] GET error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const payload: BountySummary[] = (data || []).map(mapRowToSummary);
    return NextResponse.json({ bounties: payload });
  } catch (err) {
    console.error("[Bounties] Unexpected GET error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await getProfileId(userId);
    if (!profileId) {
      return NextResponse.json(
        { error: "Profile not found. Please complete your profile." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      title,
      brief,
      rewardAmount,
      currency = "usd",
      deadline,
      stripePaymentIntentId,
      stripeCheckoutSessionId,
    } = body as {
      title?: string;
      brief?: string;
      rewardAmount?: number;
      currency?: string;
      deadline?: string | null;
      stripePaymentIntentId?: string | null;
      stripeCheckoutSessionId?: string | null;
    };

    if (!title || !rewardAmount || rewardAmount <= 0) {
      return NextResponse.json(
        { error: "Title and positive reward amount are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("bounties")
      .insert({
        title,
        brief: brief ?? null,
        reward_amount: rewardAmount,
        currency,
        deadline: deadline ?? null,
        owner_profile_id: profileId,
        stripe_payment_intent_id: stripePaymentIntentId ?? null,
        stripe_checkout_session_id: stripeCheckoutSessionId ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      console.error("[Bounties] POST insert error", error);
      return NextResponse.json({ error: error?.message }, { status: 500 });
    }

    return NextResponse.json({ bounty: mapRowToDetail(data as RawBountyRow) });
  } catch (err) {
    console.error("[Bounties] Unexpected POST error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
