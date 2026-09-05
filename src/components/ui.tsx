import type { ReactNode } from "react";

export function Card({
  title,
  badge,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={`card ${className}`}>
      {title !== undefined && (
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div className="text-[15px] font-bold">{title}</div>
          {badge}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

export function CardBadge({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-up-bg text-up">
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: string;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-14 h-14 rounded-2xl bg-surface border border-line flex items-center justify-center text-2xl mb-4">
        {icon ?? "○"}
      </div>
      <div className="font-semibold text-ink">{title}</div>
      <div className="text-sm text-ink-mid mt-1.5 max-w-xs leading-relaxed">{hint}</div>
    </div>
  );
}

const confidenceColor: Record<string, { text: string; bg: string }> = {
  high: { text: "text-up", bg: "bg-up-bg" },
  mid: { text: "text-accent", bg: "bg-accent-light" },
  low: { text: "text-ink-faint", bg: "bg-surface" },
};

export function Confidence({ pct }: { pct: number }) {
  const key = pct >= 80 ? "high" : pct >= 60 ? "mid" : "low";
  const c = confidenceColor[key];
  return (
    <span
      className={`font-mono text-[12px] font-bold px-2 py-1 rounded-md ${c.text} ${c.bg}`}
    >
      {pct}%
    </span>
  );
}

const avatarPalette = [
  "bg-orange-400",
  "bg-indigo-400",
  "bg-emerald-400",
  "bg-blue-400",
  "bg-rose-400",
  "bg-amber-400",
];

export function TokenAvatar({
  symbol,
  seed,
}: {
  symbol?: string | null;
  seed: string;
}) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const color = avatarPalette[Math.abs(hash) % avatarPalette.length];
  return (
    <div
      className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-[13px] font-bold`}
    >
      {(symbol || seed).slice(0, 1).toUpperCase()}
    </div>
  );
}

export function Pnl({ value }: { value: number }) {
  const cls = value >= 0 ? "text-up" : "text-down";
  return (
    <span className={`font-mono text-[13px] font-semibold ${cls}`}>
      {value >= 0 ? "+" : ""}
      {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%
    </span>
  );
}
