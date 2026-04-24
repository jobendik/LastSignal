import type { Game } from "../core/Game";
import { Enemy, type DamageSource } from "../entities/Enemy";
import type { EnemyType } from "../core/Types";
import { Vector2 } from "../core/Vector2";
import { rnd } from "../core/Random";
import { enemyDefinitions } from "../data/enemies";

/** Enemy update, damage routing, boss phases, heal/phase/spawn behavior. */
export class EnemySystem {
  list: Enemy[] = [];

  constructor(private readonly game: Game) {}

  reset(): void {
    this.list.length = 0;
  }

  spawn(type: EnemyType, x: number, y: number, hpScale = 1): Enemy {
    const def = enemyDefinitions[type];
    const diffMul = this.game.difficulty.hpScale(Boolean(def.isBoss), Boolean(def.elite));
    const enemy = new Enemy(type, x, y, def.hp * hpScale * diffMul);
    enemy.baseSpeed = def.speed * this.game.difficulty.speedScale();
    enemy.phaseVisibilityBonus = this.game.core.upgrades.phantomVisibleBonus;
    this.list.push(enemy);
    this.game.codex.onEncounter(type);
    if (enemy.isBoss || def.elite) {
      this.game.audio.sfxBossAlert();
      this.game.bus.emit("boss:spawned", enemy);
    }
    return enemy;
  }

  update(dt: number): void {
    // Codex alert timers.
    this.game.codex.update(dt);

    for (const e of this.list) {
      if (!e.active) continue;
      e.timer += dt;
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);

      // Phase toggling.
      if (e.ability === "phase") {
        e.isPhased = !e.visible;
      }

      // Slow/stun decay.
      if (e.slowTimer > 0) {
        e.slowTimer -= dt;
        if (e.slowTimer <= 0) {
          e.slowStrength = 0.5;
        }
      }
      if (e.stunTimer > 0) e.stunTimer -= dt;

      // Burn DoT.
      if (e.burnTimer > 0) {
        e.burnTimer -= dt;
        const tickDamage = e.burnDps * dt * this.game.core.upgrades.burnDamageMul;
        this.damage(e, tickDamage, { type: "other" });
        if (Math.random() < 0.2) {
          this.game.particles.spawnBurst(e.pos.x, e.pos.y, "#ff7043", 1, {
            speed: 40,
            life: 0.25,
            size: 2,
          });
        }
      }

      // Weaver heal pulse.
      if (e.ability === "heal") {
        e.healCooldown -= dt;
        if (e.healCooldown <= 0) {
          e.healCooldown = 1.35;
          this.doHeal(e);
        }
      }

      // Sapper proximity detonation.
      if (e.ability === "explode") {
        this.updateSapper(e);
      }

      // Corruptor aura: slows nearby tower fire rate (stored as per-tower debuff).
      if (e.ability === "corrupt") {
        e.corruptRadius = 96 + Math.sin(e.timer * 2) * 6;
      }

      // Boss phase mechanics.
      if (e.isBoss) {
        this.updateBossPhase(e, dt);
      }

      // Movement.
      const spd = e.currentSpeed;
      if (spd > 0) {
        const dir = this.game.grid.getVector(e.pos.x, e.pos.y);
        e.faceX = dir.x;
        e.faceY = dir.y;
        // Small wobble for visual variety (not used for phased or boss to keep them readable).
        if (!e.isBoss) {
          const wob = new Vector2(Math.cos(e.timer * 5) * 6, Math.sin(e.timer * 4) * 6);
          e.pos.x += (dir.x * spd + wob.x * dt) * dt;
          e.pos.y += (dir.y * spd + wob.y * dt) * dt;
        } else {
          e.pos.x += dir.x * spd * dt;
          e.pos.y += dir.y * spd * dt;
        }
      }

      // Check breach (near the core).
      const distToCore = e.pos.dist(this.game.grid.corePos);
      if (distToCore < 20) {
        let breach = e.breach;
        // Aegis Pylon reactive armor reduces breach damage.
        if (this.hasNearbyReactiveShield(e)) breach *= 0.5;
        // Guardian drone nearby core absorbs some damage.
        for (const d of this.game.drones.list) {
          if (d.type === "guardian" && d.pos.dist(e.pos) < 50) {
            breach *= 0.7;
            break;
          }
        }
        this.game.damageCore(breach, e.type);
        this.onDeath(e, false);
        continue;
      }
    }

    // Cleanup dead enemies.
    for (const e of this.list) {
      if (!e.active) this.onDeath(e, true);
    }
    this.list = this.list.filter((e) => e.active);
  }

  /** Convenience: returns true if given damage hits from behind the enemy. */
  private isFromBack(e: Enemy, srcX: number, srcY: number): boolean {
    const dx = srcX - e.pos.x;
    const dy = srcY - e.pos.y;
    const dot = dx * e.faceX + dy * e.faceY;
    return dot < -0.1; // source is opposite to facing direction
  }

  damage(
    e: Enemy,
    amount: number,
    src: DamageSource | null,
    opts?: { fromX?: number; fromY?: number; bypassShield?: boolean }
  ): void {
    if (!e.active) return;
    if (e.isPhased && e.ability === "phase") {
      return;
    }
    // Vulnerability multiplier: from stasis "vulnerabilityPulse" global.
    const up = this.game.core.upgrades;
    const slowedMul = e.slowTimer > 0 ? up.slowedEnemyDamageMul : 1;
    // Marked damage multiplier.
    const markedMul = e.signalMarked ? up.markedDamageMul : 1;
    // First-hit bonus.
    const firstHitMul = !e.hitOnce ? up.firstHitDamageMul : 1;
    // Shielded enemy bonus.
    const shieldedMul = e.type === "shielded" ? up.shieldedBonusDamageMul : 1;

    let final = amount * slowedMul * markedMul * firstHitMul * shieldedMul;

    const fromBack = opts?.fromX != null && opts?.fromY != null
      ? this.isFromBack(e, opts.fromX, opts.fromY)
      : false;

    e.damage(final, src, opts?.bypassShield ?? false, fromBack);

    if (this.game.core.settings.showDamageNumbers && final >= 1) {
      this.game.particles.spawnFloatingText(
        e.pos.x,
        e.pos.y - e.size - 4,
        Math.round(final),
        "#ffffff",
        0.6,
        11
      );
    }

    if (src?.type === "tower") {
      this.game.stats.recordDamage(src.towerType, final);
    }
  }

  private doHeal(weaver: Enemy): void {
    let healed = 0;
    for (const other of this.list) {
      if (other === weaver || !other.active) continue;
      if (other.pos.dist(weaver.pos) < 80) {
        const amt = 3;
        other.hp = Math.min(other.maxHp, other.hp + amt);
        healed++;
        this.game.particles.spawnFloatingText(other.pos.x, other.pos.y - 12, `+${amt}`, "#ff80ab", 0.6, 11);
      }
    }
    if (healed > 0) {
      this.game.particles.spawnRing(weaver.pos.x, weaver.pos.y, 80, "#ff80ab");
    }
  }

  private updateSapper(e: Enemy): void {
    // Detonate when close to any tower.
    const radius = e.def.explodeRadius ?? 48;
    let nearest = null;
    let nd = Infinity;
    for (const t of this.game.towers.list) {
      const d = t.pos.dist(e.pos);
      if (d < nd) { nd = d; nearest = t; }
    }
    // Reflect field: Aegis pylon nearby defuses sappers.
    for (const t of this.game.towers.list) {
      if (t.type === "shield" && t.flags.reflectField && t.pos.dist(e.pos) < (t.def.auraRadius ?? 128)) {
        this.game.particles.spawnRing(e.pos.x, e.pos.y, radius, "#80d8ff");
        e.applyStun(0.6);
        this.damage(e, e.hp + 10, { type: "other" }, { bypassShield: true });
        this.game.audio.sfxShieldUp();
        return;
      }
    }
    if (nearest && nd < radius * 0.6) {
      this.detonateSapper(e, nearest);
    }
  }

  private detonateSapper(e: Enemy, nearTower: { pos: Vector2 } | null): void {
    if (e.exploded) return;
    e.exploded = true;
    const radius = e.def.explodeRadius ?? 56;
    this.game.particles.spawnRing(e.pos.x, e.pos.y, radius, "#ff6d00");
    this.game.particles.spawnBurst(e.pos.x, e.pos.y, "#ff6d00", 20, { speed: 240, life: 0.6, size: 3 });
    this.game.audio.sfxSapperExplode();
    this.game.core.shake = Math.min(18, this.game.core.shake + 6);
    // Disable the nearest tower briefly and deal shake damage to nearby towers.
    if (nearTower) {
      const t = this.game.towers.list.find((tt) => tt.pos === nearTower.pos) ?? null;
      if (t) this.game.towers.disableTower(t, e.def.explodeTowerDamage ?? 2);
    }
    this.damage(e, e.hp + 10, { type: "other" }, { bypassShield: true });
  }

  private updateBossPhase(boss: Enemy, dt: number): void {
    const pct = boss.hp / boss.maxHp;
    boss.bossPhaseTimer -= dt;

    // Phase transitions: 1 -> 2 at 70%, 2 -> 3 at 40%, 3 -> 4 at 15%.
    let desired = 1;
    if (pct <= 0.15) desired = 4;
    else if (pct <= 0.4) desired = 3;
    else if (pct <= 0.7) desired = 2;

    if (desired !== boss.bossPhase) {
      boss.bossPhase = desired;
      boss.bossPhaseTimer = 0;
      this.onBossPhaseEnter(boss, desired);
    }

    // Per-phase passive behavior.
    if (boss.bossPhase === 2 && boss.bossPhaseTimer <= 0) {
      // Summon 2 scouts every ~5s.
      boss.bossPhaseTimer = 5;
      this.summonFromSides(boss, "scout", 2);
    }
    if (boss.bossPhase === 3 && boss.bossPhaseTimer <= 0) {
      // Disable nearest tower for 3s.
      boss.bossPhaseTimer = 7;
      this.disableNearestTower(boss, 3);
    }
    if (boss.bossPhase === 4) {
      // Final rush: speed up and emit corruption pulses.
      boss.speedMul = 1.8;
      boss.bossRushing = true;
      if (boss.bossPhaseTimer <= 0) {
        boss.bossPhaseTimer = 2.5;
        this.corruptionPulse(boss);
      }
    }
  }

  private onBossPhaseEnter(boss: Enemy, phase: number): void {
    const msgs: Record<number, string> = {
      2: "BOSS PHASE 2: SUMMONING ESCORT",
      3: "BOSS PHASE 3: TOWER DISRUPTION",
      4: "BOSS PHASE 4: FINAL RUSH",
    };
    const m = msgs[phase];
    if (m) {
      this.game.bus.emit("boss:phase", { phase, text: m });
      this.game.particles.spawnFloatingText(boss.pos.x, boss.pos.y - 34, m, "#ff5252", 2.5, 14);
      this.game.audio.sfxBossAlert();
    }
  }

  private summonFromSides(boss: Enemy, type: EnemyType, count: number): void {
    for (let i = 0; i < count; i++) {
      const spawner = this.game.grid.spawners[i % this.game.grid.spawners.length];
      if (!spawner) continue;
      const x = spawner.c * 32 + 16;
      const y = spawner.r * 32 + 16;
      this.spawn(type, x, y);
    }
    this.game.particles.spawnRing(boss.pos.x, boss.pos.y, 40, "#ff5252");
  }

  private disableNearestTower(boss: Enemy, duration: number): void {
    let nearest = null;
    let best = Infinity;
    for (const t of this.game.towers.list) {
      const d = t.pos.dist(boss.pos);
      if (d < best) { best = d; nearest = t; }
    }
    if (nearest) {
      this.game.towers.disableTower(nearest, duration);
      this.game.particles.spawnLightning([
        { x: boss.pos.x, y: boss.pos.y },
        { x: nearest.pos.x, y: nearest.pos.y },
      ], "#ff5252");
    }
  }

  private corruptionPulse(boss: Enemy): void {
    this.game.particles.spawnRing(boss.pos.x, boss.pos.y, 140, "#b71c1c");
    this.game.damageCore(1, boss.type);
  }

  private hasNearbyReactiveShield(e: Enemy): boolean {
    for (const t of this.game.towers.list) {
      if (t.type !== "shield") continue;
      if (!t.flags.reactiveArmor) continue;
      if (t.pos.dist(e.pos) < (t.def.auraRadius ?? 128)) return true;
    }
    return false;
  }

  private onDeath(e: Enemy, killed: boolean): void {
    // killed = HP reached 0 from damage. Otherwise it was a breach.
    if (killed) {
      // Reward credits.
      let reward = e.reward * this.game.difficulty.rewardScale();
      // Overkill salvage bonus.
      reward *= 1 + this.game.core.upgrades.overkillCreditsMul;
      const rounded = Math.max(0, Math.round(reward));
      this.game.addCredits(rounded);
      this.game.particles.spawnFloatingText(e.pos.x, e.pos.y - 12, `+${rounded}`, "#ffeb3b", 0.9, 12);
      this.game.stats.recordKill(e.type);
      this.game.bus.emit("enemy:killed", e);
      this.game.audio.sfxDeath();

      // Death burst.
      this.game.particles.spawnBurst(e.pos.x, e.pos.y, e.color, e.isBoss ? 40 : 8, {
        speed: e.isBoss ? 260 : 140,
        life: e.isBoss ? 1.2 : 0.6,
        size: e.isBoss ? 4 : 2.5,
      });

      // Carrier death: spawn scouts.
      if (e.ability === "spawn") {
        for (let i = 0; i < 3; i++) {
          const ang = rnd(0, Math.PI * 2);
          const x = e.pos.x + Math.cos(ang) * 12;
          const y = e.pos.y + Math.sin(ang) * 12;
          this.spawn("scout", x, y);
        }
      }

      // Corruptor death spawns swarmlings.
      if (e.ability === "corrupt") {
        for (let i = 0; i < 2; i++) {
          const ang = rnd(0, Math.PI * 2);
          const x = e.pos.x + Math.cos(ang) * 10;
          const y = e.pos.y + Math.sin(ang) * 10;
          this.spawn("swarmling", x, y);
        }
      }

      // Boss death: slow-mo + big ring.
      if (e.isBoss || e.def.elite) {
        this.game.core.slowMo = 1.5;
        this.game.particles.spawnRing(e.pos.x, e.pos.y, 160, "#ff5252");
        if (e.isBoss) this.game.bus.emit("boss:killed");
      }

      // Sapper on-death doesn't explode (detonation is proximity-triggered).
    }
  }
}
