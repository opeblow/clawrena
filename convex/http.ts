import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/** Liveness probe — confirms the deployment is serving HTTP. */
export const healthz = httpAction(async () => json({ ok: true, service: "alpha-scout", now: Date.now() }));

/**
 * Inbound webhook receiver for Helius transaction webhooks (V1 array payload,
 * also tolerant of the V2 `{transactions: [...]}` wrapper). Detects freshly
 * created token mints (a token account owned by the system program appearing
 * in a transfer) and records them as real `new-launch` signals.
 *
 * Secure it by setting `HELIUS_WEBHOOK_SECRET`; then a request is rejected
 * unless it carries the matching secret in `x-webhook-secret`.
 */
export const heliusWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (!secret) {
    return json({ ok: false, error: "webhook secret is not configured" }, 503);
  }
  if (request.headers.get("x-webhook-secret") !== secret) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid json" }, 400);
  }

  const events = extractNewMints(payload);
  if (events.length > 0) {
    try {
      await ctx.runMutation(internal.signals.ingestWebhookEvents, { events });
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500);
    }
  }
  return json({ ok: true, ingested: events.length });
});

http.route({ path: "/healthz", method: "GET", handler: healthz });
http.route({ path: "/webhooks/helius", method: "POST", handler: heliusWebhook });

type MintEvent = { mint: string; signature?: string; ts?: number };

const SYSTEM_OWNERS = new Set(["0", "11111111111111111111111111111111"]);

/**
 * Pull newly created mints out of a Helius webhook payload. A mint is
 * "new" when a token account owned by the system program shows up inside a
 * transfer (the first sign of a token being minted/created on-chain).
 */
function extractNewMints(payload: unknown): MintEvent[] {
  const txs = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { transactions?: unknown })?.transactions)
      ? (payload as { transactions: unknown[] }).transactions
      : [];
  if (!Array.isArray(txs)) return [];

  const seen = new Map<string, MintEvent>();
  for (const raw of txs) {
    if (!raw || typeof raw !== "object") continue;
    const tx = raw as {
      transaction?: { signature?: string };
      signature?: string;
      accountData?: Array<{ owner?: string }>;
      tokenTransfers?: Array<{ mint?: string }>;
      timestamp?: number;
      time?: number;
    };
    const created = (tx.accountData ?? []).some((a) => a.owner && SYSTEM_OWNERS.has(a.owner));
    if (!created) continue;
    const signature = tx.transaction?.signature ?? tx.signature;
    const fallbackTs = Number(tx.timestamp ?? tx.time ?? Date.now());
    for (const t of tx.tokenTransfers ?? []) {
      const mint = t?.mint;
      if (typeof mint === "string" && mint.length >= 32 && !seen.has(mint)) {
        seen.set(mint, { mint, signature, ts: Number.isFinite(fallbackTs) ? fallbackTs : Date.now() });
      }
    }
  }
  return [...seen.values()];
}

export default http;