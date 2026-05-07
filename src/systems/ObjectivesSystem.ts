import type { Game } from "../core/Game";
import type { EnemyType, SquadType, StrategicPointType, TowerType } from "../core/Types";
import type { ObjectiveDefinition, SectorObjectives } from "../data/objectives";
import { sectorObjectives } from "../data/objectives";

/** Snapshot of run state used to evaluate objectives. */
export interface ObjectiveSnapshot {
  enemiesKilledByType: Partial<Record<EnemyType, number>>;
  enemiesLeakedByType: Partial<Record<EnemyType, number>>;
  enemiesLeakedTotal: number;
  towersBuiltByType: Partial<Record<TowerType, number>>;
  towersSold: number;
  towersDisabledLong: number;
  bossKills: Partial<Record<EnemyType, number>>;
  creditsEarned: number;
  creditsUnspent: number;
  coreRemainingPct: number;
  durationSec: number;
  scannerAlive: boolean;
  /** Total enemy kills across all types. */
  enemiesKilledTotal: number;
  /** Strategic point counts captured / destroyed this run. */
  strategicCapturedByType: Partial<Record<StrategicPointType, number>>;
  strategicDestroyedByType: Partial<Record<StrategicPointType, number>>;
  /** Per-squad-type deploys this run. */
  squadDeployedByType: Partial<Record<SquadType, number>>;
  /** Per-strategic-type kills credited to squad damage this run. */
  squadDestroyedStrategicByType: Partial<Record<StrategicPointType, number>>;
  /** Total times an Engineer restored a disabled tower or fully repaired one this run. */
  towersRepairedThisRun: number;
  /** Number of player towers currently in the disabled state. */
  towersDisabledNow: number;
}

export interface ObjectiveEvalResult {
  def: ObjectiveDefinition;
  completed: boolean;
  /** Progress 0..1 for partial display, undefined when boolean. */
  progress?: number;
  /** Human-readable progress string ("3/5") for UI. */
  progressText?: string;
}

/**
 * ObjectivesSystem — tracks per-run objective progress and evaluates
 * primary/secondary completion against the active sector's targets.
 *
 * It hooks into bus events for kills/leaks/builds/sells to keep counters
 * accurate without requiring callers to invoke explicit methods.
 */
export class ObjectivesSystem {
  /** Counters reset at sector start. */
  private kills: Partial<Record<EnemyType, number>> = {};
  private leaks: Partial<Record<EnemyType, number>> = {};
  private leakTotal = 0;
  private bossKills: Partial<Record<EnemyType, number>> = {};
  private builtByType: Partial<Record<TowerType, number>> = {};
  private soldCount = 0;
  /** Ever-built type set so build_any_of_type still credits a player who later sells. */
  private builtAnyByType = new Set<TowerType>();
  /** Per-squad-type deploy counts this run. */
  private squadDeployedByType: Partial<Record<SquadType, number>> = {};
  /** Per-strategic-type kills credited to squad damage this run. */
  private squadDestroyedStrategicByType: Partial<Record<StrategicPointType, number>> = {};
  /** Tower-restored / repaired-from-disabled events this run. */
  private towersRepaired = 0;

  constructor(private readonly game: Game) {
    const bus = game.bus;
    bus.on("sector:started", () => this.reset());

    bus.on<{ type: EnemyType; isBoss?: boolean }>("enemy:killed", (ev) => {
      this.kills[ev.type] = (this.kills[ev.type] ?? 0) + 1;
      if (ev.isBoss) this.bossKills[ev.type] = (this.bossKills[ev.type] ?? 0) + 1;
    });
    bus.on<{ type: EnemyType }>("enemy:breached", (ev) => {
      this.leaks[ev.type] = (this.leaks[ev.type] ?? 0) + 1;
      this.leakTotal++;
    });
    bus.on("tower:built", (t: unknown) => {
      const type = (t as { type: TowerType }).type;
      this.builtByType[type] = (this.builtByType[type] ?? 0) + 1;
      this.builtAnyByType.add(type);
    });
    bus.on("tower:sold", () => {
      this.soldCount++;
    });
    // Squad deploy & strike-credit tracking — drives deploy_any_squad,
    // deploy_n_squad, and squad_destroy_n_strategic objectives.
    bus.on<{ type: SquadType }>("squad:deployed", (ev) => {
      const t = ev.type;
      this.squadDeployedByType[t] = (this.squadDeployedByType[t] ?? 0) + 1;
    });
    bus.on<{ type: SquadType; structureType: StrategicPointType }>("squad:structureKill", (ev) => {
      if (ev.type !== "strike") return;
      const t = ev.structureType;
      this.squadDestroyedStrategicByType[t] = (this.squadDestroyedStrategicByType[t] ?? 0) + 1;
    });
    // Tower restored from disabled / fully repaired counts toward repair-based objectives.
    bus.on("tower:restored", () => { this.towersRepaired++; });
  }

  reset(): void {
    this.kills = {};
    this.leaks = {};
    this.leakTotal = 0;
    this.bossKills = {};
    this.builtByType = {};
    this.soldCount = 0;
    this.builtAnyByType.clear();
    this.squadDeployedByType = {};
    this.squadDestroyedStrategicByType = {};
    this.towersRepaired = 0;
  }

  get currentSectorObjectives(): SectorObjectives | null {
    const id = this.game.core.sector?.id;
    if (!id) return null;
    return sectorObjectives[id] ?? null;
  }

  snapshot(): ObjectiveSnapshot {
    const c = this.game.core;
    const corePct = c.coreMax > 0 ? c.coreIntegrity / c.coreMax : 0;
    const scannerTowers: TowerType[] = ["amplifier", "tesla"]; // Tesla acts as detection-capable
    const scannerAlive = this.game.towers.list.some((t) => scannerTowers.includes(t.type));
    const sps = this.game.strategicPoints;
    let towersDisabledNow = 0;
    for (const t of this.game.towers.list) {
      if (t.disabled) towersDisabledNow++;
    }
    return {
      enemiesKilledByType: this.kills,
      enemiesLeakedByType: this.leaks,
      enemiesLeakedTotal: this.leakTotal,
      towersBuiltByType: this.builtByType,
      towersSold: this.soldCount,
      towersDisabledLong: 0,
      bossKills: this.bossKills,
      creditsEarned: c.stats.creditsEarned,
      creditsUnspent: c.credits,
      coreRemainingPct: corePct,
      durationSec: Math.max(0, Math.round((Date.now() - c.stats.startedAt) / 1000)),
      scannerAlive,
      enemiesKilledTotal: c.stats.enemiesKilled,
      strategicCapturedByType: sps?.capturedCounts ?? {},
      strategicDestroyedByType: sps?.destroyedCounts ?? {},
      squadDeployedByType: this.squadDeployedByType,
      squadDestroyedStrategicByType: this.squadDestroyedStrategicByType,
      towersRepairedThisRun: this.towersRepaired,
      towersDisabledNow,
    };
  }

  /** Evaluate one objective against a given snapshot. */
  evaluate(def: ObjectiveDefinition, snap: ObjectiveSnapshot, runWon: boolean): ObjectiveEvalResult {
    const out: ObjectiveEvalResult = { def, completed: false };
    switch (def.kind) {
      case "survive_all": {
        out.completed = runWon;
        break;
      }
      case "defeat_boss": {
        const t = def.enemyType;
        out.completed = runWon && (t == null ? true : (snap.bossKills[t] ?? 0) >= 1);
        break;
      }
      case "core_above_pct": {
        const target = def.value ?? 0;
        out.completed = runWon && snap.coreRemainingPct >= target;
        out.progressText = `${Math.round(snap.coreRemainingPct * 100)}% / ${Math.round(target * 100)}%`;
        out.progress = Math.min(1, snap.coreRemainingPct / Math.max(0.01, target));
        break;
      }
      case "leak_under": {
        const cap = def.value ?? 0;
        const filterType = def.enemyType;
        const total = filterType ? (snap.enemiesLeakedByType[filterType] ?? 0) : snap.enemiesLeakedTotal;
        out.completed = runWon && total <= cap;
        out.progressText = `${total}/${cap}`;
        out.progress = total <= cap ? 1 : Math.max(0, 1 - (total - cap) / Math.max(1, cap));
        break;
      }
      case "build_n_of_type": {
        const need = def.value ?? 1;
        const t = def.towerType;
        const have = t ? (snap.towersBuiltByType[t] ?? 0) : 0;
        out.completed = runWon && have >= need;
        out.progressText = `${have}/${need}`;
        out.progress = Math.min(1, have / Math.max(1, need));
        break;
      }
      case "build_any_of_type": {
        const t = def.towerType;
        const have = t ? (this.builtAnyByType.has(t) ? 1 : 0) : 0;
        out.completed = runWon && have > 0;
        out.progressText = have > 0 ? "✓" : "0/1";
        out.progress = have;
        break;
      }
      case "credits_earned": {
        const need = def.value ?? 0;
        out.completed = runWon && snap.creditsEarned >= need;
        out.progressText = `${snap.creditsEarned}/${need}`;
        out.progress = Math.min(1, snap.creditsEarned / Math.max(1, need));
        break;
      }
      case "credits_unspent": {
        const need = def.value ?? 0;
        out.completed = runWon && snap.creditsUnspent >= need;
        out.progressText = `${snap.creditsUnspent}/${need}`;
        out.progress = Math.min(1, snap.creditsUnspent / Math.max(1, need));
        break;
      }
      case "kill_n_type": {
        // Kill-count objectives complete as soon as the threshold is reached,
        // even on a defeat, so a player who killed e.g. the Harbinger before
        // the core fell still gets credit. This is intentionally lenient.
        const need = def.value ?? 1;
        const t = def.enemyType;
        const have = t ? (snap.enemiesKilledByType[t] ?? 0) : 0;
        out.completed = have >= need;
        out.progressText = `${have}/${need}`;
        out.progress = Math.min(1, have / Math.max(1, need));
        break;
      }
      case "kill_any_type": {
        const types = def.enemyTypes ?? [];
        const have = types.reduce((s, t) => s + (snap.enemiesKilledByType[t] ?? 0), 0);
        out.completed = runWon && have >= (def.value ?? 1);
        out.progressText = `${have}/${def.value ?? 1}`;
        out.progress = Math.min(1, have / Math.max(1, def.value ?? 1));
        break;
      }
      case "sells_under": {
        const cap = def.value ?? 0;
        out.completed = runWon && snap.towersSold <= cap;
        out.progressText = `${snap.towersSold}/${cap}`;
        out.progress = snap.towersSold <= cap ? 1 : 0;
        break;
      }
      case "towers_lost_under": {
        const cap = def.value ?? 0;
        out.completed = runWon && snap.towersDisabledLong <= cap;
        out.progressText = `${snap.towersDisabledLong}/${cap}`;
        out.progress = snap.towersDisabledLong <= cap ? 1 : 0;
        break;
      }
      case "scanner_alive": {
        out.completed = runWon && snap.scannerAlive;
        out.progressText = snap.scannerAlive ? "✓" : "✗";
        break;
      }
      case "harvesters_at_least": {
        const need = def.value ?? 1;
        const have = snap.towersBuiltByType.harvester ?? 0;
        out.completed = runWon && have >= need;
        out.progressText = `${have}/${need}`;
        out.progress = Math.min(1, have / Math.max(1, need));
        break;
      }
      case "fast_clear": {
        const cap = def.value ?? 999;
        out.completed = runWon && snap.durationSec <= cap;
        out.progressText = `${snap.durationSec}s/${cap}s`;
        break;
      }
      case "capture_n_strategic": {
        const need = def.value ?? 1;
        const t = def.strategicType;
        const have = t ? (snap.strategicCapturedByType[t] ?? 0) : 0;
        // Capture-based objectives complete as soon as the count is met,
        // matching kill_n_type semantics (don't gate on win).
        out.completed = have >= need;
        out.progressText = `${have}/${need}`;
        out.progress = Math.min(1, have / Math.max(1, need));
        break;
      }
      case "destroy_n_strategic": {
        const need = def.value ?? 1;
        const t = def.strategicType;
        const have = t ? (snap.strategicDestroyedByType[t] ?? 0) : 0;
        out.completed = have >= need;
        out.progressText = `${have}/${need}`;
        out.progress = Math.min(1, have / Math.max(1, need));
        break;
      }
      case "deploy_any_squad": {
        const t = def.squadType;
        const have = t ? (snap.squadDeployedByType[t] ?? 0) : 0;
        out.completed = have >= 1;
        out.progressText = have > 0 ? "✓" : "0/1";
        out.progress = have > 0 ? 1 : 0;
        break;
      }
      case "deploy_n_squad": {
        const need = def.value ?? 1;
        if (def.squadType) {
          const have = snap.squadDeployedByType[def.squadType] ?? 0;
          out.completed = have >= need;
          out.progressText = `${have}/${need}`;
          out.progress = Math.min(1, have / Math.max(1, need));
        } else {
          // Diversity check: at least N distinct types deployed.
          const types: SquadType[] = ["recon", "engineer", "strike", "shield"];
          const distinct = types.filter((tt) => (snap.squadDeployedByType[tt] ?? 0) > 0).length;
          out.completed = distinct >= need;
          out.progressText = `${distinct}/${need}`;
          out.progress = Math.min(1, distinct / Math.max(1, need));
        }
        break;
      }
      case "squad_destroy_n_strategic": {
        const need = def.value ?? 1;
        const t = def.strategicType;
        // If a strategicType is named, count only kills of that type. Otherwise
        // count any structure killed by a strike squad.
        let have: number;
        if (t) {
          have = snap.squadDestroyedStrategicByType[t] ?? 0;
        } else {
          have = Object.values(snap.squadDestroyedStrategicByType).reduce((s, v) => s + (v ?? 0), 0);
        }
        out.completed = have >= need;
        out.progressText = `${have}/${need}`;
        out.progress = Math.min(1, have / Math.max(1, need));
        break;
      }
      case "tower_repairs_at_least": {
        const need = def.value ?? 1;
        const have = snap.towersRepairedThisRun;
        out.completed = have >= need;
        out.progressText = `${have}/${need}`;
        out.progress = Math.min(1, have / Math.max(1, need));
        break;
      }
      case "no_disabled_towers_at_end": {
        out.completed = runWon && snap.towersDisabledNow === 0;
        out.progressText = snap.towersDisabledNow === 0 ? "✓" : `${snap.towersDisabledNow} offline`;
        out.progress = snap.towersDisabledNow === 0 ? 1 : 0;
        break;
      }
    }
    return out;
  }

  /** Evaluate the active sector's primary objective against the current run state. */
  evaluatePrimary(runWon: boolean): ObjectiveEvalResult | null {
    const s = this.currentSectorObjectives;
    if (!s) return null;
    return this.evaluate(s.primary, this.snapshot(), runWon);
  }

  /** Evaluate every secondary objective against the current run state. */
  evaluateSecondaries(runWon: boolean): ObjectiveEvalResult[] {
    const s = this.currentSectorObjectives;
    if (!s) return [];
    const snap = this.snapshot();
    return s.secondary.map((def) => this.evaluate(def, snap, runWon));
  }

  /**
   * Award rewards for any newly-completed secondary objectives at end of run.
   * Returns the list of objectives that were completed (for the victory screen).
   */
  awardOnRunEnd(runWon: boolean): { completed: ObjectiveEvalResult[]; researchAwarded: number } {
    const results = this.evaluateSecondaries(runWon);
    const completed = results.filter((r) => r.completed);
    let totalResearch = 0;
    let totalCredits = 0;
    for (const c of completed) {
      if (c.def.rewardResearch) totalResearch += c.def.rewardResearch;
      if (c.def.rewardCredits) totalCredits += c.def.rewardCredits;
    }
    if (totalResearch > 0) this.game.meta.addResearchPoints(totalResearch);
    if (totalCredits > 0) this.game.addCredits(totalCredits);
    return { completed, researchAwarded: totalResearch };
  }
}
