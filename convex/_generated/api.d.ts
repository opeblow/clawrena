/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents from "../agents.js";
import type * as auth from "../auth.js";
import type * as cleanup from "../cleanup.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_http from "../lib/http.js";
import type * as lib_market from "../lib/market.js";
import type * as portfolio from "../portfolio.js";
import type * as queries_internal from "../queries/internal.js";
import type * as queries_portfolio from "../queries/portfolio.js";
import type * as queries_public from "../queries/public.js";
import type * as queries_signal from "../queries/signal.js";
import type * as queries_signals from "../queries/signals.js";
import type * as runAgent from "../runAgent.js";
import type * as scanner from "../scanner.js";
import type * as shieldScan from "../shieldScan.js";
import type * as signals from "../signals.js";
import type * as trades from "../trades.js";
import type * as users from "../users.js";
import type * as wallet from "../wallet.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  auth: typeof auth;
  cleanup: typeof cleanup;
  crons: typeof crons;
  http: typeof http;
  "lib/http": typeof lib_http;
  "lib/market": typeof lib_market;
  portfolio: typeof portfolio;
  "queries/internal": typeof queries_internal;
  "queries/portfolio": typeof queries_portfolio;
  "queries/public": typeof queries_public;
  "queries/signal": typeof queries_signal;
  "queries/signals": typeof queries_signals;
  runAgent: typeof runAgent;
  scanner: typeof scanner;
  shieldScan: typeof shieldScan;
  signals: typeof signals;
  trades: typeof trades;
  users: typeof users;
  wallet: typeof wallet;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
