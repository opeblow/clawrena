import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal recorders so actions (the agent harness, the scanner, the shield)
 * can persist genuine events and signals without exposing auth-gated writes.
 * Nothing here invents data — callers only ever pass values derived from real
 * onchain observations.
 */
export const recordTelemetry = internalMutation({
  args: { eventType: v.string(), payload: v.any() },
  handler: async (ctx, { eventType, payload }) => {
    await ctx.db.insert("telemetry", {
      eventType,
      payload,
      timestamp: Date.now(),
    });
  },
});

export const createSignal = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("signals", {
      tokenMint: args.tokenMint,
      ...(args.tokenSymbol && { tokenSymbol: args.tokenSymbol }),
      type: args.type,
      confidence: args.confidence,
      score: args.score,
      title: args.title,
      detail: args.detail,
      payload: args.payload,
      processedAt: Date.now(),
    });
  },
});

/**
 * Webhook intake for real on-chain launch observations (Helius). Each mint is
 * deduped — a mint already recorded as `new-launch` is skipped, so replaying a
 * webhook never duplicates signals.
 */
export const ingestWebhookEvents = internalMutation({
  args: {
    events: v.array(
      v.object({
        mint: v.string(),
        signature: v.optional(v.string()),
        ts: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { events }) => {
    let inserted = 0;
    for (const ev of events) {
      const existing = await ctx.db
        .query("signals")
        .withIndex("by_tokenMint_type", (q) =>
          q.eq("tokenMint", ev.mint).eq("type", "new-launch"),
        )
        .first();
      if (existing) continue;
      await ctx.db.insert("signals", {
        tokenMint: ev.mint,
        type: "new-launch",
        confidence: 45,
        score: 1,
        title: "New launch minted on-chain",
        detail: ev.signature
          ? `Fresh token creation detected at ${new Date(ev.ts ?? Date.now()).toISOString()} (tx ${ev.signature.slice(0, 12)}…).`
          : "Fresh token creation detected on-chain.",
        payload: {
          source: "helius-webhook",
          signature: ev.signature,
          ts: ev.ts ?? Date.now(),
        },
        processedAt: Date.now(),
      });
      inserted += 1;
    }
    return { inserted };
  },
});