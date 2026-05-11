# Last Signal — CrazyGames Submission Checklist

## Code & Build

- [x] `npm run typecheck` — zero errors
- [x] `npm run build` — clean output in `dist/`
- [ ] Test production build locally: `npx serve dist` → run through Sector 1 in browser
- [ ] No `console.error` in a normal desktop play session
- [ ] No unhandled promise rejections (check DevTools console)

## GDPR / Consent

- [x] Consent modal fires on first visit (essential-only or accept-all)
- [x] Telemetry only fires after explicit consent
- [x] Ads only fire after explicit consent
- [x] Cloud save only activates after explicit consent
- [x] Re-consent accessible from Settings → Privacy & data

## Ads & SDK

- [ ] CrazyGames SDK loads without error when hosted on crazygames.com
- [ ] `sdk.game.sdkGameLoadingStart()` / `Stop()` called at load
- [ ] `sdk.game.gameplayStart()` / `Stop()` called correctly
- [ ] Interstitial fires at sector transitions (with 60s cooldown)
- [ ] Rewarded ad button appears on Game Over and Victory screens (CG only)

## Leaderboards (§2.2)

- [ ] CrazyGames dev portal: create leaderboard "endless_wave" (integer, descending)
- [ ] CrazyGames dev portal: create leaderboard "sector7_time" (integer, ascending — lower = faster)
- [ ] Endless wave score submits correctly after game over
- [ ] Sector 7 clear time submits correctly after victory
- [ ] Top-10 panel renders on Main Menu (CG environment)
- [ ] Top-10 panel renders on Game Over screen after endless run

## Cloud Save (PROMPT 2)

- [x] `CloudSaveSystem` loads from CrazyGames cloud on init (if consent given)
- [x] Synced/Offline chip reflects connection state on Main Menu
- [ ] Profile survives a full browser refresh

## QA Playtest

- [ ] Complete `qa/playtest-2026-05.md` checklist — no ship-blockers found
- [ ] Tested on: Desktop Chrome (latest), Desktop Firefox (latest)
- [ ] Tested on: Mobile emulation (Chrome DevTools, Galaxy S20 preset)
- [ ] Tested on: CrazyGames test environment (upload to dashboard, use preview URL)

## Accessibility (PROMPT 4)

- [x] High-contrast palette options in Settings
- [x] UI scale slider (0.75×–1.5×)
- [x] Reduce motion toggle
- [x] Keyboard navigation mode
- [ ] Manual verify: all interactive elements reachable by keyboard in keyboard-nav mode

## Legal Docs (PROMPT 7)

- [x] `PRIVACY.md` — complete, no placeholders
- [x] `TERMS.md` — complete, no placeholders
- [x] `THIRD_PARTY.md` — complete (TODO: update audio section when audio assets added)
- [x] Legal modal accessible from Main Menu

## Store Listing

- [ ] `marketing/description-short.txt` — reviewed and approved
- [ ] `marketing/description-long.md` — reviewed and approved
- [ ] `marketing/tags.txt` — reviewed (max 10 tags on CrazyGames portal)
- [ ] `marketing/controls.md` — copied into CrazyGames "How to play" field
- [ ] `marketing/age-rating.txt` — confirmed rating selected in portal
- [ ] Screenshots — see `marketing/IMAGE-ASSETS-TODO.md` (none yet, must be produced)
- [ ] Cover image — see `marketing/IMAGE-ASSETS-TODO.md` (none yet)

## Final Submission Steps

1. Confirm game is hosted at your CrazyGames dev-portal URL
2. Fill in all store fields in the CrazyGames developer dashboard
3. Create leaderboards in the dashboard (see Leaderboards section above)
4. Submit for review
5. Address any review feedback within 72 hours

## Post-Launch (deferred)

- [ ] PROMPT 5: Audio assets — add to `public/audio/`, update `AudioSystem.ts`, update `THIRD_PARTY.md`
- [ ] PROMPT 8: Monetisation (standalone web / itch.io track) — energy gates, reward shop
- [ ] §2.3: Localisation refactor — extract strings to `i18n/` catalogue
- [ ] Trailer / GIF for store page
