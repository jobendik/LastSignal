import type { Game } from "../core/Game";
import { el, clear } from "./dom";
import { sectorObjectives } from "../data/objectives";

function runGrade(g: Game): string {
  const s = g.core.stats;
  const corePct = g.core.coreIntegrity / Math.max(1, g.core.coreMax);
  const killScore = Math.min(40, s.enemiesKilled * 0.18);
  const efficiency = s.creditsEarned > 0
    ? Math.max(0, Math.min(25, 25 - ((s.creditsSpent / s.creditsEarned) - 0.8) * 25))
    : 10;
  const survival = Math.max(0, Math.min(35, corePct * 35));
  const total = killScore + efficiency + survival;
  if (total >= 90) return "S";
  if (total >= 78) return "A";
  if (total >= 64) return "B";
  if (total >= 50) return "C";
  return "D";
}

function objectivesSummary(g: Game, runWon: boolean): HTMLElement | null {
  const sectorId = g.core.sector?.id;
  if (!sectorId) return null;
  const obj = sectorObjectives[sectorId];
  if (!obj) return null;
  const primary = g.objectives.evaluate(obj.primary, g.objectives.snapshot(), runWon);
  const secs = g.objectives.evaluateSecondaries(runWon);
  const wrap = el("div", { class: "ls-stats" });
  wrap.append(el("div", { class: "ls-obj-title", text: "OBJECTIVES" }));
  const prim = el("div", { class: `ls-obj-row primary ${primary.completed ? "ok" : "fail"}` });
  prim.append(
    el("span", { class: "ls-obj-marker", text: primary.completed ? "✓" : "✗" }),
    el("span", { class: "ls-obj-text", text: obj.primary.label })
  );
  if (primary.progressText) prim.append(el("span", { class: "ls-obj-progress", text: primary.progressText }));
  wrap.append(prim);

  for (const s of secs) {
    const row = el("div", { class: `ls-obj-row secondary ${s.completed ? "ok" : "fail"}` });
    row.append(
      el("span", { class: "ls-obj-marker", text: s.completed ? "✓" : "○" }),
      el("span", { class: "ls-obj-text", text: s.def.label })
    );
    if (s.progressText) row.append(el("span", { class: "ls-obj-progress", text: s.progressText }));
    if (s.completed && s.def.rewardResearch) {
      row.append(el("span", { class: "ls-obj-reward", text: `+${s.def.rewardResearch}RP` }));
    }
    wrap.append(row);
  }
  return wrap;
}

function statsSummary(g: Game): string {
  const s = g.core.stats;
  const p = g.core.profile;
  const sector = g.core.sector;
  const rows: string[] = [];

  // High score comparison.
  const currentWave = g.core.waveIndex;
  const bestWave = p.bestWaveReached;
  if (bestWave > 0 && currentWave > 0) {
    const diff = currentWave - bestWave;
    const cmp = diff > 0
      ? `<span style="color:#66bb6a">▲ +${diff} above personal best</span>`
      : diff < 0
      ? `<span style="color:#ef9a9a">▼ ${Math.abs(diff)} below personal best (${bestWave})</span>`
      : `<span style="color:#ffb300">= Personal best</span>`;
    rows.push(`Wave reached: <b>${currentWave}</b> ${cmp}`);
  } else {
    rows.push(`Wave reached: <b>${currentWave}</b>`);
  }
  if (sector) rows.push(`Core remaining: <b>${Math.round(g.core.coreIntegrity / g.core.coreMax * 100)}%</b>`);

  rows.push(`Enemies destroyed: <b>${s.enemiesKilled}</b>`);
  rows.push(`Credits earned: <b>${s.creditsEarned}</b>`);
  rows.push(`Credits spent: <b>${s.creditsSpent}</b>`);
  rows.push(`Core damage taken: <b>${Math.round(s.coreDamageTaken)}</b>`);
  if (s.bestTowerType) {
    rows.push(`Best tower: <b>${s.bestTowerType.toUpperCase()} L${s.bestTowerLevel}</b>`);
  }
  const topKills = Object.entries(s.killsByEnemyType)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
  if (topKills) rows.push(`Top targets: ${topKills}`);
  rows.push(`Run grade: <b>${runGrade(g)}</b>`);

  const towerKillEntries = Object.entries(s.killsByTowerType)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  if (towerKillEntries.length > 0) {
    const towerBreakdown = towerKillEntries
      .slice(0, 4)
      .map(([k, v]) => `<span class="ls-stat-tower-kill">${k.toUpperCase()} <b>${v}</b></span>`)
      .join(" ");
    rows.push(`Kills by tower: ${towerBreakdown}`);
  }

  return rows.map((r) => `<div>${r}</div>`).join("");
}

/** Canvas-based pixelation disintegration drawn on top of the game canvas. */
function runDisintegration(canvas: HTMLCanvasElement, onDone: () => void): void {
  const overlay = document.createElement("canvas");
  overlay.width = canvas.width;
  overlay.height = canvas.height;
  overlay.style.cssText = `
    position:absolute; inset:0; pointer-events:none;
    z-index:99; width:100%; height:100%;
  `;
  canvas.parentElement?.appendChild(overlay);
  const ctx = overlay.getContext("2d")!;

  // Capture current frame.
  ctx.drawImage(canvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let blockSize = 2;
  let frame = 0;
  const totalFrames = 38;

  const tick = () => {
    frame++;
    const progress = frame / totalFrames;
    blockSize = 2 + Math.floor(progress * progress * 28);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw pixelated blocks from original image.
    for (let y = 0; y < canvas.height; y += blockSize) {
      for (let x = 0; x < canvas.width; x += blockSize) {
        // Skip some blocks for dissolution effect.
        if (Math.random() < progress * 0.65) continue;
        const px = (Math.floor(y / blockSize) * blockSize * canvas.width + Math.floor(x / blockSize) * blockSize) * 4;
        const r = imageData.data[px] ?? 0;
        const g = imageData.data[px + 1] ?? 0;
        const b = imageData.data[px + 2] ?? 0;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, blockSize, blockSize);
      }
    }

    // Add red scan-line wash as progress increases.
    ctx.fillStyle = `rgba(180, 0, 0, ${progress * 0.55})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Horizontal glitch bars.
    if (Math.random() < progress * 0.7) {
      const glitchY = Math.floor(Math.random() * canvas.height);
      const glitchH = 2 + Math.floor(Math.random() * 8);
      const glitchShift = (Math.random() - 0.5) * 30 * progress;
      ctx.drawImage(canvas, 0, glitchY, canvas.width, glitchH,
        glitchShift, glitchY, canvas.width, glitchH);
    }

    if (frame < totalFrames) {
      requestAnimationFrame(tick);
    } else {
      overlay.remove();
      onDone();
    }
  };

  requestAnimationFrame(tick);
}

export class GameOverScreen {
  el: HTMLElement;
  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-overlay ls-gameover" });
  }
  refresh(): void {
    clear(this.el);
    const isTraining = this.game.core.sector?.isTraining === true;
    const content = () => {
      const title = isTraining ? "DRILL FAILED" : "CORE OFFLINE";
      const subtitle = isTraining
        ? "Don't worry — training is meant to be retried. Hit Replay Training to try again."
        : "The signal has been lost.";
      this.el.append(
        el("div", { class: "ls-overlay-title ls-gameover-title", text: title }),
        el("div", { class: "ls-overlay-subtitle", text: subtitle }),
      );
      // Training run skips the run grade — it doesn't reward "performance",
      // only completion of the drills.
      if (!isTraining) {
        this.el.append(el("div", { class: "ls-run-grade", text: `GRADE ${runGrade(this.game)}` }));
      }
      this.el.append(el("div", { class: "ls-stats", html: statsSummary(this.game) }));
      const objs = objectivesSummary(this.game, false);
      if (objs) this.el.append(objs);
      const row = el("div", { class: "ls-overlay-actions" });
      const retry = el("button", {
        class: "ls-btn ls-btn-primary",
        text: isTraining ? "Replay Training" : "Retry Sector",
      });
      retry.onclick = () => {
        const s = this.game.core.sector;
        if (s) this.game.beginSector(s);
      };
      const menu = el("button", { class: "ls-btn", text: "Main Menu" });
      menu.onclick = () => this.game.returnToMenu();
      row.append(retry, menu);
      // Rewarded-ad opt-in: visible only when the CrazyGames SDK has loaded
      // successfully. Outside CrazyGames the button never appears, keeping
      // the screen clean for itch.io / direct hosting.
      if (!isTraining && this.game.ads.isAvailable) {
        const adBtn = el("button", {
          class: "ls-btn ls-btn-ad",
          text: "▶ Watch Ad: +2 Research",
        }) as HTMLButtonElement;
        adBtn.onclick = async () => {
          adBtn.disabled = true;
          const { rewarded } = await this.game.ads.showRewarded();
          if (rewarded) {
            this.game.meta.addResearchPoints(2);
            adBtn.textContent = "✓ Research awarded";
          } else {
            adBtn.disabled = false;
          }
        };
        row.append(adBtn);
      }
      this.el.append(row);
    };

    if (this.game.core.settings.reducedMotion || isTraining) {
      // Skip the destructive disintegration FX in training so a failed drill
      // feels like a coachable moment, not a Game Over cinematic.
      content();
      return;
    }

    // Briefly hide the overlay while the disintegration plays, then reveal.
    this.el.style.opacity = "0";
    runDisintegration(this.game.canvas, () => {
      content();
      this.el.style.opacity = "";
      this.el.classList.add("ls-gameover-enter");
    });
  }
}

export class VictoryScreen {
  el: HTMLElement;
  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-overlay ls-victory" });
  }
  refresh(): void {
    clear(this.el);

    // Training run shows a different completion screen — friendlier copy,
    // a "Training Complete" badge, and a stage-by-stage breakdown.
    if (this.game.core.sector?.isTraining) {
      this.renderTrainingComplete();
      return;
    }

    // Final campaign sector cleared → render the full "Signal Dies Forever"
    // ending sequence instead of the standard victory screen. We detect this
    // by the active sector id and the player's *new* best-cleared counter
    // having just ticked up to (or past) the last campaign index.
    const isFinalSector = this.game.core.sector?.id === "sector_07_blackout_array";
    if (isFinalSector) {
      this.renderCampaignComplete();
      return;
    }

    // Ripple rings element (CSS-animated).
    if (!this.game.core.settings.reducedMotion) {
      const ripples = el("div", { class: "ls-victory-ripples" });
      for (let i = 0; i < 3; i++) {
        const ring = el("div", { class: "ls-victory-ring" });
        ring.style.animationDelay = `${i * 0.4}s`;
        ripples.append(ring);
      }
      this.el.append(ripples);
    }

    const content = el("div", { class: "ls-victory-content" });
    content.append(
      el("div", { class: "ls-overlay-title", text: "SIGNAL HELD" }),
      el("div", { class: "ls-overlay-subtitle", text: "The Leviathan is destroyed. The relay endures." }),
      el("div", { class: "ls-run-grade", text: `GRADE ${runGrade(this.game)}` }),
      el("div", { class: "ls-stats", html: statsSummary(this.game) }),
    );
    const objs = objectivesSummary(this.game, true);
    if (objs) content.append(objs);
    // Sector unlock callout — show next sector if newly unlocked.
    const justUnlocked = this.game.core.profile.bestSectorCleared;
    if (justUnlocked >= 1 && justUnlocked < 4) {
      content.append(
        el("div", {
          class: "ls-victory-unlock",
          text: `Sector ${justUnlocked + 1} unlocked.`,
        })
      );
    } else if (justUnlocked >= 4) {
      content.append(
        el("div", {
          class: "ls-victory-unlock",
          text: "Campaign complete. Endless / Void available via Research.",
        })
      );
    }
    const row = el("div", { class: "ls-overlay-actions" });
    const again = el("button", { class: "ls-btn ls-btn-primary", text: "New Run" });
    again.onclick = () => this.game.setState("SECTOR_SELECT");
    const menu = el("button", { class: "ls-btn", text: "Main Menu" });
    menu.onclick = () => this.game.returnToMenu();
    row.append(again, menu);
    // Rewarded-ad opt-in (campaign victory only; campaign-complete and
    // training have their own renderers).
    if (this.game.ads.isAvailable) {
      const adBtn = el("button", {
        class: "ls-btn ls-btn-ad",
        text: "▶ Watch Ad: +2 Research",
      }) as HTMLButtonElement;
      adBtn.onclick = async () => {
        adBtn.disabled = true;
        const { rewarded } = await this.game.ads.showRewarded();
        if (rewarded) {
          this.game.meta.addResearchPoints(2);
          adBtn.textContent = "✓ Research awarded";
        } else {
          adBtn.disabled = false;
        }
      };
      row.append(adBtn);
    }
    content.append(row);
    this.el.append(content);
  }

  /**
   * Final-campaign-cleared ending: shown after Sector 7 (Blackout Array)
   * victory. Plays a scrolling transmission, then the standard stats summary
   * with a "CAMPAIGN COMPLETE" badge. Always available afterwards (the player
   * can re-clear S7 and see it again).
   */
  private renderCampaignComplete(): void {
    const g = this.game;

    // Outer container.
    const content = el("div", { class: "ls-victory-content ls-campaign-complete" });

    // Ripple rings — same as the regular victory, but red-shifted.
    if (!g.core.settings.reducedMotion) {
      const ripples = el("div", { class: "ls-victory-ripples ls-final-ripples" });
      for (let i = 0; i < 4; i++) {
        const ring = el("div", { class: "ls-victory-ring ls-final-ring" });
        ring.style.animationDelay = `${i * 0.35}s`;
        ripples.append(ring);
      }
      this.el.append(ripples);
    }

    // Eyebrow + title.
    content.append(
      el("div", { class: "ls-training-complete-eyebrow", text: "CAMPAIGN COMPLETE" }),
      el("div", { class: "ls-overlay-title", text: "THE SIGNAL DIES" }),
      el("div", {
        class: "ls-overlay-subtitle",
        text: "The Blackout Array is silent. The entity's broadcast tower has gone dark forever.",
      }),
      el("div", { class: "ls-run-grade", text: `GRADE ${runGrade(g)}` }),
    );

    // Transmission / finale text. Reads like a recovered log fragment.
    const transmission = el("div", { class: "ls-campaign-transmission" });
    const lines: string[] = [
      "[FINAL TRANSMISSION — ARCHIVED]",
      "",
      "Seven sectors. Seven cores held.",
      "The entity's relay network is dismantled. Its carrier wave collapses into noise.",
      "",
      "No more pulses through the dark.",
      "No more rifts opening behind the line.",
      "No more waves rolling out of the static.",
      "",
      "The signal is yours, Operator.",
      "",
      "[ARCHIVE END · RETURN TO COMMAND]",
    ];
    transmission.innerHTML = lines.map((line) => `<div>${line || "&nbsp;"}</div>`).join("");
    content.append(transmission);

    // Full stats summary (same renderer as regular victory).
    content.append(el("div", { class: "ls-stats", html: statsSummary(g) }));
    const objs = objectivesSummary(g, true);
    if (objs) content.append(objs);

    // Post-campaign hooks: Void mode and Endless are the replayable endgame.
    const hasEndless = g.core.profile.researchUnlocked.includes("unlock_endless");
    const hooks = el("div", { class: "ls-campaign-hooks" });
    hooks.innerHTML =
      `<div class="ls-campaign-hook-title">WHAT'S NEXT</div>` +
      `<div>· Replay any sector with new run modifiers and curses.</div>` +
      `<div>· Tackle <b>Void Sector</b> — a hand-authored 15-wave remix featuring all three bosses.</div>` +
      (hasEndless
        ? `<div>· <b>Endless Mode</b> is unlocked on cleared sectors via Research.</div>`
        : `<div>· Unlock <b>Endless Mode</b> in the Research Array for infinite scaling waves.</div>`);
    content.append(hooks);

    // Actions.
    const row = el("div", { class: "ls-overlay-actions" });
    const again = el("button", { class: "ls-btn ls-btn-primary", text: "Sector Select" });
    again.onclick = () => g.setState("SECTOR_SELECT");
    const menu = el("button", { class: "ls-btn", text: "Main Menu" });
    menu.onclick = () => g.returnToMenu();
    row.append(again, menu);
    content.append(row);
    this.el.append(content);
  }

  private renderTrainingComplete(): void {
    const g = this.game;
    const obj = g.objectives.currentSectorObjectives;
    const snap = g.objectives.snapshot();
    const secs = obj
      ? obj.secondary.map((s) => g.objectives.evaluate(s, snap, true))
      : [];
    const cleared = secs.filter((s) => s.completed).length;
    const total = secs.length;

    const content = el("div", { class: "ls-victory-content ls-training-complete" });
    content.append(
      el("div", { class: "ls-training-complete-eyebrow", text: "TRAINING COMPLETE" }),
      el("div", { class: "ls-overlay-title", text: "Operator Certified" }),
      el("div", {
        class: "ls-overlay-subtitle",
        text:
          "Drills cleared. You now have the basics for tower placement, relay expansion, capture, command squads, repair, and hostile-structure suppression.",
      })
    );

    // Stages cleared block.
    const stageBlock = el("div", { class: "ls-stats" });
    stageBlock.append(
      el("div", { class: "ls-obj-title", text: `STAGES CLEARED · ${cleared} / ${total}` })
    );
    for (const s of secs) {
      const row = el("div", { class: `ls-obj-row secondary ${s.completed ? "ok" : "fail"}` });
      row.append(
        el("span", { class: "ls-obj-marker", text: s.completed ? "✓" : "○" }),
        el("span", { class: "ls-obj-text", text: s.def.label })
      );
      if (s.progressText) {
        row.append(el("span", { class: "ls-obj-progress", text: s.progressText }));
      }
      stageBlock.append(row);
    }
    content.append(stageBlock);

    // Run-level summary stats — mirror the campaign one but smaller.
    const trainingStats = el("div", { class: "ls-stats" });
    const stats = g.core.stats;
    const towersBuilt = Object.values(snap.towersBuiltByType).reduce((s, v) => s + (v ?? 0), 0);
    const squadsDeployed = Object.values(snap.squadDeployedByType).reduce((s, v) => s + (v ?? 0), 0);
    trainingStats.innerHTML =
      `<div>Towers built: <b>${towersBuilt}</b></div>` +
      `<div>Relays deployed: <b>${snap.relaysDeployed}</b></div>` +
      `<div>Strategic points captured: <b>${Object.values(snap.strategicCapturedByType).reduce((s, v) => s + (v ?? 0), 0)}</b></div>` +
      `<div>Hostile structures destroyed: <b>${Object.values(snap.strategicDestroyedByType).reduce((s, v) => s + (v ?? 0), 0)}</b></div>` +
      `<div>Squads deployed: <b>${squadsDeployed}</b></div>` +
      `<div>Towers repaired: <b>${snap.towersRepairedThisRun}</b></div>` +
      `<div>Enemies destroyed: <b>${stats.enemiesKilled}</b></div>` +
      `<div>Final wave: <b>${snap.waveReached}</b></div>`;
    content.append(trainingStats);

    // Encouragement / next-step callout.
    const next = el("div", {
      class: "ls-victory-unlock",
      text: "You're ready for Sector 1. Open the Field Manual (H) any time for reference.",
    });
    content.append(next);

    const row = el("div", { class: "ls-overlay-actions" });
    const again = el("button", { class: "ls-btn ls-btn-primary", text: "Start Sector 1" });
    again.onclick = () => g.setState("SECTOR_SELECT");
    const replay = el("button", { class: "ls-btn", text: "Replay Training" });
    replay.onclick = () => {
      const s = g.core.sector;
      if (s) g.beginSector(s);
    };
    const menu = el("button", { class: "ls-btn", text: "Main Menu" });
    menu.onclick = () => g.returnToMenu();
    row.append(again, replay, menu);
    content.append(row);
    this.el.append(content);
  }
}
