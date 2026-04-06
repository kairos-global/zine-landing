"use client";

export type Distribution = {
  self_distribute: boolean;
  print_for_me: boolean;
  max_copies_per_order?: number;
  auto_approve_quantity?: number;
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

function LimitInput({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: PURPLE_DARK }}>
        {label}
      </label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v) && v >= min && v <= max) onChange(v);
        }}
        className="w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-1"
        style={{ borderColor: `${PURPLE}66`, color: PURPLE_DARK }}
      />
      <p className="text-xs mt-1" style={{ color: `${PURPLE_DARK}99` }}>
        {hint}
      </p>
    </div>
  );
}

export default function DistributionSection({
  value,
  onChange,
}: {
  value: Distribution;
  onChange: (next: Distribution) => void;
}) {
  const maxCopies = value.max_copies_per_order ?? 50;
  const autoApprove = value.auto_approve_quantity ?? 20;

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
            onChange({ ...value, self_distribute: e.target.checked, print_for_me: false })
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
            onChange({ ...value, self_distribute: false, print_for_me: e.target.checked })
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
              Zineground prints and delivers orders for your zine to distributors worldwide.
              You are charged <strong>10¢ per copy</strong> when a distributor&apos;s order is approved — no upfront fee.
            </div>
          </div>
        </div>
      </label>

      {/* Order limit controls — shown when print_for_me is active */}
      {value.print_for_me && (
        <div
          className="rounded-xl p-4 space-y-4"
          style={{
            backgroundColor: `${PURPLE}0d`,
            border: `1px solid ${PURPLE}44`,
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: PURPLE_DARK }}>
            Order controls
          </p>
          <LimitInput
            label="Max copies per order"
            hint="Distributors cannot request more than this in a single order. (1–500)"
            value={maxCopies}
            min={1}
            max={500}
            onChange={(v) => onChange({ ...value, max_copies_per_order: v })}
          />
          <LimitInput
            label="Auto-approve below"
            hint="Orders up to this quantity are approved automatically. Above it, you approve manually in the Creator Portal. Set to 0 to review every order."
            value={autoApprove}
            min={0}
            max={maxCopies}
            onChange={(v) => onChange({ ...value, auto_approve_quantity: v })}
          />
        </div>
      )}
    </div>
  );
}
