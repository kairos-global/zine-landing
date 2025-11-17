import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

import {
  BountyDetail,
  BountySubmission,
  SubmissionStatus,
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
  status: string;
  deadline: string | null;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  created_at: string;
  updated_at: string;
};

type RawSubmissionRow = {
  id: string;
  bounty_id: string;
  artist_profile_id: string;
  original_file_path: string;
  watermarked_preview_path: string;
  file_hash: string;
  status: SubmissionStatus;
  rank: number | null;
  revealed_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapBountyDetail(row: RawBountyRow): BountyDetail {
  return {
    id: row.id,
    ownerProfileId: row.owner_profile_id,
    title: row.title,
    brief: row.brief,
    rewardAmount: Number(row.reward_amount),
    currency: row.currency,
    status: row.status as BountyDetail["status"],
    deadline: row.deadline,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSubmission(row: RawSubmissionRow): BountySubmission {
  return {
    id: row.id,
    bountyId: row.bounty_id,
    artistProfileId: row.artist_profile_id,
    originalFilePath: row.original_file_path,
    watermarkedPreviewPath: row.watermarked_preview_path,
    fileHash: row.file_hash,
    status: row.status,
    rank: row.rank,
    revealedAt: row.revealed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getProfileId(clerkId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (error) {
    console.error("[BountyDetail] Profile lookup failed", error);
    return null;
  }

  return data?.id ?? null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();
    const viewerProfileId = userId ? await getProfileId(userId) : null;

    const { data: bounty, error: bountyError } = await supabase
      .from("bounties")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (bountyError || !bounty) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const detail = mapBountyDetail(bounty as RawBountyRow);
    const isOwner = detail.ownerProfileId === viewerProfileId;

    let submissions: BountySubmission[] = [];
    if (isOwner) {
      const { data: submissionRows, error: submissionError } = await supabase
        .from("bounty_submissions")
        .select("*")
        .eq("bounty_id", id)
        .order("created_at", { ascending: false });

      if (submissionError) {
        console.error("[BountyDetail] Failed to load submissions", submissionError);
      } else {
        submissions = (submissionRows || []).map((row) =>
          mapSubmission(row as RawSubmissionRow)
        );
      }
    } else if (viewerProfileId) {
      // Artist should see their own submissions
      const { data: submissionRows, error: submissionError } = await supabase
        .from("bounty_submissions")
        .select("*")
        .eq("bounty_id", id)
        .eq("artist_profile_id", viewerProfileId)
        .order("created_at", { ascending: false });

      if (submissionError) {
        console.error("[BountyDetail] Failed to load artist submissions", submissionError);
      } else {
        submissions = (submissionRows || []).map((row) =>
          mapSubmission(row as RawSubmissionRow)
        );
      }
    }

    return NextResponse.json({ bounty: detail, submissions, isOwner });
  } catch (err) {
    console.error("[BountyDetail] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

