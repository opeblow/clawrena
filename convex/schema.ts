import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * Alpha Scout data model.
 *
 * IMPORTANT: No seeds, no fixtures. Every table starts empty and is only
 * populated by real user activity and real on-chain/agent events. Counts in
 * the app reflect live system state — never invented numbers.
 */
export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    tokenIdentifier: v.optional(v.string()),
    walletAddress: v.optional(v.string()),
    agentDeployed: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("email", ["email"])
    .index("phone", ["phone"]),

  portfolios: defineTable({
    ownerId: v.id("users"),
    agentId: v.optional(v.id("agents")),
    cashSol: v.number(),
    investedSol: v.number(),
    depositedSol: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_ownerId", ["ownerId"]),

  deposits: defineTable({
    portfolioId: v.id("portfolios"),
    amountSol: v.number(),
    source: v.union(v.literal("manual"), v.literal("wallet")),
    txSignature: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_portfolioId_createdAt", ["portfolioId", "createdAt"]),

  agents: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    status: v.union(v.literal("idle"), v.literal("running"), v.literal("paused"), v.literal("halted")),
    walletAddress: v.optional(v.string()),
    riskMaxPosition: v.number(),
    riskMaxDrawdownPct: v.number(),
    autoTrading: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_status_autoTrading", ["status", "autoTrading"]),

  positions: defineTable({
    agentId: v.optional(v.id("agents")),
    portfolioId: v.id("portfolios"),
    tokenMint: v.string(),
    tokenSymbol: v.optional(v.string()),
    sizeSol: v.number(),
    entryPrice: v.number(),
    currentPrice: v.number(),
    pnlSol: v.number(),
    pnlPct: v.number(),
    stopLoss: v.optional(v.number()),
    takeProfit: v.optional(v.number()),
    status: v.union(v.literal("open"), v.literal("closed"), v.literal("closed_stop"), v.literal("closed_target")),
    openedAt: v.number(),
    closedAt: v.optional(v.number()),
  })
    .index("by_portfolioId_status", ["portfolioId", "status"])
    .index("by_agentId", ["agentId"]),

  trades: defineTable({
    portfolioId: v.id("portfolios"),
    agentId: v.optional(v.id("agents")),
    direction: v.union(v.literal("buy"), v.literal("sell")),
    tokenMint: v.string(),
    tokenSymbol: v.optional(v.string()),
    amountSol: v.number(),
    price: v.number(),
    pnlUsd: v.optional(v.number()),
    pnlPct: v.optional(v.number()),
    pnlSol: v.optional(v.number()),
    txSignature: v.optional(v.string()),
    executedBy: v.union(v.literal("user"), v.literal("agent")),
    timestamp: v.number(),
  })
    .index("by_portfolioId_timestamp", ["portfolioId", "timestamp"])
    .index("by_agentId", ["agentId"]),

  signals: defineTable({
    tokenMint: v.string(),
    tokenSymbol: v.optional(v.string()),
    type: v.union(
      v.literal("buy"),
      v.literal("sell"),
      v.literal("warn"),
      v.literal("new-launch"),
      v.literal("alert"),
    ),
    confidence: v.number(),
    score: v.number(),
    title: v.string(),
    detail: v.string(),
    payload: v.any(),
    actedOn: v.optional(v.boolean()),
    processedAt: v.number(),
  })
    .index("by_processedAt", ["processedAt"])
    .index("by_tokenMint_type", ["tokenMint", "type"])
    .index("by_type_processedAt", ["type", "processedAt"]),

  products: defineTable({
    mint: v.string(),
    name: v.string(),
    symbol: v.string(),
    supply: v.number(),
    curveState: v.any(),
    ownerId: v.id("users"),
    createdAt: v.number(),
  }).index("by_ownerId", ["ownerId"]),

  agent_runs: defineTable({
    agentId: v.id("agents"),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    scansProcessed: v.number(),
    tradesExecuted: v.number(),
    outcome: v.union(v.literal("ok"), v.literal("halted"), v.literal("error")),
    error: v.optional(v.string()),
  })
    .index("by_agentId_startedAt", ["agentId", "startedAt"])
    .index("by_startedAt", ["startedAt"]),

  telemetry: defineTable({
    eventType: v.string(),
    payload: v.any(),
    walletAddress: v.optional(v.string()),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),
});
