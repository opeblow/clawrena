import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Hermes-style harness cycle. Only touches real running agents with real
// positions; with none present it no-ops and writes nothing.
crons.interval(
  "agent-harness-cycle",
  { minutes: 15 },
  internal.runAgent.run,
  {},
);

export default crons;