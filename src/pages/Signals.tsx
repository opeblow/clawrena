import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { EmptyState, Confidence } from "../components/ui";
import { timeAgo, shorten } from "../lib/format";

type Filter = "all" | "buy" | "sell" | "warn" | "new-launch" | "alert";

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "buy", label: "Buy Signals" },
  { id: "sell", label: "Sell Signals" },
  { id: "warn", label: "Warnings" },
  { id: "new-launch", label: "New Launches" },
  { id: "alert", label: "Alerts" },
];

export default function Signals() {
  const [filter, setFilter] = useState<Filter>("all");
  const signals = useQuery(api.queries.signals.signals, {
    type: filter === "all" ? undefined : filter,
    limit: 30,
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1100px] mx-auto w-full">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold">Signal Feed</h1>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="w-2 h-2 rounded-full bg-up animate-pulse" />
          <span className="text-ink-mid">live · streaming real onchain data</span>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold border transition ${
              filter === f.id
                ? "bg-accent border-accent text-white"
                : "bg-white border-line text-ink-mid hover:border-accent hover:text-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {signals === undefined ? (
        <div className="text-sm text-ink-mid animate-pulse">Loading signals…</div>
      ) : signals.length === 0 ? (
        <CardShell>
          <EmptyState
            icon="●"
            title={`No ${filter === "all" ? "" : filter + " "}signals yet`}
            hint="The scanner produces signals only from real onchain observations. Until a genuine pattern is detected, this feed is intentionally empty — nothing is seeded or fabricated."
          />
        </CardShell>
      ) : (
        <div className="flex flex-col gap-3">
          {signals.map((s) => (
            <div
              key={s._id}
              className="bg-white border border-line rounded-2xl px-4 sm:px-6 py-5 flex items-start sm:items-center gap-3 sm:gap-4 hover:border-accent transition"
            >
              <div className="text-[11px] text-ink-faint font-mono w-14 flex-shrink-0">
                {timeAgo(s.processedAt)}
              </div>
              <SignalIcon type={s.type} />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[15px]">
                  {s.title}
                  {s.tokenSymbol && (
                    <span className="text-ink-faint text-[13px] font-semibold font-mono ml-2">
                      ${s.tokenSymbol}
                    </span>
                  )}
                </div>
                <div className="text-[13px] text-ink-mid mt-1 leading-relaxed">{s.detail}</div>
                <div className="mt-2.5 flex gap-2 flex-wrap">
                  <Tag>{s.type.toUpperCase()}</Tag>
                  <Tag accent>#{shorten(s.tokenMint)}</Tag>
                  {s.payload?.mcap !== undefined && <Tag>MCAP {formatMoney(s.payload.mcap)}</Tag>}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <Confidence pct={s.confidence} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type SignalType = "buy" | "sell" | "warn" | "new-launch" | "alert";

function SignalIcon({ type }: { type: SignalType }) {
  if (type === "buy")
    return <span className="w-11 h-11 rounded-xl bg-up-bg text-up flex items-center justify-center text-xl flex-shrink-0">▲</span>;
  if (type === "sell")
    return <span className="w-11 h-11 rounded-xl bg-down-bg text-down flex items-center justify-center text-xl flex-shrink-0">▼</span>;
  if (type === "new-launch")
    return <span className="w-11 h-11 rounded-xl bg-accent-light text-accent flex items-center justify-center text-xl flex-shrink-0">✦</span>;
  return <span className="w-11 h-11 rounded-xl bg-accent-light text-accent flex items-center justify-center text-xl flex-shrink-0">⚠</span>;
}

function Tag({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <span
      className={`text-[11px] font-semibold px-2.5 py-1 rounded-md ${
        accent ? "bg-accent-light text-accent" : "bg-surface text-ink-mid border border-line"
      }`}
    >
      {children}
    </span>
  );
}

function CardShell({ children }: { children: ReactNode }) {
  return <div className="bg-white border border-line rounded-2xl">{children}</div>;
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
