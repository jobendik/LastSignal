import "./styles/main.css";
import "./styles/ui.css";
import { Game } from "./core/Game";
import { VIEW_HEIGHT, VIEW_WIDTH } from "./core/Config";

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

const game = new Game(gameCanvas, gameUiRoot);
game.start();

// Resize canvas to fit viewport while preserving aspect ratio.
function fit(): void {
  applyDeviceClasses();
  // On mobile we want the game to fill the screen edge-to-edge so the play
  // area is as large as possible. On desktop we keep a small breathing-room
  // margin around the CRT box.
  //
  // On mobile the HUD top bar (≈ 96 px tall, more in portrait when buttons
  // wrap) and the build-menu bottom drawer (≈ 32 vh in portrait) overlay
  // the screen, so we shrink the available area by their reserved height
  // before fitting the canvas. That way the canvas slots cleanly in between
  // and the player can see the whole map without HUD chrome covering it.
  let availW: number;
  let availH: number;
  if (isMobile) {
    const portrait = window.innerHeight >= window.innerWidth;
    const hudReserve = portrait ? 110 : 64;          // top HUD bar
    const buildReserve = portrait
      ? Math.round(window.innerHeight * 0.32) + 8    // bottom drawer (32vh + gutter)
      : Math.round(window.innerHeight * 0.30) + 8;
    availW = window.innerWidth;
    availH = Math.max(120, window.innerHeight - hudReserve - buildReserve);
  } else {
    const margin = 16;
    availW = window.innerWidth - margin * 2;
    availH = window.innerHeight - margin * 2;
  }
  const scale = Math.min(availW / VIEW_WIDTH, availH / VIEW_HEIGHT);
  const dpr = window.devicePixelRatio || 1;
  const backingW = VIEW_WIDTH * dpr;
  const backingH = VIEW_HEIGHT * dpr;
  if (gameCanvas.width !== backingW || gameCanvas.height !== backingH) {
    gameCanvas.width = backingW;
    gameCanvas.height = backingH;
  }
  game.render.dpr = dpr;
  gameCanvas.style.width = `${Math.floor(VIEW_WIDTH * scale)}px`;
  gameCanvas.style.height = `${Math.floor(VIEW_HEIGHT * scale)}px`;
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
  game.audio.init();
  game.audio.resume();
  window.removeEventListener("pointerdown", unlockAudio);
  window.removeEventListener("keydown", unlockAudio);
}
window.addEventListener("pointerdown", unlockAudio);
window.addEventListener("keydown", unlockAudio);

// Expose game instance in dev for debugging.
declare global { interface Window { __game?: Game } }
try {
  if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
    window.__game = game;
  }
} catch {
  /* non-Vite env */
}
