"use node";

import { action, internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { fetchPrices, fetchMarketSnapshot, fetchHolderConcentration } from "./lib/market";

// The typed `internal` aggregate is used throughout (runQuery/runMutation) so
// internal calls are type-checked — no `internal as any`.

// Default risk exits the harness attaches to its own entries (configurable per
// position on a manual trade). Honest, fixed, and shown in the signal.
const DEFAULT_STOP_PCT = 0.2;
const DEFAULT_TAKE_PROFIT_PCT = 0.5;
const MAX_DISCOVERIES_PER_CYCLE = 3;
// Shield gate thresholds the harness applies before it can act on a signal:
// real liquidity must exceed this (USD) and the largest holder must hold less
// than this share. Anything unverifiable is treated as "not flagged" — the
// agent only rejects on proven facts.
const MIN_LIQUIDITY_USD = 1000;
const MAX_TOP_HOLDER_PCT = 50;
const FRACTION_OF_CASH_PER_ENTRY = 0.1;

type AgentState = {
  id: Id<"agents">;
  status: "idle" | "running" | "paused" | "halted";
  autoTrading: boolean;
  ownerId: Id<"users">;
  riskMaxPosition: number;
  riskMaxDrawdownPct: number;
};

type OpenPosition = {
  _id: Id<"positions">;
  tokenMint: string;
  tokenSymbol?: string;
  sizeSol: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
};

/**
 * Agent harness core (Hermes-style loop). One cycle per eligible agent:
 *
 * 1. Loads the agent's real open positions.
 * 2. Fetches live prices for those tokens from the public Jupiter price API.
 * 3. Recomputes each position's real unrealized PnL from market data.
 * 4. Enforces risk exits — stop-loss / take-profit — closing positions and
 *    recording matched sell trades.
 * 5. Discovery phase: opens new positions on real, not-yet-acted `new-launch`
 *    signals, sized by `riskMaxPosition` and capped by available cash.
 * 6. Enforces the portfolio's user-configured drawdown cap; halts the agent
 *    when breached.
 * 7. Logs the whole cycle to `agent_runs` for auditability.
 *
 * Everything is computed from real system state and live market data. With no
 * cash, no eligible signals or no running agents, this returns zeros and
 * writes no fake activity.
 */
export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    const targets: Array<{ id: Id<"agents">; status: string }> = await ctx.runQuery(
      internal.queries.internal.listEligibleAgents,
      {},
    );
    const summaries = [];
    for (const t of targets) {
      summaries.push(await runCycle(ctx, t.id));
    }
    return summaries;
  },
});

/**
 * Demo-facing "Run cycle now": run exactly one harness cycle for the
 * signed-in user's agent immediately, instead of waiting for the 15-minute
 * cron. Auth-gated; no-ops cleanly when the user has no agent.
 */
export const runNow = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    agentId: Id<"agents"> | null;
    outcome: string;
    reason?: string;
    positionsProcessed?: number;
    tradesExecuted?: number;
  }> => {
    const agentId: Id<"agents"> | null = await ctx.runQuery(
      internal.queries.internal.getMyAgentId,
      {},
    );
    if (!agentId) {
      return { agentId: null, outcome: "none", reason: "no agent" };
    }
    return runCycle(ctx, agentId);
  },
});

async function runCycle(ctx: ActionCtx, agentId: Id<"agents">) {
  const startedAt = Date.now();
  const learned = await ctx.runQuery(internal.queries.internal.loadAgentContext, {
    agentId,
  });
  if (!learned) {
    return { agentId, outcome: "error", reason: "no agent" };
  }

  const agent = learned.agent as AgentState;
  const open = (learned.openPositions ?? []) as OpenPosition[];
  if (agent.status !== "running" || !agent.autoTrading || !learned.portfolio) {
    await ctx.runMutation(internal.agents.logAgentRun, {
      agentId,
      startedAt,
      endedAt: Date.now(),
      scansProcessed: 0,
      tradesExecuted: 0,
      outcome: "ok",
    });
    return { agentId, outcome: "ok", positionsProcessed: 0, tradesExecuted: 0 };
  }

  const openMints: string[] = [...new Set(open.map((p) => p.tokenMint))];
  const prices = await fetchPrices(openMints);
  let tradesExecuted = 0;
  let processed = 0;

  for (const position of open) {
    const price = prices[position.tokenMint];
    if (price === undefined) continue;
    processed += 1;

    await ctx.runMutation(internal.trades.updatePositionPrice, {
      positionId: position._id,
      price,
      at: startedAt,
    });
    await ctx.runMutation(internal.signals.recordTelemetry, {
      eventType: "price.tick",
      payload: { mint: position.tokenMint, price, source: "jupiter", at: startedAt },
    });

    const stop = position.stopLoss;
    const target = position.takeProfit;
    if (stop !== undefined && price <= stop) {
      await ctx.runMutation(internal.trades.internalClosePosition, {
        positionId: position._id,
        reason: "stop",
      });
      tradesExecuted += 1;
      await ctx.runMutation(internal.signals.createSignal, {
        tokenMint: position.tokenMint,
        ...(position.tokenSymbol && { tokenSymbol: position.tokenSymbol }),
        type: "warn",
        confidence: 90,
        score: -3,
        title: "Stop-loss hit",
        detail: `Position stopped out at ${price} — below your ${stop} stop.`,
        payload: { price, stop, direction: "sell" },
      });
    } else if (target !== undefined && price >= target) {
      await ctx.runMutation(internal.trades.internalClosePosition, {
        positionId: position._id,
        reason: "target",
      });
      tradesExecuted += 1;
      await ctx.runMutation(internal.signals.createSignal, {
        tokenMint: position.tokenMint,
        ...(position.tokenSymbol && { tokenSymbol: position.tokenSymbol }),
        type: "sell",
        confidence: 90,
        score: 3,
        title: "Take-profit hit",
        detail: `Position sold at ${price} — reached your ${target} target.`,
        payload: { price, target },
      });
    }
  }

  // Discovery: open fresh positions on real, un-acted launch signals.
  const discovered = await discoverEntries(ctx, agent, openMints);
  tradesExecuted += discovered.tradesExecuted;
  processed += discovered.candidatesExamined;

  // Drawdown enforcement after exits and entries: open value vs invested cost.
  const fresh = await ctx.runQuery(internal.queries.internal.loadAgentContext, {
    agentId,
  });
  let outcome: "ok" | "halted" = "ok";

  const freshAgent = fresh?.agent as AgentState | undefined;
  if (fresh?.portfolio && fresh.openPositions.length > 0 && freshAgent) {
    const cost = fresh.portfolio.investedSol;
    const value = fresh.openPositions.reduce(
      (sum: number, p: OpenPosition) => sum + (p.currentPrice / p.entryPrice) * p.sizeSol,
      0,
    );
    const maxDrawdownPct = freshAgent.riskMaxDrawdownPct;
    const threshold = cost * (1 - Math.min(100, Math.max(0, maxDrawdownPct)) / 100);
    if (cost > 0 && value < threshold) {
      await ctx.runMutation(internal.agents.internalSetStatus, {
        agentId,
        status: "halted",
      });
      await ctx.runMutation(internal.signals.createSignal, {
        tokenMint: fresh.openPositions[0].tokenMint,
        type: "warn",
        confidence: 95,
        score: -4,
        title: "Agent halted — drawdown guard",
        detail: `Harness halted the agent: open value fell ${maxDrawdownPct}% below cost (your configured drawdown cap).`,
        payload: { cost, value, maxDrawdownPct },
      });
      outcome = "halted";
    }
  }

  await ctx.runMutation(internal.agents.logAgentRun, {
    agentId,
    startedAt,
    endedAt: Date.now(),
    scansProcessed: processed,
    tradesExecuted,
    outcome,
  });

  return { agentId, outcome, positionsProcessed: processed, tradesExecuted };
}

/**
 * Discovery phase: for an eligible running agent, act on up to
 * MAX_DISCOVERIES_PER_CYCLE recent `new-launch` signals the agent has not yet
 * acted on. Every token must pass the same live checks the manipulation shield
 * uses — real Jupiter liquidity above the floor and no whale-dominated top
 * holder — before entry. Size is min(riskMaxPosition, 10% of cash). The signal
 * is marked acted so the harness never opens the same launch twice.
 */
async function discoverEntries(
  ctx: ActionCtx,
  agent: AgentState,
  alreadyHeldMints: string[],
): Promise<{ tradesExecuted: number; candidatesExamined: number }> {
  const candidates: Array<{
    signalId: Id<"signals">;
    mint: string;
    symbol: string | null;
    processedAt: number;
  }> = await ctx.runQuery(internal.queries.internal.listCandidateLaunches, {
    excludeMints: alreadyHeldMints,
  });

  if (candidates.length === 0) {
    return { tradesExecuted: 0, candidatesExamined: 0 };
  }

  const mints = candidates.map((c) => c.mint);
  // One batched Jupiter call gives price + liquidity for every candidate;
  // holder concentration is one parallel RPC round-trip per mint (public RPC
  // with failover). Unknown holder data is treated as "not flagged".
  const snap = await fetchMarketSnapshot(mints);
  const holdings = await Promise.all(
    candidates.map((c) => fetchHolderConcentration(c.mint).catch(() => null)),
  );
  let remainingCash = Math.max(0, await currentCash(ctx, agent));

  let opened = 0;
  let examined = 0;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const price = snap[c.mint]?.priceUsd;
    if (price === undefined || price <= 0) continue;
    examined += 1;
    if (opened >= MAX_DISCOVERIES_PER_CYCLE) break;
    if (remainingCash <= 0) break;

    const liquidityUsd = snap[c.mint]?.liquidityUsd;
    const holder = holdings[i];
    const holderPct = holder?.largestHolderPct;
    let rejectReason: string | null = null;
    if (liquidityUsd === undefined) {
      rejectReason = "liquidity unknown";
    } else if (liquidityUsd <= MIN_LIQUIDITY_USD) {
      rejectReason = `liquidity $${Math.round(liquidityUsd)} < floor`;
    } else if (holderPct !== undefined && holderPct >= MAX_TOP_HOLDER_PCT) {
      rejectReason = `top holder ${holderPct.toFixed(1)}%`;
    }
    if (rejectReason) {
      await ctx.runMutation(internal.signals.recordTelemetry, {
        eventType: "agent.shieldReject",
        payload: { mint: c.mint, reason: rejectReason, at: Date.now() },
      });
      continue;
    }

    const sizeSol = Math.min(agent.riskMaxPosition, remainingCash * FRACTION_OF_CASH_PER_ENTRY);
    const entry = price;
    try {
      await ctx.runMutation(internal.trades.internalOpenPosition, {
        agentId: agent.id,
        tokenMint: c.mint,
        ...(c.symbol && { tokenSymbol: c.symbol }),
        sizeSol,
        price: entry,
        stopLoss: entry * (1 - DEFAULT_STOP_PCT),
        takeProfit: entry * (1 + DEFAULT_TAKE_PROFIT_PCT),
      });
      await ctx.runMutation(internal.signals.markSignalActed, { signalId: c.signalId });
      await ctx.runMutation(internal.signals.createSignal, {
        tokenMint: c.mint,
        ...(c.symbol && { tokenSymbol: c.symbol }),
        type: "buy",
        confidence: 40,
        score: 1,
        title: "Agent opened position",
        detail: `Entered ${formatSol(sizeSol)} on a new launch at ${entry}. Stop ${entry * (1 - DEFAULT_STOP_PCT)}, target ${entry * (1 + DEFAULT_TAKE_PROFIT_PCT)}.`,
        payload: { price: entry, sizeSol, stopLoss: entry * (1 - DEFAULT_STOP_PCT), takeProfit: entry * (1 + DEFAULT_TAKE_PROFIT_PCT) },
      });
      await ctx.runMutation(internal.signals.recordTelemetry, {
        eventType: "agent.opened",
        payload: { mint: c.mint, price: entry, sizeSol, signalId: c.signalId, at: Date.now() },
      });
      remainingCash -= sizeSol;
      opened += 1;
    } catch {
      // Insufficient cash / risk-limit rejection: skip this candidate and
      // keep the loop going on the next one.
    }
  }
  return { tradesExecuted: opened, candidatesExamined: examined };
}

/** Fresh portfolio cash (post-exit) for the discovery sizing decision. */
async function currentCash(ctx: ActionCtx, agent: AgentState): Promise<number> {
  const fresh = await ctx.runQuery(internal.queries.internal.loadAgentContext, {
    agentId: agent.id,
  });
  return fresh?.portfolio?.cashSol ?? 0;
}

function formatSol(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}