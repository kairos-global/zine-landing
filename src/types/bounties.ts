export type BountyStatus = "open" | "selecting" | "awarded" | "cancelled";

export interface BountySummary {
  id: string;
  title: string;
  brief: string | null;
  rewardAmount: number;
  currency: string;
  status: BountyStatus;
  deadline: string | null;
  ownerProfileId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BountyDetail extends BountySummary {
  stripePaymentIntentId?: string | null;
  stripeCheckoutSessionId?: string | null;
}

export type SubmissionStatus =
  | "submitted"
  | "shortlisted"
  | "winner"
  | "declined";

export interface BountySubmission {
  id: string;
  bountyId: string;
  artistProfileId: string;
  originalFilePath: string;
  watermarkedPreviewPath: string;
  fileHash: string;
  status: SubmissionStatus;
  rank: number | null;
  revealedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionEvent {
  id: string;
  submissionId: string;
  actorProfileId: string | null;
  eventType:
    | "submitted"
    | "viewed"
    | "ranked"
    | "revealed"
    | "payout_released"
    | "status_change";
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface BountyPayoutRecord {
  id: string;
  bountyId: string;
  submissionId: string;
  amount: number;
  currency: string;
  stripeTransferId: string;
  releasedAt: string;
  createdAt: string;
}

export type ArtistOnboardingStatus =
  | "pending"
  | "completed"
  | "restricted"
  | "disabled";

export interface ArtistStripeAccount {
  profileId: string;
  stripeAccountId: string;
  onboardingStatus: ArtistOnboardingStatus;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  lastRefreshedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
