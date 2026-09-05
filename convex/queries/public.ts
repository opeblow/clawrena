import { query } from "../_generated/server";

/**
 * Public aggregate stats for the landing page. No auth required — these are
 * broadcast counters, not private data. Every number is computed from live
 * system state; a fresh deployment genuinely returns zeros.
 */
export const publicStats = query({
  args: {},
  handler: async (ctx) => {
    const [trades, agents, users, signals, volume] = await Promise.all([
      ctx.db.query("trades").collect(),
      ctx.db.query("agents").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("signals").collect(),
      ctx.db.query("portfolios").collect(),
    ]);

    const tradesExecuted = trades.length;
    const agentsDeployed = agents.length;
    const totalUsers = Math.max(0, users.length - 1);
    const signalsGenerated = signals.length;
    const volumeSol = trades.reduce((sum, t) => sum + (t.amountSol ?? 0), 0);

    return {
      tradesExecuted,
      agentsDeployed,
      totalUsers,
      signalsGenerated,
      volumeSol,
      netWorthSol: volume.reduce((sum, p) => sum + (p.cashSol ?? 0), 0),
    };
  },
});