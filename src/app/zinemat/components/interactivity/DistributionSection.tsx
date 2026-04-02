"use client";

import { useState } from "react";
import toast from "react-hot-toast";

export type Distribution = {
  self_distribute: boolean;
  print_for_me: boolean;
};

// Purple palette constants
const PURPLE = "#D16FF2";
const PURPLE_DARK = "#7B2FBE";
// Blue from BasicsSection — used for hover state on unselected cards
const BLUE_HOVER = "#65CBF1";

function CheckIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1.5 5L4 7.5L8.5 2.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function DistributionSection({
  value,
  onChange,
  issueId,
  hasPayment,
}: {
  value: Distribution;
  onChange: (next: Distribution) => void;
  issueId?: string;
  hasPayment?: boolean;
}) {
  const [processingPayment, setProcessingPayment] = useState(false);

  async function handlePaymentClick() {
    if (!issueId) {
      toast.error("Issue ID is required");
      return;
    }

    setProcessingPayment(true);
    try {
      const res = await fetch("/api/payments/creator-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to create payment session");
        return;
      }

      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      console.error("Error initiating payment:", err);
      toast.error("Failed to initiate payment");
    } finally {
      setProcessingPayment(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Choose how you want to distribute your zine to readers and distributors.
      </p>

      {/* Self Distribute card */}
      <label
        className={`block cursor-pointer rounded-xl border-2 p-4 transition-all ${
          value.self_distribute ? "" : "border-gray-200 bg-white"
        }`}
        style={
          value.self_distribute
            ? {
                borderColor: PURPLE,
                backgroundColor: `${PURPLE}18`,
              }
            : undefined
        }
        onMouseEnter={(e) => {
          if (!value.self_distribute) {
            (e.currentTarget as HTMLElement).style.borderColor = `${BLUE_HOVER}99`;
            (e.currentTarget as HTMLElement).style.backgroundColor = `${BLUE_HOVER}12`;
          }
        }}
        onMouseLeave={(e) => {
          if (!value.self_distribute) {
            (e.currentTarget as HTMLElement).style.borderColor = "";
            (e.currentTarget as HTMLElement).style.backgroundColor = "";
          }
        }}
      >
        <input
          type="checkbox"
          checked={value.self_distribute}
          onChange={(e) =>
            onChange({ self_distribute: e.target.checked, print_for_me: false })
          }
          className="sr-only"
        />
        <div className="flex items-start gap-3">
          {/* Custom checkbox */}
          <div
            className="mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all"
            style={
              value.self_distribute
                ? { borderColor: PURPLE, backgroundColor: PURPLE }
                : { borderColor: "#D1D5DB", backgroundColor: "white" }
            }
          >
            {value.self_distribute && <CheckIcon />}
          </div>
          <div className="flex-1">
            <div
              className="text-sm font-semibold"
              style={value.self_distribute ? { color: PURPLE_DARK } : undefined}
            >
              Self distribute
            </div>
            <div className="mt-0.5 text-xs text-gray-500">
              You print and fulfill your own zines whenever you get a distribution order.
            </div>
          </div>
        </div>
      </label>

      {/* Distribute for Me card */}
      <label
        className={`block cursor-pointer rounded-xl border-2 p-4 transition-all ${
          value.print_for_me ? "" : "border-gray-200 bg-white"
        }`}
        style={
          value.print_for_me
            ? {
                borderColor: PURPLE,
                backgroundColor: `${PURPLE}18`,
              }
            : undefined
        }
        onMouseEnter={(e) => {
          if (!value.print_for_me) {
            (e.currentTarget as HTMLElement).style.borderColor = `${BLUE_HOVER}99`;
            (e.currentTarget as HTMLElement).style.backgroundColor = `${BLUE_HOVER}12`;
          }
        }}
        onMouseLeave={(e) => {
          if (!value.print_for_me) {
            (e.currentTarget as HTMLElement).style.borderColor = "";
            (e.currentTarget as HTMLElement).style.backgroundColor = "";
          }
        }}
      >
        <input
          type="checkbox"
          checked={value.print_for_me}
          onChange={(e) =>
            onChange({ self_distribute: false, print_for_me: e.target.checked })
          }
          className="sr-only"
        />
        <div className="flex items-start gap-3">
          {/* Custom checkbox */}
          <div
            className="mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all"
            style={
              value.print_for_me
                ? { borderColor: PURPLE, backgroundColor: PURPLE }
                : { borderColor: "#D1D5DB", backgroundColor: "white" }
            }
          >
            {value.print_for_me && <CheckIcon />}
          </div>
          <div className="flex-1">
            <div
              className="text-sm font-semibold"
              style={value.print_for_me ? { color: PURPLE_DARK } : undefined}
            >
              Distribute for me{" "}
              <span
                className="text-xs font-normal px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${PURPLE}22`,
                  color: PURPLE_DARK,
                }}
              >
                Recommended
              </span>
            </div>
            <div className="mt-0.5 text-xs text-gray-500">
              Zineground will print and deliver any distributor&apos;s order of copies for your zine,{" "}
              anywhere in the world where distributors are located, no exceptions. This helps us build{" "}
              a worldwide distribution network.
            </div>
          </div>
        </div>
      </label>

      {/* Payment notice */}
      {value.print_for_me && (
        <div className="mt-1 space-y-2">
          {hasPayment ? (
            <div
              className="p-3 rounded-lg text-sm"
              style={{
                backgroundColor: `${PURPLE}12`,
                border: `1px solid ${PURPLE}55`,
                color: PURPLE_DARK,
              }}
            >
              ✅ Payment completed! Your zine will be available for distributors to order once published.
            </div>
          ) : (
            <div
              className="p-3 rounded-lg space-y-2"
              style={{
                backgroundColor: `${PURPLE}10`,
                border: `1px solid ${PURPLE}44`,
              }}
            >
              <p className="text-sm font-medium" style={{ color: PURPLE_DARK }}>
                💳 Payment Required ($25)
              </p>
              <p className="text-xs" style={{ color: `${PURPLE_DARK}cc` }}>
                You need to pay a one-time fee to enable print-for-me distribution. This allows Zineground to print and ship your zine to distributors worldwide.
              </p>
              {issueId && (
                <button
                  onClick={handlePaymentClick}
                  disabled={processingPayment}
                  className="mt-2 w-full px-4 py-2 text-white rounded-lg transition disabled:opacity-50 text-sm font-medium"
                  style={{ backgroundColor: PURPLE }}
                  onMouseEnter={(e) => {
                    if (!processingPayment)
                      (e.currentTarget as HTMLElement).style.backgroundColor = PURPLE_DARK;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = PURPLE;
                  }}
                >
                  {processingPayment ? "Processing..." : "Pay $25 to Enable"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
