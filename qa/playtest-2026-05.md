# LAST SIGNAL — QA Playtest Log
_May 2026 — pre-submission QA pass_

**Ship-blocker definition:** crash, softlock, save corruption, unwinnable state from valid play, consent/ad flow broken, mobile-input dead zone, core mechanic visibly bugged.

**Non-blocker:** polish, balance, missing animation frames, text wrapping edge cases → log as `[POST-LAUNCH]`.

---

## Session template

```
## Session N — [Date] [Time]
**Device/OS:** e.g. Desktop Windows 11 / iPhone 15 emulation (Chrome DevTools)
**Browser:** e.g. Chrome 125
**Sector(s) played:** e.g. Sector 1 → 3
**Modifiers rolled:** e.g. STATIC FIELD, VOID SURGE

### Issues observed
- HH:MM — [BLOCKER/POST-LAUNCH] Description of issue. Steps to reproduce.

### Result
PASS / FAIL (blockers found)
```

---

## Playtest checklist

- [ ] Fresh profile → consent modal appears → "Essential only" → no ad fires
- [ ] Fresh profile → "Accept all" → tutorial sector completes
- [ ] Sector 1 win → Sector 1 lose-and-retry → progress correct
- [ ] Sector 2 → 5 (skip with dev shortcut if available)
- [ ] Sector 5–7: boss waves, evac mechanics, jammer fields
- [ ] Sector 7 victory → Campaign Complete screen → return to menu → re-enter Sector 7
- [ ] Void sector full clear
- [ ] Endless mode → silence wave (~w5), blitz wave (~w11), boss combo (w8), reach ≥ wave 12
- [ ] Endless leaderboard: score submits after game over, top-10 shows on main menu
- [ ] Cloud save: Synced/Offline chip reflects connection state
- [ ] Settings → Accessibility: each toggle has visible effect
- [ ] Settings → Privacy & data: re-opens consent modal, current flags shown
- [ ] Legal modal opens from main menu, all three tabs readable
- [ ] Mobile-emulated (Chrome DevTools): touch build/sell/upgrade, swipe panels, no dead zones
- [ ] `npm run build` clean, `npm run typecheck` clean
- [ ] No `console.error` in a normal full run (desktop)

---

## Sessions

<!-- Paste session logs below as you play -->

