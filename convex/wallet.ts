import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { fetchWalletBalance } from "./lib/market";
import type { Id } from "./_generated/dataModel";

type MyContext = {
  user: { id: Id<"users">; walletAddress?: string };
  portfolio:
    | { id: Id<"portfolios">; cashSol: number; depositedSol: number }
    | null;
} | null;

type ImportCredit = { currentCashSol: number; importedSol: number };

/**
 * Import the attached wallet's real SOL balance into the portfolio. Reads the
 * live balance from RPC (throws when unroutable — it never guesses) and tops
 * the portfolio up to that amount when it is higher.
 *
 * Lives outside the portfolio module so its action->internal calls cross
 * module boundaries (a same-module call defeats tsc's inference). Results are
 * annotated with their concrete types for the same reason.
 */
export const importWalletBalance = action({
  args: {},
  handler: async (ctx): Promise<{
    walletAddress: string;
    balanceSol: number;
    currentCashSol: number;
    importedSol: number;
  }> => {
    const context: MyContext = await ctx.runQuery(internal.portfolio.getMyContext, {});
    if (!context) {
      throw new Error("User not found; call ensureUser first");
    }
    if (!context.user.walletAddress) {
      throw new Error("Attach a Solana wallet before importing a balance");
    }

    const balance = await fetchWalletBalance(context.user.walletAddress);
    if (balance === null) {
      throw new Error("Could not read wallet balance — RPC unreachable.");
    }

    const credited: ImportCredit = await ctx.runMutation(
      internal.portfolio.creditWalletImport,
      { amountSol: balance },
    );
    return {
      walletAddress: context.user.walletAddress,
      balanceSol: balance,
      currentCashSol: credited.currentCashSol,
      importedSol: credited.importedSol,
    };
  },
});