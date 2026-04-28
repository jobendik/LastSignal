import type { Game } from "../core/Game";
import { el, clear } from "./dom";

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
    const content = () => {
      this.el.append(
        el("div", { class: "ls-overlay-title ls-gameover-title", text: "CORE OFFLINE" }),
        el("div", { class: "ls-overlay-subtitle", text: "The signal has been lost." }),
        el("div", { class: "ls-run-grade", text: `GRADE ${runGrade(this.game)}` }),
        el("div", { class: "ls-stats", html: statsSummary(this.game) }),
      );
      const row = el("div", { class: "ls-overlay-actions" });
      const retry = el("button", { class: "ls-btn ls-btn-primary", text: "Retry Sector" });
      retry.onclick = () => {
        const s = this.game.core.sector;
        if (s) this.game.beginSector(s);
      };
      const menu = el("button", { class: "ls-btn", text: "Main Menu" });
      menu.onclick = () => this.game.returnToMenu();
      row.append(retry, menu);
      this.el.append(row);
    };

    if (this.game.core.settings.reducedMotion) {
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
    const row = el("div", { class: "ls-overlay-actions" });
    const again = el("button", { class: "ls-btn ls-btn-primary", text: "New Run" });
    again.onclick = () => this.game.setState("SECTOR_SELECT");
    const menu = el("button", { class: "ls-btn", text: "Main Menu" });
    menu.onclick = () => this.game.returnToMenu();
    row.append(again, menu);
    content.append(row);
    this.el.append(content);
  }
}
