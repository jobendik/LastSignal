import type { Game } from "../core/Game";
import type { RunJournalEntry } from "../core/Types";
import { el, clear } from "./dom";

const GLITCH_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^█▓▒░▄▀■□";

function glitchTitle(titleEl: HTMLElement): void {
  const original = titleEl.textContent ?? "";
  let frame = 0;
  const totalFrames = 48;
  const animate = () => {
    frame++;
    const progress = frame / totalFrames;
    const locked = Math.floor(progress * original.length);
    let text = original.slice(0, locked);
    for (let i = locked; i < original.length; i++) {
      if (original[i] === " ") { text += " "; continue; }
      text += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
    }
    titleEl.textContent = text;
    if (frame < totalFrames) requestAnimationFrame(animate);
    else titleEl.textContent = original;
  };
  requestAnimationFrame(animate);
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs.toString().padStart(2, "0")}s` : `${secs}s`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function runEntryCard(entry: RunJournalEntry): HTMLElement {
  const result = entry.result.toUpperCase();
  const tower = entry.bestTowerType ? `${entry.bestTowerType.toUpperCase()} L${entry.bestTowerLevel}` : "NONE";
  const waveLabel = entry.endless
    ? `Wave ${entry.waveReached} / ENDLESS`
    : `Wave ${entry.waveReached} / ${entry.totalWaves}`;
  const card = el("div", { class: `ls-run-entry ${entry.result}` });
  card.append(
    el("div", { class: "ls-run-entry-top" }, [
      el("span", { class: "ls-run-result", text: result }),
      el("span", { class: "ls-run-date", text: formatDate(entry.endedAt) }),
    ]),
    el("div", { class: "ls-run-sector", text: entry.sectorName }),
    el("div", { class: "ls-run-meta", text: `${waveLabel} / Core ${entry.coreRemainingPct}% / ${formatDuration(entry.durationSec)}` }),
    el("div", { class: "ls-run-meta", text: `Kills ${entry.enemiesKilled} / Earned ${entry.creditsEarned} / Best ${tower}` })
  );
  if (entry.modifiers.length > 0) {
    card.append(el("div", { class: "ls-run-mods", text: entry.modifiers.slice(0, 2).join(" / ") }));
  }
  return card;
}

export class MainMenu {
  el: HTMLElement;
  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-panel ls-mainmenu" });
  }
  refresh(): void {
    clear(this.el);
    const p = this.game.core.profile;

    const titleEl = el("div", { class: "ls-title", text: "LAST SIGNAL" });
    this.el.append(
      titleEl,
      el("div", { class: "ls-subtitle", text: "Tactical Sci-Fi Roguelite Tower Defense" }),
      el("div", { class: "ls-profile", html:
        `<div>Best sector cleared: <strong>${p.bestSectorCleared}</strong></div>` +
        `<div>Best wave reached: <strong>${p.bestWaveReached}</strong></div>` +
        `<div>Codex entries: <strong>${p.codexSeen.length}</strong> / 14</div>` +
        `<div>Research points: <strong>${p.researchPoints}</strong></div>` +
        `<div>Endless best wave: <strong>${p.endlessBestWave}</strong></div>` +
        `<div>Recorded runs: <strong>${p.runHistory.length}</strong></div>`,
      }),
    );

    if (p.runHistory.length > 0) {
      const last = p.runHistory[0]!;
      this.el.append(el("div", {
        class: `ls-last-run ${last.result}`,
        text: `LAST RUN: ${last.result.toUpperCase()} / ${last.sectorName} / Wave ${last.waveReached} / Core ${last.coreRemainingPct}%`,
      }));

      const journal = el("div", { class: "ls-run-journal" });
      journal.append(el("div", { class: "ls-run-journal-title", text: "RUN JOURNAL" }));
      const list = el("div", { class: "ls-run-list" });
      for (const entry of p.runHistory.slice(0, 4)) {
        list.append(runEntryCard(entry));
      }
      journal.append(list);
      this.el.append(journal);
    }

    const actions = el("div", { class: "ls-actions" });
    const startBtn = el("button", { class: "ls-btn ls-btn-primary", text: "START MISSION" });
    startBtn.onclick = () => this.game.setState("SECTOR_SELECT");
    actions.append(startBtn);

    const codexBtn = el("button", { class: "ls-btn", text: "CODEX" });
    codexBtn.onclick = () => this.game.ui.openCodex();
    actions.append(codexBtn);

    const researchBtn = el("button", { class: "ls-btn", text: "RESEARCH" });
    researchBtn.onclick = () => this.game.ui.openMeta();
    actions.append(researchBtn);

    const settingsBtn = el("button", { class: "ls-btn", text: "SETTINGS" });
    settingsBtn.onclick = () => this.game.ui.openSettings();
    actions.append(settingsBtn);

    this.el.append(actions);

    this.el.append(el("div", { class: "ls-hint", html:
      "Hotkeys: <span>1-6</span> build, <span>U</span> upgrade, <span>S</span> sell, <span>D</span> drone, <span>K</span> kill zone, <span>T</span> tactical pause, <span>Space</span> start wave / confirm, <span>Tab</span> wave preview, <span>P</span> pause, <span>+/-</span> speed, <span>F1</span> debug." }));

    // Play glitch animation on title (skip if reduce motion is on).
    if (!this.game.core.settings.reducedMotion) {
      window.setTimeout(() => glitchTitle(titleEl), 120);
    }
  }
}
