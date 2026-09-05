import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Read-only signal feed, filtered by type. Returns real signals only — the
 * list is empty until the scanner generates actual observations.
 */
export const signals = query({
  args: {
    type: v.optional(
      v.union(
        v.literal("buy"),
        v.literal("sell"),
        v.literal("warn"),
        v.literal("new-launch"),
        v.literal("alert"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { type, limit }) => {
    const takeCount = Math.min(limit ?? 25, 100);
    let rows: any[];

    if (type) {
      rows = await ctx.db
        .query("signals")
        .withIndex("by_type_processedAt", (q) => q.eq("type", type))
        .order("desc")
        .take(takeCount);
    } else {
      rows = await ctx.db
        .query("signals")
        .withIndex("by_processedAt")
        .order("desc")
        .take(takeCount);
    }

    return rows;
  },
});
