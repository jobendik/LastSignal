import type { Game } from "../core/Game";
import { Squad } from "../entities/Squad";
import { Vector2 } from "../core/Vector2";
import { squadDefinitions, squadOrder } from "../data/squads";
import {
  SHIELD_DAMAGE_REDUCTION_MAX,
  SQUAD_BOSS_DAMAGE_MUL,
  SQUAD_CAP_BASE,
  SQUAD_CAP_TIER_BONUS,
  SQUAD_CONTACT_DAMAGE_PER_SEC,
  SQUAD_CONTACT_DAMAGE_RADIUS,
  SQUAD_EVAC_ARRIVAL_RADIUS,
  SQUAD_EVAC_REFUND,
  SQUAD_EVAC_SPEED_MUL,
  SQUAD_JAMMER_ACTION_PENALTY,
  SQUAD_JAMMER_DAMAGE_MUL,
  SQUAD_JAMMER_ENEMY_RADIUS,
  SQUAD_JAMMER_REVEAL_PENALTY,
  SQUAD_PHANTOM_RADIUS,
  SQUAD_RIFT_AURA_DPS,
  SQUAD_SABOTEUR_DAMAGE_MUL,
  SQUAD_SPRINTER_DAMAGE_MUL,
  TILE_SIZE,
} from "../core/Config";
import type { Enemy } from "../entities/Enemy";
import type { StrategicPoint } from "../entities/StrategicPoint";
import type { Tower } from "../entities/Tower";
import type { SquadDefinition, SquadType } from "../core/Types";

/**
 * Snapshot of a squad command's availability for the HUD. Lets the HUD render
 * locked / cooldown / cap states without reaching into the system internals.
 */
export interface SquadCommandStatus {
  type: SquadType;
  def: SquadDefinition;
  unlocked: boolean;
  affordable: boolean;
  /** Effective cost after upgrade modifiers. */
  effectiveCost: number;
  /** True while the cooldown timer is positive. */
  onCooldown: boolean;
  /** Remaining cooldown seconds (0 when ready). */
  cooldownRemaining: number;
  /** Total cooldown duration after upgrade modifiers (used for HUD math). */
  effectiveCooldown: number;
  /** Remaining global squad slots (across all types). */
  globalSlotsLeft: number;
  /** Active squads of this type. */
  active: number;
  /** Cap on simultaneous squads of this type. */
  capPerType: number;
  /** Reason the squad can't be deployed right now (or null when ready). */
  reason: string | null;
}

/**
 * Owns the per-run state of mobile command squads. Squads are a tactical
 * "command ability" layer on top of the existing tower-defense core: the
 * player picks a squad command from the HUD, then clicks a target location
 * to deploy. Squads then move, scout, repair, attack, or shield based on
 * type. They are NOT individual unit micro — there's no drag-select, no
 * control groups, and no production buildings.
 */
export class MobileSquadSystem {
  list: Squad[] = [];
  /** Per-type cooldown remaining (seconds). */
  cooldowns: Record<SquadType, number> = {
    recon: 0,
    engineer: 0,
    strike: 0,
    shield: 0,
  };
  /** Currently armed squad command (null = none). Set by HUD; consumed by InputSystem. */
  pendingCommand: SquadType | null = null;
  /** The active squad the player has selected via HUD/world-space click. */
  selected: Squad | null = null;
  /** True while the player is choosing a new target/location for the selected squad. */
  retaskMode = false;

  constructor(private readonly game: Game) {}

  reset(): void {
    this.list = [];
    this.cooldowns = { recon: 0, engineer: 0, strike: 0, shield: 0 };
    this.pendingCommand = null;
    this.selected = null;
    this.retaskMode = false;
  }

  /** Global active squad cap (across ALL types), respecting upgrade aggregate. */
  globalCap(): number {
    const base = SQUAD_CAP_BASE + (this.game.core.commandTier - 1) * SQUAD_CAP_TIER_BONUS;
    const bonus = this.game.core.upgrades.squadCapAdd ?? 0;
    return Math.max(1, base + bonus);
  }

  /** True if the squad type's tier requirement is met. */
  isUnlocked(type: SquadType): boolean {
    return this.game.core.commandTier >= squadDefinitions[type].tierRequired;
  }

  activeCountOfType(type: SquadType): number {
    let n = 0;
    for (const s of this.list) if (s.type === type && s.active) n++;
    return n;
  }

  /** Effective cost after upgrade aggregate cost multiplier. */
  effectiveCost(def: SquadDefinition): number {
    const mul = this.game.core.upgrades.squadCostMul ?? 1;
    return Math.max(0, Math.round(def.cost * mul));
  }

  /** Effective cooldown after upgrade aggregate cooldown multiplier. */
  effectiveCooldown(def: SquadDefinition): number {
    const mul = this.game.core.upgrades.squadCooldownMul ?? 1;
    return Math.max(2, def.cooldown * mul);
  }

  /** Build a status snapshot for every squad type (used by HUD). */
  statuses(): SquadCommandStatus[] {
    const cap = this.globalCap();
    const slotsLeft = Math.max(0, cap - this.list.length);
    return squadOrder.map<SquadCommandStatus>((type) => {
      const def = squadDefinitions[type];
      const unlocked = this.isUnlocked(type);
      const cd = this.cooldowns[type];
      const active = this.activeCountOfType(type);
      const cost = this.effectiveCost(def);
      const cdMax = this.effectiveCooldown(def);
      const affordable = this.game.core.credits >= cost;
      let reason: string | null = null;
      if (!unlocked) reason = `Requires Command T${def.tierRequired}`;
      else if (cd > 0) reason = `Cooling down (${Math.ceil(cd)}s)`;
      else if (active >= def.capPerType) reason = `Cap reached ${active}/${def.capPerType}`;
      else if (slotsLeft <= 0) reason = `Squad cap ${this.list.length}/${cap}`;
      else if (!affordable) reason = `Need ${cost} CR`;
      return {
        type,
        def,
        unlocked,
        affordable,
        effectiveCost: cost,
        onCooldown: cd > 0,
        cooldownRemaining: cd,
        effectiveCooldown: cdMax,
        globalSlotsLeft: slotsLeft,
        active,
        capPerType: def.capPerType,
        reason,
      };
    });
  }

  /** Toggle / arm a squad command. Returns true if armed; false if disarmed. */
  armCommand(type: SquadType): boolean {
    if (this.pendingCommand === type) {
      this.pendingCommand = null;
      this.game.bus.emit("squad:disarm", { type });
      return false;
    }
    if (!this.canArm(type)) {
      const status = this.statuses().find((s) => s.type === type);
      if (status?.reason) {
        const corePos = this.game.grid.corePos;
        this.game.particles.spawnFloatingText(
          corePos.x,
          corePos.y - 80,
          status.reason.toUpperCase(),
          "#ff5252",
          1.0,
          11
        );
        this.game.audio.sfxShoot(0.5, 0.07);
      }
      return false;
    }
    this.pendingCommand = type;
    // Cancel any conflicting placement modes.
    this.game.input.selectedTowerType = null;
    this.game.input.showPlacementPreview = false;
    this.game.core.coreDeployMode = false;
    this.game.core.killZoneMode = false;
    // Arming a deployment cancels any in-progress retask mode so the cursor
    // reads as "deploy NEW squad" instead of "retask existing".
    this.retaskMode = false;
    this.game.audio.sfxSquadArm();
    this.game.bus.emit("squad:arm", { type });
    return true;
  }

  cancelCommand(): void {
    if (this.pendingCommand) {
      const type = this.pendingCommand;
      this.pendingCommand = null;
      this.game.bus.emit("squad:disarm", { type });
    }
    if (this.retaskMode) {
      this.retaskMode = false;
      this.game.bus.emit("squad:retaskCancel");
    }
  }

  /** Select an active squad (HUD/world-click). Pass null to clear. */
  selectSquad(s: Squad | null): void {
    if (s && (!s.active || s.evacuating)) {
      // Evacuating squads can still be selected but not retasked.
      this.selected = s.active ? s : null;
    } else {
      this.selected = s;
    }
    if (!this.selected) this.retaskMode = false;
    if (this.selected) {
      this.game.audio.sfxSquadSelect();
      // Center camera-ish — keep camera passive; we just emit the bus event so
      // the HUD/render can light up the squad. (No auto-pan to avoid jarring.)
    }
    this.game.bus.emit("squad:selected", this.selected ? { id: this.selected.id, type: this.selected.type } : null);
  }

  /** Enter retask mode for the currently selected squad. */
  beginRetask(): boolean {
    if (!this.selected || !this.selected.active) return false;
    if (this.selected.evacuating) return false;
    this.pendingCommand = null; // any deploy-arm should yield to retask
    this.retaskMode = true;
    this.game.audio.sfxSquadArm(0.85);
    this.game.bus.emit("squad:retaskBegin", { id: this.selected.id });
    return true;
  }

  /**
   * Retask the currently selected squad to a new target location/structure.
   * Returns true if a new target was successfully assigned.
   */
  retaskSelectedTo(x: number, y: number): boolean {
    const s = this.selected;
    if (!s || !s.active) return false;
    if (s.evacuating) return false;
    // Clamp the target inside the world so out-of-bounds clicks (e.g. minimap
    // edges) don't drag squads off-map.
    const w = this.game.grid.worldW;
    const h = this.game.grid.worldH;
    x = Math.max(8, Math.min(w - 8, x));
    y = Math.max(8, Math.min(h - 8, y));

    // Resolve a meaningful target near the click. Strategic point first,
    // then disabled tower, then ground. Type-specific filtering keeps the
    // retask honest (e.g. Strike snaps to hostile, Engineer to capturable).
    const sps = this.game.strategicPoints;
    let pointTarget: StrategicPoint | null = null;
    let towerTarget: Tower | null = null;
    if (sps) {
      pointTarget = sps.pointNearWorld(x, y, 26);
    }
    if (!pointTarget) {
      // Search nearby towers for repair retask.
      const towers = this.game.towers.list;
      let bestSq = 24 * 24;
      for (const t of towers) {
        const dx = t.pos.x - x;
        const dy = t.pos.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestSq) {
          bestSq = d2;
          towerTarget = t;
        }
      }
    }

    // Filter the target through the squad type's allowed retask set.
    s.targetPoint = null;
    s.targetTower = null;
    let acceptedLabel = "";
    let acceptedColor = s.def.color;
    let acceptedX = x;
    let acceptedY = y;
    let scanReset = false;
    let order = s.order;

    if (s.type === "recon") {
      // Recon retask is location-based; if the click is near a hidden hostile
      // structure, prefer scouting that point's exact location.
      if (pointTarget && !pointTarget.discovered) {
        acceptedX = pointTarget.pos.x;
        acceptedY = pointTarget.pos.y;
      }
      acceptedLabel = "RECON RETASK";
      order = "scout";
      scanReset = true;
    } else if (s.type === "engineer") {
      // Engineer prefers neutral capturable, then disabled tower, then point hold.
      if (pointTarget && pointTarget.state === "neutral") {
        s.targetPoint = pointTarget;
        acceptedX = pointTarget.pos.x;
        acceptedY = pointTarget.pos.y;
        acceptedLabel = "ENGINEER → CAPTURE";
        order = "capture";
      } else if (towerTarget && (this.game.towers.disabled.has(towerTarget) || towerTarget.buildProgress < 1)) {
        s.targetTower = towerTarget;
        acceptedX = towerTarget.pos.x;
        acceptedY = towerTarget.pos.y;
        acceptedLabel = "ENGINEER → REPAIR";
        order = "repair";
      } else if (pointTarget && pointTarget.state === "captured" && pointTarget.type === "abandoned_turret") {
        s.targetPoint = pointTarget;
        acceptedX = pointTarget.pos.x;
        acceptedY = pointTarget.pos.y;
        acceptedLabel = "ENGINEER → REINFORCE";
        order = "repair";
      } else {
        acceptedLabel = "ENGINEER REPOSITION";
        order = "repair";
      }
    } else if (s.type === "strike") {
      // Strike prefers hostile structures, but only if discovered. If the
      // player clicked a hidden structure, fall back to area suppression at
      // the clicked location so we don't reveal information unfairly.
      if (pointTarget && pointTarget.state === "enemy" && pointTarget.discovered) {
        s.targetPoint = pointTarget;
        acceptedX = pointTarget.pos.x;
        acceptedY = pointTarget.pos.y;
        acceptedLabel = "STRIKE → STRUCTURE";
        order = "strike";
      } else {
        acceptedLabel = "STRIKE → AREA";
        order = "strike";
      }
    } else if (s.type === "shield") {
      // Shield retask is allowed (mobile up to anchor); we just move it to the
      // new location and let updateShield re-anchor when it arrives.
      acceptedLabel = "SHIELD REPOSITION";
      order = "shield";
    }

    s.target = new Vector2(acceptedX, acceptedY);
    s.order = order;
    if (scanReset) {
      s.scanPulseDone = false;
      s.scanCompletedAt = null;
    }
    s.ackTimer = 0.5;
    s.effectTimer = 0; // interrupt any in-progress channel/attack tick

    this.retaskMode = false;
    this.game.particles.spawnRing(acceptedX, acceptedY, 22, acceptedColor, 0.4);
    this.game.particles.spawnFloatingText(acceptedX, acceptedY - 18, acceptedLabel, acceptedColor, 1.0, 11);
    this.game.audio.sfxSquadRetask(s.type);
    this.game.bus.emit("squad:retask", { id: s.id, type: s.type, x: acceptedX, y: acceptedY });
    return true;
  }

  /** Returns true if the squad command can be armed right now. */
  canArm(type: SquadType): boolean {
    const status = this.statuses().find((s) => s.type === type);
    if (!status) return false;
    if (!status.unlocked) return false;
    if (status.onCooldown) return false;
    if (status.active >= status.capPerType) return false;
    if (status.globalSlotsLeft <= 0) return false;
    if (!status.affordable) return false;
    // Squads can be deployed during planning and active waves only.
    const st = this.game.state;
    return st === "PLANNING" || st === "WAVE_ACTIVE";
  }

  /**
   * Deploy a squad of the pending command type at a world-space target.
   * Returns true on success. The InputSystem calls this when the player
   * clicks on the map while a command is armed.
   */
  deployAt(targetX: number, targetY: number): boolean {
    const type = this.pendingCommand;
    if (!type) return false;
    if (!this.canArm(type)) return false;
    const def = squadDefinitions[type];
    const cost = this.effectiveCost(def);
    if (!this.game.spendCredits(cost)) return false;

    // Reject deploys outside the world bounds (clicking on the minimap or HUD
    // shouldn't drop a squad off-map).
    const w = this.game.grid.worldW;
    const h = this.game.grid.worldH;
    targetX = Math.max(8, Math.min(w - 8, targetX));
    targetY = Math.max(8, Math.min(h - 8, targetY));

    // Spawn from the nearest active core / relay center so the deployment
    // visibly originates from the player's signal network.
    const origin = this.game.grid.getNearestCoreCenter(targetX, targetY);
    const target = new Vector2(targetX, targetY);
    const squad = new Squad(type, origin.x, origin.y, target);
    this.list.push(squad);
    this.cooldowns[type] = this.effectiveCooldown(def);
    this.pendingCommand = null;

    // Deployment FX — burst and floating text near the spawn point.
    const color = def.color;
    this.game.particles.spawnRing(origin.x, origin.y, 32, color, 0.45);
    this.game.particles.spawnBurst(origin.x, origin.y, color, 12, {
      speed: 140,
      life: 0.45,
      size: 2.2,
    });
    this.game.particles.spawnFloatingText(
      origin.x,
      origin.y - 24,
      this.deployLabel(type),
      color,
      1.2,
      12
    );
    this.game.audio.sfxSquadDeploy(type, origin);
    this.game.bus.emit("squad:deployed", { type, x: targetX, y: targetY });
    return true;
  }

  private deployLabel(type: SquadType): string {
    switch (type) {
      case "recon":
        return "RECON DEPLOYED";
      case "engineer":
        return "ENGINEERS DEPLOYED";
      case "strike":
        return "STRIKE SQUAD DEPLOYED";
      case "shield":
        return "SHIELD ONLINE";
    }
  }

  // ──────────────────────────────────────────────────────────
  // EVAC / Recall
  // ──────────────────────────────────────────────────────────
  /** Begin evacuation for a single squad. Returns true if accepted. */
  evacSquad(s: Squad): boolean {
    if (!s.active) return false;
    if (s.evacuating) return false;
    s.evacuating = true;
    s.order = "evac";
    s.state = "evacuating";
    s.targetPoint = null;
    s.targetTower = null;
    // Set destination = nearest core/relay center.
    const home = this.game.grid.getNearestCoreCenter(s.pos.x, s.pos.y);
    s.target = new Vector2(home.x, home.y);
    s.effectTimer = 0;
    this.game.particles.spawnRing(s.pos.x, s.pos.y, 22, s.def.color, 0.4);
    this.game.particles.spawnFloatingText(s.pos.x, s.pos.y - 18, "EVAC ORDERED", s.def.color, 1.0, 11);
    this.game.audio.sfxSquadEvac();
    this.game.bus.emit("squad:evacBegin", { id: s.id, type: s.type });
    return true;
  }

  /** Evac all active, non-evacuating squads. */
  evacAll(): number {
    let n = 0;
    for (const s of this.list) {
      if (s.active && !s.evacuating) {
        if (this.evacSquad(s)) n++;
      }
    }
    if (n > 0) {
      const corePos = this.game.grid.corePos;
      this.game.particles.spawnFloatingText(corePos.x, corePos.y - 60, `EVAC ALL (${n})`, "#80d8ff", 1.4, 12);
    }
    return n;
  }

  // ──────────────────────────────────────────────────────────
  // Update
  // ──────────────────────────────────────────────────────────
  update(dt: number): void {
    // Tick cooldowns regardless of state so the player's command panel
    // shows progress while a wave is rolling. They only freeze on pause.
    for (const t of squadOrder) {
      if (this.cooldowns[t] > 0) {
        this.cooldowns[t] = Math.max(0, this.cooldowns[t] - dt);
      }
    }

    // Squads themselves are driven by simulation dt, so they freeze during
    // pause and slow during slow-mo just like enemies/towers/drones.
    for (const s of this.list) {
      if (!s.active) continue;
      if (s.spawnTimer > 0) s.spawnTimer = Math.max(0, s.spawnTimer - dt);
      if (s.ackTimer > 0) s.ackTimer = Math.max(0, s.ackTimer - dt);
      this.tickSquad(s, dt);
    }

    // Sweep destroyed/expired squads.
    if (this.list.some((s) => !s.active)) {
      // Clear selection if the selected squad just expired/died.
      if (this.selected && !this.selected.active) {
        this.selected = null;
        this.retaskMode = false;
        this.game.bus.emit("squad:selected", null);
      }
      this.list = this.list.filter((s) => s.active);
    }
  }

  /** Per-frame behavior dispatch. */
  private tickSquad(s: Squad, dt: number): void {
    // Duration timer always counts down once spawning is complete (even during
    // evac, so a squad with 0.1s left can still die mid-flight).
    if (s.spawnTimer <= 0) {
      s.duration -= dt;
      if (s.duration <= 0) {
        this.expireSquad(s);
        return;
      }
    }

    // Live status flags used by HUD/render/tooltip.
    const sps = this.game.strategicPoints;
    s.jammed = sps ? sps.isWorldPointJammed(s.pos.x, s.pos.y) : false;
    s.inRiftAura = sps ? sps.riftAuraMultiplier(s.pos.x, s.pos.y) > 1 : false;

    // Hostile auras + jammer chip squads. Jammer resistance upgrade reduces.
    const resist = Math.min(0.9, this.game.core.upgrades.squadJammerResistance ?? 0);
    if (s.inRiftAura) {
      s.health -= dt * SQUAD_RIFT_AURA_DPS * (1 - resist);
    }
    if (s.jammed) {
      s.health -= dt * 3 * (1 - resist);
    }

    // Contact damage from enemies. We model this without making enemies
    // retarget the squad — they keep walking toward the core, but anyone
    // close enough chips the squad. Saboteurs and Sprinters hit harder.
    this.applyContactDamage(s, dt);

    // Track recent damage timestamp for HUD readout. We read the snapshot from
    // the previous tick BEFORE this tick's damage applied, so a drop indicates
    // a fresh hit this frame.
    if (s.health < s.prevHealth - 0.01) {
      s.lastHitTime = this.game.time.elapsed;
    }
    s.prevHealth = s.health;

    if (s.health <= 0) {
      // Killed during evac counts as a failed evac.
      this.destroySquad(s);
      return;
    }

    // Light reveal pulse so squads always contribute to darkness reveal.
    this.contributeReveal(s);

    // Behavior dispatch — evacuating squads run a special path.
    if (s.evacuating) {
      this.updateEvac(s, dt);
      return;
    }
    switch (s.type) {
      case "recon":
        this.updateRecon(s, dt);
        break;
      case "engineer":
        this.updateEngineer(s, dt);
        break;
      case "strike":
        this.updateStrike(s, dt);
        break;
      case "shield":
        this.updateShield(s, dt);
        break;
    }
  }

  // ──────────────────────────────────────────────────────────
  // Movement helpers
  // ──────────────────────────────────────────────────────────
  /** Move squad toward `target` at its base speed. Returns distance to target. */
  private moveToward(s: Squad, target: Vector2, dt: number, speedMul = 1): number {
    const dx = target.x - s.pos.x;
    const dy = target.y - s.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) {
      s.vel.set(0, 0);
      return dist;
    }
    const nx = dx / dist;
    const ny = dy / dist;
    const baseSpeed = s.def.speed * speedMul;
    // Smoothly steer the velocity toward the desired direction so motion
    // feels less jittery than instant-snap velocity.
    const desiredVx = nx * baseSpeed;
    const desiredVy = ny * baseSpeed;
    s.vel.x += (desiredVx - s.vel.x) * Math.min(1, dt * 6);
    s.vel.y += (desiredVy - s.vel.y) * Math.min(1, dt * 6);
    s.pos.x += s.vel.x * dt;
    s.pos.y += s.vel.y * dt;
    // Clamp inside the world.
    const margin = 8;
    s.pos.x = Math.max(margin, Math.min(this.game.grid.worldW - margin, s.pos.x));
    s.pos.y = Math.max(margin, Math.min(this.game.grid.worldH - margin, s.pos.y));
    return dist;
  }

  /** Action speed multiplier for jammer-affected squads. */
  private actionSpeed(s: Squad): number {
    if (!s.jammed) return 1;
    const resist = Math.min(0.9, this.game.core.upgrades.squadJammerResistance ?? 0);
    const penalty = SQUAD_JAMMER_ACTION_PENALTY + (1 - SQUAD_JAMMER_ACTION_PENALTY) * resist;
    return penalty;
  }

  // ──────────────────────────────────────────────────────────
  // Recon — fast scout. Reveals darkness and exposes hidden points.
  // ──────────────────────────────────────────────────────────
  private updateRecon(s: Squad, dt: number): void {
    const dist = this.moveToward(s, s.target, dt);
    if (dist < 14) {
      s.state = "scouting";
      // One-shot scan pulse on arrival — bigger than the passive reveal. We
      // remember the location of the last completed scan so retasks can
      // re-trigger the pulse at a new spot without re-scanning the same one.
      const sameSpotAsLast =
        s.scanCompletedAt &&
        Math.abs(s.scanCompletedAt.x - s.target.x) < 4 &&
        Math.abs(s.scanCompletedAt.y - s.target.y) < 4;
      if (!s.scanPulseDone || !sameSpotAsLast) {
        s.scanPulseDone = true;
        s.scanCompletedAt = { x: s.target.x, y: s.target.y };
        const scaleMul = this.game.core.upgrades.squadReconRevealMul ?? 1;
        const radius = s.def.revealRadius * 0.9 * scaleMul;
        this.game.particles.spawnRing(s.pos.x, s.pos.y, radius, s.def.color, 0.6);
        this.game.particles.spawnRing(s.pos.x, s.pos.y, radius * 0.55, "#ffffff", 0.4);
        this.game.particles.spawnFloatingText(s.pos.x, s.pos.y - 26, "AREA SCANNED", s.def.color, 1.0, 11);
        this.exposeStrategicPointsNear(s);
        this.game.audio.sfxSquadScan(s.pos);
        this.game.bus.emit("squad:scan", { id: s.id, x: s.pos.x, y: s.pos.y });
      }
      // After arrival, slowly orbit to keep the scan alive.
      const wander = (this.game.time.elapsed * 0.4) % (Math.PI * 2);
      s.pos.x += Math.cos(wander) * 8 * dt;
      s.pos.y += Math.sin(wander) * 8 * dt;
    } else {
      s.state = "moving";
      // Periodically expose newly-detected strategic points while in transit.
      s.effectTimer -= dt;
      if (s.effectTimer <= 0) {
        s.effectTimer = 0.6;
        this.exposeStrategicPointsNear(s);
      }
    }
  }

  /** Mark hidden strategic points / hostile structures within the recon's reach as discovered. */
  private exposeStrategicPointsNear(s: Squad): void {
    const sps = this.game.strategicPoints;
    if (!sps) return;
    const revealMul = this.game.core.upgrades.squadReconRevealMul ?? 1;
    const radius = s.def.revealRadius * revealMul * (s.jammed ? SQUAD_JAMMER_REVEAL_PENALTY : 1);
    const r2 = radius * radius;
    for (const p of sps.list) {
      if (p.discovered) continue;
      if (p.state === "destroyed" || p.state === "depleted") continue;
      const dx = p.pos.x - s.pos.x;
      const dy = p.pos.y - s.pos.y;
      if (dx * dx + dy * dy <= r2) {
        p.discovered = true;
        if (p.state === "enemy") {
          if (p.type === "rift_anchor") {
            this.game.particles.spawnFloatingText(p.pos.x, p.pos.y - 28, "HOSTILE STRUCTURE DETECTED", "#ff5252", 1.4, 11);
          } else {
            this.game.particles.spawnFloatingText(p.pos.x, p.pos.y - 28, "JAMMER DETECTED", "#ef6c00", 1.4, 11);
          }
          this.game.particles.spawnRing(p.pos.x, p.pos.y, 36, "#ff5252", 0.4);
          this.game.bus.emit("strategic:discovered", { id: p.id, type: p.type });
        } else if (p.type === "data_cache") {
          this.game.particles.spawnFloatingText(p.pos.x, p.pos.y - 28, "SIGNAL CACHE FOUND", "#ffd54f", 1.4, 11);
          this.game.particles.spawnRing(p.pos.x, p.pos.y, 36, "#ffd54f", 0.4);
          this.game.bus.emit("strategic:discovered", { id: p.id, type: p.type });
        } else {
          this.game.bus.emit("strategic:discovered", { id: p.id, type: p.type });
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────
  // Engineer — accelerates capture, repairs disabled towers, and slowly
  // restores small core integrity while channeling near a real cluster.
  // ──────────────────────────────────────────────────────────
  private updateEngineer(s: Squad, dt: number): void {
    const actionSpd = this.actionSpeed(s);
    // Re-resolve target if the original entity has gone away.
    if (s.targetPoint && (s.targetPoint.state === "destroyed" || s.targetPoint.state === "depleted")) {
      s.targetPoint = null;
    }
    if (s.targetTower && !this.game.towers.list.includes(s.targetTower)) {
      s.targetTower = null;
    }

    const point = s.targetPoint ?? this.findNearbyCapturablePoint(s);
    const tower = s.targetTower ?? this.findNearbyDisabledTower(s);

    // Prefer capturable strategic point > disabled tower > target location.
    if (point) {
      s.targetPoint = point;
      const dist = this.moveToward(s, point.pos, dt);
      if (dist < s.def.interactionRadius) {
        s.state = "capturing";
        // Engineer accelerates capture progress on neutral points whenever
        // they're inside player coverage. We push directly into captureProgress
        // so the existing StrategicPointSystem still runs all of its
        // pulse/reward bookkeeping when the point completes naturally.
        if (point.state === "neutral" && point.inCoverage && !point.contested) {
          const rate = 1 / Math.max(0.5, point.captureSeconds);
          const mul = (s.def.captureMultiplier ?? 1) + (this.game.core.upgrades.squadEngineerCaptureBonus ?? 0);
          const boost = Math.max(0, mul - 1) * actionSpd;
          point.captureProgress = Math.min(
            1,
            point.captureProgress + dt * rate * boost
          );
          s.effectTimer -= dt;
          if (s.effectTimer <= 0) {
            s.effectTimer = 0.9;
            this.game.particles.spawnFloatingText(
              point.pos.x,
              point.pos.y - 32,
              "CAPTURE BOOSTED",
              s.def.color,
              0.7,
              10
            );
            this.game.audio.sfxSquadEngineer(s.pos);
          }
          this.drawWorkBeam(s.pos, point.pos, s.def.color);
        } else if (point.state === "neutral" && point.inCoverage && point.contested) {
          // Engineer reduces decay rate while contested instead of advancing.
          const decay = 0.35;
          const reduce = 0.18 * actionSpd; // up to ~50% slower decay
          point.captureProgress = Math.min(1, Math.max(0, point.captureProgress + dt * (-decay + reduce)));
          s.effectTimer -= dt;
          if (s.effectTimer <= 0) {
            s.effectTimer = 1.1;
            this.game.particles.spawnFloatingText(point.pos.x, point.pos.y - 32, "STABILIZING", s.def.color, 0.7, 10);
          }
          this.drawWorkBeam(s.pos, point.pos, s.def.color);
        } else if (point.state === "captured" && point.type === "abandoned_turret") {
          // Engineer keeps a friendly turret firing faster by trimming its cooldown.
          point.effectTimer = Math.max(0, point.effectTimer - dt * 0.5 * actionSpd);
          s.effectTimer -= dt;
          if (s.effectTimer <= 0) {
            s.effectTimer = 1.3;
            this.game.particles.spawnFloatingText(point.pos.x, point.pos.y - 30, "TURRET BOOST", s.def.color, 0.7, 10);
          }
          this.drawWorkBeam(s.pos, point.pos, s.def.color);
        }
        return;
      }
      s.state = "moving";
      return;
    }

    if (tower) {
      s.targetTower = tower;
      const dist = this.moveToward(s, tower.pos, dt);
      if (dist < s.def.interactionRadius) {
        s.state = "repairing";
        // Drain remaining disabled timer faster — equivalent of "repairing
        // a damaged tower" since towers don't have HP. Also speeds up
        // mid-construction tower build progress.
        const disabledMap = this.game.towers.disabled;
        const remaining = disabledMap.get(tower);
        if (remaining != null && remaining > 0) {
          const next = Math.max(0, remaining - dt * 2.2 * actionSpd);
          if (next <= 0) disabledMap.delete(tower);
          else disabledMap.set(tower, next);
        }
        if (tower.buildProgress < 1) {
          tower.buildProgress = Math.min(1, tower.buildProgress + dt * 1.6 * actionSpd);
        }
        s.effectTimer -= dt;
        if (s.effectTimer <= 0) {
          s.effectTimer = 1.2;
          this.game.particles.spawnFloatingText(
            tower.pos.x,
            tower.pos.y - 30,
            "REPAIRING",
            s.def.color,
            0.7,
            10
          );
          this.game.audio.sfxSquadEngineer(s.pos);
        }
        this.drawWorkBeam(s.pos, tower.pos, s.def.color);
        return;
      }
      s.state = "moving";
      return;
    }

    // Default behavior: hold position at the target and slowly heal the
    // nearest cluster's integrity if we're inside its signal coverage.
    const dist = this.moveToward(s, s.target, dt);
    if (dist < 14) {
      s.state = "repairing";
      const cluster = this.game.grid.getNearestCoreCenter(s.pos.x, s.pos.y);
      const dx = s.pos.x - cluster.x;
      const dy = s.pos.y - cluster.y;
      // Only stabilize if we're close to a real cluster and core integrity is below max.
      if (dx * dx + dy * dy < (s.def.interactionRadius * 1.4) * (s.def.interactionRadius * 1.4)) {
        const repairPerSecond = s.def.repairPerSecond ?? 0;
        if (this.game.core.coreIntegrity < this.game.core.coreMax) {
          this.game.core.coreIntegrity = Math.min(
            this.game.core.coreMax,
            this.game.core.coreIntegrity + repairPerSecond * dt * 0.55 * actionSpd
          );
          s.effectTimer -= dt;
          if (s.effectTimer <= 0) {
            s.effectTimer = 1.5;
            this.game.particles.spawnFloatingText(cluster.x, cluster.y - 38, "+CORE", s.def.color, 0.7, 10);
          }
          this.drawWorkBeam(s.pos, cluster, s.def.color);
        }
      }
    } else {
      s.state = "moving";
    }
  }

  private findNearbyCapturablePoint(s: Squad): StrategicPoint | null {
    const sps = this.game.strategicPoints;
    if (!sps) return null;
    let best: StrategicPoint | null = null;
    let bestSq = 220 * 220;
    for (const p of sps.list) {
      if (p.state !== "neutral") continue;
      const dx = p.pos.x - s.target.x;
      const dy = p.pos.y - s.target.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq) {
        bestSq = d2;
        best = p;
      }
    }
    return best;
  }

  private findNearbyDisabledTower(s: Squad): Tower | null {
    const towers = this.game.towers.list;
    let best: Tower | null = null;
    let bestSq = 220 * 220;
    for (const t of towers) {
      const isDisabled = this.game.towers.disabled.has(t) || t.buildProgress < 1;
      if (!isDisabled) continue;
      const dx = t.pos.x - s.target.x;
      const dy = t.pos.y - s.target.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq) {
        bestSq = d2;
        best = t;
      }
    }
    return best;
  }

  private drawWorkBeam(a: Vector2, b: Vector2, color: string): void {
    // Short-lived beam — refreshed each tick so it appears continuous while
    // engineering, then fades when the squad moves away or the work completes.
    this.game.particles.spawnBeam(a.x, a.y, b.x, b.y, color, 0.18, { width: 2 });
  }

  // ──────────────────────────────────────────────────────────
  // Strike — combat squad. Targets hostile structures, then enemies near it.
  // ──────────────────────────────────────────────────────────
  private updateStrike(s: Squad, dt: number): void {
    // Stay near the commanded target so the player's intent is honored, but
    // the squad will engage opportunistic enemies en route.
    const dist = this.moveToward(s, s.target, dt);
    s.state = dist < 18 ? "attacking" : "moving";
    s.effectTimer -= dt;
    if (s.effectTimer > 0) return;
    s.effectTimer = (s.def.attackCooldown ?? 0.6) / Math.max(0.4, this.actionSpeed(s));

    // Priority order:
    //  1. directly-targeted hostile structure (set via retask)
    //  2. enemy threatening squad (in close contact range)
    //  3. directly-targeted enemy via interaction radius
    //  4. nearby hostile structure (auto-target)
    //  5. nearest high-threat enemy in range
    if (s.targetPoint && s.targetPoint.state === "enemy") {
      const dx = s.targetPoint.pos.x - s.pos.x;
      const dy = s.targetPoint.pos.y - s.pos.y;
      const ir = s.def.interactionRadius;
      if (dx * dx + dy * dy <= ir * ir) {
        this.attackStructure(s, s.targetPoint);
        return;
      }
    } else if (s.targetPoint && s.targetPoint.state !== "enemy") {
      // Target structure was destroyed — clear it so we fall back to area sweep.
      s.targetPoint = null;
    }

    const threat = this.findThreatEnemy(s);
    if (threat) {
      this.attackEnemy(s, threat);
      return;
    }

    const struct = this.findNearbyHostileStructure(s);
    const enemy = this.findNearbyEnemy(s);
    if (struct && enemy) {
      // If the enemy is dangerously close, prioritize survival.
      if (enemy.pos.dist(s.pos) < 60) this.attackEnemy(s, enemy);
      else this.attackStructure(s, struct);
    } else if (enemy) {
      this.attackEnemy(s, enemy);
    } else if (struct) {
      this.attackStructure(s, struct);
    }
  }

  /** Find a single dangerous enemy hugging the squad (priority 2 above). */
  private findThreatEnemy(s: Squad): Enemy | null {
    const r = SQUAD_CONTACT_DAMAGE_RADIUS + 16;
    const r2 = r * r;
    let best: Enemy | null = null;
    let bestSq = r2;
    for (const e of this.game.enemies.list) {
      if (!e.active || e.isPhased || e.isTunneling) continue;
      const dx = e.pos.x - s.pos.x;
      const dy = e.pos.y - s.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq) {
        bestSq = d2;
        best = e;
      }
    }
    return best;
  }

  private findNearbyEnemy(s: Squad): Enemy | null {
    const r = s.def.interactionRadius;
    const r2 = r * r;
    let best: Enemy | null = null;
    let bestSq = r2;
    for (const e of this.game.enemies.list) {
      if (!e.active || e.isPhased || e.isTunneling) continue;
      const dx = e.pos.x - s.pos.x;
      const dy = e.pos.y - s.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq) {
        bestSq = d2;
        best = e;
      }
    }
    return best;
  }

  private findNearbyHostileStructure(s: Squad): StrategicPoint | null {
    const sps = this.game.strategicPoints;
    if (!sps) return null;
    const r = s.def.interactionRadius;
    const r2 = r * r;
    let best: StrategicPoint | null = null;
    let bestSq = r2;
    for (const p of sps.list) {
      if (p.state !== "enemy") continue;
      // Don't blindly target undiscovered hostile structures — Strike is not
      // a free reveal tool; player must discover them first (Recon or radar).
      if (!p.discovered) continue;
      const dx = p.pos.x - s.pos.x;
      const dy = p.pos.y - s.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq) {
        bestSq = d2;
        best = p;
      }
    }
    return best;
  }

  private attackEnemy(s: Squad, e: Enemy): void {
    const dmgMul = this.game.core.upgrades.squadStrikeDamageMul ?? 1;
    const dmg = (s.def.damage ?? 6) * dmgMul;
    e.damage(dmg, { type: "drone" });
    this.game.particles.spawnBeam(s.pos.x, s.pos.y, e.pos.x, e.pos.y, s.def.color, 0.14, { width: 2 });
    this.game.particles.spawnBurst(e.pos.x, e.pos.y, s.def.color, 4, {
      speed: 90,
      life: 0.3,
      size: 2,
    });
    this.game.audio.sfxSquadStrike(s.pos);
  }

  private attackStructure(s: Squad, p: StrategicPoint): void {
    const dmgMul = this.game.core.upgrades.squadStrikeDamageMul ?? 1;
    const baseDmg = (s.def.damage ?? 6) * dmgMul;
    const dmg = baseDmg * (s.def.structureDamageMul ?? 1.5);
    const destroyed = this.game.strategicPoints.damageStructure(p, dmg, { source: "drone" });
    this.game.particles.spawnBeam(s.pos.x, s.pos.y, p.pos.x, p.pos.y, s.def.color, 0.18, { width: 2.5 });
    if (destroyed) {
      this.game.particles.spawnFloatingText(
        p.pos.x,
        p.pos.y - 50,
        "STRIKE TEAM SECURED OBJECTIVE",
        s.def.color,
        1.6,
        12
      );
      this.game.bus.emit("squad:structureKill", { id: s.id, type: s.type, structureType: p.type });
    }
    this.game.audio.sfxSquadStrike(s.pos);
  }

  // ──────────────────────────────────────────────────────────
  // Shield — projects a stabilizing field at the deployed location.
  // ──────────────────────────────────────────────────────────
  private updateShield(s: Squad, dt: number): void {
    const dist = this.moveToward(s, s.target, dt);
    if (dist < 18) {
      s.state = "shielding";
      // Slow enemies inside the shield bubble; this is the visible "field".
      const slowAmount = (s.def.shieldSlowAmount ?? 0.5) * this.actionSpeed(s);
      const radius = s.def.interactionRadius;
      const r2 = radius * radius;
      for (const e of this.game.enemies.list) {
        if (!e.active || e.isBoss) continue;
        const dx = e.pos.x - s.pos.x;
        const dy = e.pos.y - s.pos.y;
        if (dx * dx + dy * dy < r2) {
          e.applySlow(0.4, 1 - slowAmount);
        }
      }
      // Periodic ripple ring to telegraph the active field.
      s.effectTimer -= dt;
      if (s.effectTimer <= 0) {
        s.effectTimer = 1.0;
        this.game.particles.spawnRing(s.pos.x, s.pos.y, radius, s.def.color, 0.5);
        if (this.game.time.elapsed - s.lastShieldPulse > 1.6) {
          s.lastShieldPulse = this.game.time.elapsed;
          this.game.audio.sfxSquadShield(s.pos);
        }
      }
    } else {
      s.state = "moving";
    }
  }

  /**
   * Total damage reduction applied to core damage when it lands inside any
   * active shield squad's field. Game.damageCore consults this. Returns the
   * residual fraction (0..1) that should still be applied — 1 means no
   * reduction, 0 means fully absorbed.
   *
   * Stacking is capped via SHIELD_DAMAGE_REDUCTION_MAX so multiple shields
   * can never make a position fully invulnerable.
   */
  shieldDamageMul(x: number, y: number): number {
    let totalReduction = 0;
    const strengthMul = this.game.core.upgrades.squadShieldStrengthMul ?? 1;
    for (const s of this.list) {
      if (s.type !== "shield" || !s.active) continue;
      if (s.evacuating) continue;
      if (s.state !== "shielding" && s.state !== "moving") continue;
      const radius = s.def.interactionRadius;
      const dx = x - s.pos.x;
      const dy = y - s.pos.y;
      if (dx * dx + dy * dy <= radius * radius) {
        let reduction = (s.def.shieldDamageReduction ?? 0.4) * strengthMul;
        // Jammed shields are weakened.
        if (s.jammed) reduction *= 0.55;
        totalReduction = 1 - (1 - totalReduction) * (1 - reduction);
      }
    }
    totalReduction = Math.min(SHIELD_DAMAGE_REDUCTION_MAX, totalReduction);
    return Math.max(0.35, 1 - totalReduction);
  }

  // ──────────────────────────────────────────────────────────
  // Evac flow
  // ──────────────────────────────────────────────────────────
  private updateEvac(s: Squad, dt: number): void {
    s.state = "evacuating";
    // Recompute home target each second so a relay built mid-evac is honored.
    s.effectTimer -= dt;
    if (s.effectTimer <= 0) {
      s.effectTimer = 1.0;
      const home = this.game.grid.getNearestCoreCenter(s.pos.x, s.pos.y);
      s.target = new Vector2(home.x, home.y);
    }
    const dist = this.moveToward(s, s.target, dt, SQUAD_EVAC_SPEED_MUL);
    if (dist <= SQUAD_EVAC_ARRIVAL_RADIUS) {
      this.recallSquadSafely(s);
    }
  }

  private recallSquadSafely(s: Squad): void {
    s.active = false;
    // Refund a fraction of base cooldown so the player isn't punished for
    // smart positioning. Refund is per-type and capped at 0 (never goes
    // negative) so we don't accidentally reset cooldowns to negatives.
    const refundFrac = Math.max(0, Math.min(1, SQUAD_EVAC_REFUND));
    const eff = this.effectiveCooldown(s.def);
    this.cooldowns[s.type] = Math.max(0, this.cooldowns[s.type] - eff * refundFrac);
    this.game.particles.spawnRing(s.pos.x, s.pos.y, 30, s.def.color, 0.45);
    this.game.particles.spawnFloatingText(s.pos.x, s.pos.y - 22, "SQUAD RECALLED", s.def.color, 1.0, 11);
    this.game.audio.sfxSquadRecall();
    this.game.bus.emit("squad:recalled", { id: s.id, type: s.type });
  }

  // ──────────────────────────────────────────────────────────
  // Vulnerability + reveal helpers
  // ──────────────────────────────────────────────────────────
  private applyContactDamage(s: Squad, dt: number): void {
    const r = SQUAD_CONTACT_DAMAGE_RADIUS;
    const r2 = r * r;
    let chip = 0;
    let nearbyJammerEnemy = false;
    let nearbyPhantom = false;
    for (const e of this.game.enemies.list) {
      if (!e.active) continue;
      const dx = e.pos.x - s.pos.x;
      const dy = e.pos.y - s.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2) {
        let perEnemy = SQUAD_CONTACT_DAMAGE_PER_SEC;
        if (e.isBoss) perEnemy *= SQUAD_BOSS_DAMAGE_MUL;
        else if (e.type === "saboteur") perEnemy *= SQUAD_SABOTEUR_DAMAGE_MUL;
        else if (e.type === "sprinter") perEnemy *= SQUAD_SPRINTER_DAMAGE_MUL;
        else if (e.type === "jammer") perEnemy *= SQUAD_JAMMER_DAMAGE_MUL;
        chip += perEnemy * dt;
      }
      // Nearby jammer enemies suppress squad action even outside contact range.
      if (e.type === "jammer" && d2 <= SQUAD_JAMMER_ENEMY_RADIUS * SQUAD_JAMMER_ENEMY_RADIUS) {
        nearbyJammerEnemy = true;
      }
      // Phantoms apply soft anti-drone pressure when adjacent (light damage).
      if (e.type === "phantom" && d2 <= SQUAD_PHANTOM_RADIUS * SQUAD_PHANTOM_RADIUS) {
        nearbyPhantom = true;
      }
    }
    // Lift jammer flag from enemy proximity too (resists make this less brutal).
    if (nearbyJammerEnemy) s.jammed = true;
    if (nearbyPhantom) chip += 2 * dt; // small phantom proximity drain
    if (chip > 0) {
      const resist = Math.min(0.9, this.game.core.upgrades.squadJammerResistance ?? 0);
      // Jammer resistance also slightly tanks contact damage as a comprehensive
      // squad-survivability stat. We cap so it can't make squads invulnerable.
      s.health -= chip * (1 - resist * 0.5);
    }
  }

  private contributeReveal(s: Squad): void {
    // Mark the squad's vicinity as discovered for any nearby strategic point
    // so the player gets passive reveal even without a Recon squad. Recon
    // just covers more ground per second.
    const sps = this.game.strategicPoints;
    if (!sps) return;
    const revealMul = this.game.core.upgrades.squadReconRevealMul ?? 1;
    let radius = s.def.revealRadius * 0.7;
    if (s.type === "recon") radius *= revealMul;
    if (s.jammed) radius *= SQUAD_JAMMER_REVEAL_PENALTY;
    const r2 = radius * radius;
    for (const p of sps.list) {
      if (p.discovered) continue;
      if (p.state === "destroyed" || p.state === "depleted") continue;
      const dx = p.pos.x - s.pos.x;
      const dy = p.pos.y - s.pos.y;
      if (dx * dx + dy * dy <= r2) {
        p.discovered = true;
        this.game.bus.emit("strategic:discovered", { id: p.id, type: p.type });
      }
    }
  }

  /**
   * Public per-squad reveal radius used by the renderer's darkness pass.
   * Returns 0 for an inactive squad. Strike/Recon contribute the most.
   */
  squadRevealRadius(s: Squad): number {
    if (!s.active) return 0;
    let r = s.def.revealRadius;
    if (s.type === "recon") r *= this.game.core.upgrades.squadReconRevealMul ?? 1;
    if (s.jammed) r *= SQUAD_JAMMER_REVEAL_PENALTY;
    return r;
  }

  /** Public per-squad cap used by the HUD. */
  globalSlotsLeft(): number {
    return Math.max(0, this.globalCap() - this.list.length);
  }

  // ──────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────
  private expireSquad(s: Squad): void {
    s.state = "expired";
    s.active = false;
    this.game.particles.spawnRing(s.pos.x, s.pos.y, 22, s.def.color, 0.4);
    this.game.particles.spawnFloatingText(s.pos.x, s.pos.y - 22, "SQUAD EXPIRED", s.def.color, 0.9, 10);
    this.game.bus.emit("squad:expired", { type: s.type, id: s.id });
  }

  private destroySquad(s: Squad): void {
    const wasEvacuating = s.evacuating;
    s.state = "destroyed";
    s.active = false;
    this.game.particles.spawnRing(s.pos.x, s.pos.y, 36, "#ff5252", 0.5);
    this.game.particles.spawnBurst(s.pos.x, s.pos.y, s.def.color, 14, {
      speed: 160,
      life: 0.5,
      size: 2.2,
    });
    if (wasEvacuating) {
      this.game.particles.spawnFloatingText(s.pos.x, s.pos.y - 28, "EVAC FAILED", "#ff5252", 1.4, 12);
    } else {
      this.game.particles.spawnFloatingText(s.pos.x, s.pos.y - 28, "SQUAD LOST", "#ff5252", 1.3, 12);
    }
    this.game.audio.sfxSquadLost();
    this.game.bus.emit("squad:destroyed", { type: s.type, id: s.id, evacuating: wasEvacuating });
  }

  /** Sanity utility for input/HUD modules. */
  static cellToWorld(c: number, r: number): Vector2 {
    return new Vector2(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2);
  }
}
