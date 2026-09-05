import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";

/**
 * Dashboard summary for the signed-in user: portfolio value, PnL, open
 * positions, and signals. All values are computed from real data — a brand
 * new user sees genuine zeros and empty lists, never placeholder numbers.
 */
export const dashboard = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.tokenIdentifier) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .first();

    if (!user) {
      return null;
    }

    const portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .first();

    // Open positions for this user's portfolio, most recently opened first.
    let positions: any[] = [];
    if (portfolio) {
      positions = await ctx.db
        .query("positions")
        .withIndex("by_portfolioId_status", (q) =>
          q.eq("portfolioId", portfolio._id).eq("status", "open"),
        )
        .order("desc")
        .take(50);
    }

    const agent = await ctx.db
      .query("agents")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .first();

    // Aggregate real numbers only. Position value is mark-to-market — current
    // price ratio applied to the SOL size — not entry cost basis.
    const positionValue = positions.reduce(
      (sum, p) => sum + (p.currentPrice / p.entryPrice) * p.sizeSol,
      0,
    );
    const portfolioValue = cashSol(portfolio) + positionValue;
    const realizedPnl = portfolio ? await sumTrades(ctx, portfolio._id) : 0;

    // Latest signals (real, empty until the scanner runs).
    const signals = await ctx.db
      .query("signals")
      .withIndex("by_processedAt")
      .order("desc")
      .take(20);

    return {
      user: {
        name: user.name,
        walletAddress: user.walletAddress,
        agentDeployed: user.agentDeployed,
      },
      portfolio: portfolio
        ? {
            id: portfolio._id,
            cashSol: portfolio.cashSol,
            investedSol: portfolio.investedSol,
            depositedSol: portfolio.depositedSol ?? 0,
            positionValue,
            portfolioValue,
            realizedPnl,
          }
        : null,
      agent: agent
        ? {
            id: agent._id,
            name: agent.name,
            status: agent.status,
            autoTrading: agent.autoTrading,
            riskMaxPosition: agent.riskMaxPosition,
            riskMaxDrawdownPct: agent.riskMaxDrawdownPct,
            walletAddress: agent.walletAddress,
          }
        : null,
      positions,
      signals,
    };
  },
});

function cashSol(portfolio: any) {
  return portfolio ? portfolio.cashSol : 0;
}

async function sumTrades(ctx: QueryCtx, portfolioId: any) {
  const trades = await ctx.db
    .query("trades")
    .withIndex("by_portfolioId_timestamp", (q) => q.eq("portfolioId", portfolioId))
    .take(1000);
  return trades.reduce((sum: number, t: any) => sum + (t.pnlSol ?? 0), 0);
}
