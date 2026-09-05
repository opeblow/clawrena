"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { fetchLaunchMints, isMarketConfigured } from "./lib/market";

/**
 * Launch-discovery scanner. Cron every few minutes: polls pump.fun's recent
 * signatures through a real (Helius-gated) RPC, parses each transaction to a
 * real mint address, and ingests them as `new-launch` signals — deduped by
 * mint so replays never double-insert.
 *
 * Honest by construction: with no Helius key configured this writes nothing
 * and records no fake activity. When configured, every signal maps to a real
 * on-chain create transaction.
 */
export const discover = internalAction({
  args: {},
  handler: async (ctx) => {
    const startedAt = Date.now();
    const configured = isMarketConfigured();
    if (!configured) {
      await ctx.runMutation(internal.signals.recordTelemetry, {
        eventType: "scanner.run",
        payload: {
          source: "pump.fun",
          configured: false,
          launched: 0,
          scanned: 0,
          at: startedAt,
          note: "Helius not configured — no launches discovered.",
        },
      });
      return { configured: false, launched: 0, scanned: 0 };
    }

    const events = await fetchLaunchMints(25);
    let inserted = 0;
    if (events.length > 0) {
      const result = await ctx.runMutation(internal.signals.ingestWebhookEvents, {
        events,
      });
      inserted = result.inserted;
    }

    await ctx.runMutation(internal.signals.recordTelemetry, {
      eventType: "scanner.run",
      payload: {
        source: "pump.fun",
        configured: true,
        launched: events.length,
        inserted,
        scanned: events.length,
        at: startedAt,
      },
    });

    return { configured: true, launched: events.length, inserted };
  },
});