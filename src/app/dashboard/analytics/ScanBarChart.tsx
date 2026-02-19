"use client";

type Point = { date: string; count: number };

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const mon = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  const year = String(d.getFullYear()).slice(-2);
  return `${mon}-${day}-${year}`;
}

interface ScanBarChartProps {
  data: Point[];
  title?: string;
  height?: number;
  maxBars?: number;
}

export function ScanBarChart({ data, title, height = 120, maxBars = 14 }: ScanBarChartProps) {
  const max = Math.max(1, ...data.map((p) => p.count));
  const display = data.length > maxBars ? data.slice(-maxBars) : data;

  if (display.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-center text-sm text-slate-500" style={{ minHeight: height }}>
        {title && <div className="font-semibold text-black mb-2">{title}</div>}
        No scan data yet
      </div>
    );
  }

  const barAreaHeight = height - 24;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      {title && <div className="text-xs font-semibold text-black mb-2">{title}</div>}
      <div className="flex items-end gap-1.5" style={{ height: barAreaHeight + 18 }}>
        {display.map((p) => {
          const barHeight = max > 0 ? Math.max(12, Math.round((p.count / max) * barAreaHeight)) : 0;
          return (
            <div key={p.date} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
              <div
                className="w-full bg-blue-500 rounded-t-md flex-shrink-0 min-h-[12px]"
                style={{ height: barHeight }}
                title={`${formatDateLabel(p.date)}: ${p.count} visit${p.count !== 1 ? "s" : ""}`}
              />
              <span className="text-[10px] text-slate-500 truncate w-full text-center leading-tight">
                {formatDateLabel(p.date)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-slate-400 mt-1 text-right">0 – {max} visits</div>
    </div>
  );
}
