"use client";

type Point = { date: string; count: number };

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}/${day}`;
}

/** Build last 7 days (oldest to newest) so today is on the far right. Use UTC dates to match API (server uses UTC from scanned_at). */
function getWeeklyPoints(data: Point[]): Point[] {
  const dataByDate = new Map<string, number>();
  data.forEach((p) => {
    const key = typeof p.date === "string" ? p.date.slice(0, 10) : "";
    if (key.length === 10) dataByDate.set(key, p.count);
  });
  const out: Point[] = [];
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let i = -6; i <= 0; i++) {
    const d = new Date(todayUTC);
    d.setUTCDate(d.getUTCDate() + i);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    out.push({ date: key, count: dataByDate.get(key) ?? 0 });
  }
  return out;
}

interface ScanBarChartProps {
  data: Point[];
  title?: string;
  height?: number;
  /** Total scans to show at top (e.g. zine total or QR total) */
  totalScans?: number;
  /** If true, show last 7 days with today on the right (default true) */
  weekly?: boolean;
}

export function ScanBarChart({ data, title, height = 120, totalScans, weekly = true }: ScanBarChartProps) {
  const display = weekly ? getWeeklyPoints(data) : data.length ? data.slice(-7) : [];

  if (display.length === 0 && !weekly) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-center text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400" style={{ minHeight: height }}>
        {title && <div className="font-semibold text-black dark:text-white mb-2">{title}</div>}
        No scan data yet
      </div>
    );
  }

  const PX_PER_VISIT = 14;
  const MAX_BAR_HEIGHT = 84;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800 p-3 shadow-sm">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        {title && <div className="text-xs font-semibold text-black dark:text-white">{title}</div>}
        {totalScans !== undefined && (
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
            {totalScans} visit{totalScans !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-1" style={{ minHeight: MAX_BAR_HEIGHT + 24 }}>
        {display.map((p) => {
          const barHeight = p.count === 0 ? 0 : Math.min(p.count * PX_PER_VISIT, MAX_BAR_HEIGHT);
          return (
            <div key={p.date} className="flex-1 min-w-0 max-w-[32px] flex flex-col items-center justify-end gap-0.5">
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 min-h-[14px] flex items-center justify-center">
                {p.count > 0 ? p.count : ""}
              </span>
              <div
                className="w-full max-w-[22px] bg-blue-500 dark:bg-blue-400 rounded-t rounded-b-sm flex-shrink-0"
                style={{ height: barHeight }}
                title={`${formatDateLabel(p.date)}: ${p.count} visit${p.count !== 1 ? "s" : ""}`}
              />
              <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate w-full text-center leading-tight">
                {formatDateLabel(p.date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
