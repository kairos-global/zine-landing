"use client";

import { useState } from "react";
import toast from "react-hot-toast";

export type Distribution = {
  self_distribute: boolean;
  print_for_me: boolean;
};

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
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Choose how you want to distribute your zine to readers and distributors.
      </p>

      {/* Self Distribute */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={value.self_distribute}
          onChange={(e) =>
            onChange({ ...value, self_distribute: e.target.checked })
          }
          className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div className="flex-1">
          <div className="font-medium group-hover:text-blue-600 transition">
            Self distribute
          </div>
          <div className="text-sm text-gray-600">
            You print and fulfill your own zines whenever you get a distribution order.
          </div>
        </div>
      </label>

      {/* Print for Me (Recommended) */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={value.print_for_me}
          onChange={(e) =>
            onChange({ ...value, print_for_me: e.target.checked })
          }
          className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div className="flex-1">
          <div className="font-medium group-hover:text-blue-600 transition">
            Distribute for me{" "}
            <span className="text-xs font-normal bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              Recommended
            </span>
          </div>
          <div className="text-sm text-gray-600">
            Zineground will print and deliver any distributor&apos;s order of copies for your zine, 
            anywhere in the world where distributors are located, no exceptions. This helps us build 
            a worldwide distribution network.
          </div>
        </div>
      </label>

      {value.print_for_me && (
        <div className="mt-3 space-y-2">
          {hasPayment ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              ✅ Payment completed! Your zine will be available for distributors to order once published.
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
              <p className="text-sm text-amber-800 font-medium">
                💳 Payment Required ($25)
              </p>
              <p className="text-xs text-amber-700">
                You need to pay a one-time fee to enable print-for-me distribution. This allows Zineground to print and ship your zine to distributors worldwide.
              </p>
              {issueId && (
                <button
                  onClick={handlePaymentClick}
                  disabled={processingPayment}
                  className="mt-2 w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50 text-sm font-medium"
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

