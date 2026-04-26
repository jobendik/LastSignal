# LAST SIGNAL

**LAST SIGNAL** is a tactical sci-fi roguelite tower defense game built with TypeScript, Vite, and Canvas 2D. Defend the last signal core against waves of hostile anomalies using a deep, modular system of towers, drones, upgrades, and meta-progression. Featuring a neon CRT aesthetic, procedural Web Audio, and a rich, data-driven architecture for extensibility and polish.

## Features

- **Tactical Tower Defense**: Place, upgrade, and specialize towers to counter 17+ enemy types and bosses.
- **Roguelite Progression**: Unlock meta-upgrades, achievements, and new loadouts across runs.
- **Procedural Audio**: Dynamic Web Audio SFX and adaptive music.
- **Neon CRT Visuals**: Custom Canvas 2D rendering with screen shake, chromatic aberration, and light effects.
- **Rich Content**: 10 tower types, 17 enemy types, 3 drone types, 8+ run modifiers, curses, and more.
- **Polished UX**: Responsive UI, animated menus, and accessibility options.
- **Data-Driven Design**: All towers, enemies, upgrades, and sectors are defined in modular TypeScript data files.
- **Modern Tooling**: Built with Vite for fast dev, strict TypeScript, and easy deployment.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Run the game locally:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.
3. **Build for production:**
   ```bash
   npm run build
   ```
   The output will be in the `dist/` folder, ready for static hosting (e.g. GitHub Pages).

## Project Structure

- `src/` — Main source code
  - `core/` — Game loop, state, config, random, vector math
  - `systems/` — Modular game systems (render, audio, input, enemy, tower, etc.)
  - `entities/` — Entity classes (Enemy, Tower, Drone, etc.)
  - `data/` — Data definitions for towers, enemies, upgrades, sectors, etc.
  - `ui/` — UI components and overlays
  - `styles/` — CSS for main visuals and UI
- `index.html` — Main HTML entry point
- `vite.config.ts` — Vite configuration
- `tsconfig.json` — TypeScript configuration
- `package.json` — Scripts and dependencies

## Game Overview

LAST SIGNAL is a dark, high-stakes defense game. You are the last line of defense for the Signal Core. Place towers, deploy drones, and adapt to randomized run modifiers and enemy waves. Survive as long as possible, unlock new upgrades, and climb the leaderboards.

### Core Concepts
- **Signal Core**: The heart of your defense. If it falls, the run ends.
- **Towers**: Placeable defenses with unique abilities and upgrade paths.
- **Drones**: Mobile units for support and offense.
- **Enemies**: Diverse threats with unique behaviors and bosses.
- **Meta-Progression**: Persistent upgrades and unlocks between runs.

## Development & Contribution

- **Strict TypeScript**: All code is type-checked and modular.
- **No heavy game engine**: Pure Canvas 2D, no React or large frameworks.
- **Easy to extend**: Add new towers, enemies, or upgrades by editing data files.
- **Polish & Game Feel**: Focus on responsive controls, visual feedback, and satisfying gameplay.

### Scripts
- `npm run dev` — Start local dev server
- `npm run build` — Build for production
- `npm run preview` — Preview production build
- `npm run typecheck` — TypeScript type checking

## Credits

- **Design & Code**: [Your Name]
- **Built with**: TypeScript, Vite, Canvas 2D, Web Audio API

## License

This project is for educational and portfolio use. See [LICENSE](LICENSE) for details.

---

For a full list of features, improvements, and roadmap, see [EPIC_IMPROVEMENTS.md](EPIC_IMPROVEMENTS.md).
