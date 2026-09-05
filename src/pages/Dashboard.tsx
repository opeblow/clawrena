import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardBadge, EmptyState, TokenAvatar, Pnl, Confidence } from "../components/ui";
import { formatSol, formatPrice, timeAgo, shorten } from "../lib/format";

export default function Dashboard() {
  const data = useQuery(api.queries.portfolio.dashboard);

  if (data === undefined || data === null) {
    return (
      <div className="p-8 text-ink-mid text-sm animate-pulse">
        {data === undefined ? "Loading your portfolio…" : "Connect your wallet to view your portfolio."}
      </div>
    );
  }

  const portfolio = data.portfolio;
  const agent = data.agent;
  const positions = data.positions;
  const trades = data.trades ?? [];
  const signals = data.signals;

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-5 max-w-[1400px] mx-auto w-full">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="text-[13px] text-ink-faint">
          <b className="text-ink text-[15px]">
            {data.user?.name ? `Good ${greeting()}, ${data.user.name}` : "Welcome"}
          </b>
          {agent ? (
            <span className="text-ink-mid">
              {" "}
              · Your agent is <b className="text-ink">{agent.status}</b>
            </span>
          ) : (
            <span className="text-ink-mid"> · connect a wallet and deploy an agent to begin</span>
          )}
        </div>
        <PaperModeNotice />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Portfolio Value" value={portfolio ? formatSol(portfolio.portfolioValue) : "0 SOL"} sub="position + cash" />
        <Stat
          label="Realized PnL"
          value={portfolio ? (portfolio.realizedPnl >= 0 ? "+" : "") + formatSol(portfolio.realizedPnl) : "0 SOL"}
          sub="across all closed trades"
          tone={portfolio && portfolio.realizedPnl < 0 ? "down" : "up"}
        />
        <Stat label="Open Positions" value={`${positions.length}`} sub={`${positions.length === 0 ? "no capital deployed" : "live"} · invested ${portfolio ? formatSol(portfolio.investedSol) : "0 SOL"}`} />
        <Stat label="Signals Today" value={`${signals.length}`} sub={`${signals.length === 0 ? "scanner idle" : "latest first"}`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <Card
            title="Active Positions"
            badge={<CardBadge>{positions.length} open</CardBadge>}
            bodyClassName=""
          >
            {positions.length === 0 ? (
              <EmptyState
                icon="▦"
                title="No open positions"
                hint="Once your agent executes its first trade — or you open one manually — positions will appear here with real entry, size, and PnL. Nothing is seeded."
              />
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[680px]">
                <PositionsHeader />
                {positions.map((p) => (
                  <div
                    key={p._id}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 items-center px-5 py-3.5 border-b border-line last:border-0"
                  >
                    <div className="flex items-center gap-2.5">
                      <TokenAvatar symbol={p.tokenSymbol} seed={p.tokenMint} />
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {p.tokenSymbol ?? "Unknown"}
                          <PaperPill />
                        </div>
                        <div className="text-[12px] text-ink-faint font-mono">{shorten(p.tokenMint)}</div>
                      </div>
                    </div>
                    <span className="font-mono text-[13px]">{formatPrice(p.entryPrice)}</span>
                    <span className="font-mono text-[13px]">{formatPrice(p.currentPrice)}</span>
                    <span className="font-mono text-[13px]">{formatSol(p.sizeSol)}</span>
                    <Pnl value={p.pnlPct} />
                  </div>
                ))}
                </div>
              </div>
            )}
          </Card>

          <Card
            title="Recent Trades"
            badge={<CardBadge>{trades.length} recorded</CardBadge>}
          >
            {trades.length === 0 ? (
              <EmptyState
                icon="⇄"
                title="No trades yet"
                hint="Buy and sell executions land here as real records — direction, size, price, PnL and time. Nothing is seeded."
              />
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  <TradeRowHeader />
                  {trades.slice(0, 6).map((t) => (
                    <TradeRow key={t._id} t={t} />
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card
            title="Agent Activity"
            badge={<CardBadge>{agent ? agent.status : "—"}</CardBadge>}
          >
            {agent ? (
              <div className="px-6 py-5 text-sm text-ink-mid leading-relaxed">
                Agent <b className="text-ink">{agent.name}</b> is{" "}
                <b className="text-ink">{agent.status}</b> with{" "}
                <b className="text-ink">auto-trading {agent.autoTrading ? "on" : "off"}</b>.
                Risk caps — max position {formatSol(agent.riskMaxPosition)}, max
                drawdown {agent.riskMaxDrawdownPct}%.{" "}
                {agent.status === "running"
                  ? "Position risk checks run every 15 minutes."
                  : "Start the agent to begin scanning and trading."}
              </div>
            ) : (
              <EmptyState
                icon="▲"
                title="No agent deployed yet"
                hint="Attach a Solana wallet, then deploy Alpha Scout. The agent scans and trades with real onchain data — starting from a genuinely empty state."
              />
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card
            title="Agent Console"
            badge={<CardBadge>AI Ready</CardBadge>}
            bodyClassName="flex flex-col"
          >
            <div className="px-5 py-4 text-sm">
              {agent ? (
                <p className="text-ink-mid leading-relaxed">
                  Ask your agent to find a setup, explain a signal, or place a
                  trade. Decisions are logged to <code className="font-mono text-[12px]">agent_runs</code>{" "}
                  for auditing.
                </p>
              ) : (
                <p className="text-ink-mid leading-relaxed">
                  Deploy your agent to unlock the console. Communication happens
                  in real time with zero placeholder messages.
                </p>
              )}
            </div>
          </Card>

          <Card title="Live Signals" badge={<CardBadge>{signals.length} active</CardBadge>} bodyClassName="">
            {signals.length === 0 ? (
              <EmptyState
                icon="●"
                title="No signals yet"
                hint="The scanner streams real onchain observations. Until a genuine signal is generated, this feed is correctly empty."
              />
            ) : (
              <div className="p-3.5 flex flex-col gap-2.5">
                {signals.slice(0, 4).map((s) => (
                  <div
                    key={s._id}
                    className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-surface border border-line"
                  >
                    <SignalIcon type={s.type} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate">{s.title}</div>
                      <div className="text-[11px] text-ink-faint">{timeAgo(s.processedAt)}</div>
                    </div>
                    <Confidence pct={s.confidence} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function SignalIcon({ type }: { type: "buy" | "sell" | "warn" | "new-launch" | "alert" }) {
  if (type === "buy") return <span className="w-9 h-9 rounded-lg bg-up-bg text-up flex items-center justify-center">▲</span>;
  if (type === "sell") return <span className="w-9 h-9 rounded-lg bg-down-bg text-down flex items-center justify-center">▼</span>;
  if (type === "new-launch") return <span className="w-9 h-9 rounded-lg bg-accent-light text-accent flex items-center justify-center">✦</span>;
  return <span className="w-9 h-9 rounded-lg bg-accent-light text-accent flex items-center justify-center">⚠</span>;
}

/**
 * PAPER badge — clearly marks simulated execution. Positions created in the
 * demo have no real txSignature (no live swap is wired yet); once execution
 * records an on-chain txSignature, callers should stop rendering this pill.
 */
function PaperPill() {
  return (
    <span className="inline-block rounded bg-[#FFF4E0] border border-accent/40 text-accent text-[9px] font-bold px-1.5 py-0.5 tracking-wide">
      PAPER
    </span>
  );
}

/** Small honesty banner: execution is paper until a live swap is wired. */
function PaperModeNotice() {
  return (
    <span className="rounded-md bg-[#FFF4E0] border border-accent/40 text-accent text-[10px] font-bold px-2 py-1 tracking-wide">
      PAPER MODE — simulated execution, no live swaps
    </span>
  );
}

type Trade = {
  _id: string;
  direction: "buy" | "sell";
  tokenMint: string;
  tokenSymbol?: string;
  amountSol: number;
  price: number;
  pnlSol?: number;
  pnlPct?: number;
  txSignature?: string;
  executedBy: "user" | "agent";
  timestamp: number;
};

function TradeRowHeader() {
  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 items-center px-5 py-2.5 border-b border-line bg-surface text-[11px] font-semibold text-ink-faint uppercase tracking-wide">
      <span>Side · Token</span>
      <span>Price</span>
      <span>Size</span>
      <span>PnL</span>
      <span>Time</span>
    </div>
  );
}

function TradeRow({ t }: { t: Trade }) {
  const isBuy = t.direction === "buy";
  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 items-center px-5 py-3.5 border-b border-line last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-[12px] flex-shrink-0 ${
            isBuy ? "bg-up-bg text-up" : "bg-down-bg text-down"
          }`}
        >
          {isBuy ? "▲" : "▼"}
        </span>
        <div className="min-w-0">
          <div className="font-semibold text-sm flex items-center gap-2">
            {isBuy ? "BUY" : "SELL"} {t.tokenSymbol ?? "Unknown"}
            {!t.txSignature && <PaperPill />}
          </div>
          <div className="text-[11px] text-ink-faint font-mono truncate">
            {shorten(t.tokenMint)}
            {t.executedBy === "agent" && <span className="text-accent"> · agent</span>}
          </div>
        </div>
      </div>
      <span className="font-mono text-[13px]">{formatPrice(t.price)}</span>
      <span className="font-mono text-[13px]">{formatSol(t.amountSol)}</span>
      <span className="font-mono text-[13px]">
        {t.pnlSol !== undefined ? <Pnl value={t.pnlPct ?? (t.pnlSol >= 0 ? 1 : -1)} /> : "—"}
      </span>
      <span className="text-[12px] text-ink-faint">{timeAgo(t.timestamp)}</span>
    </div>
  );
}

function PositionsHeader() {
  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 items-center px-5 py-2.5 border-b border-line bg-surface text-[11px] font-semibold text-ink-faint uppercase tracking-wide">
      <span>Token</span>
      <span>Entry</span>
      <span>Current</span>
      <span>Size</span>
      <span>PnL</span>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "up" | "down" | "ink";
}) {
  const color = tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-ink";
  return (
    <div className="card px-5 py-5">
      <div className="text-[12px] font-medium text-ink-faint uppercase tracking-wide mb-2">{label}</div>
      <div className={`font-mono text-[26px] font-bold tracking-tight ${color}`}>{value}</div>
      <div className="text-[12px] text-ink-faint mt-1.5">{sub}</div>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}
