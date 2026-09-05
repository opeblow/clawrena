import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Hermes-style harness cycle. Only touches real running agents with real
// cash and real signals; with none present it no-ops and writes nothing.
crons.interval(
  "agent-harness-cycle",
  { minutes: 15 },
  internal.runAgent.run,
  {},
);

// Launch-discovery scanner. Polls pump.fun's recent signatures, parses them
// into real mint addresses and ingests `new-launch` signals (deduped by mint).
// Runs hourly in demo mode so the data used by the demo video stays
// deterministic within a recording window; restore to { minutes: 10 } for
// production. No-ops cleanly when every RPC is unreachable.
crons.interval(
  "launch-scanner",
  { minutes: 60 },
  internal.scanner.discover,
  {},
);

// Telemetry retention: delete price.tick / shield.scan rows older than 14 days.
crons.interval(
  "telemetry-sweep",
  { hours: 24 },
  internal.cleanup.sweepTelemetry,
  {},
);

export default crons;