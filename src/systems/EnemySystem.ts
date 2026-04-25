import type { Game } from "../core/Game";
import { Enemy, type DamageSource } from "../entities/Enemy";
import type { EnemyType } from "../core/Types";
import { Vector2 } from "../core/Vector2";
import { rnd } from "../core/Random";
import { enemyDefinitions } from "../data/enemies";
import { VIEW_WIDTH, VIEW_HEIGHT } from "../core/Config";

/** Enemy update, damage routing, boss phases, heal/phase/spawn behavior. */
export class EnemySystem {
  list: Enemy[] = [];
  private killTimestamps: number[] = [];
  private lastKillStreakAnnounced = 0;

  constructor(private readonly game: Game) {}

  reset(): void {
    this.list.length = 0;
    this.killTimestamps.length = 0;
    this.lastKillStreakAnnounced = 0;
  }

  spawn(type: EnemyType, x: number, y: number, hpScale = 1): Enemy {
    const def = enemyDefinitions[type];
    const diff = this.game.difficulty.def;
    const endless = this.game.endless;
    const endlessHp = endless.active ? endless.hpScale : 1;
    const endlessSpeed = endless.active ? endless.speedScale : 1;

    // Collect run modifier multipliers.
    let modHpMul = 1;
    let modSpeedMul = 1;
    let modArmorAdd = 0;
    for (const m of this.game.core.activeModifiers) {
      if (m.enemyHpMul) modHpMul *= m.enemyHpMul;
      if (m.enemySpeedMul) modSpeedMul *= m.enemySpeedMul;
      if (m.enemyArmorAdd) modArmorAdd += m.enemyArmorAdd;
    }

    const finalHp = def.hp * hpScale * diff.enemyHpMul * endlessHp * modHpMul;
    const enemy = new Enemy(type, x, y, finalHp);
    enemy.baseSpeed = def.speed * diff.enemySpeedMul * endlessSpeed * modSpeedMul;
    enemy.extraArmor = modArmorAdd;
    enemy.phaseVisibilityBonus = this.game.core.upgrades.phantomVisibleBonus;
    this.list.push(enemy);
    this.game.codex.onEncounter(type);

    // Elite variant: 6% chance on non-boss enemies at wave 5+, 150% HP.
    if (!enemy.isBoss && this.game.core.waveIndex >= 4 && Math.random() < 0.06) {
      enemy.isElite = true;
      enemy.hp = enemy.hp * 1.5;
      enemy.maxHp = enemy.hp;
    }

    // Flanking scouts: from wave 5 onward, ~30% of scouts deviate laterally.
    if (type === "scout" && this.game.core.waveIndex >= 4 && Math.random() < 0.3) {
      enemy.flankDir = Math.random() < 0.5 ? 1 : -1;
    }

    if (enemy.isBoss) {
      enemy.bossEntranceTimer = enemy.bossEntranceMax;
      this.game.audio.sfxBossAlert(enemy.pos);
      this.game.audio.setMusicIntensity(2);
      this.game.bus.emit("boss:spawned", enemy);
      // Dramatic boss arrival FX.
      this.game.particles.spawnScreenFlash("#ff1a00", 0.5, 0.7);
      this.game.core.shake = Math.max(this.game.core.shake, 22);
      this.game.core.shakeRot = Math.max(this.game.core.shakeRot, 0.06);
      this.game.core.slowMo = Math.max(this.game.core.slowMo, 0.45);
      this.game.particles.spawnRing(x, y, 90, "#ff1a00");
      this.game.particles.spawnFloatingText(x, y - 54, "LEVIATHAN DETECTED", "#ff1a00", 3.2, 16);
    } else {
      this.game.audio.sfxEnemyArrival(type, enemy.pos);
    }
    return enemy;
  }

  update(dt: number): void {
    // Codex alert timers.
    this.game.codex.update(dt);

    // Precompute modifier heal rate once per frame.
    const modHealPerSec = this.game.core.activeModifiers.reduce(
      (sum, m) => sum + (m.enemyHealPerSec ?? 0), 0
    );

    for (const e of this.list) {
      if (!e.active) continue;
      e.timer += dt;
      if (e.freezeFxTimer > 0) e.freezeFxTimer = Math.max(0, e.freezeFxTimer - dt);
      if (e.spawnFxTimer > 0) e.spawnFxTimer = Math.max(0, e.spawnFxTimer - dt);

      // Boss entrance: freeze movement until the portal animation finishes.
      if (e.isBoss && e.bossEntranceTimer > 0) {
        e.bossEntranceTimer = Math.max(0, e.bossEntranceTimer - dt);
        continue;
      }

      // Modifier: haunted signal — enemies regenerate HP each frame.
      if (modHealPerSec > 0 && !e.isBoss) {
        e.hp = Math.min(e.maxHp, e.hp + modHealPerSec * dt);
      }

      // Saboteur cooldown decay.
      if (e.type === "saboteur" && e.saboteurCooldown > 0) {
        e.saboteurCooldown = Math.max(0, e.saboteurCooldown - dt);
      }

      // Tunneler: dive/surface cycle.
      if (e.ability === "tunnel") {
        this.updateTunneler(e, dt);
      }

      // Phase toggling.
      if (e.ability === "phase") {
        const nextPhased = !e.visible;
        if (nextPhased !== e.isPhased) this.game.audio.sfxEnemyAbility("phase", e.pos);
        e.isPhased = nextPhased;
      }

      // Slow/stun decay.
      if (e.slowTimer > 0) {
        e.slowTimer -= dt;
        if (e.slowTimer <= 0) {
          e.slowStrength = 0.5;
        }
      }
      if (e.stunTimer > 0) e.stunTimer -= dt;
      if (e.singularityTimer > 0) {
        const dx = e.singularityX - e.pos.x;
        const dy = e.singularityY - e.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 4) {
          const pullRamp = Math.max(0.2, e.singularityTimer / Math.max(0.1, e.singularityMax));
          const pull = (e.isBoss ? 90 : 360) * pullRamp;
          e.knockbackVel = e.knockbackVel.add(new Vector2(dx / dist, dy / dist).mult(pull * dt));
          e.vel = e.vel.mult(e.isBoss ? 0.98 : 0.94);
        }
        e.singularityTimer = Math.max(0, e.singularityTimer - dt);
      }

      // Weaver heal pulse.
      if (e.ability === "heal") {
        e.healCooldown -= dt;
        if (e.healCooldown <= 0) {
          e.healCooldown = 1.35;
          this.doHeal(e);
        }
      }

      // Boss phase mechanics.
      if (e.isBoss) {
        this.updateBossPhase(e, dt);
      }

      // Movement.
      const spd = e.currentSpeed;
      if (spd > 0) {
        let dir = this.game.grid.getVector(e.pos.x, e.pos.y);
        // Flanking scouts: add a lateral perpendicular component so they diverge from the main lane.
        if (e.flankDir !== 0) {
          const perpX = -dir.y * e.flankDir;
          const perpY = dir.x * e.flankDir;
          const blended = new Vector2(dir.x + perpX * 0.55, dir.y + perpY * 0.55);
          const m = Math.hypot(blended.x, blended.y);
          dir = m > 0 ? new Vector2(blended.x / m, blended.y / m) : dir;
        }
        let desired = dir.mult(spd);
        // Small wobble for visual variety (not used for phased or boss to keep them readable).
        if (!e.isBoss) {
          const wob = new Vector2(Math.cos(e.timer * 5) * 6, Math.sin(e.timer * 4) * 6);
          desired = desired.add(wob.mult(dt));
          desired = desired.add(this.separate(e).mult(95));
        }
        // Swarm boid flocking: cohesion toward nearby swarm center of mass.
        if (e.type === "swarm") {
          desired = desired.add(this.swarmCohesion(e).mult(18));
        }
        e.vel = Vector2.lerp(e.vel, desired, Math.min(1, dt * 5.5));
      } else {
        e.vel = e.vel.mult(Math.max(0, 1 - dt * 7));
      }

      e.pos.x += (e.vel.x + e.knockbackVel.x) * dt;
      e.pos.y += (e.vel.y + e.knockbackVel.y) * dt;
      e.knockbackVel = e.knockbackVel.mult(Math.max(0, 1 - dt * 6));
      if (e.knockbackVel.magSq() < 4) e.knockbackVel.set(0, 0);

      // Saboteur: disable nearest in-range tower when passing by.
      if (e.type === "saboteur" && e.saboteurCooldown <= 0) {
        this.updateSaboteur(e);
      }

      // Check breach (near the core).
      const distToCore = e.pos.dist(this.game.grid.corePos);
      if (distToCore < 20) {
        if (e.type === "cache") {
          // Data Cache just escapes — no core damage, no reward.
          e.breached = true;
          e.active = false;
        } else {
          this.game.damageCore(e.breach, e.type, e.pos.x, e.pos.y);
          e.breached = true;
          e.active = false;
          // Breach impact FX: enemy color burst converging into core + warning flash.
          const cx = this.game.grid.corePos.x;
          const cy = this.game.grid.corePos.y;
          this.game.particles.spawnBurst(cx, cy, e.color, 10, { speed: 90, life: 0.45, size: 2.2 });
          this.game.particles.spawnRing(cx, cy, 44, e.color, 0.45);
          if (e.breach >= 2) {
            this.game.particles.spawnRing(cx, cy, 70, e.color, 0.6);
          }
          this.game.particles.spawnFloatingText(cx, cy - 28, `-${e.breach} BREACH`, "#ef9a9a", 1.0, 13);
        }
        continue;
      }
    }

    // Cleanup dead enemies.
    for (const e of this.list) {
      if (!e.active) this.onDeath(e, !e.breached);
    }
    this.list = this.list.filter((e) => e.active);
  }

  damage(e: Enemy, amount: number, src: DamageSource | null): void {
    if (!e.active) return;
    if (e.isPhased && e.ability === "phase") {
      // Show PHASED indicator on attempted hit.
      if (this.game.core.settings.showDamageNumbers) {
        this.game.particles.spawnFloatingText(e.pos.x, e.pos.y - e.size - 4, "PHASED", "#9c27b0", 0.7, 10);
      }
      return;
    }
    // Vulnerability multiplier: from stasis "vulnerabilityPulse" global.
    const slowedMul = e.slowTimer > 0 ? this.game.core.upgrades.slowedEnemyDamageMul : 1;
    const prevHp = e.hp;
    const dealt = e.damage(amount * slowedMul, src);

    // Hit-stop: freeze simulation for ~4 frames on kills that deal ≥35% max HP.
    const killed = prevHp > 0 && e.hp <= 0;
    if (killed && !e.isBoss && dealt >= e.maxHp * 0.35) {
      this.game.core.hitStopTimer = Math.max(this.game.core.hitStopTimer, 0.07);
    }

    if (this.game.core.settings.showDamageNumbers && amount >= 1) {
      const finalAmt = Math.round(dealt);
      // Tier by damage relative to enemy max HP.
      const pct = dealt / e.maxHp;
      let color: string;
      let size: number;
      let life: number;
      if (e.isBoss && pct > 0.03) {
        // Boss crits: large red numbers.
        color = "#ff5252"; size = 18; life = 0.9;
      } else if (pct > 0.12 || finalAmt > 40) {
        // Heavy hit: orange.
        color = "#ff9800"; size = 15; life = 0.75;
      } else if (pct > 0.05 || finalAmt > 15) {
        // Medium hit: yellow.
        color = "#ffeb3b"; size = 12; life = 0.65;
      } else {
        // Small hit: white.
        color = "#ffffff"; size = 10; life = 0.55;
      }
      this.game.particles.spawnFloatingText(e.pos.x, e.pos.y - e.size - 4, finalAmt, color, life, size);
    }

    if (dealt >= 1) {
      const angle = src?.type === "tower" && src.tower
        ? Math.atan2(e.pos.y - src.tower.pos.y, e.pos.x - src.tower.pos.x)
        : rnd(0, Math.PI * 2);
      const color = src?.type === "tower" && src.tower ? src.tower.def.color : e.color;
      const intensity = Math.max(0.6, Math.min(1.8, (dealt / e.maxHp) * 10));
      this.game.particles.spawnImpactBurst(e.pos.x, e.pos.y, angle, color, intensity);
      if (src?.type === "tower" && src.tower && src.towerType === "railgun") {
        this.knockback(e, src.tower.pos.x, src.tower.pos.y, 190);
      } else if (dealt > e.maxHp * 0.18 && src?.type === "tower" && src.tower) {
        this.knockback(e, src.tower.pos.x, src.tower.pos.y, 95);
      }
    }

    if (src?.type === "tower") {
      this.game.stats.recordDamage(src.towerType, dealt);
      if (src.tower) src.tower.totalDamage += dealt;
    }
  }

  private updateTunneler(e: Enemy, dt: number): void {
    e.tunnelTimer += dt;
    if (e.isTunneling) {
      e.tunnelTransitionProg = Math.min(1, e.tunnelTransitionProg + dt * 5);
      if (e.tunnelTimer >= 1.5) {
        e.isTunneling = false;
        e.tunnelTimer = 0;
        e.tunnelInterval = 3.5 + Math.random() * 2;
        e.speedMul = 1;
        this.game.particles.spawnBurst(e.pos.x, e.pos.y, "#8d6e63", 12, { speed: 85, life: 0.45, size: 2 });
      }
    } else {
      e.tunnelTransitionProg = Math.max(0, e.tunnelTransitionProg - dt * 5);
      if (e.tunnelTimer >= e.tunnelInterval) {
        e.isTunneling = true;
        e.tunnelTimer = 0;
        e.speedMul = 3;
        this.game.particles.spawnBurst(e.pos.x, e.pos.y, "#8d6e63", 8, { speed: 55, life: 0.3, size: 1.5 });
      }
    }
  }

  private updateSaboteur(e: Enemy): void {
    const RANGE = 38;
    let nearest = null;
    let best = Infinity;
    for (const t of this.game.towers.list) {
      const d = t.pos.dist(e.pos);
      if (d < RANGE && d < best) { best = d; nearest = t; }
    }
    if (!nearest) return;
    this.game.towers.disableTower(nearest, 3);
    e.saboteurCooldown = 8;
    this.game.particles.spawnBurst(nearest.pos.x, nearest.pos.y, "#ff6f00", 10, { speed: 65, life: 0.4, size: 2 });
    this.game.particles.spawnFloatingText(nearest.pos.x, nearest.pos.y - 16, "DISABLED", "#ff6f00", 1.0, 11);
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
      this.game.audio.sfxEnemyAbility("heal", weaver.pos);
    }
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
    const phaseData: Record<number, { text: string; color: string; flashColor: string }> = {
      2: { text: "PHASE II — ESCORT SUMMONED", color: "#ff9800", flashColor: "#ff9800" },
      3: { text: "PHASE III — SYSTEMS DISRUPTED", color: "#ab47bc", flashColor: "#ce93d8" },
      4: { text: "PHASE IV — FINAL RUSH", color: "#ff1744", flashColor: "#ffffff" },
    };
    const pd = phaseData[phase];
    if (!pd) return;

    this.game.bus.emit("boss:phase", { phase, text: pd.text });

    // Big floating phase alert above boss.
    this.game.particles.spawnFloatingText(boss.pos.x, boss.pos.y - 50, pd.text, pd.color, 3.0, 15);

    // Screen flash colored to phase.
    this.game.particles.spawnScreenFlash(pd.flashColor, 0.35, 0.7);

    // Slow-mo dip.
    this.game.core.slowMoScale = Math.min(this.game.core.slowMoScale, 0.18);
    this.game.core.slowMo = Math.max(this.game.core.slowMo, 0.65);

    // Shake.
    if (this.game.core.settings.screenShake) {
      this.game.core.shake = Math.max(this.game.core.shake, 16);
      this.game.core.shakeRot = Math.max(this.game.core.shakeRot, 0.055);
    }

    // Telegraph rings: 3 expanding rings in phase color, staggered.
    const r = boss.size * 1.8;
    this.game.particles.spawnRing(boss.pos.x, boss.pos.y, r, pd.color);
    this.game.particles.spawnRing(boss.pos.x, boss.pos.y, r * 1.7, pd.color);
    this.game.particles.spawnRing(boss.pos.x, boss.pos.y, r * 2.5, "#ffffff");

    // Radial particle burst in phase color.
    this.game.particles.spawnBurst(boss.pos.x, boss.pos.y, pd.color, 28, { speed: 220, life: 0.8, size: 3 });

    this.game.audio.sfxBossAlert(boss.pos);
  }

  knockback(e: Enemy, fromX: number, fromY: number, speed: number): void {
    if (!e.active || e.isBoss) return;
    const dir = e.pos.sub(new Vector2(fromX, fromY)).normalize();
    e.knockbackVel = e.knockbackVel.add(dir.mult(speed));
  }

  private separate(e: Enemy): Vector2 {
    let steer = new Vector2();
    let count = 0;
    const desired = e.size * 2.1;
    for (const other of this.list) {
      if (other === e || !other.active) continue;
      const dist = e.pos.dist(other.pos);
      if (dist > 0 && dist < desired) {
        steer = steer.add(e.pos.sub(other.pos).normalize().mult((desired - dist) / desired));
        count++;
      }
    }
    return count > 0 ? steer.mult(1 / count) : steer;
  }

  private swarmCohesion(e: Enemy): Vector2 {
    const RADIUS = 55;
    let cx = 0, cy = 0, count = 0;
    for (const other of this.list) {
      if (other === e || !other.active || other.type !== "swarm") continue;
      const d = e.pos.dist(other.pos);
      if (d > 0 && d < RADIUS) { cx += other.pos.x; cy += other.pos.y; count++; }
    }
    if (count === 0) return new Vector2();
    cx /= count; cy /= count;
    return new Vector2(cx - e.pos.x, cy - e.pos.y).normalize();
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
    // Pushes a pulse outward that damages nothing but visually warns; costs 1 core integrity.
    this.game.particles.spawnRing(boss.pos.x, boss.pos.y, 140, "#b71c1c");
    this.game.damageCore(1, boss.type);
  }

  private onDeath(e: Enemy, killed: boolean): void {
    // killed = HP reached 0 from damage. Otherwise it was a breach.
    if (killed) {
      // Reward credits (boosted by enemyRewardMul modifiers).
      let rewardMul = 1;
      for (const m of this.game.core.activeModifiers) {
        if (m.enemyRewardMul) rewardMul *= m.enemyRewardMul;
      }
      const reward = Math.round(e.reward * rewardMul);
      this.game.addCredits(reward);
      this.game.particles.spawnFloatingText(e.pos.x, e.pos.y - 12, `+${reward}`, "#ffeb3b", 0.9, 12);
      const killSource = e.lastDamageSource?.type === "tower" ? e.lastDamageSource.towerType : undefined;
      this.game.stats.recordKill(e.type, killSource);
      this.game.waves.recordKill(e.type);
      if (e.lastDamageSource?.type === "tower" && e.lastDamageSource.tower) {
        e.lastDamageSource.tower.kills++;
      }
      this.game.audio.sfxEnemyDeath(e.type, e.pos);
      this.checkKillStreak(e.isBoss);

      // Death burst — body-color particles + expanding ring.
      const isBoss = e.isBoss;
      this.game.particles.spawnBurst(e.pos.x, e.pos.y, e.color, isBoss ? 40 : 16, {
        speed: isBoss ? 260 : 165,
        life: isBoss ? 1.2 : 0.7,
        size: isBoss ? 4 : 2.5,
      });
      this.game.particles.spawnRing(e.pos.x, e.pos.y, isBoss ? 80 : e.size * 2.2, e.color, isBoss ? 0.45 : 0.3);
      if (e.isElite) {
        this.game.particles.spawnRing(e.pos.x, e.pos.y, e.size * 3.5, "#ffd600", 0.35);
      }

      // Carrier death: spawn scouts + fear response (nearby scouts scatter briefly).
      if (e.ability === "spawn" && e.type === "carrier") {
        this.game.audio.sfxEnemyAbility("spawn", e.pos);
        this.game.particles.spawnRing(e.pos.x, e.pos.y, 58, "#ff8a65", 0.26);
        for (let i = 0; i < 3; i++) {
          const ang = rnd(0, Math.PI * 2);
          const x = e.pos.x + Math.cos(ang) * 12;
          const y = e.pos.y + Math.sin(ang) * 12;
          const scout = this.spawn("scout", x, y);
          scout.spawnFxTimer = scout.spawnFxMax;
          this.game.particles.spawnInwardBurst(x, y, scout.color, 10, 22);
        }
        // Fear response: nearby scouts scatter for ~1.2s before resuming.
        for (const other of this.list) {
          if (!other.active || other.type !== "scout") continue;
          if (other.pos.dist(e.pos) < 130) {
            const ang = Math.atan2(other.pos.y - e.pos.y, other.pos.x - e.pos.x) + rnd(-0.8, 0.8);
            other.knockbackVel.x += Math.cos(ang) * 160;
            other.knockbackVel.y += Math.sin(ang) * 160;
            other.stunTimer = Math.max(other.stunTimer, 1.2);
          }
        }
      }

      // Carrier/Splitter: generic spawn ability.
      if (e.ability === "spawn" && e.type === "splitter") {
        this.game.audio.sfxEnemyAbility("spawn", e.pos);
        this.game.particles.spawnRing(e.pos.x, e.pos.y, 58, "#ff8a65", 0.26);
        for (let i = 0; i < 3; i++) {
          const ang = rnd(0, Math.PI * 2);
          const x = e.pos.x + Math.cos(ang) * 12;
          const y = e.pos.y + Math.sin(ang) * 12;
          const scout = this.spawn("scout", x, y);
          scout.spawnFxTimer = scout.spawnFxMax;
          this.game.particles.spawnInwardBurst(x, y, scout.color, 10, 22);
        }
      }

      // Boss death: kill-cam slow-mo + big concentric rings.
      if (e.isBoss) {
        this.game.core.slowMoScale = 0.12;
        this.game.core.slowMo = 2.2;
        // Bass drop: 1-frame pure black punch before white flash.
        if (!this.game.core.settings.reducedFlashing) {
          this.game.particles.spawnScreenFlash("#000000", 0.9, 0.055);
        }
        this.game.particles.spawnScreenFlash("#ffffff", 0.7, 0.5);
        this.game.particles.spawnRing(e.pos.x, e.pos.y, 80,  "#ff5252");
        this.game.particles.spawnRing(e.pos.x, e.pos.y, 160, "#ffffff");
        this.game.particles.spawnRing(e.pos.x, e.pos.y, 240, "#ff5252");
        this.game.particles.spawnFloatingText(e.pos.x, e.pos.y - 50, "SIGNAL ELIMINATED", "#ffffff", 3.0, 20);
        this.game.audio.setMusicIntensity(1);
        this.game.bus.emit("boss:killed");
      }

      this.game.bus.emit("enemy:killed", {
        type: e.type,
        towerType: e.lastDamageSource?.type === "tower" ? e.lastDamageSource.towerType : e.lastDamageSource?.type ?? "unknown",
        damage: Math.round(e.damageTakenThisWave),
        isBoss: e.isBoss,
      });
    } else {
      this.game.particles.spawnBurst(e.pos.x, e.pos.y, "#ff5252", 6, { speed: 90, life: 0.35, size: 2 });
      this.game.bus.emit("enemy:breached", { type: e.type });
    }
  }

  private checkKillStreak(isBossKill: boolean): void {
    const now = this.game.time.elapsed;
    const windowSeconds = 2;
    this.killTimestamps.push(now);

    while (
      this.killTimestamps.length > 0 &&
      now - this.killTimestamps[0]! > windowSeconds
    ) {
      this.killTimestamps.shift();
    }

    const streak = this.killTimestamps.length;
    if (streak < 5) {
      this.lastKillStreakAnnounced = 0;
      return;
    }

    const shouldAnnounce =
      this.lastKillStreakAnnounced < 5 ||
      streak - this.lastKillStreakAnnounced >= 3 ||
      isBossKill;

    if (!shouldAnnounce) return;
    this.lastKillStreakAnnounced = streak;

    const cx = VIEW_WIDTH / 2;
    const cy = VIEW_HEIGHT / 2;
    const color = streak >= 8 ? "#ff5252" : "#ffeb3b";
    this.game.particles.spawnFloatingText(
      cx,
      cy - 26,
      `CHAIN KILL ×${streak}`,
      color,
      1.2,
      streak >= 8 ? 22 : 18
    );
    this.game.particles.spawnRing(cx, cy, streak >= 8 ? 180 : 130, color);
    this.game.particles.spawnBurst(cx, cy, color, streak >= 8 ? 28 : 18, {
      speed: streak >= 8 ? 220 : 160,
      life: 0.45,
      size: streak >= 8 ? 3 : 2,
    });
    this.game.bus.emit("kill:streak", { streak });

    if (this.game.core.settings.screenShake) {
      this.game.core.shake = Math.min(14, this.game.core.shake + (streak >= 8 ? 5 : 3));
      this.game.core.shakeRot = Math.min(0.035, this.game.core.shakeRot + 0.012);
    }
  }
}
