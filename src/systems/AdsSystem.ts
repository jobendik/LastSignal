/**
 * AdsSystem — opt-in integration with the CrazyGames SDK.
 *
 * The SDK is loaded lazily and entirely optional. When the SDK is not
 * available (offline, blocked by content blocker, dev server, or hosted
 * outside CrazyGames) every method silently no-ops so gameplay is never
 * gated on advertising infrastructure.
 *
 * Two ad surfaces are exposed:
 *
 *   1. Interstitial — full-screen ad shown at sector transitions / on
 *      "Return to Menu". Fire-and-forget; the SDK pauses game audio
 *      automatically.
 *
 *   2. Rewarded — opt-in via a button on the game-over and victory
 *      screens. Successful viewing grants +2 research points (a small,
 *      run-independent reward; never affects in-run balance).
 *
 * SDK reference: https://docs.crazygames.com/sdk/html5/
 */
import { ConsentSystem } from "./ConsentSystem";

export class AdsSystem {
  private sdkScriptInjected = false;
  private sdkReady = false;
  private sdkLoadFailed = false;
  /** Resolves once the SDK is loaded or failed (so callers can await once). */
  private sdkReadyPromise: Promise<void> | null = null;
  /** Avoid spamming interstitials — minimum 60s between consecutive ones. */
  private lastInterstitialAt = 0;
  /** Most ad networks recommend at least one minute between non-rewarded ads. */
  private readonly INTERSTITIAL_COOLDOWN_MS = 60_000;

  /**
   * Begin loading the SDK in the background. Safe to call multiple times.
   * Honors a global `window.LS_DISABLE_ADS = true` opt-out for testing.
   */
  init(): Promise<void> {
    if (this.sdkReadyPromise) return this.sdkReadyPromise;
    if (typeof window === "undefined") {
      this.sdkReadyPromise = Promise.resolve();
      return this.sdkReadyPromise;
    }
    const w = window as unknown as { LS_DISABLE_ADS?: boolean; CrazyGames?: unknown };
    if (w.LS_DISABLE_ADS) {
      this.sdkLoadFailed = true;
      this.sdkReadyPromise = Promise.resolve();
      return this.sdkReadyPromise;
    }
    this.sdkReadyPromise = new Promise<void>((resolve) => {
      // Already present (e.g. preloaded by host page) — short-circuit.
      if (this.detectSdk()) {
        this.sdkReady = true;
        resolve();
        return;
      }
      if (!this.sdkScriptInjected) {
        this.sdkScriptInjected = true;
        try {
          const script = document.createElement("script");
          script.src = "https://sdk.crazygames.com/crazygames-sdk-v3.js";
          script.async = true;
          script.onload = () => {
            if (this.detectSdk()) {
              this.sdkReady = true;
            } else {
              this.sdkLoadFailed = true;
            }
            resolve();
          };
          script.onerror = () => {
            this.sdkLoadFailed = true;
            resolve();
          };
          document.head.appendChild(script);
        } catch {
          this.sdkLoadFailed = true;
          resolve();
        }
      }
      // 6s safety timeout — never block on a dead network.
      setTimeout(() => {
        if (!this.sdkReady) this.sdkLoadFailed = true;
        resolve();
      }, 6000);
    });
    return this.sdkReadyPromise;
  }

  /** True iff the SDK is available right now. */
  get isAvailable(): boolean {
    return this.sdkReady && !this.sdkLoadFailed;
  }

  /** Signal SDK that game-load work is starting. Safe no-op when unavailable. */
  signalLoadingStart(): void {
    const sdk = this.getSdk();
    try {
      sdk?.game?.sdkGameLoadingStart?.();
    } catch {
      /* swallow — SDK errors must never break the game */
    }
  }

  /** Signal SDK that game-load work is complete. */
  signalLoadingStop(): void {
    const sdk = this.getSdk();
    try {
      sdk?.game?.sdkGameLoadingStop?.();
    } catch {
      /* swallow */
    }
  }

  /** Signal SDK that a wave / level / round has started (gameplay began). */
  signalGameplayStart(): void {
    const sdk = this.getSdk();
    try {
      sdk?.game?.gameplayStart?.();
    } catch {
      /* swallow */
    }
  }

  /** Signal SDK that gameplay has paused / ended. */
  signalGameplayStop(): void {
    const sdk = this.getSdk();
    try {
      sdk?.game?.gameplayStop?.();
    } catch {
      /* swallow */
    }
  }

  /**
   * Request a midgame interstitial. Returns immediately when SDK isn't
   * available, when on cooldown, or after the ad finishes / errors.
   */
  async showInterstitial(): Promise<void> {
    if (!ConsentSystem.adsAllowed) return;
    const sdk = this.getSdk();
    if (!sdk) return;
    const now = Date.now();
    if (now - this.lastInterstitialAt < this.INTERSTITIAL_COOLDOWN_MS) return;
    this.lastInterstitialAt = now;
    try {
      const reqAd = sdk?.ad?.requestAd;
      if (typeof reqAd === "function") {
        // The v3 SDK returns a Promise that resolves after the ad finishes.
        await reqAd.call(sdk.ad, "midgame");
      }
    } catch {
      /* swallow — failed ad must never break the game */
    }
  }

  /**
   * Request a rewarded ad. Resolves with `{ rewarded: true }` if the user
   * watched it to completion, otherwise `{ rewarded: false }`.
   */
  async showRewarded(): Promise<{ rewarded: boolean }> {
    if (!ConsentSystem.adsAllowed) return { rewarded: false };
    const sdk = this.getSdk();
    if (!sdk) return { rewarded: false };
    try {
      const reqAd = sdk?.ad?.requestAd;
      if (typeof reqAd !== "function") return { rewarded: false };
      // v3 conventions: rewarded path either resolves or rejects. We treat
      // resolve as "watched", reject/throw as "skipped".
      await reqAd.call(sdk.ad, "rewarded");
      return { rewarded: true };
    } catch {
      return { rewarded: false };
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ────────────────────────────────────────────────────────────────────────

  private detectSdk(): boolean {
    if (typeof window === "undefined") return false;
    const w = window as unknown as { CrazyGames?: { SDK?: unknown } };
    return Boolean(w.CrazyGames?.SDK);
  }

  /**
   * Returns a loosely-typed handle to the CrazyGames SDK or null when
   * unavailable. We intentionally avoid declaring the SDK's full shape so
   * upstream API tweaks don't break our build.
   */
  private getSdk(): {
    ad?: { requestAd?: (type: string) => Promise<unknown> };
    game?: {
      sdkGameLoadingStart?: () => void;
      sdkGameLoadingStop?: () => void;
      gameplayStart?: () => void;
      gameplayStop?: () => void;
    };
  } | null {
    if (!this.isAvailable) return null;
    if (typeof window === "undefined") return null;
    const w = window as unknown as { CrazyGames?: { SDK?: unknown } };
    return (w.CrazyGames?.SDK as ReturnType<AdsSystem["getSdk"]>) ?? null;
  }
}
