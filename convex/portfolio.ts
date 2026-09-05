import { mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * The funding path: a wallet -> portfolio bridge. Until a portfolio holds
 * cash, nothing — user or agent — can open a position. The read-side queries
 * here are consumed by the `wallet.importWalletBalance` action (cross-module,
 * so aggregate reference inference stays clean).
 */

/**
 * Read the signed-in user's portfolio context. Actions can't touch the db
 * directly, so this ships wallet + cash across the internal boundary.
 */
export const getMyContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.tokenIdentifier) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier!),
      )
      .first();
    if (!user) return null;
    const portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .first();
    return {
      user: { id: user._id, walletAddress: user.walletAddress },
      portfolio: portfolio
        ? { id: portfolio._id, cashSol: portfolio.cashSol, depositedSol: portfolio.depositedSol ?? 0 }
        : null,
    };
  },
});

/** Simple "add N SOL" — the demo/paper funding path. */
export const depositSol = mutation({
  args: {
    amountSol: v.number(),
    txSignature: v.optional(v.string()),
  },
  // TODO(production): wrap this in a real SOL transfer once live execution is
  // wired (ClawPump / Hermes funded wallet). For the demo this authenticates
  // the user and credits the managed portfolio directly, so nothing on-chain
  // has to exist for the app to close the loop — and the PAPER badge makes
  // that explicit in the UI.
  handler: async (ctx, { amountSol, txSignature }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.tokenIdentifier) {
      throw new Error("Not authenticated");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier!),
      )
      .first();
    if (!user) {
      throw new Error("User not found; call ensureUser first");
    }
    if (!Number.isFinite(amountSol) || amountSol <= 0 || amountSol > 100) {
      throw new Error("Deposit amount must be between 0 and 100 SOL");
    }
    let portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .first();
    if (!portfolio) {
      const now = Date.now();
      const id = await ctx.db.insert("portfolios", {
        ownerId: user._id,
        cashSol: 0,
        investedSol: 0,
        depositedSol: 0,
        updatedAt: now,
      });
      portfolio = await ctx.db.get(id);
    }
    if (!portfolio) throw new Error("No portfolio");

    const now = Date.now();
    await ctx.db.patch(portfolio._id, {
      cashSol: portfolio.cashSol + amountSol,
      depositedSol: (portfolio.depositedSol ?? 0) + amountSol,
      updatedAt: now,
    });
    await ctx.db.insert("deposits", {
      portfolioId: portfolio._id,
      amountSol,
      source: "manual",
      ...(txSignature && { txSignature }),
      createdAt: now,
    });
    return ctx.db.get(portfolio._id);
  },
});

export const creditWalletImport = internalMutation({
  args: { amountSol: v.number() },
  handler: async (ctx, { amountSol }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.tokenIdentifier) {
      throw new Error("Not authenticated");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier!),
      )
      .first();
    if (!user) throw new Error("User not found; call ensureUser first");
    let portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .first();
    if (!portfolio) {
      const now = Date.now();
      const id = await ctx.db.insert("portfolios", {
        ownerId: user._id,
        cashSol: 0,
        investedSol: 0,
        depositedSol: 0,
        updatedAt: now,
      });
      portfolio = await ctx.db.get(id);
    }
    if (!portfolio) throw new Error("No portfolio");
    const now = Date.now();
    const current = portfolio.cashSol;
    const topUp = amountSol > current ? amountSol - current : 0;
    if (topUp > 0) {
      await ctx.db.patch(portfolio._id, {
        cashSol: amountSol,
        depositedSol: (portfolio.depositedSol ?? 0) + topUp,
        updatedAt: now,
      });
      await ctx.db.insert("deposits", {
        portfolioId: portfolio._id,
        amountSol: topUp,
        source: "wallet",
        createdAt: now,
      });
    }
    return { currentCashSol: current, importedSol: topUp };
  },
});

/**
 * Internal: place a user position whose price was verified server-side by the
 * `trades.openPosition` action. Kept in this module (not `trades.ts`) so the
 * action and its internal target never share a module — a self-reference
 * there would defeat type-checking on the internal call.
 */
export const internalPlaceUserPosition = internalMutation({
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
        q.eq("tokenIdentifier", identity.tokenIdentifier!),
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
      pnlSol: 0,
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