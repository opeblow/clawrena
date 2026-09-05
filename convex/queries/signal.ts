import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Read-only single signal lookup (used by the token page + detail view).
 * Returns null when no signal exists for the given id.
 */
export const signal = query({
  args: {
    id: v.id("signals"),
  },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});
