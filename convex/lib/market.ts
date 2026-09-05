import { getJson, postJson } from "./http";

/**
 * Real Solana market-data layer. Every function here talks to a live public
 * or environment-gated endpoint. Nothing is generated or seeded.
 *
 * - Helius paths require `HELIUS_RPC_URL` (or `HELIUS_API_KEY`) to be set.
 * - Jupiter price (V3) is keyless for agents; set `JUPITER_API_KEY` for
 *   higher rate limits. One batched call returns price, liquidity, decimals
 *   and 24h change together — the rest of the scan feeds off it.
 * - Public Solana RPCs are tried in order so rate limits (429s) fail over.
 * - When an integration is not configured, callers get a clean "not
 *   configured" answer and no telemetry is written — the product never shows
 *   invented numbers.
 */

const PUMP_FUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SOL_MINT = "So11111111111111111111111111111111111111112";

export type MarketConfig = {
  heliusConfigured: boolean;
  heliusRpcUrl?: string;
};

export function marketConfig(): MarketConfig {
  const key = process.env.HELIUS_API_KEY;
  const rawUrl = process.env.HELIUS_RPC_URL;
  const heliusRpcUrl = key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : rawUrl || undefined;
  return { heliusConfigured: Boolean(heliusRpcUrl), heliusRpcUrl };
}

export function isMarketConfigured(): boolean {
  return marketConfig().heliusConfigured;
}

const PUBLIC_SOLANA_RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana.publicnode.com",
];

/**
 * JSON-RPC to Solana with failover. Public endpoints rate-limit aggressively
 * (HTTP 200 with a `{error:{code:429}}` body), so any body-level error rotates
 * to the next endpoint.
 */
async function rpcCall(method: string, params: unknown[]): Promise<{ result?: any; error?: any }> {
  const cfg = marketConfig();
  const urls = [...(cfg.heliusRpcUrl ? [cfg.heliusRpcUrl] : []), ...PUBLIC_SOLANA_RPCS];
  let last: unknown;
  for (const url of urls) {
    try {
      const res = await postJson<{ result?: any; error?: any }>(
        url,
        { jsonrpc: "2.0", id: 1, method, params },
        6_000,
      );
      if (res.error) throw new Error(`${method}: ${res.error?.message ?? JSON.stringify(res.error)}`);
      return res;
    } catch (e) {
      last = e;
    }
  }
  throw last ?? new Error(`${method} failed`);
}

export { rpcCall };

/**
 * Real SOL balance of a wallet (the wallet the user funds the agent with).
 * Returns null when no RPC is reachable — the caller decides what "unknown"
 * means and never guesses a balance.
 */
export async function fetchWalletBalance(address: string): Promise<number | null> {
  try {
    const res = await rpcCall("getBalance", [address, { commitment: "confirmed" }]);
    const lamports = Number(res.result?.value ?? NaN);
    if (!Number.isFinite(lamports) || lamports < 0) return null;
    return lamports / 1e9;
  } catch {
    return null;
  }
}

/** SOL -> USD spot rate from the keyless Jupiter price API. */
export async function fetchSolUsdRate(): Promise<number | null> {
  const prices = await fetchPrices([SOL_MINT]);
  const rate = prices[SOL_MINT];
  return rate !== undefined && rate > 0 ? rate : null;
}

export type MarketSnapshot = {
  priceUsd?: number;
  liquidityUsd?: number;
  decimals?: number;
  priceChange24h?: number;
};

/**
 * One batched call to the Jupiter Price API (V3) returning price, cross-DEX
 * liquidity, decimals and 24h change for up to 50 mints. Mints with no
 * reliable price are omitted. V2 is deprecated/404s, so this talks to V3;
 * keyless agent mode works, or set JUPITER_API_KEY for higher limits.
 */
export async function fetchMarketSnapshot(mints: string[]): Promise<Record<string, MarketSnapshot>> {
  const ids = [...new Set(mints)].slice(0, 50);
  if (ids.length === 0) return {};
  const headers: Record<string, string> = {};
  const key = process.env.JUPITER_API_KEY;
  if (key) headers["x-api-key"] = key;
  try {
    const body = await getJson<Record<string, Record<string, unknown>>>(
      `https://api.jup.ag/price/v3?ids=${ids.join(",")}`,
      8_000,
      headers,
    );
    const map = (body.data ?? body) as Record<string, Record<string, unknown>>;
    const out: Record<string, MarketSnapshot> = {};
    for (const mint of ids) {
      const raw = map[mint];
      if (!raw || typeof raw !== "object") continue;
      const num = (keys: string[]) => {
        for (const k of keys) {
          const val = raw[k];
          const n = Number(val);
          if (val !== undefined && val !== null && Number.isFinite(n)) return n;
        }
        return undefined;
      };
      const snap: MarketSnapshot = {
        priceUsd: num(["usdPrice", "price"]),
        liquidityUsd: num(["liquidity"]),
        decimals: num(["decimals"]),
        priceChange24h: num(["priceChange24h"]),
      };
      if (snap.priceUsd !== undefined) out[mint] = snap;
    }
    return out;
  } catch {
    return {};
  }
}

/** Convenience wrapper: mint -> USD price (Jupiter V3). */
export async function fetchPrices(mints: string[]): Promise<Record<string, number>> {
  const snap = await fetchMarketSnapshot(mints);
  const out: Record<string, number> = {};
  for (const [mint, s] of Object.entries(snap)) {
    if (s.priceUsd !== undefined) out[mint] = s.priceUsd;
  }
  return out;
}

/** Public Jupiter token metadata: real name/symbol for a mint. */
export async function fetchTokenMeta(
  mint: string,
): Promise<{ name?: string; symbol?: string; decimals?: number } | null> {
  try {
    const body = await getJson<{
      name?: string;
      symbol?: string;
      decimals?: number;
    }>(`https://tokens.jup.ag/token/${mint}`, 5_000);
    return body && (body.name || body.symbol) ? body : null;
  } catch {
    return null;
  }
}

export type HolderConcentration = {
  mint: string;
  supply: number;
  largestHolderAmount: number;
  largestHolderPct: number;
  holderCount: number;
};

/**
 * Real holder-concentration check (dev-wallet / whale detection). The two
 * RPC calls run in parallel and fail over across public endpoints on 429s.
 * Returns null when no RPC is reachable.
 */
export async function fetchHolderConcentration(mint: string): Promise<HolderConcentration | null> {
  try {
    const [supplyRes, largestRes] = await Promise.all([
      rpcCall("getTokenSupply", [mint]),
      rpcCall("getTokenLargestAccounts", [mint]),
    ]);
    const supply = Number(supplyRes.result?.value?.uiAmount ?? NaN);
    const accounts: { address: string; uiAmount?: number | null }[] =
      largestRes.result?.value ?? [];
    if (!accounts.length || !Number.isFinite(supply) || supply <= 0) return null;
    const largest = accounts.reduce((a, b) => ((a.uiAmount ?? 0) >= (b.uiAmount ?? 0) ? a : b));
    return {
      mint,
      supply,
      largestHolderAmount: largest.uiAmount ?? 0,
      largestHolderPct: ((largest.uiAmount ?? 0) / supply) * 100,
      holderCount: accounts.filter((a) => (a.uiAmount ?? 0) > 0).length,
    };
  } catch {
    return null;
  }
}

/**
 * Real recent-launch discovery. Requires a Helius RPC because it lists recent
 * signatures for the pump.fun program. With no Helius key this returns [] —
 * the scanner never fabricates candidate tokens.
 */
export async function fetchRecentLaunches(limit = 25): Promise<string[]> {
  const cfg = marketConfig();
  if (!cfg.heliusConfigured || !cfg.heliusRpcUrl) return [];
  try {
    const res = await rpcCall("getSignaturesForAddress", [
      PUMP_FUN_PROGRAM,
      { limit, commitment: "confirmed" },
    ]);
    const sigs: { signature?: string }[] = res.result ?? [];
    return sigs.map((s) => s.signature ?? "").filter(Boolean);
  } catch {
    return [];
  }
}

export type LaunchEvent = { mint: string; signature: string; ts: number };

/**
 * Resolve recent pump.fun transaction signatures into real mint addresses.
 * Each signature is loaded (jsonParsed) and a mint is returned only when the
 * transaction actually created a brand-new token account — a `postTokenBalance`
 * that has no `preTokenBalance` counterpart on the same account. This is what
 * a real "create / initializeMint" looks like on-chain, and it avoids treating
 * every fee-payer transfer as a launch (the failure mode of the old webhook
 * heuristic).
 *
 * Returns [] when Helius is not configured or nothing resolvable was found.
 */
export async function fetchLaunchMints(limit = 25): Promise<LaunchEvent[]> {
  const cfg = marketConfig();
  if (!cfg.heliusConfigured || !cfg.heliusRpcUrl) return [];
  const signatures = await fetchRecentLaunches(limit);
  const events: LaunchEvent[] = [];
  for (const signature of signatures.slice(0, 15)) {
    const mint = await findMintCreatedInTx(signature);
    if (mint) events.push({ mint, signature, ts: Date.now() });
  }
  return events;
}

/**
 * Best-effort: the mint of a token whose first token account was created in a
 * given pump.fun transaction. Uses `getTransaction` with jsonParsed and looks
 * for a token balance delta where a new account appears in postTokenBalances
 * with no pre-table entry. Returns null when nothing is resolvable.
 */
export async function findMintCreatedInTx(signature: string): Promise<string | null> {
  try {
    const res = await rpcCall("getTransaction", [
      signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
    ]);
    const tx = res.result as
      | {
          meta?: {
            preTokenBalances?: Array<{ mint?: string }>;
            postTokenBalances?: Array<{ mint?: string }>;
          };
          transaction?: { message?: { accountKeys?: Array<{ pubkey?: string }> } };
          blockTime?: number;
        }
      | null;
    if (!tx?.meta) return null;

    const accountKeys = tx.transaction?.message?.accountKeys ?? [];
    const pumpFunInvolved = accountKeys.some((k) => k.pubkey === PUMP_FUN_PROGRAM);
    if (!pumpFunInvolved) return null;

    const preMints = new Set(
      (tx.meta.preTokenBalances ?? []).map((b) => b.mint).filter(Boolean) as string[],
    );
    const post = tx.meta.postTokenBalances ?? [];
    const created = new Set<string>();
    for (const b of post) {
      if (b.mint && !preMints.has(b.mint)) created.add(b.mint);
    }
    if (created.size === 0) return null;
    return [...created][0];
  } catch {
    return null;
  }
}

export { PUMP_FUN_PROGRAM, SPL_TOKEN_PROGRAM, SOL_MINT };