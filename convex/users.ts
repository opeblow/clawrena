import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Idempotently create the signed-in user's record and a starting portfolio.
 * Called by the client after first sign-in. A new user starts with 0 SOL cash,
 * 0 invested, and an empty positions table — real state, nothing seeded.
 */
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    if (!identity.tokenIdentifier) {
      throw new Error("Missing token identifier");
    }

    let existing = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .first();

    if (!existing && identity.email) {
      existing = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", identity.email))
        .first();
    }

    const now = Date.now();
    let userId = existing?._id;
    if (existing) {
      await ctx.db.patch(existing._id, {
        tokenIdentifier: identity.tokenIdentifier,
        ...(identity.name && !existing.name && { name: identity.name }),
        agentDeployed: existing.agentDeployed ?? false,
        createdAt: existing.createdAt ?? now,
      });
    } else {
      userId = await ctx.db.insert("users", {
        tokenIdentifier: identity.tokenIdentifier,
        ...(identity.name && { name: identity.name }),
        walletAddress: undefined,
        agentDeployed: false,
        createdAt: now,
      });
    }

    const portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", userId!))
      .first();
    if (!portfolio) {
      await ctx.db.insert("portfolios", {
        ownerId: userId!,
        cashSol: 0,
        investedSol: 0,
        updatedAt: now,
      });
    }

    return ctx.db.get(userId!);
  },
});

/**
 * Attach the user's Solana wallet address to their profile.
 */
export const setWallet = mutation({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, { walletAddress }) => {
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
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress.trim())) {
      throw new Error("Invalid Solana wallet address");
    }
    return ctx.db.patch(user._id, { walletAddress: walletAddress.trim() });
  },
});
