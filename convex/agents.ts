import { mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";

async function requireUser(ctx: MutationCtx) {
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
  return user;
}

/**
 * Deploy an Alpha Scout agent for the signed-in user. Requires the user to
 * have attached a funded Solana wallet. Creates a real agent record (idle).
 */
export const deployAgent = mutation({
  args: {
    name: v.string(),
    autoTrading: v.boolean(),
  },
  handler: async (ctx, { name, autoTrading }) => {
    const user = await requireUser(ctx);
    if (!user.walletAddress) {
      throw new Error("Attach a Solana wallet before deploying an agent");
    }

    const existing = await ctx.db
      .query("agents")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .first();
    if (existing) {
      return existing;
    }

    const agentId = await ctx.db.insert("agents", {
      ownerId: user._id,
      name,
      status: "idle",
      walletAddress: user.walletAddress,
      riskMaxPosition: 2, // SOL
      riskMaxDrawdownPct: 10, // %
      autoTrading,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.patch(user._id, { agentDeployed: true });

    const portfolio = await ctx.db
      .query("portfolios")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .first();
    if (portfolio) {
      await ctx.db.patch(portfolio._id, { agentId });
    }

    return ctx.db.get(agentId);
  },
});

/**
 * Update an agent's risk parameters. Only the owning user can change it.
 */
export const updateAgentRisk = mutation({
  args: {
    agentId: v.id("agents"),
    riskMaxPosition: v.optional(v.number()),
    riskMaxDrawdownPct: v.optional(v.number()),
  },
  handler: async (ctx, { agentId, riskMaxPosition, riskMaxDrawdownPct }) => {
    const user = await requireUser(ctx);
    const agent = await ctx.db.get(agentId);
    if (!agent || agent.ownerId !== user._id) {
      throw new Error("Agent not found or not owned");
    }
    if (
      riskMaxPosition !== undefined &&
      (!Number.isFinite(riskMaxPosition) || riskMaxPosition <= 0)
    ) {
      throw new Error("Maximum position must be positive");
    }
    if (
      riskMaxDrawdownPct !== undefined &&
      (!Number.isFinite(riskMaxDrawdownPct) ||
        riskMaxDrawdownPct <= 0 ||
        riskMaxDrawdownPct > 100)
    ) {
      throw new Error("Maximum drawdown must be between 0 and 100 percent");
    }
    return ctx.db.patch(agentId, {
      ...(riskMaxPosition !== undefined && { riskMaxPosition }),
      ...(riskMaxDrawdownPct !== undefined && { riskMaxDrawdownPct }),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Change agent trading state: idle/running/paused/halted. Owned only.
 */
export const setAgentState = mutation({
  args: {
    agentId: v.id("agents"),
    status: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("halted"),
    ),
  },
  handler: async (ctx, { agentId, status }) => {
    const user = await requireUser(ctx);
    const agent = await ctx.db.get(agentId);
    if (!agent || agent.ownerId !== user._id) {
      throw new Error("Agent not found or not owned");
    }
    return ctx.db.patch(agentId, { status, updatedAt: Date.now() });
  },
});

export { requireUser };

/**
 * Internal: force an agent into a status (used by the risk halt and harness).
 */
export const internalSetStatus = internalMutation({
  args: {
    agentId: v.id("agents"),
    status: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("halted"),
    ),
  },
  handler: async (ctx, { agentId, status }) => {
    return ctx.db.patch(agentId, { status, updatedAt: Date.now() });
  },
});

/**
 * Internal: record one agent execution cycle for the auditable run log.
 * Only ever logged by the harness action after a real run.
 */
export const logAgentRun = internalMutation({
  args: {
    agentId: v.id("agents"),
    startedAt: v.number(),
    endedAt: v.number(),
    scansProcessed: v.number(),
    tradesExecuted: v.number(),
    outcome: v.union(v.literal("ok"), v.literal("halted"), v.literal("error")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agent_runs", args);
    await ctx.db.patch(args.agentId, { updatedAt: Date.now() });
  },
});
