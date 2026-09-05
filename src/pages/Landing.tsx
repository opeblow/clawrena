import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import type { FormEvent } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";

export default function Landing() {
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const ensureUser = useMutation(api.users.ensureUser);
  const stats = useQuery(api.queries.public.publicStats);
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signIn" | "signUp">("signUp");

  const openAuth = (mode: "signIn" | "signUp") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const handleLaunch = () => {
    void ensureUser();
  };

  return (
    <div className="bg-white text-ink">
      <nav className="flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-10 py-4 sm:py-5 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-white font-extrabold shadow-[0_6px_16px_rgba(245,158,11,.3)]">
            A
          </div>
          <span className="font-bold text-[17px]">Alpha Scout</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/signals" className="hidden sm:block text-sm font-medium text-ink-mid hover:text-ink px-3 py-2">
            Signals
          </Link>
          <Link to="/agent" className="hidden sm:block text-sm font-medium text-ink-mid hover:text-ink px-3 py-2">
            Agent
          </Link>
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold"
            >
              Dashboard →{/* */}
            </Link>
          ) : (
            <button
              onClick={() => openAuth("signIn")}
              className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold"
            >
              Get started
            </button>
          )}
        </div>
      </nav>

      <header className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16 px-4 sm:px-6 lg:px-10 py-12 sm:py-16 max-w-[1180px] mx-auto">
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-up-bg text-up text-[13px] font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-up" />
            Autonomous AI trading agent on Solana
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold leading-[1.05] tracking-tight mb-5">
            Your AI trader that{" "}
            <span className="bg-gradient-to-r from-accent to-accent-dark bg-clip-text text-transparent">
              finds alpha
            </span>{" "}
            before it moves.
          </h1>
          <p className="text-lg text-ink-mid leading-relaxed mb-8 max-w-[520px]">
            Alpha Scout monitors Solana tokens, tracks smart money, detects
            manipulation, and executes trades — verifiably onchain. Deploy one
            now; every trade lands on Solana for anyone to audit.
          </p>
          <div className="flex flex-col sm:flex-row gap-3.5 mb-9">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                onClick={handleLaunch}
                className="px-7 py-3.5 rounded-xl bg-accent text-white text-base font-semibold shadow-[0_6px_16px_rgba(245,158,11,.3)]"
              >
                Deploy my agent
              </Link>
            ) : (
              <button
                onClick={() => openAuth("signUp")}
                className="px-7 py-3.5 rounded-xl bg-accent text-white text-base font-semibold shadow-[0_6px_16px_rgba(245,158,11,.3)]"
              >
                Deploy my agent
              </button>
            )}
            <Link
              to="/signals"
              className="px-7 py-3.5 rounded-xl border border-line text-base font-semibold text-ink hover:border-accent hover:text-accent"
            >
              View live dashboard
            </Link>
          </div>
          <div className="flex gap-11">
            <div>
              <div className="font-mono text-[26px] font-extrabold">
                {stats === undefined ? "…" : stats.tradesExecuted}
              </div>
              <div className="text-[13px] text-ink-faint mt-1">Trades executed</div>
            </div>
            <div>
              <div className="font-mono text-[26px] font-extrabold">
                {stats === undefined ? "…" : stats.agentsDeployed}
              </div>
              <div className="text-[13px] text-ink-faint mt-1">Agents deployed</div>
            </div>
            <div>
              <div className="font-mono text-[26px] font-extrabold">
                {stats === undefined ? "…" : `${String(stats.volumeSol.toLocaleString(undefined, { maximumFractionDigits: 2 }))} SOL`}
              </div>
              <div className="text-[13px] text-ink-faint mt-1">Volume traded</div>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-[0_30px_60px_-20px_rgba(16,20,32,.22)]">
            <div className="flex items-center gap-1.5 px-4 py-3.5 border-b border-line bg-surface">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
              <span className="ml-3 text-[12px] text-ink-faint flex-1 font-mono">
                app.alphascout.xyz
              </span>
              <span className="text-[11px] text-up font-semibold">● READY</span>
            </div>
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <div className="text-[13px] text-ink-faint">Portfolio Value</div>
                  <div className="font-mono text-2xl font-extrabold">0 SOL</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] text-ink-faint">24h PnL</div>
                  <div className="font-mono text-2xl font-extrabold text-ink-mid">—</div>
                </div>
              </div>
              <div className="flex items-end gap-2 h-28 px-2 py-2">
                {[35, 48, 40, 62, 55, 74, 68, 86, 80, 100].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md bg-gradient-to-b from-accent to-accent-dark opacity-40"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {["Connect a Solana wallet to begin", "Agent waits for your first signal", "Trades record onchain automatically"].map(
                  (t, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-surface border border-line text-[13px]"
                    >
                      <span className="w-5 h-5 rounded-md bg-accent-light text-accent flex items-center justify-center text-[11px]">
                        {i + 1}
                      </span>
                      <span className="font-medium text-ink-mid">{t}</span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="py-8 sm:py-10 px-4 sm:px-10 border-y border-line bg-surface">
        <div className="max-w-[1180px] mx-auto flex items-center justify-between gap-8 flex-wrap">
          <span className="text-[13px] text-ink-faint font-semibold uppercase tracking-wider">
            Built on
          </span>
          <span className="font-mono font-bold">Solana</span>
          <span className="font-mono font-bold text-accent">ClawPump</span>
          <span className="font-mono font-bold">pump.fun</span>
          <span className="font-mono font-bold">Helius</span>
          <span className="font-mono font-bold">Hermes</span>
        </div>
      </div>

      <section className="py-14 sm:py-20 px-4 sm:px-10 max-w-[1180px] mx-auto">
        <div className="text-center max-w-[640px] mx-auto mb-14">
          <div className="text-accent font-bold text-sm mb-3 uppercase tracking-wide">
            Why Alpha Scout
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Every edge an alpha trader has, automated.
          </h2>
          <p className="text-[17px] text-ink-mid leading-relaxed">
            Encode the playbooks of elite Solana traders into an autonomous
            agent that never sleeps, never FOMOs, and never fades.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              icon: "⚡",
              bg: "bg-up-bg",
              t: "Real-time Alpha Discovery",
              d: "Scan Solana tokens for volume spikes, holder shifts, and smart-money entries before the crowd. Real onchain data only.",
            },
            {
              icon: "🛡",
              bg: "bg-accent-light",
              t: "Manipulation Shield",
              d: "Flags wash trading, bundling, dev dumps, and honeypots before entry. Blocks engineered momentum from real demand.",
            },
            {
              icon: "🎯",
              bg: "bg-[#FFF8E1]",
              t: "Adaptive Risk Control",
              d: "Position sizing, trailing stops, and drawdown limits that adapt to volatility. Capital preservation first.",
            },
            {
              icon: "🤖",
              bg: "bg-down-bg",
              t: "Autonomous Execution",
              d: "Executes across spot, perps, and prediction markets with sub-second Solana finality.",
            },
            {
              icon: "📊",
              bg: "bg-up-bg",
              t: "Onchain Verifiable",
              d: "Every trade is recorded on Solana. Full transparency — audit performance, risk, and PnL in real time.",
            },
            {
              icon: "🔗",
              bg: "bg-accent-light",
              t: "Token-powered",
              d: "$SCOUT holders unlock premium signal tiers, revenue share, and governance over strategy parameters.",
            },
          ].map((f) => (
            <div
              key={f.t}
              className="bg-white border border-line rounded-2xl p-7 hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_16px_40px_-18px_rgba(245,158,11,.28)] transition"
            >
              <div
                className={`w-13 h-13 w-[52px] h-[52px] rounded-2xl flex items-center justify-center text-2xl mb-5 ${f.bg}`}
              >
                {f.icon}
              </div>
              <h3 className="text-lg font-bold mb-2.5">{f.t}</h3>
              <p className="text-[15px] text-ink-mid leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="px-4 sm:px-10 pb-14 sm:pb-20 max-w-[1180px] mx-auto">
        <div className="bg-gradient-to-br from-accent to-accent-dark rounded-3xl px-6 sm:px-12 py-12 sm:py-16 text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Enter the arena with your own agent.
          </h2>
          <p className="text-[17px] opacity-90 max-w-[520px] mx-auto mb-8 leading-relaxed">
            Deploy Alpha Scout to a live Solana wallet, tokenize it, and give it
            money to trade. Built for the AnsemHack Clawrena.
          </p>
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="inline-block px-8 py-4 rounded-xl bg-white text-accent font-semibold"
            >
              Launch Alpha Scout now
            </Link>
          ) : (
            <button
              onClick={() => openAuth("signUp")}
              className="px-8 py-4 rounded-xl bg-white text-accent font-semibold"
            >
              Launch Alpha Scout now
            </button>
          )}
        </div>
      </div>

      <footer className="py-8 px-4 sm:px-10 border-t border-line bg-surface">
        <div className="max-w-[1180px] mx-auto flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center text-sm text-ink-faint">
          <span>© 2026 Alpha Scout. Built for the AnsemHack Clawrena.</span>
          <span className="font-mono">Alpha Scout · Solana</span>
        </div>
      </footer>
      {authOpen && (
        <AuthDialog
          mode={authMode}
          onClose={() => setAuthOpen(false)}
          onModeChange={setAuthMode}
          onSuccess={() => {
            setAuthOpen(false);
            navigate("/dashboard");
          }}
          signIn={signIn}
        />
      )}
    </div>
  );
}

function AuthDialog({
  mode,
  onClose,
  onModeChange,
  onSuccess,
  signIn,
}: {
  mode: "signIn" | "signUp";
  onClose: () => void;
  onModeChange: (mode: "signIn" | "signUp") => void;
  onSuccess: () => void;
  signIn: ReturnType<typeof useAuthActions>["signIn"];
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await signIn("password", {
        flow: mode,
        email: email.trim(),
        password,
      });
      onSuccess();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" role="presentation" onMouseDown={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white border border-line shadow-[0_24px_80px_-24px_rgba(16,20,32,.45)] p-6 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent">Alpha Scout</p>
            <h2 id="auth-title" className="text-2xl font-extrabold mt-1">
              {mode === "signUp" ? "Create your account" : "Welcome back"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-ink-faint hover:text-ink" aria-label="Close authentication dialog">
            ×
          </button>
        </div>
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <label className="text-sm font-semibold">
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line bg-surface px-4 py-3 font-normal outline-none focus:border-accent"
            />
          </label>
          <label className="text-sm font-semibold">
            Password
            <span className="relative mt-1.5 block">
              <input
                required
                minLength={8}
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-4 py-3 pr-14 font-normal outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-lg text-ink-faint hover:text-ink"
              >
                {showPassword ? "◉" : "◌"}
              </button>
            </span>
          </label>
          {error && <p className="rounded-lg bg-down-bg px-4 py-3 text-sm text-down">{error}</p>}
          <button type="submit" disabled={pending} className="rounded-xl bg-accent px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60">
            {pending ? "Connecting…" : mode === "signUp" ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-ink-mid">
          {mode === "signUp" ? "Already have an account?" : "New to Alpha Scout?"}{" "}
          <button type="button" onClick={() => { setError(null); onModeChange(mode === "signUp" ? "signIn" : "signUp"); }} className="font-semibold text-accent hover:underline">
            {mode === "signUp" ? "Sign in" : "Create one"}
          </button>
        </p>
      </div>
    </div>
  );
}
