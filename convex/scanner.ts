"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { fetchLaunchMints, isMarketConfigured } from "./lib/market";

/**
 * Launch-discovery scanner. Cron every few minutes: polls pump.fun's recent
 * signatures through a real (Helius-gated) RPC, parses each transaction to a
 * real mint address, and ingests them as `new-launch` signals — deduped by
 * mint so replays never double-insert.
 *
 * Honest by construction: every signal maps to a real on-chain create
 * transaction. When no Helius key is configured the underlying fetch helpers
 * fall back through plain public Solana RPCs (rate-limit-prone, so don't rely
 * on it at scale), and telemetry records `configured` exactly as it is. With
 * every RPC unreachable this writes nothing and records no fake activity.
 */
export const discover = internalAction({
  args: {},
  handler: async (ctx) => {
    const startedAt = Date.now();
    const configured = isMarketConfigured();
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
        configured,
        launched: events.length,
        inserted,
        scanned: events.length,
        at: startedAt,
        note: configured
          ? "Helius-gated RPC discovery."
          : "Helius not configured — public RPC discovery (rate-limit prone).",
      },
    });

    return { configured, launched: events.length, inserted };
  },
});

/**
 * On-demand discovery for a human at the wheel (the demo path). Same real
 * discovery + ingest pipeline as the cron, invoked immediately instead of on
 * the interval, and paginated shallow (public RPCs rate-limit hard). Returns
 * exactly what was found and ingested — never an estimate.
 */
export const discoverNow = action({
  args: {},
  handler: async (ctx) => {
    const startedAt = Date.now();
    const configured = isMarketConfigured();
    const events = await fetchLaunchMints(15);
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
        configured,
        launched: events.length,
        inserted,
        scanned: events.length,
        at: startedAt,
        note: "manual trigger",
      },
    });

    return { configured, launched: events.length, inserted, events };
  },
});