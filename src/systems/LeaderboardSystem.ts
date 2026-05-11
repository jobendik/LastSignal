/**
 * LeaderboardSystem — CrazyGames leaderboard integration.
 *
 * Leaderboards are tied to CrazyGames user identity so they are gated on
 * `ConsentSystem.cloudSaveAllowed`. Every method silently no-ops when the SDK
 * is absent (offline, blocked, dev server, or hosted outside CrazyGames).
 *
 * Two boards are used:
 *   • "endless_wave"  — Highest endless-wave reached.  Higher = better.
 *   • "sector7_time"  — Fastest Sector 7 campaign clear in seconds.
 *                       Set the CrazyGames dashboard to ascending sort so that
 *                       lower (faster) scores rank first on the native page.
 *
 * Dashboard setup:
 *   1. Log into the CrazyGames developer portal → Leaderboards.
 *   2. Create a leaderboard named exactly "endless_wave" (integer, descending).
 *   3. Create a leaderboard named exactly "sector7_time" (integer, ascending,
 *      display as MM:SS if the dashboard supports it).
 */
import { ConsentSystem } from "./ConsentSystem";

export interface LeaderboardEntry {
  name: string;
  score: number;
  rank: number;
}

export const BOARD_ENDLESS_WAVE = "endless_wave";
export const BOARD_S7_TIME = "sector7_time";

export class LeaderboardSystem {
  /**
   * Submit a score to a named leaderboard.
   * No-op when the SDK is unavailable or cloud-save consent is not granted.
   */
  async submit(boardName: string, score: number): Promise<void> {
    if (!ConsentSystem.cloudSaveAllowed) return;
    const sdk = this.getSdk();
    if (!sdk) return;
    try {
      if (typeof sdk.leaderboard?.save === "function") {
        await sdk.leaderboard.save({ leaderboardName: boardName, score });
      }
    } catch {
      /* leaderboard errors must never affect gameplay */
    }
  }

  /**
   * Fetch up to 10 entries from a named leaderboard.
   * Returns an empty array when the SDK is unavailable or the call fails.
   */
  async getTop10(boardName: string): Promise<LeaderboardEntry[]> {
    const sdk = this.getSdk();
    if (!sdk) return [];
    try {
      if (typeof sdk.leaderboard?.get !== "function") return [];
      const result = await sdk.leaderboard.get({
        leaderboardName: boardName,
        maxResults: 10,
      });
      if (!Array.isArray(result?.leaderboard)) return [];
      return (result.leaderboard as Record<string, unknown>[]).map(
        (e, i) => ({
          name: typeof e["playerName"] === "string" ? e["playerName"] : "—",
          score: typeof e["score"] === "number" ? e["score"] : 0,
          rank: typeof e["rank"] === "number" ? e["rank"] : i + 1,
        }),
      );
    } catch {
      return [];
    }
  }

  /** True iff the CrazyGames SDK is currently accessible. */
  get isAvailable(): boolean {
    return this.getSdk() !== null;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ────────────────────────────────────────────────────────────────────────

  private getSdk(): {
    leaderboard?: {
      save?: (opts: { leaderboardName: string; score: number }) => Promise<unknown>;
      get?: (opts: {
        leaderboardName: string;
        maxResults: number;
      }) => Promise<{ leaderboard: unknown[] } | null>;
    };
  } | null {
    if (typeof window === "undefined") return null;
    const w = window as unknown as { CrazyGames?: { SDK?: unknown } };
    if (!w.CrazyGames?.SDK) return null;
    return w.CrazyGames.SDK as ReturnType<LeaderboardSystem["getSdk"]>;
  }
}
