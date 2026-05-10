import type { Game } from "../../core/Game";
import { el, clear } from "./dom";
import type { MobileShell } from "./MobileShell";
import { towerDefinitions, towerOrder } from "../../data/towers";
import { droneDefinitions, droneOrder } from "../../data/drones";
import { squadDefinitions } from "../../data/squads";
import type { DroneType, TowerType, SquadType } from "../../core/Types";

/**
 * Tower category buckets for the build drawer's category tabs. Categories
 * are intentionally coarse so the player can scan them with a thumb. Towers
 * absent from any bucket fall through into ATTACK as a safe default.
 */
const CATEGORIES = {
  ATTACK: ["pulse", "blaster", "railgun", "flamer"] as TowerType[],
  CONTROL: ["stasis", "snare", "tesla"] as TowerType[],
  SUPPORT: ["barrier", "amplifier", "reflector", "overclock"] as TowerType[],
  ECONOMY: ["harvester"] as TowerType[],
  ELITE: ["mortar"] as TowerType[],
} as const;
type TowerCategory = keyof typeof CATEGORIES;
type Category = "ALL" | TowerCategory | "DRONES";
const CATEGORY_ORDER: Category[] = ["ALL", "ATTACK", "DRONES", "CONTROL", "SUPPORT", "ECONOMY", "ELITE"];

/**
 * MobileBuildSquadDrawer — bottom drawer that swaps between BUILD and SQUAD
 * modes. The tab switch is owned by the parent MobileShell; this component
 * just renders whichever side is active.
 *
 *   BUILD: category tab strip (ALL | ATTACK | DRONES | CONTROL | SUPPORT | ECONOMY | ELITE)
 *          + grid of large tower cards (~88px tall, finger-sized).
 *   SQUAD: roster strip of currently-deployed squads (HP bar, EVAC, RETASK
 *          chips, tap-to-select), then a 2x2 grid of squad command buttons
 *          with cooldown rings.
 */
export class MobileBuildSquadDrawer {
  el: HTMLElement;
  isOpen = false;

  private mode: "build" | "squad" = "build";
  private buildCategory: Category = "ALL";

  private handle: HTMLElement;
  private cats: HTMLElement;
  private roster: HTMLElement;
  private body: HTMLElement;

  private rafId = 0;
  /** Cached signature so we only re-render when relevant state actually changes. */
  private lastSig = "";

  constructor(private readonly game: Game, private readonly shell: MobileShell) {
    this.el = el("div", { class: "ls-mdrawer" });

    this.handle = el("div", { class: "ls-mdrawer-handle" });
    this.handle.onclick = () => this.close();

    this.cats = el("div", { class: "ls-mdrawer-cats" });
    this.roster = el("div", { class: "ls-mdrawer-roster" });
    this.body = el("div", { class: "ls-mdrawer-body" });

    this.el.append(this.handle, this.cats, this.roster, this.body);

    // Re-render on key bus events (immediate feedback). Per-frame tick handles
    // continuous values like cooldowns / credits.
    const bus = game.bus;
    const refresh = () => this.refresh();
    bus.on("tower:built", refresh);
    bus.on("tower:sold", refresh);
    bus.on("tower:upgraded", refresh);
    bus.on("drone:bought", refresh);
    bus.on("squad:deployed", refresh);
    bus.on("squad:expired", refresh);
    bus.on("squad:destroyed", refresh);
    bus.on("squad:recalled", refresh);
    bus.on("squad:arm", refresh);
    bus.on("squad:disarm", refresh);
    bus.on("squad:selected", refresh);
    bus.on("build:tool", refresh);
    bus.on("command:tierUp", refresh);

    this.startTick();
  }

  // ──────────────────────────────────────────────────────────
  // Open / close lifecycle.
  // ──────────────────────────────────────────────────────────
  open(mode: "build" | "squad"): void {
    this.mode = mode;
    this.isOpen = true;
    this.el.classList.add("open");
    this.lastSig = "";
    this.refresh();
  }

  close(): void {
    this.isOpen = false;
    this.el.classList.remove("open");
  }

  // ──────────────────────────────────────────────────────────
  // Per-frame tick — drives cooldown timers, affordability, and HP bars
  // without thrashing on every event.
  // ──────────────────────────────────────────────────────────
  private startTick(): void {
    const tick = () => {
      if (this.isOpen) this.refresh();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  // ──────────────────────────────────────────────────────────
  // Render dispatch.
  // ──────────────────────────────────────────────────────────
  private refresh(): void {
    if (!this.isOpen) return;
    if (this.mode === "build") this.renderBuild();
    else this.renderSquad();
  }

  // ──────────────────────────────────────────────────────────
  // BUILD mode
  // ──────────────────────────────────────────────────────────
  private renderBuild(): void {
    const game = this.game;
    const credits = game.core.credits;
    const armed = game.input.selectedTowerType;

    // Build a signature so we only repaint when something material changed.
    const cat = this.buildCategory;
    const towersInCat = this.towersInCategory(cat);
    const sigParts = [
      `mode:build`,
      `cat:${cat}`,
      `cr:${credits}`,
      `armed:${armed ?? "_"}`,
      `wave:${game.core.waveIndex}`,
    ];
    for (const t of towersInCat) {
      const limit = game.towers.buildLimit(t);
      const built = limit != null ? game.towers.list.filter((x) => x.type === t).length : 0;
      const unlocked = game.towers.isTierUnlocked(t);
      const cost = game.towers.buildCost(t);
      sigParts.push(`${t}:${cost}:${unlocked ? 1 : 0}:${built}`);
    }
    if (cat === "DRONES") {
      sigParts.push(`drones:${game.drones.list.length}/${game.drones.maxDrones()}`);
      for (const d of droneOrder) {
        const count = game.drones.list.filter((x) => x.type === d).length;
        sigParts.push(`${d}:${game.drones.nextCost(d)}:${count}`);
      }
    }
    const sig = sigParts.join("|");
    if (sig === this.lastSig) return;
    this.lastSig = sig;

    // Hide the active-squad roster on the build tab — it belongs on the squad tab.
    this.roster.style.display = "none";

    // Category tabs.
    clear(this.cats);
    for (const c of CATEGORY_ORDER) {
      const t = el("button", {
        class: `ls-mdrawer-cat${this.buildCategory === c ? " active" : ""}`,
        text: c,
      });
      t.onclick = () => {
        this.buildCategory = c;
        this.lastSig = "";
        this.refresh();
        this.shell.haptic(4);
      };
      this.cats.append(t);
    }
    this.cats.style.display = "";

    // Body grid.
    clear(this.body);
    if (cat === "DRONES") {
      const droneGrid = el("div", { class: "ls-mdrawer-grid drones" });
      for (const type of droneOrder) {
        droneGrid.append(this.buildDroneCard(type));
      }
      this.body.append(droneGrid);
    } else {
      const grid = el("div", { class: "ls-mdrawer-grid" });
      if (towersInCat.length === 0) {
        grid.append(el("div", { class: "ls-mdrawer-empty", text: "No towers in this category yet." }));
      }
      for (const type of towersInCat) {
        grid.append(this.buildTowerCard(type));
      }
      this.body.append(grid);
    }
  }

  private towersInCategory(cat: Category): TowerType[] {
    if (cat === "DRONES") return [];
    const candidates = cat === "ALL" ? towerOrder : CATEGORIES[cat];
    // Filter out research-locked towers (railgun/flamer/barrier) the player hasn't unlocked yet.
    const metaUnlocks = new Set(this.game.meta.aggregate().unlockedTowers);
    const gated = new Set<TowerType>(["railgun", "flamer", "barrier"] as TowerType[]);
    const out: TowerType[] = [];
    for (const t of towerOrder) {
      if (!candidates.includes(t)) continue;
      if (gated.has(t) && !metaUnlocks.has(t)) continue;
      out.push(t);
    }
    return out;
  }

  private buildTowerCard(type: TowerType): HTMLElement {
    const game = this.game;
    const def = towerDefinitions[type];
    const cost = game.towers.buildCost(type);
    const unlocked = game.towers.isTierUnlocked(type);
    const limit = game.towers.buildLimit(type);
    const built = limit != null ? game.towers.list.filter((t) => t.type === type).length : 0;
    const limitReached = limit != null && built >= limit;
    const affordable = game.core.credits >= cost && unlocked && !limitReached;
    const active = game.input.selectedTowerType === type;

    const cls = ["ls-mcard"];
    if (active) cls.push("active");
    if (!unlocked || limitReached) cls.push("disabled");
    else if (!affordable) cls.push("unaffordable");

    const card = el("button", { class: cls.join(" ") });
    card.style.borderColor = def.color;
    if (active) card.style.boxShadow = `0 0 0 2px ${def.color}, 0 0 16px ${def.color}80`;

    card.append(
      el("div", { class: "ls-mcard-name", text: def.name }),
      el("div", { class: "ls-mcard-role", text: def.role }),
      el("div", { class: "ls-mcard-meta" }, [
        el("span", { class: "ls-mcard-cost", text: `${cost}` }),
        el("span", { class: "ls-mcard-stat", text: `D${Math.round(def.damage)}` }),
        el("span", { class: "ls-mcard-stat", text: `R${Math.round(def.range)}` }),
      ]),
    );

    let footnote = "";
    if (!unlocked) footnote = `Unlocks wave ${game.towers.unlockWave(type)}`;
    else if (limitReached) footnote = `Limit ${limit} reached`;
    else if (limit != null) footnote = `${built}/${limit}`;
    if (footnote) card.append(el("div", { class: "ls-mcard-footnote", text: footnote }));

    card.onclick = () => {
      if (!unlocked || limitReached) {
        this.shell.haptic(40);
        return;
      }
      // Pressing the same card again disarms (matches desktop behavior).
      game.input.setBuildTool(type);
      // Cancel any squad arming so the action bar shows the tower confirm slot.
      game.squads?.cancelCommand();
      this.shell.haptic(8);
    };
    return card;
  }

  private buildDroneCard(type: DroneType): HTMLElement {
    const def = droneDefinitions[type];
    const cost = this.game.drones.nextCost(type);
    const count = this.game.drones.list.filter((d) => d.type === type).length;
    const cap = this.game.drones.maxDrones();
    const capped = this.game.drones.list.length >= cap;
    const affordable = this.game.core.credits >= cost && !capped;
    const cls = ["ls-mcard", "drone"];
    if (capped) cls.push("disabled");
    else if (!affordable) cls.push("unaffordable");

    const card = el("button", { class: cls.join(" ") });
    card.style.borderColor = def.color;
    card.append(
      el("div", { class: "ls-mcard-name", text: def.name }),
      el("div", { class: "ls-mcard-role", text: def.role }),
      el("div", { class: "ls-mcard-meta" }, [
        el("span", { class: "ls-mcard-cost", text: `${cost}` }),
        el("span", { class: "ls-mcard-stat", text: `D${Math.round(def.damage)}` }),
        el("span", { class: "ls-mcard-stat", text: `R${Math.round(def.range)}` }),
      ]),
      el("div", {
        class: "ls-mcard-footnote",
        text: capped ? `Drone cap ${this.game.drones.list.length}/${cap}` : `${count} owned`,
      }),
    );
    card.onclick = () => {
      if (!this.game.drones.buy(type)) {
        this.shell.haptic(40);
        return;
      }
      this.game.input.setBuildTool(null);
      this.shell.setArmed(null);
      this.shell.haptic([8, 18, 8]);
    };
    return card;
  }

  // ──────────────────────────────────────────────────────────
  // SQUAD mode
  // ──────────────────────────────────────────────────────────
  private renderSquad(): void {
    const game = this.game;
    const sys = game.squads;
    if (!sys) return;
    const statuses = sys.statuses();
    const active = sys.list.filter((s) => s.active);
    const cap = sys.globalCap();
    const selectedId = sys.selected?.id ?? null;
    const retask = sys.retaskMode;
    const pending = sys.pendingCommand ?? "_";

    const sigParts: string[] = [
      `mode:squad`,
      `cap:${active.length}/${cap}`,
      `sel:${selectedId ?? "_"}`,
      `retask:${retask ? 1 : 0}`,
      `pending:${pending}`,
      `tier:${game.core.commandTier}`,
      `cr:${game.core.credits}`,
    ];
    for (const a of active) {
      sigParts.push(`a:${a.id}:${a.type}:${Math.ceil(a.health)}:${Math.ceil(a.duration)}:${a.state}:${a.evacuating ? "E" : "_"}:${a.jammed ? "J" : "_"}`);
    }
    for (const s of statuses) {
      sigParts.push(`s:${s.type}:${s.unlocked ? 1 : 0}:${Math.ceil(s.cooldownRemaining)}:${s.active}/${s.capPerType}:${s.affordable ? 1 : 0}:${s.effectiveCost}`);
    }
    const sig = sigParts.join("|");
    if (sig === this.lastSig) return;
    this.lastSig = sig;

    // Hide the category strip (squads have no categories).
    this.cats.style.display = "none";

    // Active squad roster.
    clear(this.roster);
    if (active.length > 0) {
      this.roster.style.display = "";
      const head = el("div", { class: "ls-mroster-head" });
      head.append(
        el("span", { class: "ls-mroster-title", text: `ACTIVE ${active.length}/${cap}` }),
      );
      const evacAll = el("button", { class: "ls-mroster-evac-all", text: "EVAC ALL" });
      evacAll.disabled = active.every((a) => a.evacuating);
      evacAll.onclick = () => {
        sys.evacAll();
        this.shell.haptic([10, 30, 10]);
      };
      head.append(evacAll);
      this.roster.append(head);

      const list = el("div", { class: "ls-mroster-list" });
      for (const s of active) {
        const item = el("div", {
          class: `ls-mroster-item${s.id === selectedId ? " selected" : ""}${s.evacuating ? " evac" : ""}${s.jammed ? " jammed" : ""}`,
        });
        item.style.borderLeftColor = s.def.color;
        const top = el("div", { class: "ls-mroster-top" });
        top.append(
          el("span", { class: "ls-mroster-name", text: s.def.name }),
          el("span", { class: "ls-mroster-state", text: this.stateLabel(s.state, s.evacuating, s.jammed) }),
        );
        item.append(top);
        const hpPct = Math.max(0, s.health / s.maxHealth);
        const hpBar = el("div", { class: "ls-mroster-bar" });
        const hpFill = el("div", { class: "ls-mroster-bar-fill" });
        hpFill.style.width = `${(hpPct * 100).toFixed(0)}%`;
        hpFill.style.background = hpPct > 0.5 ? "var(--ls-m-good)" : hpPct > 0.25 ? "var(--ls-m-warning)" : "var(--ls-m-danger)";
        hpBar.append(hpFill);
        item.append(hpBar);

        const actions = el("div", { class: "ls-mroster-actions" });
        const retaskBtn = el("button", {
          class: `ls-mroster-action${retask && s.id === selectedId ? " active" : ""}`,
          text: retask && s.id === selectedId ? "PICK SPOT" : "RETASK",
        });
        retaskBtn.disabled = s.evacuating;
        retaskBtn.onclick = (ev) => {
          ev.stopPropagation();
          if (s.id !== selectedId) sys.selectSquad(s);
          if (sys.selected) sys.beginRetask();
          this.shell.haptic(10);
          this.shell.setArmed("squad");
        };
        const evacBtn = el("button", { class: "ls-mroster-action danger", text: "EVAC" });
        evacBtn.disabled = s.evacuating;
        evacBtn.onclick = (ev) => {
          ev.stopPropagation();
          sys.evacSquad(s);
          this.shell.haptic([8, 20, 8]);
        };
        actions.append(retaskBtn, evacBtn);
        item.append(actions);

        item.onclick = () => {
          sys.selectSquad(s);
          this.shell.haptic(6);
        };
        list.append(item);
      }
      this.roster.append(list);
    } else {
      this.roster.style.display = "none";
    }

    // Squad command grid.
    clear(this.body);
    const grid = el("div", { class: "ls-mdrawer-grid squads" });
    for (const status of statuses) {
      grid.append(this.buildSquadCard(status, sys.pendingCommand === status.type));
    }
    this.body.append(grid);
  }

  private buildSquadCard(status: ReturnType<NonNullable<Game["squads"]>["statuses"]>[number], isPending: boolean): HTMLElement {
    const def = status.def;
    const cls = ["ls-mcard"];
    if (isPending) cls.push("active");
    if (!status.unlocked || status.reason) cls.push("disabled");
    else if (!status.affordable) cls.push("unaffordable");

    const card = el("button", { class: cls.join(" ") });
    card.style.borderColor = def.color;
    if (isPending) card.style.boxShadow = `0 0 0 2px ${def.color}, 0 0 16px ${def.color}80`;

    card.append(
      el("div", { class: "ls-mcard-name", text: def.name }),
      el("div", { class: "ls-mcard-role", text: def.role }),
      el("div", { class: "ls-mcard-meta" }, [
        el("span", { class: "ls-mcard-cost", text: `${status.effectiveCost}` }),
        el("span", { class: "ls-mcard-stat", text: `T${def.tierRequired}+` }),
        el("span", { class: "ls-mcard-stat", text: `${status.active}/${status.capPerType}` }),
      ]),
    );

    // Cooldown ring (visual percent).
    if (status.cooldownRemaining > 0 && status.effectiveCooldown > 0) {
      const pct = Math.min(1, status.cooldownRemaining / status.effectiveCooldown);
      const cd = el("div", { class: "ls-mcard-cd", text: `${Math.ceil(status.cooldownRemaining)}s` });
      cd.style.background = `conic-gradient(${def.color}33 ${(1 - pct) * 360}deg, rgba(0,0,0,0.6) 0)`;
      card.append(cd);
    }

    if (status.reason) {
      card.append(el("div", { class: "ls-mcard-footnote", text: status.reason }));
    }

    card.onclick = () => {
      if (!status.unlocked || status.reason) { this.shell.haptic(40); return; }
      this.game.squads?.armCommand(status.type as SquadType);
      this.shell.haptic(8);
    };
    return card;
  }

  private stateLabel(state: string, evac: boolean, jammed: boolean): string {
    if (evac) return "EVAC";
    if (jammed) return "JAMMED";
    switch (state) {
      case "spawning": return "DEPLOY";
      case "moving": return "MOVING";
      case "scouting": return "SCAN";
      case "capturing": return "CAPTURE";
      case "repairing": return "REPAIR";
      case "attacking": return "ATTACK";
      case "shielding": return "SHIELD";
      case "evacuating": return "EVAC";
      case "expired": return "DONE";
      case "destroyed": return "LOST";
      default: return state.toUpperCase();
    }
  }
}
