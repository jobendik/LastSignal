import type { Game } from "../core/Game";
import { StrategicPoint, isHostile } from "../entities/StrategicPoint";
import {
  ABANDONED_TURRET_COOLDOWN,
  ABANDONED_TURRET_DAMAGE,
  ABANDONED_TURRET_RANGE,
  CAPTURE_CONTEST_RADIUS,
  CAPTURE_DECAY_PER_SECOND,
  CAPTURE_TIME_SECONDS,
  DATA_CACHE_CREDIT_REWARD,
  DATA_CACHE_RESEARCH_REWARD,
  JAMMER_DESTROY_REWARD,
  JAMMER_RADIUS_CELLS,
  RADAR_REVEAL_BONUS_CELLS,
  RIFT_ANCHOR_AURA_RADIUS,
  RIFT_ANCHOR_DESTROY_REWARD,
  RIFT_ANCHOR_HEALTH,
  RIFT_ANCHOR_PULSE_INTERVAL,
  SIGNAL_NODE_RADIUS_CELLS,
  TILE_SIZE,
} from "../core/Config";
import { Projectile } from "../entities/Projectile";
import { Vector2 } from "../core/Vector2";
import type { SectorDefinition, StrategicPointType } from "../core/Types";
import type { Enemy } from "../entities/Enemy";

interface DamageOpts {
  source?: "tower" | "drone" | "other";
}

/**
 * StrategicPointSystem — owns per-run state for sector strategic map points.
 *
 * Responsibilities:
 *  - Build runtime instances from `sector.strategicPoints` on `beginSector`.
 *  - Tick capture progress for neutral points inside player signal coverage.
 *  - Apply rewards / activate effects when capture completes.
 *  - Tick hostile structures: aura buffs, periodic spawns, jammer suppression.
 *  - Route damage from towers/drones onto hostile structures.
 *
 * The system intentionally stays small and self-contained. Rendering and HUD
 * read its public state; the towers/enemy systems consume targeting helpers.
 */
export class StrategicPointSystem {
  list: StrategicPoint[] = [];
  /** Counts that objectives & UI watch for completion text. */
  capturedCounts: Partial<Record<StrategicPointType, number>> = {};
  destroyedCounts: Partial<Record<StrategicPointType, number>> = {};
  /** Total reveal bonus (cells) granted by every captured radar dish. */
  radarBonusCells = 0;
  /** Whether the player owns at least one radar dish (used by HUD). */
  hasRadar = false;

  constructor(private readonly game: Game) {
    this.game.bus.on("sector:started", () => this.reset());
  }

  reset(): void {
    this.list = [];
    this.capturedCounts = {};
    this.destroyedCounts = {};
    this.radarBonusCells = 0;
    this.hasRadar = false;
  }

  loadSector(sector: SectorDefinition): void {
    this.reset();
    const defs = sector.strategicPoints ?? [];
    for (const def of defs) {
      this.list.push(new StrategicPoint(def));
    }
  }

  /** Total capture-state count helper for objectives. */
  capturedOf(type: StrategicPointType): number {
    return this.capturedCounts[type] ?? 0;
  }
  destroyedOf(type: StrategicPointType): number {
    return this.destroyedCounts[type] ?? 0;
  }

  /**
   * Reveal bonus from captured radars. Used by darkness rendering / minimap.
   * Returns extra cells beyond the player's existing reveal sources.
   */
  revealRadiusCells(): number {
    return this.radarBonusCells;
  }

  /** Returns true if (cell c,r) is jammed by an active enemy jammer. */
  isCellJammed(c: number, r: number): boolean {
    if (this.list.length === 0) return false;
    for (const p of this.list) {
      if (p.type !== "jammer" || p.state !== "enemy") continue;
      const dc = c - p.c;
      const dr = r - p.r;
      if (dc * dc + dr * dr <= p.radiusCells * p.radiusCells) return true;
    }
    return false;
  }

  /** Returns true if a given world point sits inside a jammer field. */
  isWorldPointJammed(x: number, y: number): boolean {
    if (this.list.length === 0) return false;
    for (const p of this.list) {
      if (p.type !== "jammer" || p.state !== "enemy") continue;
      const radiusPx = p.radiusCells * TILE_SIZE;
      const dx = x - p.pos.x;
      const dy = y - p.pos.y;
      if (dx * dx + dy * dy <= radiusPx * radiusPx) return true;
    }
    return false;
  }

  /** Aura boost (1 + bonus) from rift anchors near a world position. */
  riftAuraMultiplier(x: number, y: number): number {
    if (this.list.length === 0) return 1;
    let mul = 1;
    for (const p of this.list) {
      if (p.type !== "rift_anchor" || p.state !== "enemy") continue;
      const dx = x - p.pos.x;
      const dy = y - p.pos.y;
      if (dx * dx + dy * dy <= RIFT_ANCHOR_AURA_RADIUS * RIFT_ANCHOR_AURA_RADIUS) {
        mul *= 1.18;
      }
    }
    return mul;
  }

  /** Active hostile structures (used by tower targeting). */
  hostileTargets(): StrategicPoint[] {
    const out: StrategicPoint[] = [];
    for (const p of this.list) {
      if (p.state === "enemy") out.push(p);
    }
    return out;
  }

  /** True if any active enemy is inside the capture-contest radius of this point. */
  private hasEnemyContest(point: StrategicPoint): boolean {
    const r2 = CAPTURE_CONTEST_RADIUS * CAPTURE_CONTEST_RADIUS;
    for (const e of this.game.enemies.list) {
      if (!e.active) continue;
      const dx = e.pos.x - point.pos.x;
      const dy = e.pos.y - point.pos.y;
      if (dx * dx + dy * dy <= r2) return true;
    }
    return false;
  }

  update(dt: number): void {
    if (this.list.length === 0) return;
    for (const p of this.list) {
      // Maintain shared "live status" flags so renderer / tooltip / HUD all
      // read the same view of contest/jam state without recomputing.
      p.inCoverage = this.game.grid.isCellInSignalCoverage(p.c, p.r);
      p.jammed = this.isWorldPointJammed(p.pos.x, p.pos.y);
      // Contested only matters for capturable / friendly turret points.
      if (p.state === "neutral") {
        p.contested = p.inCoverage && (p.jammed || this.hasEnemyContest(p));
      } else {
        p.contested = false;
      }
      switch (p.state) {
        case "neutral":
          this.updateNeutral(p, dt);
          break;
        case "enemy":
          this.updateHostile(p, dt);
          break;
        case "captured":
          this.updateCaptured(p, dt);
          break;
      }
      if (p.flashTimer > 0) p.flashTimer = Math.max(0, p.flashTimer - dt);
    }
  }

  // ──────────────────────────────────────────────────────────
  // Capture flow — the per-tick `inCoverage`/`jammed`/`contested` flags are
  // already set by update() before dispatching here.
  // ──────────────────────────────────────────────────────────
  private updateNeutral(p: StrategicPoint, dt: number): void {
    if (!p.inCoverage) {
      // Slowly bleed off any phantom progress so disconnects don't trickle in.
      if (p.captureProgress > 0) p.captureProgress = Math.max(0, p.captureProgress - dt * 0.15);
      return;
    }
    p.discovered = true;
    if (p.contested) {
      // Reverse capture under enemy / jammer contest.
      p.captureProgress = Math.max(0, p.captureProgress - dt * CAPTURE_DECAY_PER_SECOND);
      return;
    }
    const rate = 1 / Math.max(0.5, p.captureSeconds);
    const before = p.captureProgress;
    p.captureProgress = Math.min(1, p.captureProgress + dt * rate);
    // Emit progress events at 25/50/75% milestones for HUD/audio cues.
    const ms = (val: number) => Math.floor(val * 4); // 0..4 buckets
    if (ms(p.captureProgress) !== ms(before)) {
      this.game.bus.emit("strategic:progress", { id: p.id, progress: p.captureProgress });
    }
    if (p.captureProgress >= 1) {
      this.completeCapture(p);
    }
  }

  private completeCapture(p: StrategicPoint): void {
    p.captureProgress = 1;
    p.state = "captured";
    p.flashTimer = 0.6;
    p.contested = false;
    this.capturedCounts[p.type] = (this.capturedCounts[p.type] ?? 0) + 1;
    const x = p.pos.x;
    const y = p.pos.y;

    // Universal capture-complete pulse so every type gets a satisfying beat.
    this.game.particles.spawnRing(x, y, 28, "#ffffff", 0.4);
    this.game.particles.spawnRing(x, y, 60, "#66fcf1", 0.55);
    this.game.particles.spawnBurst(x, y, "#66fcf1", 12, { speed: 160, life: 0.55, size: 2.2 });

    switch (p.type) {
      case "signal_node": {
        // Add the point as a satellite signal source. We keep it as a virtual
        // CoreCluster-like entry so existing build logic just works.
        this.attachSignalNodeCluster(p);
        this.game.particles.spawnRing(x, y, SIGNAL_NODE_RADIUS_CELLS * TILE_SIZE, "#66fcf1", 0.55);
        this.game.particles.spawnFloatingText(x, y - 28, "SIGNAL NODE ONLINE", "#66fcf1", 1.4, 12);
        // Force a render-cache invalidate so the new coverage repaints.
        this.game.render.invalidateTerrainCache();
        break;
      }
      case "radar_dish": {
        this.radarBonusCells += RADAR_REVEAL_BONUS_CELLS;
        this.hasRadar = true;
        // A fast scan-sweep effect: three rings at increasing radii.
        this.game.particles.spawnRing(x, y, 80, "#80d8ff", 0.6);
        this.game.particles.spawnRing(x, y, 160, "#80d8ff", 0.45);
        this.game.particles.spawnRing(x, y, RADAR_REVEAL_BONUS_CELLS * TILE_SIZE, "#80d8ff", 0.35);
        this.game.particles.spawnFloatingText(x, y - 28, "RADAR ONLINE", "#80d8ff", 1.4, 12);
        break;
      }
      case "data_cache": {
        const credits = p.rewardCredits || DATA_CACHE_CREDIT_REWARD;
        const research = p.rewardResearch || DATA_CACHE_RESEARCH_REWARD;
        this.game.addCredits(credits);
        if (research > 0 && this.game.meta) this.game.meta.addResearchPoints(research);
        this.game.particles.spawnFloatingText(x, y - 28, `+${credits}CR / +${research} RES`, "#ffd54f", 1.6, 13);
        this.game.particles.spawnBurst(x, y, "#ffd54f", 18, { speed: 140, life: 0.6, size: 2.5 });
        this.game.particles.spawnBurst(x, y, "#ffffff", 8, { speed: 70, life: 0.5, size: 1.6 });
        // One-shot reward — deplete so it can't be farmed.
        p.state = "depleted";
        break;
      }
      case "abandoned_turret": {
        // Initial cooldown lets the player see the activation animation.
        p.effectTimer = 0.3;
        this.game.particles.spawnFloatingText(x, y - 28, "TURRET ACTIVATED", "#ffeb3b", 1.4, 12);
        this.game.particles.spawnRing(x, y, 36, "#ffeb3b", 0.5);
        // Big yellow activation flash so the foothold is unmistakable.
        this.game.particles.spawnRing(x, y, 90, "#ffeb3b", 0.4);
        this.game.particles.spawnBurst(x, y, "#ffeb3b", 16, { speed: 180, life: 0.55, size: 2 });
        break;
      }
      default:
        break;
    }
    this.game.audio.sfxReward();
    this.game.bus.emit("strategic:captured", { id: p.id, type: p.type });
  }

  /**
   * Attach a captured Signal Node as an additional virtual cluster on the grid
   * so the existing signal-coverage code automatically grants build territory
   * around it. Not flagged as a real core (no HP, no relay-cap consumption).
   */
  private attachSignalNodeCluster(p: StrategicPoint): void {
    const radiusCells = p.radiusCells || SIGNAL_NODE_RADIUS_CELLS;
    const grid = this.game.grid;
    grid.coreClusters.push({
      cells: [],
      center: p.pos,
      centerCol: p.c + 0.5,
      centerRow: p.r + 0.5,
      isPrimary: false,
      signalRadiusCells: radiusCells,
    });
    grid.markCacheDirty();
  }

  // ──────────────────────────────────────────────────────────
  // Hostile structure tick + damage
  // ──────────────────────────────────────────────────────────
  private updateHostile(p: StrategicPoint, dt: number): void {
    // Initialize the pulse interval on first tick so the renderer's countdown
    // ring has a sensible duration even before the structure has pulsed once.
    if (p.pulseInterval <= 0) p.pulseInterval = RIFT_ANCHOR_PULSE_INTERVAL;
    p.effectTimer -= dt;
    if (p.effectTimer <= 0) {
      const next = RIFT_ANCHOR_PULSE_INTERVAL + Math.random() * 2;
      p.effectTimer = next;
      p.pulseInterval = next;
      if (p.type === "rift_anchor") this.pulseRiftAnchor(p);
      else if (p.type === "jammer") this.pulseJammer(p);
    }
    // Lazy darkness reveal: structures inside player coverage / radar reach
    // become "discovered" so HUD can list them.
    if (!p.discovered) {
      const grid = this.game.grid;
      if (grid.isCellInSignalCoverage(p.c, p.r) || this.radarBonusCells > 0) {
        p.discovered = true;
        this.game.bus.emit("strategic:discovered", { id: p.id, type: p.type });
      }
    }
  }

  private pulseRiftAnchor(p: StrategicPoint): void {
    // Big telegraphed ring + screen-friendly text. Particles already animate;
    // the rendered countdown ring above the anchor handles the pre-warning.
    this.game.particles.spawnRing(p.pos.x, p.pos.y, RIFT_ANCHOR_AURA_RADIUS, "#ff5252", 0.6);
    this.game.particles.spawnRing(p.pos.x, p.pos.y, RIFT_ANCHOR_AURA_RADIUS * 0.55, "#ffeb3b", 0.45);
    if (p.discovered) {
      this.game.particles.spawnFloatingText(
        p.pos.x, p.pos.y - 36, "RIFT PULSE", "#ff5252", 1.2, 13
      );
    }
    this.game.bus.emit("strategic:pulse", { id: p.id, type: p.type });
    if (this.game.state !== "WAVE_ACTIVE") return;
    // Spawn a single weak scout near the anchor (only during waves; capped).
    const enemyCount = this.game.enemies.list.length;
    if (enemyCount > 60) return;
    const ang = Math.random() * Math.PI * 2;
    const dist = 14;
    this.game.enemies.spawn(
      "scout",
      p.pos.x + Math.cos(ang) * dist,
      p.pos.y + Math.sin(ang) * dist,
      0.7
    );
  }

  private pulseJammer(p: StrategicPoint): void {
    // Visual-only: orange dish ripple that telegraphs the jamming field.
    this.game.particles.spawnRing(p.pos.x, p.pos.y, p.radiusCells * TILE_SIZE, "#ef6c00", 0.45);
    this.game.bus.emit("strategic:pulse", { id: p.id, type: p.type });
  }

  /** Apply damage to a hostile structure (called from tower/drone routes). */
  damageStructure(p: StrategicPoint, amount: number, opts: DamageOpts = {}): boolean {
    if (p.state !== "enemy" || amount <= 0) return false;
    p.health -= amount;
    p.damagedOnce = true;
    p.discovered = true;
    if (p.health <= 0) {
      this.destroyStructure(p, opts);
      return true;
    }
    // Hit FX — mirrors enemy hit feedback.
    this.game.particles.spawnBurst(p.pos.x, p.pos.y, p.type === "jammer" ? "#ef6c00" : "#ff5252", 4, {
      speed: 80,
      life: 0.3,
      size: 2,
    });
    return false;
  }

  private destroyStructure(p: StrategicPoint, _opts: DamageOpts): void {
    p.state = "destroyed";
    p.health = 0;
    this.destroyedCounts[p.type] = (this.destroyedCounts[p.type] ?? 0) + 1;
    const reward =
      p.rewardCredits ||
      (p.type === "rift_anchor" ? RIFT_ANCHOR_DESTROY_REWARD : JAMMER_DESTROY_REWARD);
    this.game.addCredits(reward);
    this.game.particles.spawnRing(p.pos.x, p.pos.y, 80, p.type === "jammer" ? "#ef6c00" : "#ff5252", 0.7);
    this.game.particles.spawnRing(p.pos.x, p.pos.y, 140, "#ffffff", 0.4);
    this.game.particles.spawnBurst(p.pos.x, p.pos.y, p.type === "jammer" ? "#ef6c00" : "#ff5252", 28, {
      speed: 230,
      life: 0.7,
      size: 3,
    });
    this.game.particles.spawnFloatingText(
      p.pos.x,
      p.pos.y - 32,
      p.type === "jammer" ? "JAMMER DOWN" : "RIFT ANCHOR DESTROYED",
      p.type === "jammer" ? "#ef6c00" : "#ff5252",
      1.6,
      14
    );
    this.game.particles.spawnFloatingText(p.pos.x, p.pos.y - 16, `+${reward}CR`, "#ffd54f", 1.2, 12);
    this.game.audio.sfxExplosion(0.55);
    this.game.bus.emit("strategic:destroyed", { id: p.id, type: p.type });
  }

  // ──────────────────────────────────────────────────────────
  // Captured behavior
  // ──────────────────────────────────────────────────────────
  private updateCaptured(p: StrategicPoint, dt: number): void {
    if (p.type !== "abandoned_turret") return;
    p.effectTimer -= dt;
    if (p.effectTimer > 0) return;

    // Pick the closest enemy in range and emit a small projectile.
    let target: Enemy | null = null;
    let bestSq = ABANDONED_TURRET_RANGE * ABANDONED_TURRET_RANGE;
    for (const e of this.game.enemies.list) {
      if (!e.active || e.isPhased || e.isTunneling) continue;
      const dx = e.pos.x - p.pos.x;
      const dy = e.pos.y - p.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq) {
        bestSq = d2;
        target = e;
      }
    }
    if (!target) {
      p.effectTimer = 0.35;
      return;
    }
    p.effectTimer = ABANDONED_TURRET_COOLDOWN;
    const proj = new Projectile({
      pos: p.pos,
      target,
      damage: ABANDONED_TURRET_DAMAGE,
      color: "#ffeb3b",
      speed: 480,
      kind: "bullet",
      owner: {},
      ownerType: "other",
    });
    this.game.projectiles.spawn(proj);
    this.game.particles.spawnMuzzleFlash(p.pos.x, p.pos.y,
      Math.atan2(target.pos.y - p.pos.y, target.pos.x - p.pos.x), "#ffeb3b");
  }

  /**
   * Handy lookup used by InputSystem hover and HUD.
   * Returns the strategic point whose center is closest to (x, y) within
   * `maxPx` pixels, or null if none are close enough.
   */
  pointNearWorld(x: number, y: number, maxPx = 22): StrategicPoint | null {
    let best: StrategicPoint | null = null;
    let bestSq = maxPx * maxPx;
    for (const p of this.list) {
      const dx = x - p.pos.x;
      const dy = y - p.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq) {
        bestSq = d2;
        best = p;
      }
    }
    return best;
  }

  /** Quick predicate: any active hostile structures left? (objectives use this). */
  hasActiveHostiles(): boolean {
    for (const p of this.list) if (p.state === "enemy") return true;
    return false;
  }

  /** Total damage applied to a hostile structure by a hostile world position.
   *  Currently unused but exposed so future enemy abilities can repair structures. */
  pointAtCell(c: number, r: number): StrategicPoint | null {
    for (const p of this.list) {
      if (p.c === c && p.r === r) return p;
    }
    return null;
  }
}

// Re-export module-level helpers tests / future systems may need.
export { isHostile };

// Exhaustive-check helper to silence unused-imports if a constant ever drops.
void RIFT_ANCHOR_HEALTH;
void JAMMER_RADIUS_CELLS;
void Vector2;
