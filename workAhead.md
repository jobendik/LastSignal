# LAST SIGNAL — Work Ahead to Release

> **Date:** May 2026
> **Purpose:** Single source of truth for everything still required to ship LAST SIGNAL as a release-ready product on CrazyGames (primary) and the public web (secondary). Read top to bottom, then copy-paste the prompts at the bottom into fresh agent sessions in the order they appear.

---

## 0. How to read this document

The previous design audit produced an 8-item list (monetisation, campaign conclusion, squad onboarding, modifier pool, void/endless depth, research tree depth, reflector clarity, etc.). **Items 2, 3, 5, 6, 7 and 8 are already implemented and merged** — verified in this audit:

| # | Item | Status | Where it lives |
|---|------|--------|---------------|
| 1 | CrazyGames SDK (loading/gameplay hooks, interstitial, rewarded) | ✅ Done | `src/systems/AdsSystem.ts` |
| 1 | Standalone monetisation (energy gate, starter pack, daily login, gem shop) | ❌ **Not done — deferred** | — |
| 2 | Campaign Complete screen after Sector 7 | ✅ Done | `src/ui/GameOverScreen.ts` → `renderCampaignComplete()` |
| 3 | Squad / strategic-point onboarding | ✅ Done | `src/systems/GuidanceSystem.ts` (squad/strategic/relay hooks) |
| 5 | Modifier pool tripled to 24 | ✅ Done | `src/data/modifiers.ts` (25 entries, buff/debuff/mixed kinds) |
| 6 | Void Sector hand-authored | ✅ Done | `src/data/sectors.ts` → `voidWaves()` (15 waves, 3 acts) |
| 6 | Endless mode events + boss combos | ✅ Done | `src/systems/EndlessSystem.ts` (silence/blitz events, themed bosses) |
| 7 | Research tree depth + branching | ✅ Done | `src/data/research.ts` (25 nodes with `requires:` deps) |
| 8 | Reflector "Requires Railgun" indicator | ✅ Done | `src/ui/TowerPanel.ts` |

What's left is **not on the original 8-item list**. It is the production layer that converts a complete game into a **shipped product**: legal, privacy, CrazyGames-platform compliance, cloud save, performance, accessibility, store assets, QA. That work is described below.

---

## 1. Critical path to release (must-ship)

These items block the CrazyGames submission, or block any responsible public release. They must all be done.

### 1.1 GDPR/consent gate & privacy compliance ✅ DONE
- **Why:** CrazyGames submissions are reviewed against GDPR/COPPA. Personalised-ads SDKs must respect a consent decision. Without it, the submission is rejected.
- **Scope:** Implement a first-load consent modal ("Allow personalised ads? Yes / No"). Persist decision in `localStorage`. Wire decision to the CrazyGames SDK consent API (`sdk.user.addUserChangedListener` / `sdk.banner.requestResponsiveBanner` respect the flag). Add a "Privacy" entry in the main menu that re-opens the modal so users can change their mind.
- **Required artefacts:** `PRIVACY.md` and a short, plain-English privacy notice rendered inside the game.
- **Where it touches:** `src/systems/AdsSystem.ts`, new `src/systems/ConsentSystem.ts`, `src/ui/MainMenu.ts`, new `src/ui/ConsentModal.ts`.

### 1.2 Cloud save & profile sync (CrazyGames + public web) ✅ DONE
- **Why:** CrazyGames provides a free cloud-save API. Without it, players lose progress when they clear cookies or switch device. Reviewers flag this.
- **Scope:** Wrap `PersistenceSystem` with a `CloudSaveAdapter`. On `sdk.user.getUser()` success, fetch remote save; merge with local using a "last-write-wins" rule keyed on `profile.lastPlayedAt`. Fall back silently to localStorage when no SDK / no user.
- **Where it touches:** `src/systems/PersistenceSystem.ts`, new `src/systems/CloudSaveSystem.ts`, `src/core/Game.ts` startup sequence.

### 1.3 Bundle split & loading screen ✅ DONE
- **Why:** The current build emits a 604 kB JS chunk (Vite warns at 500 kB). Slow mobile networks see a multi-second white screen. CrazyGames measures TTI and penalises slow loads.
- **Scope:** Code-split by route (MainMenu / Game / SectorSelect). Lazy-load `src/data/waves.ts`, `src/data/sectors.ts`, `src/data/codex.ts` (the biggest static blobs). Add a real loading screen that drives `sdk.game.sdkGameLoadingStart/Stop()` with actual progress, not just two timestamps.
- **Target:** Initial JS payload < 200 kB gzipped, full game interactive < 4 s on a mid-range Android device.
- **Where it touches:** `vite.config.ts` (manualChunks), `src/main.ts`, new `src/ui/LoadingScreen.ts`.

### 1.4 Audio asset pass ⏭️ SKIPPED (no audio assets — v1.1)
- **Why:** Currently all music and SFX are WebAudio synthesised in `AudioSystem.ts`. The synthesised "BGM" is a rhythmic click — fine for prototyping, not for release.
- **Scope:** Source 3 royalty-free music loops (calm / wave / boss) and ~15 SFX from a licensed pack (Kenney, Sonniss GDC, or a licensed pack such as ZapSplat Pro). Replace synthesis hooks with HTMLAudio/`<audio>` element streams. Keep synthesis as a fallback. Ensure all assets are < 500 kB total (mp3 64 kbps mono is fine for ambient loops).
- **Where it touches:** new `public/audio/`, `src/systems/AudioSystem.ts`.

### 1.5 Accessibility minimum bar ✅ DONE
- **Why:** A11y is a CrazyGames quality signal and a hard requirement for several distribution partners (Poki, etc.).
- **Scope:** (1) Colourblind-safe palette toggle (deuteranopia and protanopia presets) wired through tower beam colours, enemy outlines, and HUD chips. (2) UI font-scale slider 80–140% in Settings. (3) Full keyboard navigation of MainMenu / SectorSelect / SettingsPanel. (4) Reduce-motion toggle that disables screen shake, particle bursts, and the menu starfield. (5) Pause-on-blur (already partial — verify).
- **Where it touches:** `src/systems/SettingsSystem.ts`, `src/ui/SettingsPanel.ts`, `src/systems/RenderSystem.ts`, `src/styles/ui.css`.

### 1.6 Telemetry (minimal, privacy-respecting) ✅ DONE
- **Why:** Post-launch tuning is impossible without data. Without "% of players who clear sector 1", balance work is guesswork.
- **Scope:** A tiny `TelemetrySystem` that records anonymised counters (sector_start, sector_clear, sector_fail, wave_died_on, modifier_picked, tower_built_by_type, average_run_length) and POSTs them in batches to a free endpoint (e.g. Plausible's `/api/event`, Umami self-host, or just buffer-and-print in dev). Respect the consent flag from §1.1.
- **Where it touches:** new `src/systems/TelemetrySystem.ts`, hooks on `bus.emit("sector:complete"|"sector:failed"|"wave:start"|"tower:built"|...)`.

### 1.7 QA pass: full campaign + endless smoke run 🔲 AWAITING MANUAL PLAY
- **Why:** Several large feature waves landed back-to-back; the integration risk is real. We need a deliberate human run-through.
- **Scope:** Play Sectors 1–7 + Void + ≥ 20 endless waves on desktop AND mobile (touch). Record every visible bug. Triage into "ship-blocker" (crash, softlock, broken core flow) and "post-launch". Fix all ship-blockers. Capture screen recordings as evidence for the store page.
- **Where it touches:** new `qa/playtest-2026-05.md` log, plus targeted bug-fix commits.

### 1.8 Store-page assets & submission package 🔲 IMAGES PENDING (text assets done)
- **Why:** CrazyGames submission requires icon, banner, screenshots, description, tags, controls, age rating.
- **Scope:** Produce: 1024×1024 icon, 1920×1080 banner, 4–6 in-game screenshots, 30-second trailer GIF, 500-word description, controls section, tag list, suggested age rating. Verify game runs inside the CrazyGames test harness (file:// + cross-origin checks). Produce `release-checklist.md`.
- **Where it touches:** new `marketing/`, new `release-checklist.md`.

### 1.9 Legal: privacy policy, ToS, third-party licences ✅ DONE
- **Why:** Required by ad SDKs and by EU/UK consumer law.
- **Scope:** A short `PRIVACY.md` (data collected: anonymous gameplay events; ads served by CrazyGames; cloud save via CrazyGames). A short `TERMS.md`. A `THIRD_PARTY.md` listing every dependency + asset + license. Link all three from the main menu.

---

## 2. High-value, non-blocking (strong-recommend before release)

### 2.1 Standalone-release monetisation (energy gate, starter pack, daily login, gem shop) ⏭️ DEFERRED — v1.1
- **Why:** The CrazyGames track is unblocked by §1.1 + §1.3 already. The full `monetize.md` plan (Signal Power energy, $4.99 Starter Pack, 7-day login streak, gem shop) is the **standalone** track and is per the original design 1–2 weeks of work. It is high-impact for direct-web revenue but is **not** required for CrazyGames submission.
- **Scope:** Implement in this order: (a) Signal Power resource model + UI; (b) gem currency + persistence; (c) Starter Pack offer triggered after first sector clear; (d) daily-login streak modal with claim animation; (e) gem shop in MainMenu.
- **Decision required:** Ship CrazyGames first, add this for v1.1 standalone — **OR** delay launch by ~10 days for full monetisation parity. Default recommendation: ship CrazyGames first.

### 2.2 Leaderboards (endless wave reached, fastest sector clear) ✅ DONE
- **Why:** Endless mode now has real depth (§6 done) but no compare-against-others hook. Leaderboards triple endless retention in this genre.
- **Scope:** Use the CrazyGames leaderboard API. Two boards: "Endless wave reached" and "Fastest Sector 7 clear (seconds)". Surface top-10 on Main Menu and at Game Over.
- **Implemented:** `src/systems/LeaderboardSystem.ts` — `submit()` + `getTop10()`, gated on `ConsentSystem.cloudSaveAllowed`. Scores submitted from `Game.onGameOver()` (endless) and `Game.onVictory()` (Sector 7). Top-10 panel rendered in `MainMenu` and `GameOverScreen`. **Dashboard action required:** create leaderboards "endless_wave" (descending) and "sector7_time" (ascending) in the CrazyGames dev portal.

### 2.3 Localisation scaffolding ⏭️ DEFERRED — v1.1
- **Why:** CrazyGames audience is ~70% non-English. Ship English at launch, but having the strings extractable means PT-BR/ES/DE can ship in v1.1 without a refactor.
- **Scope:** Move all user-facing strings into `src/data/i18n/en.ts` keyed by id. Add a `t(id)` helper. Ship English only; future agents can add languages.

---

## 3. Nice-to-have (post-launch v1.1+)

Listed for completeness; do not block release on these.

- Real cutscenes for sector intros (currently text overlays).
- Daily seeded challenge ("Today's Anomaly").
- Co-op or asynchronous spectator mode.
- Steam release packaging (Electron / Tauri wrapper).
- Workshop / community map support.
- Twitch drops integration.

---

## 4. Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CrazyGames rejects submission for missing consent UI | High if §1.1 skipped | Blocker | Do §1.1 first |
| Mobile players lose progress (no cloud save) | Certain without §1.2 | High (review scores) | Do §1.2 |
| Loading screen hangs on slow networks | Medium | High | §1.3 |
| Audio is the most-cited bad-review reason in TD genre | High | Medium-high | §1.4 |
| Localisation lock-in (hardcoded strings) | Certain without §2.3 | Medium (v1.1 cost) | §2.3 |
| Bugs in late campaign found by players, not us | Medium | High | §1.7 |

---

## 5. Order of work

The prompts in §6 are written to be executed top-to-bottom in fresh agent sessions. Order rationale:

1. **§1.1 Consent** before any ads/cloud calls go live.
2. **§1.2 Cloud save** before telemetry, so anonymous IDs are stable.
3. **§1.3 Bundle split** early — every later change can be tested against the smaller bundle.
4. **§1.5 Accessibility** before §1.4 audio, because reduce-motion / settings UI needs to exist before SFX volume hooks land.
5. **§1.4 Audio** — requires assets but no other code dependencies.
6. **§1.6 Telemetry** — needs §1.1 consent flag to exist.
7. **§1.9 Legal docs** — can be done any time, scheduled here so they're in repo before store submission.
8. **§1.7 QA pass** — must come after all code work but before store assets so screenshots reflect the shipped build.
9. **§1.8 Store assets & submission** — last.
10. **§2.\*** items only if you elect to delay launch.

---

## 6. Copy-paste prompts (in execution order)

Each prompt below is self-contained: it tells the next agent **what to build, where the code lives, the acceptance criteria, and what NOT to touch**. Copy one prompt into a new agent chat, wait for it to complete, verify, then move to the next.

---

### PROMPT 1 — GDPR consent gate + Privacy doc

```
Implement a GDPR/COPPA consent gate for LAST SIGNAL and wire it to the existing ads system.

Context:
- Game is a Vite + TypeScript canvas tower defence. Entry: src/main.ts.
- Ads SDK already exists at src/systems/AdsSystem.ts (CrazyGames SDK wrapper, lazy-loaded, with no-op fallback). It does NOT currently check user consent.
- Settings UI: src/ui/SettingsPanel.ts. Main menu: src/ui/MainMenu.ts.
- Settings persistence pattern: src/systems/SettingsSystem.ts (localStorage-backed).
- Codebase conventions: classes per system, EventBus (src/core/EventBus.ts) for cross-system signalling, el() helper from src/ui/dom.ts for DOM nodes, BEM-ish class names prefixed `ls-`.

Task:
1. Create src/systems/ConsentSystem.ts that owns three flags persisted in localStorage:
   - consentRequested (bool) — has the user been asked yet
   - adsAllowed (bool) — personalised ads ok
   - cloudSaveAllowed (bool) — remote sync ok
   It exposes get/set methods, an `await ConsentSystem.ensure()` that resolves once a decision exists, and emits `consent:changed` on the bus when flags update.
2. Create src/ui/ConsentModal.ts that renders a blocking modal on first load. Plain-English copy: "LAST SIGNAL plays ads, can save your progress to CrazyGames cloud, and records anonymous gameplay stats so we can improve the game. You can change this any time in Settings." Two primary buttons: "Accept all" and "Essential only". Pressing either sets consentRequested=true and routes flags accordingly.
3. Modify src/systems/AdsSystem.ts: gate showInterstitial() and showRewarded() on ConsentSystem.adsAllowed. If denied, resolve immediately with `{rewarded:false}` / no-op.
4. Add a "Privacy & data" row to src/ui/SettingsPanel.ts that re-opens the consent modal and shows the current flag values.
5. Wire src/main.ts so the consent modal is shown before any SDK init or game start.
6. Create PRIVACY.md at repo root, ~300 words, listing: data we collect (anonymous gameplay events, cloud save tied to CrazyGames user id), data we do NOT collect (no email, no IP storage, no third-party analytics SDK), how to delete (clear browser data + opt out in Settings).

Do not touch: src/systems/EndlessSystem.ts, src/data/*, src/systems/WaveSystem.ts. Do not change ad logic beyond adding the consent gate.

Acceptance:
- `npm run build` passes.
- Loading the game with cleared localStorage shows the modal once.
- Choosing "Essential only" prevents any ad request.
- Settings → "Privacy & data" re-opens the modal.
- PRIVACY.md exists.
```

---

### PROMPT 2 — Cloud save via CrazyGames SDK

```
Add cloud save / load to LAST SIGNAL using the CrazyGames SDK, gated on the consent flag implemented in the previous task.

Context:
- Local save lives in src/systems/PersistenceSystem.ts. The profile shape is the `Profile` interface — read this file end-to-end first.
- The CrazyGames SDK is lazy-loaded in src/systems/AdsSystem.ts (look for `loadSdk()`). The data API is `sdk.data.setItem(key, value)` and `sdk.data.getItem(key)` (returns string or null). Tied to `sdk.user.getUser()`.
- ConsentSystem (from previous task) exposes `cloudSaveAllowed`.
- Profile already contains `lastPlayedAt: number` — use this for conflict resolution.

Task:
1. Create src/systems/CloudSaveSystem.ts. Public surface:
   - `init(): Promise<void>` — call after SDK + consent are ready. If consent denied or SDK missing, no-op.
   - `loadRemote(): Promise<Profile | null>`
   - `saveRemote(profile: Profile): Promise<void>` — debounced 5s (drop intermediate writes).
   - `merge(local: Profile, remote: Profile | null): Profile` — pick whichever has the larger lastPlayedAt; never merge field-by-field (avoid invariants breaking).
2. Modify PersistenceSystem so that on startup it calls CloudSaveSystem.loadRemote(), merges with local, and writes the result back to both. On every save(), it also queues a remote save.
3. Surface sync status with two tiny HUD chips ("Synced" / "Offline") in src/ui/MainMenu.ts only — do NOT clutter in-game HUD.
4. Handle the failure modes: SDK timeout (>5s) falls back to local silently; corrupt remote payload (JSON parse error) is logged once and ignored.

Do not touch: any gameplay system, src/systems/EndlessSystem.ts, the consent system itself.

Acceptance:
- `npm run build` passes.
- With ConsentSystem.cloudSaveAllowed=false, no SDK data calls are made (verify by grepping or by stubbing the SDK).
- A profile written on machine A is loaded on machine B (manual test via two browsers logged into the same CrazyGames test account, or by stubbing sdk.data with an in-memory map).
- Pulling the cable mid-save does not crash or corrupt the local save.
```

---

### PROMPT 3 — Bundle split + real loading screen

```
Reduce LAST SIGNAL's initial bundle and replace the placeholder loading hooks with a real progress screen.

Context:
- Vite project. Currently `npm run build` emits one ~604 kB JS chunk (gzip ~165 kB). Vite warns about the 500 kB threshold.
- Largest static data files: src/data/waves.ts (~30 kB), src/data/sectors.ts, src/data/codex.ts. Run `du -b src/data/*.ts` to confirm.
- Game entry is src/main.ts which boots a Game (src/core/Game.ts) immediately.
- AdsSystem already calls `sdk.game.sdkGameLoadingStart()` on init and `sdk.game.sdkGameLoadingStop()` after first menu paint — verify in src/systems/AdsSystem.ts. The current "loading screen" is just an HTML fallback in index.html that is hidden when the menu mounts.

Task:
1. Configure vite.config.ts with `build.rollupOptions.output.manualChunks` so that:
   - `src/data/codex.ts` and `src/data/help.ts` (text-heavy) split into a `chunk-text` lazy chunk that only loads when the Codex panel is opened.
   - `src/data/training.ts` splits into `chunk-training` that loads only on training-sector entry.
   - The vendor (none today, but keep the hook for future deps) goes to `chunk-vendor`.
2. Convert imports of those data files to dynamic `import()` at the point of use (e.g. inside CodexPanel constructor). Ensure types stay correct (use `import type` for type-only imports).
3. Build a proper LoadingScreen at src/ui/LoadingScreen.ts: full-screen overlay, the game logo, a progress bar 0–100, three labelled phases ("Booting systems", "Loading sector data", "Preparing UI"). Drive progress from real promise resolutions in main.ts.
4. Move the sdkGameLoadingStart/Stop calls so they bracket the real init sequence, not the cosmetic delay.
5. Verify build output: initial JS chunk should be under 350 kB raw / 100 kB gzipped. If still over, split CodexPanel itself.

Do not touch: any gameplay system, src/styles/main.css unless required for the LoadingScreen, AdsSystem beyond moving the two SDK hook calls.

Acceptance:
- `npm run build` passes with no chunk > 500 kB warning, OR with a documented justification in vite.config.ts comment if a chunk must remain large.
- Codex panel still works (loads lazily, brief spinner is acceptable).
- Loading screen visibly progresses through three phases.
- Initial paint within 1 s on a throttled "Fast 3G" Chrome devtools profile.
```

---

### PROMPT 4 — Accessibility minimum bar

```
Add an accessibility tier to LAST SIGNAL: colourblind palettes, UI font scaling, full keyboard nav, reduce-motion.

Context:
- Settings storage: src/systems/SettingsSystem.ts (localStorage). Settings UI: src/ui/SettingsPanel.ts.
- Rendering: src/systems/RenderSystem.ts owns the canvas draw loop and reads tower/enemy colours from src/data/towers.ts and src/data/enemies.ts.
- HUD/menu DOM: src/ui/HUD.ts, src/ui/MainMenu.ts, src/ui/SectorSelect.ts, src/ui/PauseMenu.ts.
- Styles: src/styles/main.css (canvas/global), src/styles/ui.css (DOM UI). Mobile: src/styles/mobile.css and body.ls-mobile class set in main.ts.
- Particle/shake hooks: src/systems/ParticleSystem.ts and the `core:shake` event in src/systems/RenderSystem.ts (grep `shake`).

Task:
1. In SettingsSystem add four new settings (with defaults): `palette: "default" | "deuteranopia" | "protanopia" | "highContrast"`, `uiScale: number` (range 0.8–1.4, default 1.0), `reduceMotion: boolean` (default false), `keyboardNav: boolean` (default true).
2. Implement palette: tower beam colours and enemy outline colours are looked up via a new `paletteColor(id, fallback)` helper. Define the three palette maps as data tables (do NOT hand-edit every draw call — only the lookup helper). Verify in-game readability for green/red, blue/purple.
3. UI scale: apply via `document.documentElement.style.setProperty('--ls-ui-scale', String(uiScale))` and adjust the relevant rem-based sizes in src/styles/ui.css to use that variable.
4. Reduce-motion: when enabled, suppress screen-shake events in RenderSystem, cap particle counts at 25% in ParticleSystem, disable the menu starfield animation.
5. Keyboard nav: MainMenu, SectorSelect, PauseMenu and SettingsPanel must be operable with Tab/Shift+Tab/Enter/Esc. Use `role` and `aria-label` on interactive divs. Visible focus ring (`outline: 2px solid #66fcf1`) when `body.ls-kbd`. Add `body.ls-kbd` class on first Tab press and remove on first mouse move.
6. Add an "Accessibility" group to SettingsPanel with the four new settings.

Do not touch: gameplay balance, modifier data, wave data, AdsSystem.

Acceptance:
- `npm run build` passes.
- All four settings persist across reload.
- Deuteranopia palette makes Pulse and Stasis beams clearly distinguishable from Plasma and Flamer (verify with the Coblis simulator or a quick visual diff).
- Tab cycles through every interactive element of MainMenu and SettingsPanel.
- With reduceMotion=true, taking damage produces no screen shake and noticeably fewer particles.
```

---

### PROMPT 5 — Audio asset pass

```
Replace LAST SIGNAL's synthesised audio with licensed/royalty-free music + SFX assets while keeping synthesis as a fallback.

Context:
- All audio is currently WebAudio synthesis in src/systems/AudioSystem.ts (~700 lines). Read it end-to-end before changing anything. It exposes `playSfx(id)`, music intensity 0/1/2, and the `bgmIntensity` state.
- There are no audio assets in the repo. There is no `public/` folder yet (Vite serves it from root by default, but the folder must be created).
- Volume settings already exist in SettingsSystem.
- Mobile note: audio context starts suspended until first user gesture — that logic must be preserved.

Task:
1. Create public/audio/ with these files (all mp3, mono, 64-96 kbps, < 500 kB total). You will source these from a free pack — Kenney UI audio pack, Sonniss GDC bundle, or Pixabay royalty-free. Confirm licence and add an entry per file in THIRD_PARTY.md.
   - bgm_calm.mp3 (loop, planning phase, ~30–60 s loop)
   - bgm_wave.mp3 (loop, active wave)
   - bgm_boss.mp3 (loop, boss waves)
   - sfx_tower_build.mp3
   - sfx_tower_sell.mp3
   - sfx_tower_upgrade.mp3
   - sfx_enemy_die.mp3
   - sfx_enemy_die_boss.mp3
   - sfx_core_hit.mp3
   - sfx_wave_start.mp3
   - sfx_wave_clear.mp3
   - sfx_reward_pick.mp3
   - sfx_ui_click.mp3
   - sfx_ui_hover.mp3
   - sfx_squad_deploy.mp3
   - sfx_squad_evac.mp3
   - sfx_achievement.mp3
2. Extend AudioSystem with a sample-based path. New `loadSample(id, url)` returns a promise that resolves an AudioBuffer. Add a `samples: Record<string, AudioBuffer | null>` map. When a sample for an SFX id is present, play it instead of the synth.
3. Music: use three HTMLAudio elements (one per intensity) with crossfade in/out as bgmIntensity changes. Keep them muted-but-playing so the browser doesn't gate the playback.
4. Preload non-blocking: kick off loadSample(...) for every SFX during the LoadingScreen "Preparing UI" phase. Music loads lazily on first wave start.
5. If a sample fails to load, fall back silently to the existing synth path for that id.

Do not touch: gameplay systems, RenderSystem, ParticleSystem.

Acceptance:
- `npm run build` passes.
- public/audio/ total size on disk < 600 kB.
- All listed SFX play with the real samples when triggered.
- Music crossfades between calm → wave → boss with no audible click.
- Disabling network mid-game does not crash the audio system.
- THIRD_PARTY.md lists each file with source URL and licence.
```

---

### PROMPT 6 — Telemetry

```
Add anonymous gameplay telemetry to LAST SIGNAL so we can balance post-launch.

Context:
- EventBus is src/core/EventBus.ts. Events already emitted include: `sector:complete`, `sector:failed`, `wave:start`, `wave:complete`, `tower:built`, `modifier:picked`, `endless:wave`, `endless:started`. Grep for `bus.emit(` to confirm names.
- ConsentSystem (from PROMPT 1) exposes a flag `telemetryAllowed` — add this flag now if it doesn't exist, defaulting to true when "Accept all" was chosen and false otherwise.
- We have no analytics endpoint. For now, ship a stub that POSTs to a configurable URL set via env, and falls back to console.debug in dev.
- A stable anonymous ID is required. Use crypto.randomUUID() stored once in localStorage as `ls.anonId`.

Task:
1. Create src/systems/TelemetrySystem.ts. Public surface:
   - `init()` — sets up event listeners, reads anonId, reads endpoint from `import.meta.env.VITE_TELEMETRY_URL`.
   - `record(event: string, props?: Record<string, string|number|boolean>)` — push to in-memory buffer.
   - `flush()` — POST batched buffer to endpoint, fire-and-forget, no retries. Called every 30 s and on `beforeunload`.
2. Wire these events automatically (no per-call telemetry sprinkled in feature code; centralise in TelemetrySystem.init):
   - sector_start { sectorId, difficulty, modifiers: string[] }
   - sector_clear { sectorId, durationS, livesRemaining }
   - sector_fail { sectorId, waveIndex, durationS }
   - wave_start { sectorId, waveIndex }
   - tower_built { type }
   - modifier_picked { id }
   - endless_wave_reached { wave }
3. Strip PII defensively: an allow-list of property keys is the only thing serialised; everything else is dropped.
4. Respect `consentSystem.telemetryAllowed`. If false, init becomes a no-op and `record` is a no-op.
5. Add a tiny dev panel: when `import.meta.env.DEV`, log every recorded event via `console.debug('[telemetry]', event, props)`.

Do not touch: gameplay systems, ads, cloud save.

Acceptance:
- `npm run build` passes.
- With consent denied, no network requests are made.
- With consent allowed and VITE_TELEMETRY_URL unset, events appear in console in dev.
- With VITE_TELEMETRY_URL=https://httpbin.org/post (a public echo), running a sector start-to-clear posts a JSON array containing sector_start, wave_start (xN), sector_clear.
- Reloading the page preserves anonId.
```

---

### PROMPT 7 — Legal docs (privacy, terms, third-party)

```
Add the legal documents required for a public release of LAST SIGNAL.

Context:
- PRIVACY.md may already exist from PROMPT 1. Extend it if so, do not duplicate.
- THIRD_PARTY.md may already exist from PROMPT 5 (audio licences). Extend it.
- All deps live in package.json. Currently: vite, typescript. CrazyGames SDK is loaded at runtime from sdk.crazygames.com (no npm dep).

Task:
1. Finalise PRIVACY.md (~500 words): what data is collected (telemetry events as listed in PROMPT 6, cloud save tied to CrazyGames user id, ads served by CrazyGames), data retention (we keep telemetry 90 days), how to opt out (Settings → Privacy), data controller (your name/email — leave a `[YOUR EMAIL HERE]` placeholder and add a TODO marker), and the EU/UK GDPR rights summary (access, deletion, portability).
2. Create TERMS.md (~400 words): the game is provided as-is, no warranty, you must be 13+ (or 16+ in EU), no reverse-engineering, no automated play, content licence (game content © your name, but you may stream/share gameplay).
3. Finalise THIRD_PARTY.md listing every dep with version + licence:
   - vite (MIT)
   - typescript (Apache-2.0)
   - CrazyGames SDK (proprietary, runtime-loaded only on crazygames.com)
   - All audio assets (from PROMPT 5)
   - Any other fonts/icons in src/styles or public/.
4. Link all three docs from src/ui/MainMenu.ts via a small "Legal" row at the bottom.

Do not touch: gameplay systems.

Acceptance:
- All three .md files exist and are filled out.
- Main menu has a Legal entry that opens an in-game modal showing the three docs.
- TODO marker for the data-controller email is the only placeholder.
```

---

### PROMPT 8 — Standalone monetisation (Signal Power, starter pack, daily login, gem shop) [OPTIONAL — only if delaying launch]

```
Implement the full standalone-release monetisation layer for LAST SIGNAL per monetize.md sections 1.1, 1.2 (skip VIP), and the starter-pack/daily-login model.

ONLY do this prompt if you are choosing to delay launch by ~10 days to ship monetisation parity. Otherwise skip to PROMPT 9.

Context:
- monetize.md (repo root) contains the full design. Read sections 1.1 (energy gate), 1.4 (gacha — implement as Signal Crate gem shop), starter pack, and daily login.
- ConsentSystem flag `cloudSaveAllowed` — persist purchases via cloud save where possible.
- Existing currencies: credits (per-run), research points (meta). Add a third: gems (meta, premium).
- AdsSystem.showRewarded() exists from PROMPT 1.

Task is large — split into FIVE commits:

Commit A: Signal Power resource
- Add `signalPower: number` and `maxSignalPower: 100` to Profile.
- Regenerates 1/minute IRL time (compute on load: now - lastPlayedAt).
- Sector start costs 20 power. Insufficient → modal: "Watch ad +20", "100 gems → full refill", "Wait X min".
- UI chip in MainMenu showing current/max + regen timer.

Commit B: Gems currency + shop
- Add `gems: number` to Profile.
- New src/ui/GemShop.ts: bundle list (Pocket 100 gems / Crate 500 / Vault 1100 / Hoard 3000 / Pile 6500). Buttons are stubs — call `MonetisationSystem.requestPurchase(bundleId)` which for now logs the intent and (if the CrazyGames SDK has an IAP API at submission time) calls it; otherwise shows a "Coming soon" toast. Make it trivial to swap in the real IAP call later.

Commit C: Starter pack
- First-time offer triggered after first sector clear. Bundle: 500 gems + 50 power + 1 random Mythic tower skin slot reservation, $4.99 equivalent, one-time. Persisted as `profile.starterPackPurchased`. UI: src/ui/StarterPackModal.ts.

Commit D: Daily login streak
- On first launch each calendar day (UTC), show src/ui/DailyLoginModal.ts. Rewards: D1 10 gems, D2 20, D3 30, D4 50, D5 80, D6 100, D7 200 + reset. Streak persists in Profile.
- A streak-broken day resets to D1.

Commit E: Wire to ads
- "Watch ad → +20 power" button calls AdsSystem.showRewarded() (already exists). On rewarded:true, add the power and persist.

Do not touch: gameplay balance, wave data, modifier data, EndlessSystem.

Acceptance per commit:
A: Power regenerates correctly over time including across reloads, sector cost is enforced, the insufficient-power modal works.
B: Gem shop renders, all bundles show; clicking shows the "Coming soon" toast.
C: Starter pack offers exactly once.
D: Daily modal shows once per UTC day; missing a day resets.
E: Rewarded ad path adds power and triggers UI refresh.
`npm run build` passes after each commit.
```

---

### PROMPT 9 — Manual QA pass + ship-blocker bugs only

```
Run a full manual QA pass on LAST SIGNAL and fix any ship-blocker bugs found.

Context:
- All features are in. This is the last code session before store-asset capture.
- "Ship-blocker" = any of: crash, softlock, save corruption, unwinnable state from valid play, ad/consent flow broken, mobile-input dead zone, core mechanic visibly bugged.
- "Not ship-blocker" = polish, balance tweaks, missing animation frames, text wrapping in obscure cases — log these in qa/playtest-2026-05.md as `[POST-LAUNCH]` items.

Task:
1. Create qa/playtest-2026-05.md. Document each session with: device, browser, sector played, modifiers rolled, observed issues with timestamps.
2. Run the following sequence (desktop + mobile-emulated, Chrome DevTools device toolbar with touch):
   - Fresh profile → tutorial sector → Sector 1 win → Sector 1 lose-and-retry → Sector 2.
   - Mid-campaign: skip ahead via dev shortcut if one exists, otherwise grind to Sector 5–7. Verify boss waves, evac mechanics, jammer fields.
   - Sector 7 victory → verify Campaign Complete screen → return to menu → re-enter Sector 7.
   - Void sector full clear.
   - Endless mode → verify silence wave (around w5), blitz wave (w11), boss combo (w8), reach ≥ wave 12.
   - Consent flow: fresh profile, choose "Essential only", verify no ads fire.
   - Cloud save: verify the "Synced/Offline" chip behaviour.
   - Settings: toggle each accessibility setting, observe expected effect in-game.
3. Triage. For every ship-blocker, fix it in a small focused commit. Re-run the affected scenario to verify.
4. Final pass: `npm run build` clean, `npm run typecheck` clean, no console.error in a normal full run.

Do not touch: anything that isn't a ship-blocker. Resist scope creep. Polish goes in qa/playtest-2026-05.md as POST-LAUNCH.

Acceptance:
- qa/playtest-2026-05.md is filled with at least 6 session logs covering desktop and mobile.
- Zero unresolved ship-blocker items.
- Build + typecheck clean.
```

---

### PROMPT 10 — Store assets & CrazyGames submission package

```
Produce all store-page assets and the CrazyGames submission package for LAST SIGNAL.

Context:
- QA is complete (PROMPT 9). The build at HEAD is the candidate.
- CrazyGames requires: 800×600 thumbnail, 1280×720 cover, 1024×1024 square icon, ≥4 screenshots (1920×1080), short description (max 200 chars), long description (max 2500 chars), tags, controls, age rating.
- The game's existing identity: name "LAST SIGNAL", tagline implicit in sector copy "Restore the signal. Hold the line."

Task:
1. Create marketing/ folder with:
   - thumbnail.png (800×600)
   - cover.png (1280×720)
   - icon.png (1024×1024)
   - screenshots/ (4–6 PNGs at 1920×1080). Capture: a busy mid-game wave, the tower panel showing synergies, the Sector 7 boss, a Void wave, the Campaign Complete screen, the modifier-pick screen.
   - trailer.gif (≤8 MB, ~20–30 s, autoplay-friendly).
   - description-short.txt (≤200 chars)
   - description-long.md (≤2500 chars)
   - tags.txt (one per line — suggested: tower-defence, strategy, roguelite, sci-fi, single-player, mobile-friendly)
   - controls.md (one section per platform)
   - age-rating.txt (suggested PEGI 7 / ESRB E10+ rationale: mild fantasy violence, no blood, no language)
2. Create release-checklist.md at repo root with the submission steps:
   - [ ] All ship-blockers from QA closed
   - [ ] PRIVACY.md, TERMS.md, THIRD_PARTY.md present and linked in MainMenu
   - [ ] Consent modal verified on fresh load
   - [ ] Build size < 350 kB initial JS gzipped
   - [ ] All 17 SFX present in public/audio
   - [ ] Cloud save tested on two browsers
   - [ ] Telemetry endpoint configured for production (set VITE_TELEMETRY_URL)
   - [ ] CrazyGames test harness pass
   - [ ] All marketing/ assets produced
   - [ ] Tag v1.0.0 cut
3. Tag v1.0.0 (note: cannot push tags from the agent — leave a final instruction line "Maintainer: run `git tag -a v1.0.0 -m 'LAST SIGNAL v1.0.0'` and submit to CrazyGames.")

Do not touch: any code unless a marketing capture reveals a regression — in which case treat it as a PROMPT 9 ship-blocker and fix it.

Acceptance:
- marketing/ folder is complete.
- release-checklist.md exists at root.
- Final commit message: "release: v1.0.0 candidate".
```

---

## 7. After all prompts complete

You have:

- A CrazyGames-submittable build (assuming PROMPT 8 was skipped — fine for the CG track).
- A v1.1 follow-up roadmap (PROMPT 8 if skipped, §2.2 leaderboards, §2.3 localisation).
- A telemetry pipeline measuring how players are actually performing, ready to drive your first balance patch.

If you took the launch-delay path and ran PROMPT 8, you also have a viable standalone-web monetisation loop and can launch outside CrazyGames too.

Either way: the game is ready for release.
