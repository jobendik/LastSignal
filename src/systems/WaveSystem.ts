import type { Game } from "../core/Game";
import type { WaveDefinition, EnemyType, SpawnerDefinition } from "../core/Types";
import { EARLY_START_BONUS, COLS, ROWS, TILE_SIZE } from "../core/Config";

interface PendingGroup {
  type: EnemyType;
  remaining: number;
  interval: number;
  timer: number;
  spawner: SpawnerDefinition;
  startDelay: number;
}

/** Wave spawn orchestration. Lanes run in parallel; each lane queues its enemies. */
export class WaveSystem {
  private pending: PendingGroup[] = [];
  private allSpawned = false;
  /** Seconds of tower silence remaining at wave start. */
  silenceTimer = 0;
  private activeWaveTotals: Partial<Record<EnemyType, number>> = {};
  private activeWaveKills: Partial<Record<EnemyType, number>> = {};
  private waveStartCoreDamageTaken = 0;
  private dataCacheTriggered = false;
  private escalationTriggered = false;
  private ambushTriggered = false;
  private chokepointHeat = new Float32Array(COLS * ROWS);
  private chokepointTriggered = false;
  private chokepointSampleTimer = 0;

  constructor(private readonly game: Game) {}

  reset(): void {
    this.pending.length = 0;
    this.allSpawned = false;
    this.silenceTimer = 0;
    this.activeWaveTotals = {};
    this.activeWaveKills = {};
    this.waveStartCoreDamageTaken = 0;
    this.dataCacheTriggered = false;
    this.escalationTriggered = false;
    this.chokepointHeat.fill(0);
    this.chokepointTriggered = false;
    this.chokepointSampleTimer = 0;
    this.planningCountdown = 0;
    this.endlessCurrent = null;
  }

  /** Called by Game when entering PLANNING. Starts an auto-start countdown. */
  beginPlanningCountdown(): void {
    this.planningCountdown = this.planningDuration;
  }

  /** Remembered endless wave so HUD/codex have a stable reference. */
  private endlessCurrent: WaveDefinition | null = null;

  /** Planning-phase countdown (seconds) until auto-start. 0 disables auto-start. */
  planningCountdown = 0;
  readonly planningDuration = 20;

  get currentWaveDef(): WaveDefinition | null {
    const sector = this.game.core.sector;
    if (!sector) return null;
    if (this.game.endless.active && this.game.core.waveIndex >= sector.waves.length) {
      return this.endlessCurrent;
    }
    return sector.waves[this.game.core.waveIndex] ?? null;
  }

  get nextWaveDef(): WaveDefinition | null {
    return this.currentWaveDef;
  }

  get hasMoreWaves(): boolean {
    const sector = this.game.core.sector;
    if (!sector) return false;
    if (this.game.endless.active) return true;
    return this.game.core.waveIndex < sector.waves.length;
  }

  get totalWaves(): number {
    if (this.game.endless.active) {
      // Cosmetic: extend the displayed total by current endless progression.
      return (this.game.core.sector?.waves.length ?? 0) + this.game.endless.wave + 1;
    }
    return this.game.core.sector?.waves.length ?? 0;
  }

  get allEnemiesSpawned(): boolean {
    return this.allSpawned;
  }

  startWave(early = false): void {
    // Generate the next endless wave on demand so it's ready to read.
    if (
      this.game.endless.active &&
      this.game.core.sector &&
      this.game.core.waveIndex >= this.game.core.sector.waves.length
    ) {
      this.endlessCurrent = this.game.endless.generateWave();
    }
    const wave = this.currentWaveDef;
    if (!wave) return;

    // Early-start bonus credits.
    if (early) {
      this.game.addCredits(EARLY_START_BONUS);
      this.game.particles.spawnFloatingText(
        this.game.grid.corePos.x,
        this.game.grid.corePos.y - 24,
        `+${EARLY_START_BONUS}`,
        "#ffeb3b"
      );
    }

    // Clear per-wave state.
    this.game.core.killZone = null;
    this.game.core.killZoneMode = false;

    // Build pending groups.
    this.pending = [];
    this.activeWaveTotals = {};
    this.activeWaveKills = {};
    this.dataCacheTriggered = false;
    this.escalationTriggered = false;
    this.ambushTriggered = false;
    this.chokepointHeat.fill(0);
    this.chokepointTriggered = false;
    this.chokepointSampleTimer = 0;
    for (const lane of wave.lanes) {
      const spawner = this.game.grid.spawners.find((s) => s.id === lane.spawnerId) ?? this.game.grid.spawners[0];
      if (!spawner) continue;
      let timerOffset = lane.startDelay ?? 0;
      for (const g of lane.enemies) {
        this.activeWaveTotals[g.type] = (this.activeWaveTotals[g.type] ?? 0) + g.count;
        this.pending.push({
          type: g.type,
          remaining: g.count,
          interval: g.interval,
          timer: timerOffset, // seconds until first spawn
          spawner,
          startDelay: timerOffset,
        });
        // Stagger subsequent groups so they don't overlap unless interval is intentionally short.
        timerOffset += g.count * g.interval;
      }
    }
    this.allSpawned = false;
    this.waveStartCoreDamageTaken = this.game.core.stats.coreDamageTaken;

    // Reset per-wave abilities.
    if (this.game.core.upgrades.tacticalPause) this.game.core.tacticalPauseCharges = 1;
    this.game.setState("WAVE_ACTIVE");
    this.game.audio.sfxWaveStart();
    this.game.bus.emit("wave:started", wave);

    if (wave.waveEvent === "blitz") {
      this.triggerBlitzWave(wave);
    } else if (wave.waveEvent === "silence") {
      this.triggerSilenceWave();
    }
  }

  isWaveFinished(): boolean {
    return this.allSpawned && this.pending.length === 0;
  }

  onWaveComplete(): void {
    const wave = this.currentWaveDef;
    if (!wave) return;

    this.game.addCredits(wave.rewardCredits);
    this.game.economy.onWaveComplete();
    this.checkMilestones();
    this.game.setState("WAVE_COMPLETE");
    this.game.audio.sfxReward();
    this.game.bus.emit("wave:complete", wave);
    if (this.game.core.stats.coreDamageTaken === this.waveStartCoreDamageTaken) {
      this.game.bus.emit("wave:perfect", wave);
    }

    // Advance wave index.
    this.game.core.waveIndex++;

    setTimeout(() => {
      if (this.game.state !== "WAVE_COMPLETE") return;
      if (wave.rewardChoice) {
        // Offer upgrade choices (and optionally a curse card from wave 2 onward).
        const choices = this.game.rewards.rollChoices(3);
        this.game.rewards.rollCurseCard();
        if (choices.length > 0) {
          this.game.setState("REWARD_CHOICE");
          return;
        }
      }
      this.goToNextOrVictory();
    }, 700);
  }

  goToNextOrVictory(): void {
    if (!this.hasMoreWaves) {
      this.game.onVictory();
    } else {
      // Endless: update the best-wave tracker for persistence.
      if (this.game.endless.active) {
        const prof = this.game.core.profile;
        prof.endlessBestWave = Math.max(prof.endlessBestWave, this.game.endless.wave);
        this.game.persistence.saveProfile(prof);
      }
      this.game.setState("PLANNING");
    }
  }

  updatePlanningCountdown(dt: number): void {
    if (this.planningCountdown <= 0) return;
    this.planningCountdown = Math.max(0, this.planningCountdown - dt);
    if (this.planningCountdown <= 0 && this.hasMoreWaves) {
      this.startWave(false);
    }
  }

  update(dt: number): void {
    if (this.silenceTimer > 0) this.silenceTimer = Math.max(0, this.silenceTimer - dt);
    if (this.pending.length === 0) {
      // Either all spawned or nothing queued.
      this.allSpawned = true;
      return;
    }
    for (const g of this.pending) {
      g.timer -= dt;
      while (g.timer <= 0 && g.remaining > 0) {
        this.spawnFromGroup(g);
        g.remaining--;
        g.timer += g.interval;
      }
    }
    this.pending = this.pending.filter((g) => g.remaining > 0);
    this.allSpawned = this.pending.length === 0;

    // Chokepoint tracking: sample enemy positions every 0.5s and accumulate tile heat.
    if (!this.chokepointTriggered) {
      this.chokepointSampleTimer += dt;
      if (this.chokepointSampleTimer >= 0.5) {
        this.chokepointSampleTimer = 0;
        for (const e of this.game.enemies.list) {
          if (!e.active) continue;
          const c = Math.floor(e.pos.x / TILE_SIZE);
          const r = Math.floor(e.pos.y / TILE_SIZE);
          if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
            this.chokepointHeat[r * COLS + c] = (this.chokepointHeat[r * COLS + c] ?? 0) + 1;
          }
        }
        // Check if any tile crossed the chokepoint threshold (10 enemy-samples).
        let maxHeat = 0, maxIdx = 0;
        for (let i = 0; i < this.chokepointHeat.length; i++) {
          if ((this.chokepointHeat[i] ?? 0) > maxHeat) {
            maxHeat = this.chokepointHeat[i]!;
            maxIdx = i;
          }
        }
        if (maxHeat >= 10) {
          this.chokepointTriggered = true;
          this.spawnChokepointBonus(maxIdx);
        }
      }
    }
  }

  recordKill(type: EnemyType): void {
    if (this.game.state !== "WAVE_ACTIVE" && this.game.state !== "WAVE_COMPLETE") return;
    this.activeWaveKills[type] = (this.activeWaveKills[type] ?? 0) + 1;

    const totalKills = Object.values(this.activeWaveKills).reduce((s, v) => s + v, 0);
    const totalEnemies = Object.values(this.activeWaveTotals).reduce((s, v) => s + v, 0);

    if (!this.dataCacheTriggered && totalEnemies > 0 && totalKills >= Math.ceil(totalEnemies * 0.5) && Math.random() < 0.42) {
      this.dataCacheTriggered = true;
      this.spawnCache();
    }

    if (!this.escalationTriggered && this.game.core.waveIndex >= 2 && totalEnemies > 0 && totalKills >= Math.ceil(totalEnemies * 0.65)) {
      this.escalationTriggered = true;
      this.spawnEscalation();
    }

    // Ambush: 15% chance at 40% kills from wave 4+ — surprise spawn from a mid-map tile.
    if (!this.ambushTriggered && this.game.core.waveIndex >= 3 && totalEnemies > 0 &&
        totalKills >= Math.ceil(totalEnemies * 0.4) && Math.random() < 0.15) {
      this.ambushTriggered = true;
      this.spawnAmbush();
    }
  }

  private spawnCache(): void {
    const spawner = this.game.grid.spawners[Math.floor(Math.random() * this.game.grid.spawners.length)];
    if (!spawner) return;
    const x = spawner.c * 32 + 16;
    const y = spawner.r * 32 + 16;
    const cache = this.game.enemies.spawn("cache", x, y);
    cache.spawnFxTimer = cache.spawnFxMax;
    this.game.particles.spawnFloatingText(x, y - 30, "DATA CACHE DETECTED!", "#ffd700", 2.5, 14);
    this.game.particles.spawnRing(x, y, 40, "#ffd700");
  }

  private spawnEscalation(): void {
    const wave = this.currentWaveDef;
    if (!wave) return;
    // Pick the most common enemy type from this wave as the reinforcement.
    const comp = this.waveComposition();
    if (comp.length === 0) return;
    const type = comp[0]!.type;
    const count = 2 + Math.floor(this.game.core.waveIndex / 2);
    const spawner = this.game.grid.spawners[Math.floor(Math.random() * this.game.grid.spawners.length)];
    if (!spawner) return;
    for (let i = 0; i < count; i++) {
      const x = spawner.c * 32 + 16 + (Math.random() - 0.5) * 8;
      const y = spawner.r * 32 + 16 + (Math.random() - 0.5) * 8;
      const e = this.game.enemies.spawn(type, x, y);
      e.spawnFxTimer = e.spawnFxMax;
    }
    this.game.particles.spawnFloatingText(
      spawner.c * 32 + 16, spawner.r * 32 - 10,
      "ESCALATION!", "#ff5252", 2.0, 13
    );
    this.game.bus.emit("wave:escalation", { type, count });
  }

  private spawnAmbush(): void {
    // Pick a random walkable mid-map tile (not a spawner tile or core tile).
    const spawnerId = new Set(this.game.grid.spawners.map((s) => this.game.grid.idx(s.c, s.r)));
    const candidates: { c: number; r: number }[] = [];
    for (let attempt = 0; attempt < 120 && candidates.length < 6; attempt++) {
      const c = 4 + Math.floor(Math.random() * (COLS - 8));
      const r = 4 + Math.floor(Math.random() * (ROWS - 8));
      const i = this.game.grid.idx(c, r);
      if (this.game.grid.cells[i] === 0 && !spawnerId.has(i)) {
        candidates.push({ c, r });
      }
    }
    if (candidates.length === 0) return;
    const tile = candidates[Math.floor(Math.random() * candidates.length)]!;
    const px = tile.c * TILE_SIZE + TILE_SIZE / 2;
    const py = tile.r * TILE_SIZE + TILE_SIZE / 2;

    // Spawn 3-5 scouts with a slight stagger.
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const e = this.game.enemies.spawn("scout", px + (Math.random() - 0.5) * 12, py + (Math.random() - 0.5) * 12);
      e.spawnFxTimer = e.spawnFxMax;
    }

    this.game.particles.spawnFloatingText(px, py - 32, "AMBUSH!", "#ff1744", 2.4, 16);
    this.game.particles.spawnRing(px, py, 52, "#ff1744", 0.45);
    this.game.particles.spawnRing(px, py, 28, "#ff1744", 0.3);
    this.game.particles.spawnBurst(px, py, "#ff1744", 12, { speed: 110, life: 0.5, size: 2.5 });
    this.game.core.shake = Math.min(18, this.game.core.shake + 7);
    this.game.bus.emit("wave:ambush", { count });
  }

  private checkMilestones(): void {
    const c = this.game.core;
    const achieved = c.achievedMilestones;
    const coreX = this.game.grid.corePos.x;
    const coreY = this.game.grid.corePos.y;

    const grant = (id: string, label: string, bonusSlot: boolean) => {
      if (achieved.has(id)) return;
      achieved.add(id);
      if (bonusSlot) c.bonusUpgradeCount++;
      const cr = bonusSlot ? 0 : 40;
      if (cr > 0) this.game.addCredits(cr);
      const detail = bonusSlot ? "BONUS UPGRADE UNLOCKED" : `+${cr}CR`;
      this.game.particles.spawnFloatingText(coreX, coreY - 40, `✦ ${label}`, "#ffeb3b", 3.0, 13);
      this.game.particles.spawnFloatingText(coreX, coreY - 24, detail, "#ffffff", 2.5, 11);
      this.game.particles.spawnRing(coreX, coreY, 55, "#ffeb3b", 0.4);
      this.game.bus.emit("wave:milestone" as never, { id, label } as never);
    };

    // "Iron Core": reach wave 5 with core above 85%.
    if (c.waveIndex >= 4 && c.coreIntegrity / c.coreMax >= 0.85) {
      grant("iron_core", "IRON CORE", true);
    }
    // "Veteran": survive 10 waves.
    if (c.waveIndex >= 9) {
      grant("veteran", "VETERAN", true);
    }
    // "Economy Engine": earn 500+ total credits by wave 4.
    if (c.waveIndex >= 3 && c.stats.creditsEarned >= 500) {
      grant("economy_engine", "ECONOMY ENGINE", false);
    }
    // "Destroyer": kill 200+ enemies this run.
    if (c.stats.enemiesKilled >= 200) {
      grant("destroyer", "DESTROYER", false);
    }
    // "Merchant": build 5+ harvesters by wave 8 → +20% permanent income.
    if (c.waveIndex >= 7 && this.game.towers.list.filter((t) => t.isEco).length >= 5) {
      if (!achieved.has("merchant")) {
        achieved.add("merchant");
        this.game.core.upgrades.harvesterIncomeMul *= 1.2;
        this.game.particles.spawnFloatingText(coreX, coreY - 56, "MERCHANT NETWORK", "#00e676", 3.5, 15);
        this.game.particles.spawnFloatingText(coreX, coreY - 38, "+20% HARVESTER INCOME", "#ffffff", 3.0, 11);
        this.game.particles.spawnRing(coreX, coreY, 70, "#00e676", 0.5);
        this.game.particles.spawnRing(coreX, coreY, 45, "#00e676", 0.35);
        this.game.particles.spawnBurst(coreX, coreY, "#00e676", 20, { speed: 140, life: 0.7, size: 3 });
        this.game.bus.emit("wave:milestone" as never, { id: "merchant", label: "MERCHANT NETWORK" } as never);
      }
    }
    // Synergy discoveries: first time specific tower pairs produce >500 combined damage.
    this.checkSynergyDiscoveries(achieved, coreX, coreY);
  }

  private checkSynergyDiscoveries(achieved: Set<string>, coreX: number, coreY: number): void {
    const towers = this.game.towers.list;
    const dmg = this.game.core.stats.damageByTowerType;

    // "Cryo Cascade": Stasis + Tesla — both deal >500 damage this run.
    if (!achieved.has("syn_cryo_cascade")) {
      const stasisDmg = dmg["stasis"] ?? 0;
      const teslaDmg = dmg["tesla"] ?? 0;
      const hasStasis = towers.some((t) => t.type === "stasis");
      const hasTesla = towers.some((t) => t.type === "tesla");
      if (hasStasis && hasTesla && stasisDmg > 500 && teslaDmg > 500) {
        achieved.add("syn_cryo_cascade");
        this.announceDiscovery("CRYO CASCADE", "Stasis + Tesla", "#40c4ff", "#b3e5fc", coreX, coreY);
      }
    }
    // "Fire & Brimstone": Flamer + Mortar — both deal >500 damage this run.
    if (!achieved.has("syn_fire_brimstone")) {
      const flamerDmg = dmg["flamer"] ?? 0;
      const mortarDmg = dmg["mortar"] ?? 0;
      const hasFlamer = towers.some((t) => t.type === "flamer");
      const hasMortar = towers.some((t) => t.type === "mortar");
      if (hasFlamer && hasMortar && flamerDmg > 500 && mortarDmg > 500) {
        achieved.add("syn_fire_brimstone");
        this.announceDiscovery("FIRE & BRIMSTONE", "Flamer + Mortar", "#ff6d00", "#ffe0b2", coreX, coreY);
      }
    }
    // "Signal Storm": Railgun + Tesla — both deal >500 damage this run.
    if (!achieved.has("syn_signal_storm")) {
      const railgunDmg = dmg["railgun"] ?? 0;
      const teslaDmg2 = dmg["tesla"] ?? 0;
      const hasRailgun = towers.some((t) => t.type === "railgun");
      const hasTesla2 = towers.some((t) => t.type === "tesla");
      if (hasRailgun && hasTesla2 && railgunDmg > 500 && teslaDmg2 > 500) {
        achieved.add("syn_signal_storm");
        this.announceDiscovery("SIGNAL STORM", "Railgun + Tesla", "#e040fb", "#f3e5f5", coreX, coreY);
      }
    }
    // "Iron Harvest": Harvester + Barrier — harvester income > 500 total, barrier on field.
    if (!achieved.has("syn_iron_harvest")) {
      const incomeEarned = this.game.core.stats.creditsEarned;
      const hasBarrier = towers.some((t) => t.type === "barrier");
      const hasHarvester = towers.some((t) => t.isEco);
      if (hasBarrier && hasHarvester && incomeEarned > 500) {
        achieved.add("syn_iron_harvest");
        this.announceDiscovery("IRON HARVEST", "Barrier + Harvester", "#ffd740", "#fff8e1", coreX, coreY);
      }
    }
  }

  private announceDiscovery(name: string, pair: string, color: string, textColor: string, coreX: number, coreY: number): void {
    this.game.particles.spawnFloatingText(coreX, coreY - 60, `COMBO DISCOVERED`, textColor, 3.0, 11);
    this.game.particles.spawnFloatingText(coreX, coreY - 44, name, color, 3.5, 15);
    this.game.particles.spawnFloatingText(coreX, coreY - 28, pair, "#ffffff", 2.8, 10);
    this.game.particles.spawnRing(coreX, coreY, 65, color, 0.5);
    this.game.particles.spawnRing(coreX, coreY, 40, color, 0.35);
    this.game.particles.spawnBurst(coreX, coreY, color, 16, { speed: 130, life: 0.7, size: 2.5 });
    this.game.bus.emit("combo:discovered" as never, { name } as never);
  }

  private spawnChokepointBonus(tileIdx: number): void {
    const c = tileIdx % COLS;
    const r = Math.floor(tileIdx / COLS);
    const x = c * TILE_SIZE + TILE_SIZE / 2;
    const y = r * TILE_SIZE + TILE_SIZE / 2;
    const bonus = 25 + Math.floor(this.game.core.waveIndex * 5);
    this.game.addCredits(bonus);
    this.game.particles.spawnFloatingText(x, y - 28, `CHOKEPOINT +${bonus}CR`, "#ffab40", 2.5, 13);
    this.game.particles.spawnRing(x, y, 36, "#ffab40", 0.3);
    this.game.particles.spawnRing(x, y, 52, "#ffab40", 0.18);
  }

  private triggerSilenceWave(): void {
    this.silenceTimer = 5;
    const cx = this.game.grid.corePos.x;
    const cy = this.game.grid.corePos.y;
    this.game.particles.spawnFloatingText(cx, cy - 64, "SILENCE PROTOCOL", "#7c4dff", 3.5, 18);
    this.game.particles.spawnRing(cx, cy, 100, "#7c4dff", 0.6);
    this.game.particles.spawnRing(cx, cy, 60, "#7c4dff", 0.45);
    this.game.bus.emit("wave:silence", { duration: 5 });
  }

  private triggerBlitzWave(wave: WaveDefinition): void {
    let spawned = 0;
    for (const g of this.pending) {
      while (g.remaining > 0) {
        this.spawnFromGroup(g, spawned);
        g.remaining--;
        spawned++;
      }
      this.game.particles.spawnRing(g.spawner.c * TILE_SIZE + TILE_SIZE / 2, g.spawner.r * TILE_SIZE + TILE_SIZE / 2, 48, "#ff5252", 0.32);
    }
    this.pending.length = 0;
    this.allSpawned = true;
    this.game.particles.spawnFloatingText(
      this.game.grid.corePos.x,
      this.game.grid.corePos.y - 56,
      "BLITZ WAVE",
      "#ff5252",
      2.2,
      16
    );
    this.game.particles.spawnRing(this.game.grid.corePos.x, this.game.grid.corePos.y, 120, "#ff5252", 0.42);
    this.game.bus.emit("wave:blitz", { wave, spawned });
  }

  private spawnFromGroup(g: PendingGroup, index = 0): void {
    const x = g.spawner.c * TILE_SIZE + TILE_SIZE / 2 + (Math.random() - 0.5) * 8;
    const y = g.spawner.r * TILE_SIZE + TILE_SIZE / 2 + (Math.random() - 0.5) * 8;
    const e = this.game.enemies.spawn(g.type, x, y);
    if (index > 0) {
      const angle = index * 2.399963229728653;
      const radius = Math.min(18, 3 + Math.sqrt(index) * 2.2);
      e.pos.x += Math.cos(angle) * radius;
      e.pos.y += Math.sin(angle) * radius;
    }
  }

  /** Spawner telegraph signs for RenderSystem: groups about to spawn within 1.5s. */
  get telegraphSigns(): { x: number; y: number; intensity: number }[] {
    const WARN = 1.5;
    const signs: { x: number; y: number; intensity: number }[] = [];
    for (const g of this.pending) {
      if (g.timer > 0 && g.timer <= WARN) {
        signs.push({
          x: g.spawner.c * 32 + 16,
          y: g.spawner.r * 32 + 16,
          intensity: 1 - g.timer / WARN,
        });
      }
    }
    return signs;
  }

  waveComposition(): { type: EnemyType; total: number; killed: number }[] {
    const entries = Object.entries(this.activeWaveTotals) as [EnemyType, number][];
    return entries
      .map(([type, total]) => ({ type, total, killed: Math.min(total, this.activeWaveKills[type] ?? 0) }))
      .sort((a, b) => b.total - a.total);
  }

  estimatedCompletionSeconds(): number | null {
    if (!this.allSpawned || this.game.enemies.list.length === 0) return null;
    let longest = 0;
    for (const e of this.game.enemies.list) {
      if (!e.active) continue;
      const distCells = this.game.grid.getDistAtWorld(e.pos.x, e.pos.y);
      if (!Number.isFinite(distCells) || e.currentSpeed <= 0) continue;
      longest = Math.max(longest, (distCells * 32) / e.currentSpeed);
    }
    return longest > 0 ? longest : null;
  }

  upcomingWaves(count: number): WaveDefinition[] {
    const sector = this.game.core.sector;
    if (!sector) return [];
    return sector.waves.slice(this.game.core.waveIndex, this.game.core.waveIndex + count);
  }
}
