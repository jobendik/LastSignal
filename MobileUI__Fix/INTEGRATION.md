# LAST SIGNAL — Mobile UX Integration

This package adds a complete mobile experience on top of the existing desktop UI without touching any desktop code paths. The new mobile chrome only activates when `body.ls-mobile` is present (which `detectMobile()` already sets in `src/main.ts`).

## Files in this drop

```
src/styles/mobile.css                    NEW — full mobile stylesheet (~1.2k lines)
src/ui/mobile/dom.ts                     NEW — tiny el()/clear() helpers (delete if src/ui/dom.ts already exports these and switch imports)
src/ui/mobile/MobileShell.ts             NEW — top HUD + bottom action bar + more menu
src/ui/mobile/MobileBuildSquadDrawer.ts  NEW — tabbed build/squad drawer + active-squad roster
src/ui/mobile/MobileTowerSheet.ts        NEW — selected-tower bottom sheet
```

Plus five small edits to existing files documented below.

---

## 1. `index.html` — link the stylesheet

Find the existing `<link rel="stylesheet" ...>` for `ui.css` and add the mobile sheet immediately after it. Load order matters: mobile.css must come **after** ui.css so its `body.ls-mobile` selectors win the cascade.

```html
<link rel="stylesheet" href="/src/styles/ui.css" />
<!-- NEW: mobile chrome, only takes effect when body.ls-mobile is set -->
<link rel="stylesheet" href="/src/styles/mobile.css" />
```

If your stylesheets are imported from `main.ts` instead of `<link>`'d, see step 2.

---

## 2. `src/main.ts` — import mobile.css and flag the game

Two additions.

**(a)** Near the other CSS imports, add:

```ts
import "./styles/mobile.css";
```

**(b)** After `const game = new Game(...)` (or wherever the game instance is created) and after the existing `detectMobile()` call that adds `body.ls-mobile`, set the flag on the game so the rest of the code can branch on it. If you don't already capture the result of `detectMobile()`, change it to:

```ts
const mobile = detectMobile();   // returns true on mobile (existing logic)
game.isMobile = mobile;
```

If `detectMobile()` currently returns void, just read the class off the body:

```ts
game.isMobile = document.body.classList.contains("ls-mobile");
```

---

## 3. `src/core/Game.ts` — one field

Add a public field on the `Game` class, next to the other top-level fields (canvas, ctx, etc.):

```ts
/** True when running on a touch device — toggles the mobile UI/InputSystem branches. */
public isMobile = false;
```

That's it for Game.ts.

---

## 4. `src/ui/UIManager.ts` — mount the mobile shell when on mobile

Two changes.

**(a)** Add the import near the top:

```ts
import { MobileShell } from "./mobile/MobileShell";
```

**(b)** Add a field on the `UIManager` class:

```ts
mobileShell: MobileShell | null = null;
```

**(c)** Inside the constructor (or `init()`, wherever the desktop HUD/BuildMenu/TowerPanel are instantiated), after all the existing desktop UI components are created and appended, add:

```ts
if (this.game.isMobile) {
  this.mobileShell = new MobileShell(this.game);
  // Append into whatever root the desktop UI uses. Adjust if your root is
  // `this.root`, `game.uiRoot`, `document.body`, etc.
  this.game.uiRoot.appendChild(this.mobileShell.el);
}
```

You do **not** need to remove or hide the desktop components — `mobile.css` already hides `.ls-hud`, `.ls-build-menu`, `.ls-tower-panel`, `.ls-hud-right-sidebar`, `.ls-modifier-strip` etc. when `body.ls-mobile` is set.

If `UIManager` has cleanup / `destroy()`, mirror it:

```ts
if (this.mobileShell) {
  this.mobileShell.el.remove();
  this.mobileShell = null;
}
```

---

## 5. `src/systems/InputSystem.ts` — three surgical additions

These changes preserve every existing desktop behavior. They add: (a) mobile ghost-placement mode, (b) a one-pass pinch-zoom fix, (c) haptic hooks, (d) a kill switch for edge-pan on mobile.

### 5a. Add mobile ghost-placement state

Near the other instance fields on the `InputSystem` class:

```ts
/** Mobile only: when true, touch-end does NOT commit a build — the player must hit the floating CONFIRM button. */
private isMobileGhostMode = false;
```

### 5b. Expose `confirmGhostPlacement()` and `cancelGhostPlacement()`

Anywhere in the class, add the two public methods the `MobileShell` calls. Adapt the inner call to whatever your existing build-commit method is named (`tryBuild`, `placeTower`, `buildAt`, etc.):

```ts
/**
 * Called by the mobile CONFIRM button. Commits the ghost-positioned tower
 * to the cell the player last hovered. Returns true on success.
 */
public confirmGhostPlacement(): boolean {
  if (!this.selectedTowerType || !this.overCell) return false;
  // EXISTING: whatever method your codebase uses to commit a placement.
  // Replace `this.tryBuild` with the real name if different.
  const ok = this.tryBuild(this.overCell.col, this.overCell.row, this.selectedTowerType);
  if (ok) {
    this.selectedTowerType = null;
    this.showPlacementPreview = false;
    this.isMobileGhostMode = false;
  }
  return ok;
}

/**
 * Called by the mobile CANCEL button. Clears the armed tower without committing.
 */
public cancelGhostPlacement(): void {
  this.selectedTowerType = null;
  this.showPlacementPreview = false;
  this.isMobileGhostMode = false;
}
```

### 5c. In `setBuildTool()` (or wherever a tower type is armed)

When a tower type is armed on mobile, set `isMobileGhostMode = true`. Find the method that sets `this.selectedTowerType` from a build-menu click — it's typically called `setBuildTool`, `arm`, or similar:

```ts
public setBuildTool(type: TowerType | null): void {
  // ... existing logic to set this.selectedTowerType, emit "build:tool", etc.
  this.isMobileGhostMode = this.game.isMobile && this.selectedTowerType !== null;
}
```

### 5d. In `onTouchEnd()` — skip auto-build when armed for mobile

Find the existing `onTouchEnd` (or equivalent) handler. There's currently logic like:

```ts
// EXISTING — auto-commit on touch end
if (this.selectedTowerType && wasShortTap) {
  this.tryBuild(this.overCell.col, this.overCell.row, this.selectedTowerType);
}
```

Wrap it so it's a no-op when in ghost mode (the floating CONFIRM button now commits):

```ts
if (this.selectedTowerType && wasShortTap && !this.isMobileGhostMode) {
  this.tryBuild(this.overCell.col, this.overCell.row, this.selectedTowerType);
}
```

### 5e. Fix the pinch-zoom math (single-pass zoom-around-midpoint)

In `onTouchMove`, the existing two-finger branch likely does both a midpoint pan and a zoom — that's the source of drift. Replace it with this single-pass version (preserve the variable names you already use for the previous distance/midpoint):

```ts
if (touches.length === 2) {
  const t0 = touches[0], t1 = touches[1];
  // Midpoint in canvas space.
  const mx = (t0.clientX + t1.clientX) * 0.5 - this.canvasRect.left;
  const my = (t0.clientY + t1.clientY) * 0.5 - this.canvasRect.top;
  const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);

  if (this.pinchPrevDist > 0) {
    const cam = this.game.camera;
    const oldZoom = cam.zoom;
    const ratio = dist / this.pinchPrevDist;
    const newZoom = Math.max(cam.minZoom, Math.min(cam.maxZoom, oldZoom * ratio));

    if (newZoom !== oldZoom) {
      // World point under the midpoint BEFORE zoom — must stay there AFTER.
      const wx = cam.x + (mx - this.canvas.width * 0.5) / oldZoom;
      const wy = cam.y + (my - this.canvas.height * 0.5) / oldZoom;
      cam.zoom = newZoom;
      cam.targetZoom = newZoom;
      // Re-anchor exactly once. No separate midpoint-pan correction.
      cam.x = wx - (mx - this.canvas.width * 0.5) / newZoom;
      cam.y = wy - (my - this.canvas.height * 0.5) / newZoom;
      cam.targetX = cam.x;
      cam.targetY = cam.y;
    }
  }
  this.pinchPrevDist = dist;
  this.pinchPrevMid = { x: mx, y: my };
  return;
}
```

Adjust `cam.x` / `cam.targetX` field names to whatever your Camera uses (`cam.targetX` is what the previous summary referenced).

### 5f. Disable edge-pan on mobile

In the InputSystem constructor or wherever camera edge-pan is configured, branch on mobile:

```ts
if (this.game.isMobile) {
  this.game.camera.edgePanX = 0;
  this.game.camera.edgePanY = 0;
}
```

If your camera doesn't use those fields, find the equivalent "auto-pan when cursor is near edge" logic and skip it on mobile.

### 5g. Haptics

Add a private helper anywhere on the class:

```ts
private vibrate(pattern: number | number[]): void {
  try {
    if (this.game.core.settings?.reducedMotion) return;
    navigator.vibrate?.(pattern);
  } catch { /* ignore */ }
}
```

Then call it at the key feel-good moments — adjust call sites to wherever these events fire in InputSystem:

```ts
// On successful tower build:        this.vibrate([10, 25, 10]);
// On tower sell:                    this.vibrate([8, 20]);
// On core ability fire (EMP, etc.): this.vibrate([15, 40, 15]);
// On wave start tap:                this.vibrate(20);
```

The `MobileShell` already vibrates on its own UI taps (tabs, confirm, cancel), so InputSystem only needs to cover the canvas-driven actions.

---

## 6. Behavior summary

After integration, on mobile:

* **Top HUD** shows credits, core HP, wave counter + status, START WAVE (when applicable), pause, ⋯ more, ⚙ settings.
* **Bottom action bar** shows speed toggle (1×/2×/3× cycle) + BUILD/SQUAD tab switcher. When a tower or squad is armed it morphs into PLACE ✓ / CANCEL ✕.
* **Build drawer** — tabbed by category (ATTACK, CONTROL, SUPPORT, ECONOMY, ELITE), big finger-sized cards.
* **Squad drawer** — same slot, swapped via tab. Shows an active-squad roster strip at the top with HP bars + per-squad EVAC / RETASK chips + an EVAC ALL button.
* **Tower sheet** opens on tower select with HP / stats / status chips / UPGRADE / SELL / TARGET▼ / DETAILS toggle. Specialization picker appears when eligible. Swipe-down on the handle dismisses.
* **More menu** (⋯ in top HUD) — REPAIR CORE, CORE EMP, RELAY, COMMAND TIER, FIELD MANUAL, RESEARCH.
* **Ghost placement** — tap a tower card, drag on the map to position, tap PLACE ✓ to commit (no accidental builds on a misplaced tap).
* **Haptics** — short buzz on each UI action; failure buzz on invalid placement.
* **Safe areas** — every fixed bar respects `env(safe-area-inset-*)` for iPhone notches and home indicators.
* **Landscape** — drawer becomes a 3-column grid and the bars shrink to fit phones turned sideways.

---

## 7. Known integration gotchas

1. **Bus event names** — `MobileShell` listens for `"build:tool"`, `"squad:arm"`, `"squad:disarm"`, `"tower:selected"`, `"state:changed"`, `"credits:changed"`, `"core:damaged"`, `"core:repaired"`, `"speed:changed"`, `"wave:started"`, `"wave:complete"`, `"ui:cleared"`. If any of those don't exist yet, either add an emit in the corresponding system or wire to the closest equivalent.
2. **`game.squads`** — code paths assume `Game` exposes `squads: MobileSquadSystem` (with `statuses()`, `armCommand`, `cancelCommand`, `selectSquad`, `beginRetask`, `evacSquad`, `evacAll`, `pendingCommand`, `retaskMode`, `selected`, `globalCap()`). Adjust to your real surface if names differ.
3. **`game.towers.selected`** — assumed to be the currently-selected `Tower` or `null`. `MobileTowerSheet` calls `game.towers.clearSelection()` on close, `setTargetingMode()` on target change, `upgrade()` / `sell()` / `applySpecialization()`. If any names differ rename in `MobileTowerSheet.ts`.
4. **`game.meta.aggregate().unlockedTowers`** — used to gate research-locked towers in the build drawer. If your meta exposes it differently, edit `MobileBuildSquadDrawer.towersInCategory()`.
5. **`game.ui.openCodex()` / `openMeta()` / `openSettings()`** — `MobileShell` calls these from the more-menu and settings button. Rename if different.
6. **TypeScript imports for towers/squads** — `MobileBuildSquadDrawer.ts` imports `towerDefinitions`, `towerOrder` from `../../data/towers` and `squadDefinitions` from `../../data/squads`. Verify those paths/names exist.

If anything fails to compile, the first place to look is the bus event names and the system field names in section 7 — everything else is self-contained.
