import "./styles/main.css";
import "./styles/ui.css";
import "./styles/mobile.css";
import { VIEW_HEIGHT, VIEW_WIDTH } from "./core/Config";
import { LoadingScreen } from "./ui/LoadingScreen";

import type { Game } from "./core/Game";

const appRoot =
  document.getElementById("ls-app") ??
  document.getElementById("game-container") ??
  document.getElementById("game-root") ??
  document.body;

// Reuse an existing canvas if the host page provided one.
let canvas = document.getElementById("ls-canvas") as HTMLCanvasElement | null;
if (!canvas) canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
if (!canvas) {
  canvas = document.createElement("canvas");
  canvas.id = "ls-canvas";
  appRoot.append(canvas);
}
const initDpr = window.devicePixelRatio || 1;
canvas!.width = VIEW_WIDTH * initDpr;
canvas!.height = VIEW_HEIGHT * initDpr;
canvas!.style.aspectRatio = `${VIEW_WIDTH} / ${VIEW_HEIGHT}`;

// Reuse an existing UI root if provided, otherwise create one.
let uiRoot = document.getElementById("ls-ui") ?? document.getElementById("ui-root");
if (!uiRoot) {
  uiRoot = document.createElement("div");
  uiRoot.id = "ls-ui";
  appRoot.append(uiRoot);
}
uiRoot.classList.add("ls-ui-root");

const gameCanvas = canvas!;
const gameUiRoot = uiRoot!;
const loadingScreen = new LoadingScreen(appRoot);
let game: Game | null = null;
// Read a CSS custom property as px from <body>; fallback if unset/invalid.
const cssPx = (name: string, fallback = 0): number => {
  const value = Number.parseFloat(getComputedStyle(document.body).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
};

// ──────────────────────────────────────────────────────────
// Mobile / touch device detection.
// We tag the <body> with `ls-mobile` (coarse pointer / small viewport / mobile
// UA) so CSS can switch to the touch-friendly layout, and `ls-portrait` /
// `ls-landscape` so layout can react to orientation. The flags are recomputed
// on resize/orientation change.
// ──────────────────────────────────────────────────────────
function detectMobile(): boolean {
  try {
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const ua = navigator.userAgent || "";
    const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Mobi|Touch|Tablet|Silk|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const smallViewport = Math.min(window.innerWidth, window.innerHeight) <= 820;
    // Treat as mobile if either:
    //  - the device clearly identifies itself (UA / coarse pointer), OR
    //  - the viewport is small enough that the desktop HUD won't fit.
    return uaMobile || (coarse && smallViewport);
  } catch {
    return false;
  }
}
const isMobile = detectMobile();
function applyDeviceClasses(): void {
  const body = document.body;
  body.classList.toggle("ls-mobile", isMobile);
  const portrait = window.innerHeight >= window.innerWidth;
  body.classList.toggle("ls-portrait", portrait);
  body.classList.toggle("ls-landscape", !portrait);
}
applyDeviceClasses();

// Prevent browser-native gestures (pinch-zoom, double-tap zoom, scroll) from
// stealing input over the canvas. The InputSystem implements its own
// pinch / pan / tap handling and needs full ownership of touch events.
gameCanvas.style.touchAction = "none";
gameUiRoot.style.touchAction = "manipulation";
// Block iOS Safari's legacy gesture events (pinch zoom on the whole page).
// The viewport meta `user-scalable=no` covers modern browsers; this is
// belt-and-braces for older iOS.
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());

// Resize canvas to fit viewport while preserving aspect ratio.
// On portrait mobile the canvas backing is resized to fill the available area
// directly (portrait-native resolution), so the Camera auto-fits the map into
// the tall viewport instead of letterboxing a landscape canvas.
function fit(): void {
  applyDeviceClasses();
  const dpr = window.devicePixelRatio || 1;
  let portrait = false;
  if (isMobile) {
    portrait = window.innerHeight >= window.innerWidth;
    const topReserve = cssPx("--ls-m-top-h", portrait ? 44 : 42) + cssPx("--ls-m-safe-top");
    const bottomReserve = cssPx("--ls-m-bottom-h", portrait ? 52 : 50) + cssPx("--ls-m-safe-bottom");
    if (portrait) {
      // Portrait mobile: canvas fills the full available area so ~88% of the
      // screen height is game instead of <35%.  The Camera recalculates its
      // fit-zoom to show the entire map within this portrait viewport.
      const logicalW = Math.max(120, window.innerWidth);
      const logicalH = Math.max(120, window.innerHeight - topReserve - bottomReserve);
      const backingW = Math.round(logicalW * dpr);
      const backingH = Math.round(logicalH * dpr);
      if (gameCanvas.width !== backingW || gameCanvas.height !== backingH) {
        gameCanvas.width = backingW;
        gameCanvas.height = backingH;
      }
      gameCanvas.style.width = `${logicalW}px`;
      gameCanvas.style.height = `${logicalH}px`;
      if (game) {
        game.render.dpr = dpr;
        game.camera.resizeViewport(logicalW, logicalH);
        game.render.resizeViewport();
      }
      return;
    }
    // Landscape mobile: contain-fit within available area (same as desktop path).
    const availW = window.innerWidth;
    const availH = Math.max(120, window.innerHeight - topReserve - bottomReserve);
    const scale = Math.min(availW / VIEW_WIDTH, availH / VIEW_HEIGHT);
    const backingW = Math.round(VIEW_WIDTH * dpr);
    const backingH = Math.round(VIEW_HEIGHT * dpr);
    if (gameCanvas.width !== backingW || gameCanvas.height !== backingH) {
      gameCanvas.width = backingW;
      gameCanvas.height = backingH;
    }
    if (game) {
      game.render.dpr = dpr;
      if (game.camera.viewW !== VIEW_WIDTH || game.camera.viewH !== VIEW_HEIGHT) {
        game.camera.resizeViewport(VIEW_WIDTH, VIEW_HEIGHT);
        game.render.resizeViewport();
      }
    }
    gameCanvas.style.width = `${Math.floor(VIEW_WIDTH * scale)}px`;
    gameCanvas.style.height = `${Math.floor(VIEW_HEIGHT * scale)}px`;
  } else {
    const margin = 16;
    const availW = window.innerWidth - margin * 2;
    const availH = window.innerHeight - margin * 2;
    const scale = Math.min(availW / VIEW_WIDTH, availH / VIEW_HEIGHT);
    const backingW = Math.round(VIEW_WIDTH * dpr);
    const backingH = Math.round(VIEW_HEIGHT * dpr);
    if (gameCanvas.width !== backingW || gameCanvas.height !== backingH) {
      gameCanvas.width = backingW;
      gameCanvas.height = backingH;
    }
    if (game) {
      game.render.dpr = dpr;
      if (game.camera.viewW !== VIEW_WIDTH || game.camera.viewH !== VIEW_HEIGHT) {
        game.camera.resizeViewport(VIEW_WIDTH, VIEW_HEIGHT);
        game.render.resizeViewport();
      }
    }
    gameCanvas.style.width = `${Math.floor(VIEW_WIDTH * scale)}px`;
    gameCanvas.style.height = `${Math.floor(VIEW_HEIGHT * scale)}px`;
  }
}
fit();
window.addEventListener("resize", fit);
window.addEventListener("orientationchange", () => {
  // Some mobile browsers fire `orientationchange` before innerWidth updates;
  // fit twice to catch the post-rotate dimensions.
  fit();
  setTimeout(fit, 200);
});
try {
  const hot = (import.meta as unknown as { hot?: { accept: (deps?: string[], cb?: () => void) => void } }).hot;
  hot?.accept(["./data/towers.ts", "./data/enemies.ts", "./data/waves.ts", "./data/sectors.ts"], () => {
    console.info("[LastSignal] balance data hot-reloaded; restart the current sector to apply structural map/wave changes.");
  });
} catch {
  /* non-Vite env */
}

// Attempt to unlock audio on first user interaction.
function unlockAudio(): void {
  if (!game) return;
  game.audio.init();
  game.audio.resume();
  window.removeEventListener("pointerdown", unlockAudio);
  window.removeEventListener("keydown", unlockAudio);
}
window.addEventListener("pointerdown", unlockAudio);
window.addEventListener("keydown", unlockAudio);

function keyboardNavEnabled(): boolean {
  return game?.core.settings.keyboardNav !== false;
}

window.addEventListener("keydown", (e) => {
  if (e.key === "Tab" && keyboardNavEnabled()) {
    document.body.classList.add("ls-kbd");
  }
});
window.addEventListener("mousemove", () => {
  document.body.classList.remove("ls-kbd");
});

// Expose game instance in dev for debugging.
declare global { interface Window { __game?: Game } }

async function boot(): Promise<void> {
  loadingScreen.setPhase("Booting systems");
  loadingScreen.setProgress(8);
  const [{ ConsentSystem }, { ConsentModal }] = await Promise.all([
    import("./systems/ConsentSystem"),
    import("./ui/ConsentModal"),
  ]);
  loadingScreen.setProgress(28);

  if (!ConsentSystem.consentRequested) {
    void ConsentModal.open(gameUiRoot);
  }
  await ConsentSystem.ensure();

  loadingScreen.setPhase("Loading sector data");
  await import("./data/sectors");
  loadingScreen.setProgress(58);

  loadingScreen.setPhase("Preparing UI");
  const { Game } = await import("./core/Game");
  game = new Game(gameCanvas, gameUiRoot, isMobile);
  ConsentSystem.bindBus(game.bus);
  fit();

  try {
    if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
      window.__game = game;
    }
  } catch {
    /* non-Vite env */
  }

  const sdkReady = game.ads.init();
  void sdkReady.then(() => game?.ads.signalLoadingStart());
  await game.start({ sdkReady });
  loadingScreen.setProgress(92);

  // Boot telemetry after consent is confirmed and the game is running.
  const { TelemetrySystem } = await import("./systems/TelemetrySystem");
  TelemetrySystem.init(game);

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  loadingScreen.complete();
  void sdkReady.then(() => game?.ads.signalLoadingStop());
}

void boot();
