<p align="center">
  <img src="public/alpha-scout.svg" width="80" height="80" alt="Alpha Scout logo">
</p>

<h1 align="center">Alpha Scout</h1>

<p align="center">
  <em>Real-data autonomous trading agent for Solana pump launches.</em>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/build-passing-brightgreen" alt="build"></a>
  <a href="#"><img src="https://img.shields.io/badge/TypeScript-5-blue" alt="typescript"></a>
  <a href="#"><img src="https://img.shields.io/badge/Convex-1.45-f56513" alt="convex"></a>
  <a href="#"><img src="https://img.shields.io/badge/Solana-000000" alt="solana"></a>
  <a href="#"><img src="https://img.shields.io/badge/license-MIT-green" alt="license"></a>
</p>

Real-data autonomous trading agent for Solana pump launches. The agent **finds
alpha before it moves — verifiably, onchain.** No mocked or seeded numbers: every
signal, position and trade derives from live system state.

> **Hackathon:** AnsemHack Clawrena (19 Aug – 1 Oct 2026).
> **Track:** ClawPump × pump.fun + Overall Winner.

---

## Status

**Pre-launch.** No users, no live trades yet. The full loop is buildable end to
end and type-checks clean, but the execution layer waits on a funded wallet and
ClawPump / Hermes credentials. Until then, everything demonstrates real zeros —
nothing is fabricated.

---

## Features

- **Autonomous agent harness** (`convex/runAgent.ts`) — a simplified Hermes-style
  loop that:
  - loads real open positions, prices them live from Jupiter,
  - enforces stop-loss / take-profit exits and records matched sell trades,
  - opens fresh positions on real `new-launch` signals (one per launch, sized
    by your risk limit and capped by available cash),
  - halts the agent when the portfolio's configured drawdown cap is breached.
- **Launch-discovery scanner** (`convex/scanner.ts`) — polls pump.fun's recent
  signatures through a real RPC, resolves actual mint addresses, and ingests
  them as deduped `new-launch` signals (Helius-gated: with no key configured it
  writes nothing and records no fake activity).
- **Manipulation shield** (`convex/shieldScan.ts`) — price, liquidity, decimals
  and largest-holder concentration computed live; deep wash/bundle/honeypot
  checks report "unknown" until live streaming is configured.
- **Funding path** — a paper/import wallet bridge: deposit SOL into your
  portfolio, or import your attached wallet's live balance. Nothing trades until
  a portfolio holds cash.
- **Server-verified pricing** — buy prices are fetched server-side from Jupiter
  and never trusted from the client.
- **Telemetry with retention** — 14-day sweep keeps the log bounded.

## Stack

| Layer | Tech |
|---|---|
| Backend | [Convex](https://convex.dev) — queries, mutations, actions, crons, auth, realtime |
| Frontend | React 18 · Vite · Tailwind CSS |
| Chain | Solana — Jupiter (pricing), public RPC + Helius (wallet/launch data) |
| Auth | Convex Auth (sign-in) |

## Project structure

```
.
├── convex/                    # Convex backend (schema, queries, mutations, actions)
│   ├── _generated/            # Convex-generated client + schema types (hand-synced locally)
│   ├── lib/                   # Shared serverside helpers (HTTP, market data)
│   ├── queries/               # Read-path queries (public, portfolio, signals, signal, internal)
│   ├── agents.ts              # Agent profile model
│   ├── auth.ts                # Convex Auth wiring
│   ├── auth.config.ts         # Auth app config
│   ├── cleanup.ts             # Retention / sweep logic
│   ├── crons.ts               # Recurring scheduled jobs
│   ├── http.ts                # HTTP actions (webhooks)
│   ├── portfolio.ts           # Portfolio model (cash, holdings, drawdown)
│   ├── runAgent.ts            # Autonomous agent harness (the trading loop)
│   ├── scanner.ts             # Launch-discovery scanner (pump.fun → signals)
│   ├── schema.ts              # Database schema
│   ├── shieldScan.ts          # Manipulation shield (wash/bundle/honeypot checks)
│   ├── signals.ts             # Signal model + ingestion
│   ├── trades.ts              # Trade model + matched fills
│   ├── users.ts               # User model
│   ├── wallet.ts              # Paper/import wallet funding bridge
│   └── tsconfig.json
├── docs/
│   └── BUILD_PLAN.md          # Build plan + honest current-state record
├── public/
│   └── alpha-scout.svg        # Logo
├── src/                       # React frontend
│   ├── components/
│   │   ├── AppShell.tsx
│   │   └── ui.tsx
│   ├── lib/
│   │   └── format.ts
│   ├── pages/
│   │   ├── AgentConsole.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Landing.tsx
│   │   ├── Signals.tsx
│   │   └── Token.tsx
│   ├── App.tsx
│   ├── convexClient.ts
│   ├── index.css
│   ├── main.tsx
│   └── vite-env.d.ts
├── .github/
│   └── workflows/
│       └── ci.yml             # CI: typecheck, lint, build
├── .eslintrc.cjs
├── .gitignore
├── convex.config.ts           # Convex component/options
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Getting Started

```
npm install
# backend env (Convex env vars, not committed):
#   HELIUS_API_KEY, HELIUS_WEBHOOK_SECRET, JUPITER_API_KEY (optional)
npm run dev:backend     # convex dev  (see note below)
npm run dev             # vite frontend
```

> **Note for this machine:** `convex-local-backend.exe` is currently blocked by a
> Windows Application Control policy, so local `convex dev` can't spawn the
> binary. `convex/_generated/api.d.ts` is hand-synced (regenerated identically by
> `convex dev` on any unblocked machine). Unblock the binary, or deploy to Convex
> Cloud, to run the live app.

## Checks

```
npm run typecheck   # tsc --noEmit
npm run lint        # eslint src convex
```

## Live app & demo

- **Live URL:** _will fill in after deploy_
- **Demo video:** _will fill in after deploy_

### Demo clips

https://github.com/user-attachments/assets/7f6f2cde-fd2a-414f-b274-39e756f3aef5

https://github.com/user-attachments/assets/883ee4d5-6fd4-40e4-9c6a-e62faa109f00

https://github.com/user-attachments/assets/307444cf-4a44-402a-b2e5-c05ec99e6df9

## Production / roadmap

- [ ] Deploy to Convex Cloud + Vercel and drop in the live URL above.
- [ ] Capture a demo clip and link it above.
- [ ] Real swap execution via ClawPump / Hermes (funded wallet + creds).
- [ ] $SCOUT token flow (ClawPump) and revenue-share gating.

See [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md) for the full plan and an honest
record of current state.

---

## License

[MIT](LICENSE) — © 2026 Mobolaji Opeyemi Bolatito (opeblow2021@gmail.com). Hackathon project.
