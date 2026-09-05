import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/** Open (buy) a position for the signed-in user's own portfolio. */
export const openPosition = mutation({
  args: {
    tokenMint: v.string(),
    tokenSymbol: v.optional(v.string()),
    sizeSol: v.number(),
    price: v.number(),
    stopLoss: v.optional(v.number()),
    takeProfit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.tokenIdentifier) {
      throw new Error("Not authenticated");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .first();
    if (!user) {
      throw new Error("User not found; call ensureUser first");
    }
    const portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .first();
    if (!portfolio) {
      throw new Error("No portfolio");
    }
    if (args.sizeSol <= 0) {
      throw new Error("Position size must be positive");
    }
    if (!Number.isFinite(args.price) || args.price <= 0) {
      throw new Error("Position price must be positive");
    }
    if (
      (args.stopLoss !== undefined &&
        (!Number.isFinite(args.stopLoss) || args.stopLoss <= 0)) ||
      (args.takeProfit !== undefined &&
        (!Number.isFinite(args.takeProfit) || args.takeProfit <= 0))
    ) {
      throw new Error("Exit prices must be positive");
    }
    if (portfolio.cashSol < args.sizeSol) {
      throw new Error("Insufficient cash in portfolio");
    }

    const positionId = await ctx.db.insert("positions", {
      portfolioId: portfolio._id,
      ...(portfolio.agentId && { agentId: portfolio.agentId }),
      tokenMint: args.tokenMint,
      ...(args.tokenSymbol && { tokenSymbol: args.tokenSymbol }),
      sizeSol: args.sizeSol,
      entryPrice: args.price,
      currentPrice: args.price,
      pnlUsd: 0,
      pnlPct: 0,
      ...(args.stopLoss !== undefined && { stopLoss: args.stopLoss }),
      ...(args.takeProfit !== undefined && { takeProfit: args.takeProfit }),
      status: "open",
      openedAt: Date.now(),
    });

    await ctx.db.patch(portfolio._id, {
      cashSol: portfolio.cashSol - args.sizeSol,
      investedSol: portfolio.investedSol + args.sizeSol,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("trades", {
      portfolioId: portfolio._id,
      ...(portfolio.agentId && { agentId: portfolio.agentId }),
      direction: "buy",
      tokenMint: args.tokenMint,
      ...(args.tokenSymbol && { tokenSymbol: args.tokenSymbol }),
      amountSol: args.sizeSol,
      price: args.price,
      executedBy: "user",
      timestamp: Date.now(),
    });

    return ctx.db.get(positionId);
  },
});

/**
 * Internal: used by the execution action to record an agent-driven position
 * open. Requires an agentId so ownership is scoped through the agent -> user
 * relation rather than trusting arbitrary args.
 */
export const internalOpenPosition = internalMutation({
  args: {
    agentId: v.id("agents"),
    tokenMint: v.string(),
    tokenSymbol: v.optional(v.string()),
    sizeSol: v.number(),
    price: v.number(),
    stopLoss: v.optional(v.number()),
    takeProfit: v.optional(v.number()),
    txSignature: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }
    if (agent.status !== "running" || !agent.autoTrading) {
      throw new Error("Agent is not authorized to trade");
    }
    if (args.sizeSol <= 0 || args.sizeSol > agent.riskMaxPosition) {
      throw new Error("Position exceeds the agent risk limit");
    }
    if (!Number.isFinite(args.price) || args.price <= 0) {
      throw new Error("Position price must be positive");
    }
    if (
      (args.stopLoss !== undefined &&
        (!Number.isFinite(args.stopLoss) || args.stopLoss <= 0)) ||
      (args.takeProfit !== undefined &&
        (!Number.isFinite(args.takeProfit) || args.takeProfit <= 0))
    ) {
      throw new Error("Exit prices must be positive");
    }
    const portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", agent.ownerId))
      .first();
    if (!portfolio) {
      throw new Error("No portfolio for agent owner");
    }
    if (portfolio.cashSol < args.sizeSol) {
      throw new Error("Insufficient cash in portfolio");
    }

    const positionId = await ctx.db.insert("positions", {
      portfolioId: portfolio._id,
      agentId: args.agentId,
      tokenMint: args.tokenMint,
      ...(args.tokenSymbol && { tokenSymbol: args.tokenSymbol }),
      sizeSol: args.sizeSol,
      entryPrice: args.price,
      currentPrice: args.price,
      pnlUsd: 0,
      pnlPct: 0,
      ...(args.stopLoss !== undefined && { stopLoss: args.stopLoss }),
      ...(args.takeProfit !== undefined && { takeProfit: args.takeProfit }),
      status: "open",
      openedAt: Date.now(),
    });

    await ctx.db.patch(portfolio._id, {
      cashSol: portfolio.cashSol - args.sizeSol,
      investedSol: portfolio.investedSol + args.sizeSol,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("trades", {
      portfolioId: portfolio._id,
      agentId: args.agentId,
      direction: "buy",
      tokenMint: args.tokenMint,
      ...(args.tokenSymbol && { tokenSymbol: args.tokenSymbol }),
      amountSol: args.sizeSol,
      price: args.price,
      ...(args.txSignature && { txSignature: args.txSignature }),
      executedBy: "agent",
      timestamp: Date.now(),
    });

    return ctx.db.get(positionId);
  },
});

/**
 * Internal: snap a position to a real market price (fetched by the agent
 * action). Recomputes unrealized PnL from actual market data.
 */
export const updatePositionPrice = internalMutation({
  args: { positionId: v.id("positions"), price: v.number(), at: v.number() },
  handler: async (ctx, { positionId, price }) => {
    const position = await ctx.db.get(positionId);
    if (!position || position.status !== "open") return null;
    if (!Number.isFinite(price) || price <= 0) return position;

    const pnlPct = ((price - position.entryPrice) / position.entryPrice) * 100;
    const pnlUsd = ((price - position.entryPrice) / position.entryPrice) * position.sizeSol;

    await ctx.db.patch(positionId, { currentPrice: price, pnlPct, pnlUsd });
    return ctx.db.get(positionId);
  },
});

/**
 * Internal: close an open position and record the matched sell trade with its
 * realized PnL. `reason` records the exit type for auditability.
 */
export const internalClosePosition = internalMutation({
  args: {
    positionId: v.id("positions"),
    reason: v.union(
      v.literal("manual"),
      v.literal("stop"),
      v.literal("target"),
      v.literal("agent"),
    ),
  },
  handler: async (ctx, { positionId, reason }) => {
    const position = await ctx.db.get(positionId);
    if (!position || position.status !== "open") return null;

    const status =
      reason === "stop"
        ? "closed_stop"
        : reason === "target"
          ? "closed_target"
          : "closed";

    await ctx.db.patch(position._id, {
      status,
      closedAt: Date.now(),
      currentPrice: position.currentPrice,
      pnlPct: position.pnlPct,
      pnlUsd: position.pnlUsd,
    });

    const portfolio = await ctx.db.get(position.portfolioId);
    if (portfolio) {
      const proceeds = position.entryPrice > 0
        ? (position.currentPrice / position.entryPrice) * position.sizeSol
        : position.sizeSol;
      await ctx.db.patch(portfolio._id, {
        cashSol: portfolio.cashSol + proceeds,
        investedSol: Math.max(0, portfolio.investedSol - position.sizeSol),
        updatedAt: Date.now(),
      });
    }

    await ctx.db.insert("trades", {
      portfolioId: position.portfolioId,
      ...(position.agentId && { agentId: position.agentId }),
      direction: "sell",
      tokenMint: position.tokenMint,
      ...(position.tokenSymbol && { tokenSymbol: position.tokenSymbol }),
      amountSol: position.entryPrice > 0
        ? (position.currentPrice / position.entryPrice) * position.sizeSol
        : position.sizeSol,
      price: position.currentPrice,
      pnlUsd: position.pnlUsd,
      pnlPct: position.pnlPct,
      pnlSol: position.entryPrice > 0
        ? (position.currentPrice / position.entryPrice) * position.sizeSol - position.sizeSol
        : 0,
      executedBy: "agent",
      timestamp: Date.now(),
    });

    return ctx.db.get(position._id);
  },
});
