import type { Game } from "../core/Game";

/** Also exports the UpgradeSystem for data-driven upgrade replay. */
export { UpgradeSystem } from "./UpgradeSystem";

/**
 * Wrapper kept so older imports (`from "./RewardSystem"`) continue to compile.
 * The real implementation lives alongside UpgradeSystem for simplicity.
 */
export { RewardSystem } from "./UpgradeSystem";

// Unused placeholder export to signal that this file is intentionally a facade.
export const _rewardFacadeMarker = (game?: Game): boolean => Boolean(game);
