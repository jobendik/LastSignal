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
canvas!.width = VIEW_WIDTH;
canvas!.height = VIEW_HEIGHT;
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
const game = new Game(gameCanvas, gameUiRoot);
game.start();

// Resize canvas to fit viewport while preserving aspect ratio.
function fit(): void {
  const margin = 16;
  const availW = window.innerWidth - margin * 2;
  const availH = window.innerHeight - margin * 2;
  const scale = Math.min(availW / VIEW_WIDTH, availH / VIEW_HEIGHT);
  gameCanvas.style.width = `${Math.floor(VIEW_WIDTH * scale)}px`;
  gameCanvas.style.height = `${Math.floor(VIEW_HEIGHT * scale)}px`;
}
fit();
window.addEventListener("resize", fit);
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
