import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Internal read helpers used by the agent harness action. Actions cannot
 * query the db directly, so orchestration state is loaded through these.
 */
export const loadAgentContext = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) return null;
    const portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", agent.ownerId))
      .first();
    const positions = await ctx.db
      .query("positions")
      .withIndex("by_agentId", (q) => q.eq("agentId", agentId))
      .take(100);
    const openPositions = positions.filter((p) => p.status === "open");
    return {
      agent: {
        id: agent._id,
        status: agent.status,
        autoTrading: agent.autoTrading,
        ownerId: agent.ownerId,
        riskMaxPosition: agent.riskMaxPosition,
        riskMaxDrawdownPct: agent.riskMaxDrawdownPct,
      },
      portfolio: portfolio
        ? {
            id: portfolio._id,
            cashSol: portfolio.cashSol,
            investedSol: portfolio.investedSol,
          }
        : null,
      openPositions,
    };
  },
});

export const listEligibleAgents = internalQuery({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_status_autoTrading", (q) =>
        q.eq("status", "running").eq("autoTrading", true),
      )
      .take(200);
    return agents
      .map((a) => ({ id: a._id, status: a.status }));
  },
});

/**
 * Candidate tokens an agent may still act on: real `new-launch` signals not
 * yet acted on, excluding mints the agent already holds open. Used by the
 * harness discovery phase to open fresh positions only once per launch.
 */
export const listCandidateLaunches = internalQuery({
  args: {
    excludeMints: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { excludeMints }) => {
    const excluded = new Set(excludeMints ?? []);
    const rows = await ctx.db
      .query("signals")
      .withIndex("by_type_processedAt", (q) => q.eq("type", "new-launch"))
      .order("desc")
      .take(50);
    return rows
      .filter((s) => s.actedOn !== true && !excluded.has(s.tokenMint))
      .slice(0, 5)
      .map((s) => ({
        signalId: s._id,
        mint: s.tokenMint,
        symbol: s.tokenSymbol ?? null,
        processedAt: s.processedAt,
      }));
  },
});