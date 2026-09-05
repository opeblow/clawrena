import { useState } from "react";
import type { ReactNode, FormEvent } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardBadge, EmptyState } from "../components/ui";
import { formatSol, shorten } from "../lib/format";

export default function AgentConsole() {
  const data = useQuery(api.queries.portfolio.dashboard);
  const setWallet = useMutation(api.users.setWallet);
  const deployAgent = useMutation(api.agents.deployAgent);
  const setAgentState = useMutation(api.agents.setAgentState);
  const updateRisk = useMutation(api.agents.updateAgentRisk);
  const depositSol = useMutation(api.portfolio.depositSol);
  const importBalance = useAction(api.wallet.importWalletBalance);
  const runNow = useAction(api.runAgent.runNow);
  const [running, setRunning] = useState(false);

  const [wallet, setWalletInput] = useState("");
  const [name, setName] = useState("Alpha Scout");
  const [auto, setAuto] = useState(true);
  const [maxPos, setMaxPos] = useState(2);
  const [maxDD, setMaxDD] = useState(10);
  const [depositAmt, setDepositAmt] = useState(1);
  const [funding, setFunding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const user = data?.user;
  const agent = data?.agent;
  const portfolio = data?.portfolio;
  const agentRuns = data?.agentRuns ?? [];

  const handleDeposit = async (event: FormEvent) => {
    event.preventDefault();
    setMsg(null);
    setFunding(true);
    try {
      await depositSol({ amountSol: Number(depositAmt) });
      setMsg(`Deposited ${formatSol(Number(depositAmt))}. Ready to trade.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Deposit failed.");
    } finally {
      setFunding(false);
    }
  };

  const handleImport = async () => {
    setMsg(null);
    setFunding(true);
    try {
      const r = await importBalance();
      setMsg(
        r.importedSol > 0
          ? `Imported ${formatSol(r.importedSol)} from your wallet (${formatSol(r.balanceSol)} balance).`
          : `Wallet balance ${formatSol(r.balanceSol)} already reflected in your portfolio.`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setFunding(false);
    }
  };

  const handleDeploy = async () => {
    setMsg(null);
    try {
      if (!user?.walletAddress) {
        if (!wallet.trim()) {
          setMsg("Attach a Solana wallet address first.");
          return;
        }
        await setWallet({ walletAddress: wallet.trim() });
      }
      await deployAgent({ name, autoTrading: auto });
      setMsg("Agent deployed (idle). Fund the wallet and start trading.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Deploy failed.");
    }
  };

  const handleRunCycle = async () => {
    if (!agent) return;
    setMsg(null);
    setRunning(true);
    try {
      const r = await runNow();
      setMsg(
        `Cycle complete — outcome ${r.outcome}, ${r.positionsProcessed ?? 0} positions processed, ${r.tradesExecuted ?? 0} trade(s).`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Cycle failed.");
    } finally {
      setRunning(false);
    }
  };

  const handleRisk = async () => {
    if (!agent) return;
    try {
      await updateRisk({
        agentId: agent.id,
        riskMaxPosition: Number(maxPos),
        riskMaxDrawdownPct: Number(maxDD),
      });
      setMsg("Risk parameters updated.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Update failed.");
    }
  };

/** Honesty marker: execution is paper until live swaps are wired. */
const PaperModePill = () => (
  <span className="rounded bg-[#FFF4E0] border border-accent/40 text-accent text-[9px] font-bold px-1.5 py-0.5 tracking-wide">
    PAPER
  </span>
);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto w-full">
      <div className="grid lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <Card
            title={
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center text-white text-xl">
                  ▲
                </span>
                <div>
                  <div className="text-[16px] font-bold leading-tight">
                    {agent ? agent.name : "Alpha Scout"}
                  </div>
                  <div className="text-[12px] text-ink-mid">autonomous trading agent</div>
                </div>
              </div>
            }
            badge={
              <div className="flex items-center gap-2">
                <PaperModePill />
                <CardBadge>{agent ? agent.status : "not deployed"}</CardBadge>
              </div>
            }
          >
            <div className="px-6 py-4 text-sm text-ink-mid leading-relaxed">
              {agent ? (
                <>
                  Status <b className="text-ink">{agent.status}</b> · wallet{" "}
                  <span className="font-mono text-[12px]">{shorten(agent.walletAddress ?? "")}</span> ·{" "}
                  auto-trading <b className="text-ink">{agent.autoTrading ? "on" : "off"}</b>.{" "}
                  {agent.status !== "running" && "No trades executed yet."}
                </>
              ) : (
                "Deploy your agent below. This console remembers real decisions and trades — there is no seeded history."
              )}
            </div>
          </Card>

          <Card title="Conversation" badge={<CardBadge>live</CardBadge>} bodyClassName="">
            <div className="px-6 py-5">
              {agent ? (
                <div className="flex flex-col gap-4 text-sm">
                  <AgentLine who="scout">
                    I'm standing by. Give me a funded Solana wallet and a risk
                    budget, and I'll start scanning for real alpha.
                  </AgentLine>
                  <AgentLine who="user">Show me your current risk settings.</AgentLine>
                  <AgentLine who="scout">
                    Max position per trade: <b className="text-ink">{formatSol(agent.riskMaxPosition)}</b>. Max
                    portfolio drawdown: <b className="text-ink">{agent.riskMaxDrawdownPct}%</b>. Adjust them below.
                  </AgentLine>
                </div>
              ) : (
                <EmptyState
                  icon="▲"
                  title="No agent yet"
                  hint="Deploy Alpha Scout to open the live console. Until then there are no messages — nothing is simulated."
                />
              )}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card title="Deploy Agent" bodyClassName="p-5 flex flex-col gap-3">
            {user?.walletAddress ? (
              <div className="rounded-lg bg-surface border border-line px-4 py-3 text-[13px]">
                Wallet attached: <span className="font-mono">{shorten(user.walletAddress)}</span>
              </div>
            ) : (
              <input
                value={wallet}
                onChange={(e) => setWalletInput(e.target.value)}
                placeholder="Solana wallet address"
                className="px-4 py-3 rounded-lg bg-surface border border-line text-[13px] font-mono outline-none focus:border-accent"
              />
            )}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Agent name"
              className="px-4 py-3 rounded-lg bg-surface border border-line text-[13px] outline-none focus:border-accent"
            />
            <label className="flex items-center justify-between text-[13px]">
              <span className="font-medium">Auto-trading</span>
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            </label>
            <button
              onClick={() => void handleDeploy()}
              disabled={!!agent}
              className="px-5 py-3 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-50"
            >
              {agent ? "Deployed" : "Deploy agent"}
            </button>
          </Card>

          <Card title="Fund Portfolio" badge={<CardBadge>{portfolio ? formatSol(portfolio.cashSol) : "0 SOL"}</CardBadge>} bodyClassName="p-5 flex flex-col gap-3">
            <p className="text-[13px] text-ink-mid leading-relaxed">
              Add paper SOL to trade with, or import the real balance of your
              attached wallet. Nothing trades until the portfolio holds cash.
            </p>
            <form onSubmit={handleDeposit} className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.1"
                value={depositAmt}
                onChange={(e) => setDepositAmt(Number(e.target.value))}
                className="flex-1 px-4 py-3 rounded-lg bg-surface border border-line text-[13px] font-mono outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={funding}
                className="px-4 py-3 rounded-lg bg-accent text-white text-[13px] font-semibold disabled:opacity-60"
              >
                Deposit
              </button>
            </form>
            {user?.walletAddress ? (
              <button
                onClick={() => void handleImport()}
                disabled={funding}
                className="px-4 py-3 rounded-lg border border-line text-[13px] font-semibold hover:border-accent hover:text-accent disabled:opacity-60"
              >
                Import wallet balance
              </button>
            ) : (
              <p className="text-[12px] text-ink-faint">
                Attach a wallet above to import its real SOL balance.
              </p>
            )}
          </Card>

          {agent && (
            <>
              <Card
                title="Harness Audit Log"
                badge={<CardBadge>{agentRuns.length} runs</CardBadge>}
                bodyClassName="p-2"
              >
                {agentRuns.length === 0 ? (
                  <div className="px-4 py-4 text-[13px] text-ink-mid">
                    No cycles recorded yet. Every harness run lands here with its
                    real outcome and counts — nothing is simulated.
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {agentRuns.slice(0, 6).map((r) => (
                      <div
                        key={r._id}
                        className="flex items-center gap-3 px-4 py-2.5 text-[13px] border-b border-line last:border-0"
                      >
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            r.outcome === "ok"
                              ? "bg-up"
                              : r.outcome === "halted"
                                ? "bg-accent"
                                : "bg-down"
                          }`}
                        />
                        <span className="font-mono w-24 text-ink-faint">
                          {new Date(r.startedAt).toLocaleTimeString()}
                        </span>
                        <span className="font-semibold text-ink uppercase text-[11px] w-16">
                          {r.outcome}
                        </span>
                        <span className="text-ink-mid">
                          {r.scansProcessed} scanned · {r.tradesExecuted} traded
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card
                title="Risk Controls"
                bodyClassName="p-5 flex flex-col gap-3"
                badge={<CardBadge>owner</CardBadge>}
              >
                <label className="text-[13px] font-medium">
                  Max position (SOL)
                  <input
                    type="number"
                    value={maxPos}
                    onChange={(e) => setMaxPos(Number(e.target.value))}
                    className="mt-1 w-full px-4 py-3 rounded-lg bg-surface border border-line text-[13px] font-mono outline-none focus:border-accent"
                  />
                </label>
                <label className="text-[13px] font-medium">
                  Max drawdown (%)
                  <input
                    type="number"
                    value={maxDD}
                    onChange={(e) => setMaxDD(Number(e.target.value))}
                    className="mt-1 w-full px-4 py-3 rounded-lg bg-surface border border-line text-[13px] font-mono outline-none focus:border-accent"
                  />
                </label>
                <button
                  onClick={() => void handleRisk()}
                  className="px-5 py-3 rounded-xl border border-line text-sm font-semibold hover:border-accent hover:text-accent"
                >
                  Save risk settings
                </button>
                <button
                  onClick={() =>
                    void setAgentState({
                      agentId: agent.id,
                      status: agent.status === "running" ? "paused" : "running",
                    }).then(() => setMsg(agent.status === "running" ? "Agent paused." : "Agent started."))
                  }
                  className="px-5 py-3 rounded-xl bg-accent text-white text-sm font-semibold"
                >
                  {agent.status === "running" ? "Pause agent" : "Start agent"}
                </button>
                <button
                  onClick={() => void handleRunCycle()}
                  disabled={running}
                  className="px-5 py-3 rounded-xl border border-line text-sm font-semibold hover:border-accent hover:text-accent disabled:opacity-60"
                >
                  {running ? "Running cycle…" : "Run cycle now"}
                </button>
              </Card>

              <Card title="Capabilities" bodyClassName="p-2">
                {[
                  ["DeFi Trading", true],
                  ["Alpha Scanner", true],
                  ["Manipulation Shield", true],
                  ["Risk Manager", true],
                  ["Perps Trading", false],
                ].map(([label, on]) => (
                  <div
                    key={label as string}
                    className="flex items-center justify-between px-3 py-2.5 text-sm"
                  >
                    <span className="font-medium">{label}</span>
                    <span className={`text-[11px] font-bold ${on ? "text-up" : "text-ink-faint"}`}>
                      {on ? "ON" : "OFF"}
                    </span>
                  </div>
                ))}
              </Card>
            </>
          )}

          {msg && (
            <div className="rounded-lg bg-accent-light text-accent px-4 py-3 text-[13px] font-medium">
              {msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentLine({ who, children }: { who: "scout" | "user"; children: ReactNode }) {
  if (who === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-4 py-3 rounded-xl rounded-br-sm bg-accent text-white">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <span className="w-8 h-8 rounded-lg bg-accent-light text-accent flex items-center justify-center text-sm flex-shrink-0">
        ▲
      </span>
      <div className="max-w-[85%] px-4 py-3 rounded-xl rounded-bl-sm bg-surface border border-line text-ink-mid">
        {children}
      </div>
    </div>
  );
}
