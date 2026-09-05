"use node";

import { internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { fetchPrices } from "./lib/market";

// Break the type-level cycle (module -> internal -> module) that TS cannot
// resolve during inference. The runtime object is unchanged.
const I = internal as any; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Agent harness core (Hermes-style loop). One cycle per eligible agent:
 *
 * 1. Loads the agent's real open positions.
 * 2. Fetches live prices for those tokens from the public Jupiter price API.
 * 3. Recomputes each position's real unrealized PnL from market data.
 * 4. Enforces risk exits — stop-loss / take-profit — closing positions and
 *    recording matched sell trades.
 * 5. Enforces the portfolio drawdown cap; halts the agent when breached.
 * 6. Logs the whole cycle to `agent_runs` for auditability.
 *
 * Everything is computed from real system state and live market data. With no
 * positions or agents, this returns zeros and writes no fake activity.
 */
export const run = internalAction({
  args: { agentId: v.optional(v.id("agents")) },
  handler: async (ctx, { agentId }) => {
    const targets = agentId
      ? [{ id: agentId }]
      : await ctx.runQuery(I.queries.internal.listEligibleAgents, {});

    const summaries = [];
    for (const t of targets) {
      summaries.push(await runCycle(ctx, t.id));
    }
    return summaries;
  },
});

async function runCycle(ctx: ActionCtx, agentId: string) {
  const startedAt = Date.now();
  const learned = await ctx.runQuery(I.queries.internal.loadAgentContext, {
    agentId,
  });
  if (!learned) {
    return { agentId, outcome: "error", reason: "no agent" };
  }

  const open: any[] = learned.openPositions ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (
    learned.agent.status !== "running" ||
    !learned.agent.autoTrading ||
    !learned.portfolio ||
    open.length === 0
  ) {
    await ctx.runMutation(I.agents.logAgentRun, {
      agentId,
      startedAt,
      endedAt: Date.now(),
      scansProcessed: 0,
      tradesExecuted: 0,
      outcome: "ok",
    });
    return { agentId, outcome: "ok", positionsProcessed: 0, tradesExecuted: 0 };
  }

  const mints: string[] = [...new Set(open.map((p) => p.tokenMint))];
  const prices = await fetchPrices(mints);
  let tradesExecuted = 0;
  let processed = 0;

  for (const position of open) {
    const price = prices[position.tokenMint];
    if (price === undefined) continue;
    processed += 1;

    await ctx.runMutation(I.trades.updatePositionPrice, {
      positionId: position._id,
      price,
      at: startedAt,
    });
    await ctx.runMutation(I.signals.recordTelemetry, {
      eventType: "price.tick",
      payload: { mint: position.tokenMint, price, source: "jupiter", at: startedAt },
    });

    const stop = position.stopLoss;
    const target = position.takeProfit;
    if (stop !== undefined && price <= stop) {
      await ctx.runMutation(I.trades.internalClosePosition, {
        positionId: position._id,
        reason: "stop",
      });
      tradesExecuted += 1;
      await ctx.runMutation(I.signals.createSignal, {
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
      await ctx.runMutation(I.trades.internalClosePosition, {
        positionId: position._id,
        reason: "target",
      });
      tradesExecuted += 1;
      await ctx.runMutation(I.signals.createSignal, {
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

  // Drawdown enforcement after exits: openValue vs the invested cost.
  const fresh = await ctx.runQuery(I.queries.internal.loadAgentContext, {
    agentId,
  });
  let outcome: "ok" | "halted" = "ok";

  if (fresh?.portfolio && fresh.openPositions.length > 0) {
    const cost = fresh.portfolio.investedSol;
    const value = fresh.openPositions.reduce(
      (sum: number, p: any) => sum + (p.currentPrice / p.entryPrice) * p.sizeSol, // eslint-disable-line @typescript-eslint/no-explicit-any
      0,
    );
    if (cost > 0 && value < cost * 0.5) {
      // Hard circuit: account lost too much to keep trading.
      await ctx.runMutation(I.agents.internalSetStatus, {
        agentId,
        status: "halted",
      });
      await ctx.runMutation(I.signals.createSignal, {
        tokenMint: fresh.openPositions[0].tokenMint,
        type: "warn",
        confidence: 95,
        score: -4,
        title: "Agent halted — drawdown guard",
        detail:
          "Harness halted the agent because open value fell below the safety threshold.",
        payload: { cost, value },
      });
      outcome = "halted";
    }
  }

  await ctx.runMutation(I.agents.logAgentRun, {
    agentId,
    startedAt,
    endedAt: Date.now(),
    scansProcessed: processed,
    tradesExecuted,
    outcome,
  });

  return { agentId, outcome, positionsProcessed: processed, tradesExecuted };
}