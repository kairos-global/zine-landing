"use client";

const BLUE = "#65CBF1";
const BLUE_DARK = "#1E7FA8";

type Checklist = {
  basics: boolean;
  cover: boolean;
  pdf?: boolean;
  interactivity?: boolean;
  distribution?: boolean;
};

// ─── Small check / circle icons ──────────────────────────────────────────────
function DoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill={BLUE} />
      <path
        d="M4.5 8L7 10.5L11.5 5.5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PendingIcon({ required }: { required?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle
        cx="8"
        cy="8"
        r="7"
        stroke={required ? "#F87171" : "#D1D5DB"}
        strokeWidth="1.5"
        fill={required ? "#FEF2F2" : "white"}
      />
    </svg>
  );
}

export default function FinalChecklist({
  checklist,
}: {
  checklist: Checklist | Partial<Record<"A" | "B" | "C" | "D" | "E", boolean>>;
}) {
  // Normalise legacy format
  const isLegacy =
    "A" in checklist || "B" in checklist || "C" in checklist || "D" in checklist || "E" in checklist;

  const c: Checklist = isLegacy
    ? {
        basics: !!(checklist as Record<string, boolean>).A,
        cover: !!(checklist as Record<string, boolean>).B,
      }
    : (checklist as Checklist);

  const requiredItems = [
    { key: "basics", ok: c.basics, label: "Title", desc: "A) Basics — required" },
    { key: "cover", ok: c.cover, label: "Cover", desc: "B) Uploads — required" },
  ];

  const optionalItems = [
    { key: "pdf", ok: !!c.pdf, label: "PDF copy", desc: "B) Uploads" },
    { key: "interactivity", ok: !!c.interactivity, label: "Links & QR", desc: "C) Interactivity" },
    { key: "distribution", ok: !!c.distribution, label: "Distribution", desc: "D) Distribution" },
  ];

  const requiredDone = requiredItems.filter((i) => i.ok).length;
  const totalRequired = requiredItems.length;
  const allRequiredDone = requiredDone === totalRequired;
  const optionalDone = optionalItems.filter((i) => i.ok).length;
  const progressPct = Math.round((requiredDone / totalRequired) * 100);

  return (
    <div className="space-y-4">
      {/* ── Header + progress bar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold text-sm text-gray-700 whitespace-nowrap">Publish Checklist</h3>
        <div className="flex-1 flex items-center gap-2">
          {/* Bar track */}
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                backgroundColor: allRequiredDone ? BLUE : "#FCA5A5",
              }}
            />
          </div>
          <span className="text-xs font-semibold whitespace-nowrap"
            style={{ color: allRequiredDone ? BLUE_DARK : "#EF4444" }}>
            {requiredDone}/{totalRequired} required
          </span>
        </div>
      </div>

      {/* ── Required step cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {requiredItems.map((item) => (
          <div
            key={item.key}
            className="rounded-xl border-2 p-3 flex items-start gap-3 transition-all"
            style={{
              borderColor: item.ok ? `${BLUE}99` : "#FECACA",
              backgroundColor: item.ok ? `${BLUE}10` : "#FFF5F5",
            }}
          >
            <div className="flex-shrink-0 mt-0.5">
              {item.ok ? <DoneIcon /> : <PendingIcon required />}
            </div>
            <div className="min-w-0">
              <div
                className="text-sm font-bold leading-tight"
                style={{ color: item.ok ? BLUE_DARK : "#EF4444" }}
              >
                {item.label}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Optional step pills ───────────────────────────────────────────── */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
          Toolkit — optional ({optionalDone}/{optionalItems.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {optionalItems.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all"
              style={
                item.ok
                  ? { borderColor: `${BLUE}66`, backgroundColor: `${BLUE}12`, color: BLUE_DARK }
                  : { borderColor: "#E5E7EB", backgroundColor: "white", color: "#9CA3AF" }
              }
            >
              {item.ok ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span style={{ color: "#D1D5DB" }}>○</span>
              )}
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Readiness banner ─────────────────────────────────────────────── */}
      <div
        className="rounded-xl px-4 py-3 flex items-center gap-3 transition-all"
        style={{
          backgroundColor: allRequiredDone ? `${BLUE}15` : "#FFF5F5",
          border: `1.5px solid ${allRequiredDone ? `${BLUE}55` : "#FECACA"}`,
        }}
      >
        <div className="flex-shrink-0 mt-0.5">
          {allRequiredDone ? <DoneIcon /> : <PendingIcon required />}
        </div>
        <div>
          <div
            className="text-sm font-bold"
            style={{ color: allRequiredDone ? BLUE_DARK : "#EF4444" }}
          >
            {allRequiredDone ? "Ready to publish!" : "Almost there…"}
          </div>
          <div className="text-xs text-gray-500">
            {allRequiredDone
              ? `Required steps complete${optionalDone > 0 ? ` · ${optionalDone} optional toolkit item${optionalDone > 1 ? "s" : ""} added` : ""}. Hit Publish when you're ready.`
              : requiredItems
                  .filter((i) => !i.ok)
                  .map((i) => i.desc)
                  .join(" and ") + " must be completed before publishing."}
          </div>
        </div>
      </div>
    </div>
  );
}
