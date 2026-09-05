import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, EmptyState } from "../components/ui";
import { shorten } from "../lib/format";
import type { ShieldCheck } from "../../convex/shieldScan";

export default function Token() {
  const { mint: routeMint } = useParams();
  const [mint, setMint] = useState<string>(routeMint ?? "");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{
    valid: boolean;
    configured?: boolean;
    checks?: ShieldCheck[];
    flagCount?: number;
    token?: { name?: string; symbol?: string } | null;
    price?: number;
    error?: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const shieldScan = useAction(api.shieldScan.scan);

  const runScan = async () => {
    if (!mint.trim()) {
      setMessage("Enter a Solana token mint to scan.");
      return;
    }
    setScanning(true);
    setMessage(null);
    try {
      const r = await shieldScan({ tokenMint: mint.trim() });
      setResult(r);
      if (r.valid && !r.configured) {
        setMessage("Deep-scan checks (wash/bundling/honeypot) need a HELIUS_API_KEY. Real checks below use public Solana + Jupiter data.");
      }
    } catch (e) {
      setResult(null);
      setMessage(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  };

  const statusBadge: Record<ShieldCheck["status"], { label: string; cls: string }> = {
    pass: { label: "PASS", cls: "bg-up-bg text-up" },
    flag: { label: "FLAG", cls: "bg-down-bg text-down" },
    unknown: { label: "UNKNOWN", cls: "bg-surface text-ink-faint" },
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1100px] mx-auto w-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Token View</h1>
        <button
          onClick={() => void runScan()}
          disabled={scanning}
          className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-60"
        >
          {scanning ? "Scanning…" : "Run shield scan"}
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2">
          <Card title="Token" badge={<span className="text-[11px] text-ink-faint">live scan</span>} bodyClassName="">
            <div className="px-6 py-6">
              <input
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                placeholder="Solana token mint (base58)"
                className="w-full px-4 py-3 rounded-lg bg-surface border border-line text-[13px] font-mono outline-none focus:border-accent mb-5"
              />

              {!result ? (
                <EmptyState
                  icon="★"
                  title="No scan run yet"
                  hint="Enter a token mint and run the manipulation-shield scan. It returns real onchain findings — no fabricated scores."
                />
              ) : !result.valid ? (
                <div className="text-sm text-down font-medium">{result.error}</div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <TokenGlyph symbol={result.token?.symbol} />
                    <div>
                      <div className="font-bold text-lg">
                        {result.token?.symbol ?? "Unknown token"}
                      </div>
                      <div className="font-mono text-[12px] text-ink-faint">{shorten(mint)}</div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="font-mono text-xl font-extrabold">
                        {result.price !== undefined ? `$${result.price.toPrecision(5)}` : "—"}
                      </div>
                      <div className="text-[12px] text-ink-faint">real price · Jupiter</div>
                    </div>
                  </div>
                  <div className="text-[13px] text-ink-mid leading-relaxed">
                    {result.token?.name ? <span className="font-medium">{result.token.name}</span> : null}{" "}
                    Shield findings below are computed from live network data.
                    {result.flagCount ? (
                      <span className="text-down font-semibold"> {result.flagCount} flagged.</span>
                    ) : null}
                  </div>
                </div>
              )}

              {message && (
                <div className="mt-5 rounded-lg bg-accent-light text-accent px-4 py-3 text-[13px] font-medium">
                  {message}
                </div>
              )}
            </div>
          </Card>
        </div>

        <Card
          title="Manipulation Shield"
          badge={
            <span className="text-[11px] font-semibold text-ink-faint">
              {result ? `${result.flagCount ?? 0} flags` : "no scan yet"}
            </span>
          }
          bodyClassName="p-4"
        >
          {!result?.checks ? (
            <div className="flex flex-col gap-3">
              {[
                ["Price verification", "Real price via Jupiter"],
                ["Largest-holder concentration", "Public RPC holder data"],
                ["Liquidity pool", "Raydium SDK index"],
                ["Wash trading", "Needs Helius streaming"],
                ["Bundling", "Needs Helius streaming"],
                ["Buy/sell restrictions", "Needs route simulation"],
              ].map(([label, desc]) => (
                <div key={label} className="flex items-center gap-3 border border-line rounded-xl px-4 py-3.5">
                  <span className="w-10 h-10 rounded-xl bg-surface text-ink-faint flex items-center justify-center text-lg">○</span>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold">{label}</div>
                    <div className="text-[12px] text-ink-faint">{desc}</div>
                  </div>
                  <span className="text-[11px] font-bold text-ink-faint">PENDING</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {result.checks.map((c) => (
                <div key={c.id} className="flex items-center gap-3 border border-line rounded-xl px-4 py-3.5">
                  <span
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                      c.status === "pass"
                        ? "bg-up-bg text-up"
                        : c.status === "flag"
                          ? "bg-down-bg text-down"
                          : "bg-surface text-ink-faint"
                    }`}
                  >
                    {c.status === "pass" ? "✓" : c.status === "flag" ? "!" : "?"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold">{c.label}</div>
                    <div className="text-[12px] text-ink-mid leading-snug">{c.detail}</div>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${statusBadge[c.status].cls}`}>
                    {statusBadge[c.status].label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function TokenGlyph({ symbol }: { symbol?: string }) {
  return (
    <div className="w-12 h-12 rounded-xl bg-accent text-white flex items-center justify-center font-extrabold text-lg">
      {symbol?.slice(0, 1) ?? "?"}
    </div>
  );
}