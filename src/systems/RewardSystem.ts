/** Also exports the UpgradeSystem for data-driven upgrade replay. */
export { UpgradeSystem } from "./UpgradeSystem";

/**
 * Wrapper kept so older imports (`from "./RewardSystem"`) continue to compile.
 * The real implementation lives alongside UpgradeSystem for simplicity.
 */
export { RewardSystem } from "./UpgradeSystem";

