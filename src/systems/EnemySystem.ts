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
    const diff = this.game.difficulty.def;
    const endless = this.game.endless;
    const endlessHp = endless.active ? endless.hpScale : 1;
    const endlessSpeed = endless.active ? endless.speedScale : 1;
    const finalHp = def.hp * hpScale * diff.enemyHpMul * endlessHp;
    const enemy = new Enemy(type, x, y, finalHp);
    enemy.baseSpeed = def.speed * diff.enemySpeedMul * endlessSpeed;
    enemy.phaseVisibilityBonus = this.game.core.upgrades.phantomVisibleBonus;
    this.list.push(enemy);
    this.game.codex.onEncounter(type);
    if (enemy.isBoss) {
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
        const dir = this.game.grid.getVector(e.pos.x, e.pos.y);
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
        this.game.damageCore(e.breach, e.type, e.pos.x, e.pos.y);
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
    e.damage(amount * slowedMul, src);

    if (this.game.core.settings.showDamageNumbers && amount >= 1) {
      const finalAmt = Math.round(amount * slowedMul);
      // Tier by damage relative to enemy max HP.
      const pct = amount / e.maxHp;
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

    if (src?.type === "tower") {
      this.game.stats.recordDamage(src.towerType, amount);
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
    // Pushes a pulse outward that damages nothing but visually warns; costs 1 core integrity.
    this.game.particles.spawnRing(boss.pos.x, boss.pos.y, 140, "#b71c1c");
    this.game.damageCore(1, boss.type);
  }

  private onDeath(e: Enemy, killed: boolean): void {
    // killed = HP reached 0 from damage. Otherwise it was a breach.
    if (killed) {
      // Reward credits.
      this.game.addCredits(e.reward);
      this.game.particles.spawnFloatingText(e.pos.x, e.pos.y - 12, `+${e.reward}`, "#ffeb3b", 0.9, 12);
      this.game.stats.recordKill(e.type);
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

      // Boss death: slow-mo + big ring.
      if (e.isBoss) {
        this.game.core.slowMo = 1.5;
        this.game.particles.spawnRing(e.pos.x, e.pos.y, 160, "#ff5252");
        this.game.bus.emit("boss:killed");
      }

      this.game.bus.emit("enemy:killed", { type: e.type });
    }
  }
}
