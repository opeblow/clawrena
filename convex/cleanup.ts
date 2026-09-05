import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const TELEMETRY_RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/**
 * Telemetry retention sweep. Every 24h, deletes price.tick / shield.scan rows
 * older than 14 days so the telemetry table can't grow without bound. A fresh
 * deployment has nothing to delete — no-op is the correct, silent behavior.
 */
export const sweepTelemetry = internalAction({
  args: {},
  handler: async (ctx): Promise<{ deleted: number }> => {
    const cutoff = Date.now() - TELEMETRY_RETENTION_MS;
    const deleted: number = await ctx.runMutation(internal.signals.sweepTelemetryRows, {
      cutoff,
    });
    return { deleted };
  },
});