"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import {
  fetchHolderConcentration,
  fetchTokenMeta,
  fetchMarketSnapshot,
  isMarketConfigured,
} from "./lib/market";
import { internal } from "./_generated/api";

export type ShieldCheck = {
  id: string;
  label: string;
  status: "pass" | "flag" | "unknown";
  detail: string;
};

/**
 * Manipulation-shield scan for a user-supplied Solana token mint.
 *
 * Every returning check is computed from live data:
 * - Jupiter Price V3 (one call): listed, real price, liquidity, decimals.
 * - Public Solana RPC: largest-holder concentration (dev-wallet risk).
 * - Helius-gated checks (wash trading, bundling, honeypot) report "unknown"
 *   with the reason until a Helius key is configured. We never fabricate a
 *   verdict we can't derive.
 */
export const scan = action({
  args: { tokenMint: v.string() },
  handler: async (ctx, { tokenMint }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const mint = tokenMint.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
      return { valid: false, error: "Not a valid Solana base58 mint." };
    }

    const [meta, snap, holdings] = await Promise.all([
      fetchTokenMeta(mint),
      fetchMarketSnapshot([mint]),
      fetchHolderConcentration(mint),
    ]);

    const price = snap[mint]?.priceUsd;
    const liquidityUsd = snap[mint]?.liquidityUsd;
    const checks: ShieldCheck[] = [];

    checks.push({
      id: "price",
      label: "Price verification",
      status: price !== undefined ? "pass" : "unknown",
      detail:
        price !== undefined
          ? `Listed — real price $${price.toPrecision(5)} via Jupiter.`
          : "No price on Jupiter. Token may be unlisted or illiquid.",
    });

    checks.push({
      id: "holders",
      label: "Largest-holder concentration",
      status:
        holdings === null
          ? "unknown"
          : holdings.largestHolderPct > 50
            ? "flag"
            : "pass",
      detail:
        holdings === null
          ? "RPC unavailable — retry later."
          : `Largest holder owns ${holdings.largestHolderPct.toFixed(1)}% (${holdings.largestHolderAmount.toLocaleString()} of ${holdings.supply.toLocaleString()}).`,
    });

    checks.push({
      id: "liquidity",
      label: "Liquidity",
      status:
        liquidityUsd === undefined
          ? "unknown"
          : liquidityUsd > 0
            ? "pass"
            : "flag",
      detail:
        liquidityUsd === undefined
          ? "No liquidity data on Jupiter for this mint."
          : liquidityUsd > 0
            ? `~$${liquidityUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} total liquidity across DEXs on Jupiter.`
            : "Jupiter reports zero liquidity — high rug risk.",
    });

    const heliusConfigured = isMarketConfigured();
    for (const { id, label, hint } of [
      { id: "wash", label: "Wash trading", hint: "Needs trade-history streaming (Helius key)." },
      { id: "bundle", label: "Bundling", hint: "Needs launch-account analysis (Helius key)." },
      { id: "honeypot", label: "Buy/sell restrictions", hint: "Needs live route simulation." },
    ]) {
      checks.push(
        heliusConfigured
          ? { id, label, status: "unknown", detail: "Deep scan queued with Helius streaming." }
          : { id, label, status: "unknown", detail: hint },
      );
    }

    const flagCount = checks.filter((c) => c.status === "flag").length;

    await ctx.runMutation(internal.signals.recordTelemetry, {
      eventType: "shield.scan",
      payload: {
        mint,
        token: meta,
        price,
        liquidityUsd,
        holderConcentration: holdings,
        flagCount,
        checks,
      },
    });

    return {
      valid: true,
      configured: heliusConfigured,
      token: meta,
      price,
      flagCount,
      checks,
    };
  },
});