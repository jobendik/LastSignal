import type { Game } from "../core/Game";
import type { RunJournalEntry } from "../core/Types";
import { achievementDefinitions } from "../data/achievements";
import { el, clear } from "./dom";
import { BOARD_ENDLESS_WAVE } from "../systems/LeaderboardSystem";
import privacyText from "../../PRIVACY.md?raw";
import termsText from "../../TERMS.md?raw";
import thirdPartyText from "../../THIRD_PARTY.md?raw";

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

const LEGAL_TABS: Array<{ label: string; text: string }> = [
  { label: "Privacy Policy", text: privacyText },
  { label: "Terms of Use", text: termsText },
  { label: "Third-Party Licences", text: thirdPartyText },
];

function openLegalModal(root: HTMLElement): void {
  const overlay = el("div", {
    class: "ls-overlay ls-legal-modal visible",
    attrs: {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Legal notices",
    },
  });
  overlay.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  overlay.addEventListener("click", (ev) => ev.stopPropagation());

  const title = el("div", { class: "ls-overlay-title", text: "LEGAL NOTICES" });

  const tabBar = el("div", { class: "ls-legal-tabs" });
  const contentArea = el("pre", { class: "ls-legal-content" });

  let activeIndex = 0;
  const tabBtns: HTMLButtonElement[] = [];

  LEGAL_TABS.forEach(({ label, text }, i) => {
    const btn = el("button", { class: "ls-legal-tab", text: label }) as HTMLButtonElement;
    btn.onclick = () => {
      activeIndex = i;
      tabBtns.forEach((b, j) => b.classList.toggle("active", j === i));
      contentArea.textContent = text;
    };
    tabBtns.push(btn);
    tabBar.append(btn);
  });

  // Activate first tab.
  tabBtns[0].classList.add("active");
  contentArea.textContent = LEGAL_TABS[0].text;

  const closeBtn = el("button", {
    class: "ls-btn",
    text: "CLOSE",
    attrs: { "aria-label": "Close legal notices" },
  }) as HTMLButtonElement;
  const actions = el("div", { class: "ls-overlay-actions" });
  actions.append(closeBtn);
  closeBtn.onclick = () => overlay.remove();

  overlay.append(title, tabBar, contentArea, actions);
  root.append(overlay);
  closeBtn.focus();
}

export class MainMenu {
  el: HTMLElement;
  constructor(private readonly game: Game) {
    this.el = el("div", {
      class: "ls-panel ls-mainmenu",
      attrs: { role: "region", "aria-label": "Main menu" },
    });
  }
  refresh(): void {
    clear(this.el);
    const p = this.game.core.profile;

    const titleEl = el("div", { class: "ls-title", text: "LAST SIGNAL" });
    const synced = this.game.cloudSaves.status === "synced";
    this.el.append(
      titleEl,
      el("div", { class: "ls-subtitle", text: "Tactical Sci-Fi Roguelite Tower Defense" }),
      el("div", { class: "ls-sync-chips" }, [
        el("span", { class: `ls-sync-chip synced ${synced ? "active" : ""}`, text: "Synced" }),
        el("span", { class: `ls-sync-chip offline ${synced ? "" : "active"}`, text: "Offline" }),
      ]),
      el("div", { class: "ls-profile", html:
        `<div>Best sector cleared: <strong>${p.bestSectorCleared}</strong></div>` +
        `<div>Best wave reached: <strong>${p.bestWaveReached}</strong></div>` +
        `<div>Codex entries: <strong>${p.codexSeen.length}</strong> / 14</div>` +
        `<div>Research points: <strong>${p.researchPoints}</strong></div>` +
        `<div>Prestige: <strong>${p.prestigeLevel}</strong> (x${p.prestigeMultiplier.toFixed(2)})</div>` +
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

    const medals = el("div", { class: "ls-achievement-showcase" });
    for (const a of achievementDefinitions.slice(0, 6)) {
      const unlocked = p.achievementsUnlocked.includes(a.id);
      medals.append(el("div", {
        class: `ls-medal ${unlocked ? "unlocked" : "locked"}`,
        attrs: { title: `${a.name}: ${a.description}` },
        text: `${a.icon} ${unlocked ? "100%" : "0%"}`,
      }));
    }
    this.el.append(medals);

    // Endless leaderboard panel — shown only when the CrazyGames SDK is available.
    if (this.game.leaderboard.isAvailable) {
      const lbPanel = el("div", { class: "ls-leaderboard-panel" });
      lbPanel.append(el("div", { class: "ls-leaderboard-title", text: "ENDLESS · TOP 10" }));
      const lbList = el("div", { class: "ls-leaderboard-list", text: "Fetching…" });
      lbPanel.append(lbList);
      this.el.append(lbPanel);
      void this.game.leaderboard.getTop10(BOARD_ENDLESS_WAVE).then((entries) => {
        if (entries.length === 0) {
          lbList.textContent = "No scores recorded yet.";
          return;
        }
        lbList.textContent = "";
        for (const e of entries) {
          lbList.append(
            el("div", { class: "ls-leaderboard-row", html:
              `<span class="ls-lb-rank">#${e.rank}</span>` +
              `<span class="ls-lb-name">${e.name}</span>` +
              `<span class="ls-lb-score">${e.score} waves</span>`,
            }),
          );
        }
      });
    }

    const actions = el("div", { class: "ls-actions" });
    const startBtn = el("button", {
      class: "ls-btn ls-btn-primary",
      text: "START MISSION",
      attrs: { "aria-label": "Start mission" },
    });
    startBtn.onclick = () => this.game.setState("SECTOR_SELECT");
    actions.append(startBtn);

    const codexBtn = el("button", {
      class: "ls-btn",
      text: "FIELD MANUAL",
      attrs: { "aria-label": "Open field manual" },
    });
    codexBtn.title =
      "Open the field manual / codex. Reference for every system, control, and threat. (H or ?)";
    codexBtn.onclick = () => this.game.ui.openCodex();
    actions.append(codexBtn);

    const researchBtn = el("button", {
      class: "ls-btn",
      text: "RESEARCH",
      attrs: { "aria-label": "Open research" },
    });
    researchBtn.onclick = () => this.game.ui.openMeta();
    actions.append(researchBtn);

    const dailyBtn = el("button", {
      class: "ls-btn",
      text: "DAILY",
      attrs: { "aria-label": "Start daily challenge" },
    });
    dailyBtn.onclick = () => this.game.startDailyChallenge();
    actions.append(dailyBtn);

    const settingsBtn = el("button", {
      class: "ls-btn",
      text: "SETTINGS",
      attrs: { "aria-label": "Open settings" },
    });
    settingsBtn.onclick = () => this.game.ui.openSettings();
    actions.append(settingsBtn);

    this.el.append(actions);

    this.el.append(el("div", { class: "ls-hint", html:
      "Hotkeys: <span>1-6</span> build, <span>U</span> upgrade, <span>S</span> sell, <span>R</span> relay deploy, <span>Y</span> command tier, <span>F1-F4</span> squads, <span>E</span> retask, <span>Q</span> evac, <span>Space</span> start wave, <span>Tab</span> wave preview, <span>P</span> pause, <span>+/-</span> speed, <span>H/?</span> codex." }));

    const legalLink = el("button", {
      class: "ls-legal-link",
      text: "Privacy Policy · Terms · Third-Party Licences",
      attrs: { "aria-label": "Open legal notices" },
    });
    legalLink.onclick = () => openLegalModal(this.el);
    this.el.append(legalLink);

    // Play glitch animation on title (skip if reduce motion is on).
    if (!(this.game.core.settings.reduceMotion || this.game.core.settings.reducedMotion)) {
      window.setTimeout(() => glitchTitle(titleEl), 120);
    }
  }
}
