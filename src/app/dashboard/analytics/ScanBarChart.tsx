"use client";

type Point = { date: string; count: number };

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}/${day}`;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Build last 7 days (oldest to newest) so today is on the far right */
function getWeeklyPoints(data: Point[]): Point[] {
  const dataByDate = new Map<string, number>();
  data.forEach((p) => dataByDate.set(p.date, p.count));
  const out: Point[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = -6; i <= 0; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const key = toDateKey(d);
    out.push({ date: key, count: dataByDate.get(key) ?? 0 });
  }
  return out;
}

interface ScanBarChartProps {
  data: Point[];
  title?: string;
  height?: number;
  /** If true, show last 7 days with today on the right (default true) */
  weekly?: boolean;
}

export function ScanBarChart({ data, title, height = 120, weekly = true }: ScanBarChartProps) {
  const display = weekly ? getWeeklyPoints(data) : data.length ? data.slice(-7) : [];
  const max = Math.max(1, ...display.map((p) => p.count));

  if (display.length === 0 && !weekly) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-center text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400" style={{ minHeight: height }}>
        {title && <div className="font-semibold text-black dark:text-white mb-2">{title}</div>}
        No scan data yet
      </div>
    );
  }

  const barAreaHeight = Math.max(60, height - 28);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800 p-3 shadow-sm">
      {title && <div className="text-xs font-semibold text-black dark:text-white mb-2">{title}</div>}
      <div className="flex items-end justify-between gap-0.5" style={{ minHeight: barAreaHeight + 16 }}>
        {display.map((p) => {
          const barHeight = max > 0 ? Math.max(4, Math.round((p.count / max) * barAreaHeight)) : 4;
          return (
            <div key={p.date} className="flex-1 min-w-0 max-w-[28px] flex flex-col items-center justify-end gap-0.5">
              <div
                className="w-full max-w-[20px] bg-blue-500 dark:bg-blue-400 rounded-t rounded-b-sm flex-shrink-0"
                style={{ height: barHeight, minHeight: 4 }}
                title={`${formatDateLabel(p.date)}: ${p.count} visit${p.count !== 1 ? "s" : ""}`}
              />
              <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate w-full text-center leading-tight">
                {formatDateLabel(p.date)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 text-right">0 – {max} visits</div>
    </div>
  );
}
