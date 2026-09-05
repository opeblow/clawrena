# ALPHA SCOUT — Build Plan

> **Product:** Autonomous Solana alpha-trading agent.
> **Hackathon:** AnsemHack Clawrena (19 Aug — 1 Oct 2026, deadline 19 Sept 2026).
> **Track:** ClawPump × pump.fun (~$125K $ANSEM + $35K cash) + Overall Winner.
> **Status:** **Pre-launch. No users yet.** This document is the single source of truth for everything that must be built. Nothing in this plan is mocked or seeded. "0" is a real, verified zero. Every number here reflects actual system state, not invented metrics.

---

## 1. North Star & Winning Strategy

The judges score four things (from clawpump.tech/ansemhack):

1. **Builders onboarded** — developers brought onto Solana
2. **Onchain volume** — real volume the agent/product does on Solana
3. **Attention garnered** — streams, clips, audience built while building
4. **$ANSEM volume**

Alpha Scout wins by being a **real, live, self-custodied trading agent** whose every trade is an onchain event. It is not a wrapper around existing agents — it is **net-new tooling on the Hermes DeFi harness** (an explicit judging preference), plus a novel autonomous **alpha-discovery + risk layer** that survives a live market.

**Core promise:** "Your AI trader that finds alpha before it moves — verifiably, onchain."

---

## 2. Product Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Web)                       │
│  Landing · Dashboard · Agent Console · Signals · Token Page │
└──────────────────────────────┬──────────────────────────────┘
                               │ Convex Realtime (reactivate)
┌──────────────────────────────▼──────────────────────────────┐
│                        CONVEX BACKEND                        │
│  Mutations/Queries/Actions  ·  Schema  ·  Indexes            │
│  Auth (sign-in)  ·  Scheduling (crons / intervals)           │
└──────────────────────────────┬──────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐    ┌──────────────────┐    ┌───────────────────┐
│  AI AGENT     │    │  MARKET DATA      │    │  TRADE EXECUTION  │
│  (Hermes      │    │  RPC / Streams    │    │  (Spot/Perps/     │
│   harness)    │    │  scanner          │    │   Prediction)     │
└───────────────┘    └──────────────────┘    └───────────────────┘
```

**Stack decision (TBD — confirm before building):**
- Backend: **Convex** (reactive, type-safe, transactions, scheduling, auth) — recommended
  - *Alternative:* Node/Express + Postgres (more manual)
- Frontend: **React + Vite + Tailwind** (recommended) or plain HTML/JS
- Chain: **Solana** via ClawPump / Hermes harness / Helius RPC
- Agent runtime: ClawPump agent platform (MCP tools) — the Hermes harness
- Fonts/theme: white/orange (`#F59E0B` accent, `#0F1419` text) — matches UI references

---

## 3. MONOREPO STRUCTURE (build target)

```
clawrena-hack/
├── README.md
├── docs/
│   └── BUILD_PLAN.md          <- this file
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Landing.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── AgentConsole.tsx
│   │   │   ├── Signals.tsx
│   │   │   └── Token.tsx
│   │   ├── components/
│   │   ├── lib/            <- Convex client bindings
│   │   └── styles/
│   ├── package.json
│   └── tailwind.config.js
├── convex/                   <- Convex backend
│   ├── schema.ts
│   ├── auth.config.ts
│   ├── queries/
│   ├── mutations/
│   ├── actions/
│   ├── crons.ts
│   └── http.ts
├── agent/                    <- Hermes harness / agent code
│   ├── config.ts
│   ├── skills/
│   ├── scanners/
│   └── execution/
├── scripts/
└── (ui-references removed — PNGs were merged into the finished pages)
```

---

## 4. DATA MODEL (Convex schema — nothing seeded)

All counts below are **0/empty at launch** until real user activity. These are the actual tables; they start empty.

| Table | Purpose | Key fields |
|---|---|---|
| `users` | Authentication identities | tokenIdentifier, name, walletAddress |
| `portfolios` | One per user/agent | ownerId, value, cashBalance (0 initially), updatedAt |
| `positions` | Open trades (0 initially) | portfolioId, tokenMint, entryPrice, sizeSol, currentPrice, pnl, stopLoss, takeProfit, status |
| `trades` | Full trade history (0 rows) | portfolioId, direction, tokenMint, amountSol, price, pnl, timestamp, txSignature |
| `signals` | Generated alpha signals (0 rows) | tokenMint, type (buy/sell/warn), confidence, score, payload, processedAt |
| `products` | Agent-managed tokens | mint, name, symbol, supply, curveState |
| `agent_runs` | Auditable agent execution log (0 rows) | startedAt, endedAt, scansProcessed, tradesExecuted, outcome |
| `telemetry` | Raw onchain/metric events (0 rows) | eventType, payload, wallet, timestamp |

**Indexes (planned):**
- `signals` by `processedAt` (desc) for the signal feed
- `positions` by `portfolioId` + `status`
- `trades` by `portfolioId` + `timestamp` (desc)
- `agent_runs` by `startedAt` (desc)

> No fixtures, no seed scripts. Users, positions and trades are created only by real interactions.

---

## 5. FEATURE CHECKLIST (ordered by value / dependencies)

### Phase 0 — Foundation
- [x] Initialize monorepo (git, package.json)
- [x] Set up Convex project (`convex init`) + `npx convex dev`
- [x] Define schema.ts with the tables above (no seed)
- [x] Auth wiring (Convex Auth — sign in via email/password; `convex/auth.ts` + `auth.config.ts` modern format)
- [x] React + Vite + Tailwind scaffold, white/orange theme tokens
- [x] .env / env vars: `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, auth keys on the deployment

### Phase 1 — Market Data Pipeline (real data only)
- [x] Solana RPC client in `convex/lib/market.ts` (public RPC + Helius URL env-gated)
- [x] Token discovery scanner: `fetchRecentLaunches` (pump.fun program, Helius-gated → returns [] when not configured)
- [x] Token metrics fetcher: Jupiter **Price V3** (keyless agent mode, optional `JUPITER_API_KEY`) — one batched call returns price + liquidity + decimals + 24h change; replaced deprecated `/price/v2` (now 404) and dropped the slow Raydium SDK dump
- [x] Whale/holder analyzer: `fetchHolderConcentration` (largest-holder share via `getTokenLargestAccounts`); parallel RPC calls with public-endpoint failover (mainnet-beta → publicnode) for 429s
- [x] Shield/telemetry recorder: `convex/signals.ts` (`recordTelemetry`, `createSignal`, `ingestWebhookEvents`) — writes only real observations
- [x] Inbound webhooks: `POST /webhooks/helius` (Helius transaction webhook → real `new-launch` signals, deduped) + `GET /healthz` liveness probe; optional `HELIUS_WEBHOOK_SECRET` auth
- [ ] Realtime stream (Helius WebSocket) — deferred; polling harness covers runtime first, webhook ingestion covers launch discovery

### Phase 2 — AI Agent Core (Hermes harness)
- [x] Agent runtime skeleton: `convex/agents.ts` (deploy, risk, state) + `convex/runAgent.ts` loop (interval cron, 15 min)
- [ ] Hermes DeFi harness integration (live swap execution) — stub waits on ClawPump/Hermes creds
- [x] Strategy/risk engine: drawdown guard (`halted` when open value < 50% of cost), stop-loss / take-profit exits
- [x] Manipulation shield: `convex/shieldScan.ts` (price + liquidity + decimals from one Jupiter V3 call, holder concentration, Helius-gated deep checks)
- [x] `agent_runs` logging: every cycle logged with real counts (scansProcessed, tradesExecuted, outcome)
- [ ] Execution module: real swaps on Solana (Jupiter) — blocked on funded wallet + creds

### Phase 3 — Frontend (mirror the 5 PNG references)
- [x] **Landing** — hero, product preview, features, CTA "Deploy my agent", real-zero stats
- [x] **Dashboard** — greeting, portfolio stats (real), positions (real/empty), agent console, live signals feed
- [x] **Agent Console** — deploy flow, wallet attach, risk controls, start/pause, conversation, capabilities
- [x] **Signals** — filterable feed (all/buy/sell/warn) wired to real signals query
- [x] **Token Page** — mint input + live shield-scan action (`useAction`), real findings, PENDING/UNKNOWN when not configured
- [x] **Empty states everywhere** — genuine zeros; never fake numbers
- [x] Convex `useQuery`/`useMutation`/`useAction` bindings wired to real data

### Phase 4 — Tokenomics & Launch (in-app, real)
- [ ] $SCOUT token creation flow (ClawPump) — entry requirement
- [ ] Token page wiring to live onchain token data (price/volume real)
- [ ] Revenue-share / premium-tier gating (by actual $SCOUT balance)
- [ ] Fee-flywheel integration (per ClawPump loop: 35% fee split, keep yours)

### Phase 5 — Launch Ops
- [ ] Register team on clawpump.tech/ansemhack (before 19 Sept)
- [ ] Tokenize by 19 Sept 2026
- [ ] Reachable project X account
- [ ] Live streams/demo clips (attention rubric)
- [ ] Free Helius RPC credits activated

---

## 6. INTEGRATIONS / THIRD-PARTY

| Service | Use | Status |
|---|---|---|
| ClawPump / ClawPump MCP | agent platform, token launch, Hermes harness | to integrate |
| Helius (free credits) | RPC, real-time streams | apply/activate |
| Jupiter / Raydium | swaps, slippage-aware execution | to integrate |
| UsePod (optional — Inference track) | LLM inference if we stack track | optional |
| Convex | backend, scheduling, auth, storage | to set up |

---

## 7. SECURITY & SAFETY

- **Self-custody:** agent wallet private key stored as an env secret, never in code/DB
- **Arg-based authz guards:** every mutation checks `ctx.auth.getUserIdentity()` — no trusting client args for wallet/owner
- **Per-document ownership:** positions, portfolios, trades scoped to their owner; users cannot read/modify others' data
- **Limit exposure:** no PII-leaking public queries; wallet addresses only shown to owner
- **No hardcoded secrets** anywhere; all keys via Convex env vars
- **Kill switch:** position limits and a "halt agent" control as safety mechanisms

---

## 8. RECORD OF STATE (updated by hand as we ship)

Last updated: **2026-09-04**

- Users: **0** (real)
- Live positions: **0**
- Trades executed: **0**
- Signals generated: **0**
- Total onchain volume: **$0.00** (SOL: **0**)
- Tokens launched: **0**
- Agents deployed: **0**

*All values above are true system state as of this edit. They will only change through real interactions — never through seeding.*

**Dev-environment note (2026-09-04):** the local Convex backend binary
(`convex-local-backend.exe`) is currently blocked by a Windows Application
Control policy on this dev machine, so `npx convex dev`/`codegen` cannot spawn
it. The Convex source passes `npx convex typecheck` (CLI checker, no binary)
and `npm run build`. `convex/_generated/api.d.ts` was hand-synced to the new
modules (a build artifact that `convex dev` regenerates identically on any
unblocked machine). Unblock the binary, or push to Convex Cloud, to run the
live app.

**Funding path (2026-09-04):** to make the loop actually runnable before real
swap creds exist, a paper funding bridge was added — `portfolio.depositSol`
(manual add) and `wallet.importWalletBalance` (imports the attached wallet's
real SOL balance via RPC) fill a portfolio's `cashSol`. `trades.openPosition` is
an action that fetches the real Jupiter price server-side, and the harness opens
positions against un-acted `new-launch` signals sized by `riskMaxPosition` and
capped by available cash. This demonstrates the full signal→position loop end to
end; real onchain swap execution still waits on ClawPump/Hermes creds.

## 9. NEXT ACTIONS (immediate order)

1. Scaffold monorepo + Convex + Vite/Tailwind — **done**
2. Define the Convex schema (tables above, no seed) — **done**
3. Get a Helius RPC + ClawPump agent credentials — **in progress (needed for live scanner/execution)**
4. Build the real market-data scanner (Phase 1) — **done (Helius-gated)**
5. Build the Hermes-harness agent core (Phase 2) — **done (execution stub pending creds)**
6. Wire the 5 frontend pages to real Convex queries (Phase 3) — **done**
7. Tokenize on ClawPump (Phase 4) — **next**
8. Unblock local `convex-local-backend.exe` or use Convex Cloud, then `npx convex dev` to run live
