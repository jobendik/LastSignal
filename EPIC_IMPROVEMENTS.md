# LAST SIGNAL — Epic Improvement Plan

> **Game Overview**: Last Signal is a tactical sci-fi tower defense roguelite rendered on Canvas 2D with a neon-cyan CRT aesthetic, procedural Web Audio, 9 tower types, 14 enemy types, 3 drone types, and roguelite meta-progression. Built in TypeScript + Vite.

This document is the master checklist for every improvement needed to make the game feel truly epic. Each section covers a domain; each item is a discrete, implementable task.

Status audited against the current codebase on 2026-04-25; `npm run typecheck` passes.

---

## ✅ PHASE 1 COMPLETED — 2026-04-24

All Phase 1 "Foundation" improvements are implemented and TypeScript-clean:

| # | Feature | Details |
|---|---------|---------|
| 1-A | **Directional + rotational screen shake** | 60% bias toward damage source, independent `shakeRot` decay |
| 1-B | **Projectile tracer trails** | 6-point trail with alpha fade; bright white head for bullets |
| 1-C | **Unique SFX per tower** | `sfxTesla` (electric snap), `sfxRailgun` (crack+thud), `sfxMortar` (deep thump), `sfxFlamer` (hiss roar), `sfxStasis` (crystalline chime) |
| 1-D | **Dramatic damage numbers** | White→yellow→orange→red tiers; purple "PHASED" text; boss crits size 18 |
| 1-E | **Tower cooldown arc** | Thin arc fills to tower color when ready; green for Harvester |
| 1-F | **Targeting mode selector** | NEAR / WEAK / STRG / FAST buttons in TowerPanel; drives `findTarget()` |
| 1-G | **Segmented core integrity bar** | 10 lit segments; CSS pulse animation < 30%; inset critical overlay < 15% |
| 1-H | **Threat heatmap overlay** | H key: live blue→yellow→red tile heat from enemy density + flow-field convergence |
| 1-I | **Enhanced spawner portals + CRT** | Rotating segmented ring, pulsing core, 6 energy tendrils; animated scanlines, vignette deepens at low HP |

---

## ✅ PHASE 2 COMPLETED — 2026-04-24

All Phase 2 "Visual Overhaul" improvements are implemented and TypeScript-clean:

| # | Feature | Details |
|---|---------|---------|
| 2-A | **Dynamic point light system** | Offscreen canvas composited with `screen` at 0.55 alpha; towers, projectiles, muzzle flashes, rings, bosses, slowed enemies all emit coloured radial gradients |
| 2-B | **Tower idle animations** | Pulse rotating arcs, Stasis orbiting shards, Barrier shield bars, Tesla micro-arcs, Railgun charge fill; fire-burst `shadowBlur` spike via `t.recoil` |
| 2-C | **Core visual redesign** | Outer HP arc + tick marks, counter-rotating inner ring (4 segs), 4 antenna arms, 8-sector orb (broken sectors darken with HP loss), radial glow |
| 2-D | **Mortar parabolic arc** | Shell follows sin-curve arc (0→34px→0 offset), ground shadow ellipse scales inversely with altitude; uses `maxLife` for progress tracking |
| 2-E | **Flamer particle ribbon cone** | 7 flame particles per fire tick (orange/red/yellow palette) fan out in ±0.6 rad cone with gravity; `spawnFlameJet()` replaces the old beam |
| 2-F | **Tesla recursive lightning** | Two-pass subdivision at dist/8 (finer jaggedness), 55% chance branch arc, 20% per-frame flicker skip, dual outer-glow + white-core render passes |
| 2-G | **Enemy visual improvements** | Scout velocity trail (gradient from `e.vel`), Brute HP cracks (deterministic, 4 lines), Phantom 3-ring shimmer (rotating dashed rings), Leviathan 3 rotating multi-segment rings |
| 2-H | **Star field + animated grid** | 120 twinkling stars (per-star sin-wave alpha), grid lines pulse with a travelling wave across columns/rows |

---

## ✅ PHASE 3 COMPLETED — 2026-04-25

Phase 3 "Gameplay Depth & UX":

| # | Feature | Details |
|---|---------|---------|
| 3-A | **Run modifiers system** | 8 modifiers (4 debuffs + 4 mixed/buffs) rolled at sector start; displayed as HUD chip strip during planning & wave; effects wired into EnemySystem (HP/speed/armor/heal/reward), TowerSystem (cost/fire-rate/harvester income), and Game.ts (core integrity) |
| 3-B | **Boss entrance cinematic** | 2.2s frozen entrance: contracting red portal ring + inner rotating dashed ring; boss body scales in with ease-in; full-screen flash, big shake, slow-mo dip, and "LEVIATHAN DETECTED" floating text on spawn |
| 3-C | **Boss HP bar phase markers** | Three yellow tick marks at 70% / 40% / 15% thresholds on the boss bar; markers dim red once their phase is crossed; label shows "INCOMING" during entrance |
| 3-D | **Hit stop** | When a non-boss enemy dies from a single hit dealing ≥35% of its max HP, all simulation systems freeze for ~4 frames (0.07s real time); particles continue for visual feedback |
| 3-E | **Flamer overheat visual** | `heatTimer` accumulates per fire tick, decays when idle; barrel glows red-hot at heat > 2 (color shifts orange → deep red); steam particles emitted via Poisson rate at heat > 5 |
| 3-F | **Tunneler enemy** | Dives underground every 3.5–5.5s; invisible + 3× speed while tunneling (1.5s); untargetable by towers; dirt burst on dive/surface; `tunnelTransitionProg` drives fade; ripple ring while underground; wired into endless pool at wave 8 |
| 3-G | **Saboteur enemy** | Disables nearest tower within 38px for 3s (8s cooldown between disables); orange spark burst + "DISABLED" floating text on trigger; unique jagged-polygon shape; wired into endless pool at wave 10 |
| 3-H | **Data Cache mid-wave event** | 42% chance to spawn a fast golden cache enemy at 50% wave kills; escape with no core damage (breach:0); golden rotating diamond shape; "DATA CACHE DETECTED!" alert text |
| 3-I | **Elite enemy variant (visual)** | `isElite` flag drives pulsing golden border ring around the enemy; ready to activate for mini-boss spawns |
| 3-J | **Spawner telegraph pulse** | Spawner portals flash bright red with expanding ring 1.5s before a new enemy group spawns; intensity ramps 0→1 as spawn approaches |
| 3-K | **Carrier fear response** | When a Carrier dies, spawned scouts gain radial knockback + 1.2s stun to scatter nearby scouts |

**Phase 4 in progress:**

| # | Feature | Details |
|---|---------|---------|
| 4-A | **Jammer aura suppression** | Jammer enemies within 80px reduce tower fire rate by 30%; yellow dashed halo on jammed towers; jammer's 80px aura ring already visible in drawEnemy |
| 4-B | **Boss kill-cam slow-mo** | `slowMoScale = 0.12` (was hardcoded 0.35); 2.2s of 0.12× speed on boss death; triple concentric rings; "SIGNAL ELIMINATED" floating text; white screen flash |
| 4-C | **Adaptive music** | Tension layer (dissonant triangle oscillator at 82.5Hz with HP filter) cross-fades over 1.8s when wave starts; boss spawn kicks to level 2 (louder); beat pulse layer fires every 1.8s during waves; `setMusicIntensity(0/1/2)` driven by state machine |
| 4-D | **Elite variant spawning** | 6% chance at wave 5+ for non-boss enemies to spawn as elite (150% HP); golden glow border already wired in RenderSystem |
| 4-E | **Swarm boid flocking** | Cohesion force pulls swarm enemies toward nearby swarm center-of-mass (radius 55px); creates natural cluster-and-split organic movement |
| 4-F | **Chromatic aberration pass** | High-quality CRT mode applies subtle screen-blend fringe offsets from `previousFrameCanvas`, stronger when core integrity is low |
| 4-G | **Tower construction animation** | Newly placed towers are disabled for 0.4s while scaling in; four glowing parts converge into the final tower body |
| 4-H | **Specialization unlock FX pass** | Specialization applies a 0.55s slow-mo pop, tower-color burst, dual rings, upgrade SFX, and "SPEC LOCKED" floating text |
| 4-I | **Crystal ambient sparkles** | `GridSystem.crystalCells` tracks crystal tiles; `Game.update()` emits idle green sparkle particles from crystal positions |
| 4-J | **Escalation reinforcements** | From wave 3 onward, one mid-wave reinforcement group spawns at ~65% kills using the wave's dominant enemy type |
| 4-K | **Spatial audio panning** | World SFX accept optional screen positions and pan through Web Audio `StereoPannerNode` for tower shots, enemy events, explosions, boss alerts, and core hits |

**Next: Continue Phase 4**

---

## TABLE OF CONTENTS

1. [Rendering & Graphics](#1-rendering--graphics)
2. [Visual FX & Juice](#2-visual-fx--juice)
3. [Game Feel & Feedback](#3-game-feel--feedback)
4. [HUD & Interface](#4-hud--interface)
5. [UI/UX & Menus](#5-uiux--menus)
6. [Gameplay Mechanics](#6-gameplay-mechanics)
7. [Enemy Design & AI](#7-enemy-design--ai)
8. [Tower Design & Depth](#8-tower-design--depth)
9. [Physics & Movement](#9-physics--movement)
10. [Audio & Soundscape](#10-audio--soundscape)
11. [Meta-Progression & Roguelite Loop](#11-meta-progression--roguelite-loop)
12. [Content & Level Design](#12-content--level-design)
13. [Performance & Technical Polish](#13-performance--technical-polish)
14. [Accessibility & Settings](#14-accessibility--settings)

---

## 1. RENDERING & GRAPHICS

The game uses Canvas 2D with procedural geometry. The CRT aesthetic is a strong foundation — push it into a full visual identity.

### 1.1 Shader-Like Canvas Post-Processing
- [x] Replace the basic CRT scanline (3px stripes, 10% opacity) with a **true scanline shader simulation**: alternating dark/bright horizontal bands with sub-pixel curvature distortion applied to the canvas via `ctx.transform` *(animated brightness variation per row)*
- [ ] Add **barrel distortion** by rendering the game to an off-screen canvas and using `ctx.drawImage` with a warped quad (approximate via stepped horizontal strips) to simulate CRT screen curve
- [x] Add a **chromatic aberration pass**: draw subtle screen-blend fringe offsets in high-quality mode using `previousFrameCanvas` *(disabled by reduced flashing / reduced motion; stronger when core integrity is low)*
- [x] Add a **phosphor persistence / motion blur effect**: draw the previous frame at low opacity before the current frame using a dedicated ghost canvas *(previous-frame canvas composited with screen blend)*
- [x] Add a **noise/film grain overlay**: every frame sample a pre-generated 256×256 noise texture at a random offset *(256px procedural noise texture sampled at random offsets in CRT pass)*
- [x] Make the vignette **animated** — pulse it on core damage events, breathe it slowly at idle *(vignette deepens when core < 30%)*

### 1.2 Lighting System
- [x] Implement a **dynamic point light system**: every active projectile, tower muzzle, and explosion source emits a radial gradient glow onto a dedicated "light layer" composited with `screen` blend mode *(offscreen canvas composite at 0.55 alpha; towers, projectiles, muzzle flashes, rings, bosses, slowed enemies all emit radial gradients)*
- [x] Give each **tower type its own light color**: Pulse = cyan, Tesla = purple, Mortar = orange, Railgun = white, Flamer = red-orange, Stasis = blue, Blaster = green *(per-tower color from towerDefinitions)*
- [x] **Enemy glow**: bosses, slowed enemies, and critical enemies emit coloured halos *(leviathan gets magenta glow, slowed enemies get purple)*
- [x] **Core light**: the core casts a pulsing cyan ambient glow across surrounding tiles, intensifies at low HP *(corePulse radial gradient in buildLightLayer)*
- [ ] Add **tile-level ambient occlusion**: darker shading in corners and along rock/crystal edges to give the grid depth
- [ ] Implement a **"darkness mode" upgrade or sector**: darken the entire map and towers emit pools of visibility light, forcing placement strategy around vision

### 1.3 Tower Visual Overhaul
- [ ] Replace plain colored polygon towers with **multi-layered procedural art**: base platform + weapon barrel/dish + level indicator rings all as separate animated components
- [x] Add **idle animations** to every tower: Pulse rotating arcs, Stasis orbiting shards, Barrier rotating shield bars, Tesla micro-arc crackles, Railgun capacitor charge fill bar *(per-type idle animation in drawTower; all driven by t.timer)*
- [x] Add **firing animations**: fire-burst `shadowBlur` spike via `t.recoil`; Railgun charge fill glows when ready *(recoil state on Tower, decays each frame)*
- [ ] Level-up towers gain **visual complexity**: new geometric elements added at each level (extra antenna, wider base, more barrel ports)
- [ ] Specialization visuals: applying a specialization **changes the tower silhouette** — e.g. Focus Lens Pulse gains a visible lens ring, Chain Storm Tesla grows additional coil nodes
- [x] Tower **construction animation**: when placed, tower assembles from parts flying inward over 0.4s *(new `buildProgress` field; towers do not fire until the animation completes)*

### 1.4 Enemy Visual Overhaul
- [ ] Replace single-color circle/polygon enemies with **multi-part procedural designs**: body core + leg/wing/fin appendages that animate during movement
- [x] **Scout**: fast-moving teardrop with a velocity-trailing tail that stretches with speed *(gradient trail from `e.vel` direction, alpha 0.55, proportional width)*
- [x] **Brute**: visible damage cracks at HP < 66%, deterministically seeded from `e.maxHp` so they don't flicker *(4 crack lines radiating outward)*
- [ ] **Weaver**: pulsing circular body with orbiting "heal orbs" that visually fly to nearby allies when healing
- [x] **Phantom**: 3 concentric rotating shimmer rings with dashed stroke + lineDashOffset animation — ring speed and color vary per layer; isPhased state increases ring alpha *(phantom shimmer)*
- [ ] **Carrier**: wide body with visible "hatch" that opens as it takes damage; scouts visible inside until released
- [x] **Leviathan boss**: 3 animated multi-segment rotating rings at radii 1.85/2.4/3.0× size, each ring has gap segments; ring directions alternate CW/CCW *(multi-ring leviathan)*
- [ ] Add **death animations** to all enemies: dissolve into colored particles matching their body color, not generic sparks
- [ ] Enemies accumulate **battle damage**: burn marks from Flamer hits, ice cracks from Stasis, electric scorch marks from Tesla

### 1.5 Environment & Map
- [x] **Animated grid**: grid lines pulse with a sinusoidal wave that travels across columns/rows driven by `elapsed` *(per-line alpha varies 0.015–0.065 via sin wave)*
- [ ] **Terrain variety**: rocks have procedurally varied shapes (not all the same polygon) with cracks and shadow edges
- [ ] **Crystal clusters**: crystals animate with a slow rotation and emit faint sparkle particles at idle *(sparkle particles are implemented via `GridSystem.crystalCells`; slow crystal rotation still pending)*
- [x] **Spawner portals**: spawner cells should be vivid glowing portals with a rotating ring and energy tendrils — not static markers *(rotating segmented ring, pulsing red core, 6 energy tendrils)*
- [x] **Core redesign**: the 2×2 core is a multi-layered signal node — outer ring with HP arc + tick marks, counter-rotating inner ring, 4 antenna arms, 8-sector orb (sectors darken as HP drops), radial inner glow *(full drawCore() rewrite)*
- [x] Add a **background star field** layer to reinforce the sci-fi space feel *(120 twinkling stars drawn with per-star sinusoidal alpha variation)*
- [ ] Add **sector-specific environment themes**: asteroid sector = rocky dark background, orbital station = metal grate patterns, deep space = nebula gradients

---

## 2. VISUAL FX & JUICE

Juice is the difference between "functional" and "epic." Every action should have a satisfying visual response.

### 2.1 Projectile FX
- [x] **Tracer trails**: every projectile leaves a fading color trail (deque of past positions, alpha-faded line segments) *(6-point trail with alpha fade + bright bullet head)*
- [x] **Bullet types**: Blaster = tiny green rectangle, Pulse = expanding ring, Railgun = full-screen horizontal beam flash with afterglow *(owner-specific projectile silhouettes + railgun beam pass)*
- [x] **Mortar arc**: mortar shell follows a parabolic arc (sin-curve vertical offset 0→34px→0) with a ground-shadow ellipse that grows/shrinks inversely with altitude *(progress = 1 - life/maxLife)*
- [x] **Impact flashes**: on enemy hit, spawn a brief directional impact spark burst at the hit point *(damage routing now emits directional spark bursts from source-to-target angle)*
- [x] **Railgun beam**: fill the entire tile column/row between tower and target with a bright white beam that fades in 0.15s — not just a particle *(screen-edge railgun beam with colored afterglow + white core)*
- [x] **Flamer cone**: replaced beam with particle ribbon — 7 orange/red/yellow particles per fire tick fanning out within ±0.6 rad cone with gravity, speed scaled to range *(spawnFlameJet in ParticleSystem)*
- [x] **Tesla arcs**: two-pass subdivision (dist/8 + secondary pass) giving finer jaggedness; 55% chance random branch; per-frame flicker (20% skip chance); dual outer-glow + white-core stroke passes *(upgraded spawnLightning + drawLightning)*
- [x] **Stasis field**: when a Stasis tower fires, the target enemy should visually freeze — render it in a desaturated blue-white palette and add ice crystal spikes around it *(freeze timer drives blue-white render palette + orbiting ice spikes)*

### 2.2 Explosion & AoE FX
- [x] **Mortar explosions**: multi-ring shockwave (3 expanding rings at different speeds), debris particles that follow parabolic gravity arcs, lingering ground scorch decal *(spawnMortarExplosion adds 3 rings, gravity debris, and fading scorch decals)*
- [x] **Chain explosion** (Carrier death releasing scouts): each scout spawns with an inward-burst animation, not just appearing *(carrier death now gives each scout a spawn scale-in + inward particle burst)*
- [x] **Boss phase transitions**: full-screen white flash + screen shake + temporal slow-mo dip for 0.5s *(phase enter emits screen flash, shake, and 0.5s slow-mo)*
- [x] **Core hit**: red shockwave ring emanates from core center, camera shakes toward the hit direction (not random), screen flashes red at edges *(directional + rotational shake implemented)*

### 2.3 Tower-Fire Feedback
- [x] **Muzzle flash**: already exists — expand it to a directional cone-shaped flash, not just a circle *(drawMuzzleFlashes renders a directional cone + white core)*
- [x] **Tower glow pulse on fire**: the tower's ambient glow briefly spikes to 3× intensity when firing *(light layer scales tower radius/alpha from recoil)*
- [x] **Cooldown indicator**: a subtle arc around the tower base fills from 0→1 between shots (like an ability timer) *(arc glows tower color when ready, green for harvester)*
- [x] **Overheat visual** (Flamer only): barrel glows red-hot while firing; brief cooling steam puff if fired for 3+ consecutive seconds *(`heatTimer` on Tower; orange→red barrel glow; Poisson steam particles when heat > 5)*

### 2.4 Upgrade & Economy FX
- [x] **Level-up**: tower level-up triggers an expanding golden ring + floating "LEVEL 2" text + brief particle shower *(gold ring + tower-color ring + particle shower + floating LEVEL text)*
- [x] **Specialization unlock FX pass**: specialization applies a slow-motion pop, radial burst, dual rings, color-matched particles, upgrade SFX, and "SPEC LOCKED" floating text *(camera zoom/color-shift variant still available as future polish)*
- [ ] **Credit gain**: harvester income spawns credit coin icons that fly from harvester to the HUD credit counter
- [x] **Kill streak**: after 5 kills in 2 seconds, display a "CHAIN KILL ×5" floating text in the center with a color flash *(center-screen text, burst, expanding ring, escalates every +3 kills)*

---

## 3. GAME FEEL & FEEDBACK

### 3.1 Screen Shake Refinement
- [x] Replace the current additive random shake with **directional trauma shake**: shake direction biased toward the source of damage *(60% directional, 40% perpendicular random)*
- [x] Add **rotational screen shake** component (small canvas rotation ±1-2°) during explosions *(shakeRot state variable, decays independently)*
- [ ] Differentiate shake profiles: core hit = long low-frequency rumble, explosion = sharp high-frequency snap, boss phase = sustained medium frequency
- [ ] Add a **"bass drop" frame**: 1 frame of pure black on large explosions before the flash (mimics the punch of film sound)

### 3.2 Hit Stop / Time Manipulation
- [x] **Hit stop**: when an enemy dies to a high-damage attack, freeze all movement for 2-4 frames to emphasize impact *(0.07s freeze when a single hit deals ≥35% max HP; particles still render)*
- [x] **Slow-motion kill cam**: boss death triggers 0.2× speed for 1.5s with dramatic zoom-in on the boss corpse *(slowMoScale=0.12 for 2.2s, triple rings, "SIGNAL ELIMINATED" text, white flash)*
- [ ] Expand **slow-mo** usage: player can optionally purchase a "Tactical Pause" upgrade that allows 1 manual slow-mo trigger per wave
- [ ] **Speed feedback**: game speed indicator (×1, ×2, ×4) should animate when changed — a sliding tape counter, not just text

### 3.3 Damage Number System
- [x] Floating numbers currently exist — make them dramatic:
  - [x] Small hits: small white numbers, drift upward, fade
  - [x] Critical hits (top 20% of possible damage): large yellow/orange numbers with a brief expand-then-settle animation *(tiered: white→yellow→orange→red)*
  - [x] Boss damage: extra-large red numbers *(size 18 for boss crits)*
  - Healing: green numbers with a + prefix *(already existed)*
  - [x] Miss/immune: grey "IMMUNE" or "PHASED" text for phasing enemies *(shows "PHASED" in purple)*
- [x] Add **damage accumulation indicator** on enemies: show the total damage dealt to an enemy this wave as a thin progress bar above the HP bar *(thin yellow accumulated-damage bar above HP)*

### 3.4 Tower Interaction Feel
- [x] **Hover preview**: hovering over a tower in the build menu should show a semi-transparent ghost on the grid that updates in real time as mouse moves *(build menu hover feeds the canvas placement ghost via InputSystem)*
- [x] **Placement snap**: ghost tower should snap to valid tiles with a satisfying "lock" micro-animation (small scale bounce) *(valid-cell transitions trigger a short scale bounce)*
- [x] **Invalid placement feedback**: ghost turns red + brief shake micro-animation + a "blocked" sound byte when hovering over invalid cells *(invalid cells tint red, shake, and play throttled reject SFX)*
- [ ] **Sell confirmation**: instead of immediate sell, show a 0.5s dissolve animation of the tower breaking apart into credits raining down

---

## 4. HUD & INTERFACE

### 4.1 Core Integrity Display
- [x] Replace the plain HP percentage text with a **segmented integrity bar**: 10 visual segments that go dark as HP drops, with a crackling animation on the active edge segment *(10 lit segments, each colored green/yellow/red)*
- [x] The bar should **pulse red** when below 30%, with an audible heartbeat-like beep *(CSS keyframe pulse animation on critical class)*
- [x] Show **armor/shield layer** if a barrier tower bonus applies — visualized as a thin outer ring on the core *(Deflector Grid draws a dashed shield ring on the core)*
- [x] Add a **"CRITICAL" overlay** when core integrity < 15%: red border pulses around the entire screen *(inset box-shadow pulse overlay at < 15%)*

### 4.2 Wave Information Panel
- [x] Show a **live enemy composition strip** for the current incoming wave: small enemy icons in a horizontal row that gray out as those enemies are killed *(HUD INCOMING strip tracks killed/total by type)*
- [x] Show **estimated time to wave completion** once all enemies are spawned *(ETA appears after all spawns finish, based on remaining path distance)*
- [x] Add a **path threat indicator**: overlay color-coded tile heat on the grid showing the most-traveled pathways (red = high traffic, yellow = medium, blue = low) *(H key toggles live enemy-density + flow-field convergence heatmap)*
- [x] Show **upcoming waves** as a scrollable mini-timeline at the bottom (2-3 waves ahead visible) *(HUD NEXT timeline shows the next three wave names during planning)*

### 4.3 Economy & Build Panel
- [x] **Credits display** should animate: credit numbers roll up/down like an odometer, not jump instantly *(HUD credit count eases toward target value)*
- [x] Show **"affordable"** towers in the build menu with a subtle gold shimmer; **"unaffordable"** towers should show their cost in red and be visually dimmed *(affordability classes and red unaffordable costs)*
- [x] Add **DPS readout** on selected tower info panel (calculated from damage, fire rate, and specialization) *(uses effective tower stats including run upgrades/synergies)*
- [x] Show **total credits earned / spent** this run as a mini-stat on the economy panel *(build menu economy mini-stat; spend path centralized)*
- [x] Build menu should show **tower synergies**: when a tower is selected for placement, nearby compatible towers briefly highlight (e.g. Harvester highlights towers that get Relay Node bonus) *(selected build tools pulse compatible towers and link to nearby hover cells)*

### 4.4 Selected Tower Panel
- [x] **Upgrade cost progression visualization**: show the cost for next 3 levels as a small chart *(NEXT cost chips in TowerPanel)*
- [x] Show **kill count** for the selected tower (how many enemies this tower has killed this run) *(tower-owned kill tracking wired through DamageSource)*
- [x] Show **total damage dealt** by this tower *(actual post-armor damage is accumulated per tower)*
- [x] Show **specialization preview**: if at level 3, show the specialization choice with description before selecting *(level-before-unlock preview + active choice cards use descriptions)*
- [x] Tower panel slides in from the side with a smooth CSS transform animation, not an instant appearance *(panel stays mounted and transitions opacity/translateX)*

### 4.5 Kill Feed
- [x] Add a **scrolling kill feed** on the right side: last 5-8 kills listed with tower icon → enemy icon → damage dealt, entries fade out after 3s *(KillFeed component listens to enemy kill payloads)*
- [x] Highlight exceptional events: "LEVIATHAN SLAIN", "CHAIN KILL ×8", "PERFECT WAVE" *(boss, streak, and no-core-damage wave events use special feed entries)*

---

## 5. UI/UX & MENUS

### 5.1 Main Menu
- [ ] **Animated background**: the main menu should show the game world in the background — an active wave playing out in slow-motion with blurred depth-of-field effect
- [ ] Title "LAST SIGNAL" should use a **glitch text animation**: letters scramble and lock in one by one on load
- [ ] Add a **transmission static animation** to the title — random characters flicker around the title text
- [ ] Add subtle **particle streams** (data packets?) flowing from the background toward the title
- [ ] Show **last run summary** below the start button: "Last run: Wave 12, Sector 2, Core: 47%" in small text

### 5.2 Sector Select Screen
- [ ] Upgrade from a list to a **star map**: sectors shown as nodes connected by dotted travel lines, with current unlock state shown
- [ ] Each sector node should pulse with light and show a miniature preview of its map layout
- [ ] Add **lore blurbs** per sector: brief flavor text explaining the threat level and environment
- [ ] Difficulty selector should be a **sliding toggle** with color indicators (green → yellow → orange → red)

### 5.3 Reward Choice Screen
- [x] **Card flip animation**: the 3 reward cards flip face-up sequentially with a 0.15s stagger *(CSS rotateX reveal with staggered animation delay)*
- [x] Cards should have a **visual rarity tier**: Common (grey), Uncommon (blue), Rare (purple), Legendary (gold) with particle effects matching rarity *(rarity colors/shadows on cards)*
- [x] Show card **synergy hints**: "Pairs well with Tesla" or "Amplifies Harvester income" *(data-driven `synergyHint` on upgrades)*
- [ ] Hovering a card expands it slightly and shows a full description, not just on-click
- [x] Add a **"Reroll" option** (costs credits or a limited resource) to replace all 3 cards *(35CR reroll avoids previous choices when possible)*

### 5.4 Game Over & Victory Screens
- [ ] **Game Over**: data corruption / static disintegration effect — the game canvas pixelates and dissolves, then the game-over screen assembles
- [ ] **Victory**: signal transmission animation — waves ripple outward from the core as if a signal is being sent, then the victory card flies in
- [ ] Show a **detailed run summary**: total kills by tower type (pie chart), damage dealt, credits earned, wave timeline, core integrity over time
- [ ] Add a **high score comparison**: "Your best: Wave 12 | Previous best: Wave 9 ▲ +3"

### 5.5 Planning Phase UX
- [ ] **Tower placement guide**: on first placement attempt for each tower type, show a brief animated tooltip explaining range and function
- [ ] The **20s countdown timer** should be a prominent circular arc timer in the center-top (not small text), changing color from green → yellow → red
- [x] Add a **"Quick Build" mode**: holding Shift keeps the same tower type selected after placement so you can spam-build without re-selecting *(normal placement clears selection; Shift preserves it)*
- [x] Show a **heatmap overlay** toggle — show which tiles see the most enemy traffic based on the flow field *(H key toggles live blue→yellow→red heat overlay)*

---

## 6. GAMEPLAY MECHANICS

### 6.1 Tower Mechanics Depth
- [x] **Tower synergy system**: explicit bonuses when towers are adjacent — Stasis near Tesla gives Tesla +30% chain range (since slowed enemies clump); Harvester near Barrier gives Barrier +1 pulse per second *(active synergy cards show on selected towers)*
- [x] **Priority targeting modes**: add a targeting mode selector per tower — Closest to Core (current), Weakest, Strongest, Most Threatening (carries/weavers first), Fastest *(4-mode selector buttons in TowerPanel: NEAR/WEAK/STRG/FAST)*
- [x] **Manual fire / ability activate**: right-click a tower to manually trigger one shot or ability (with a long cooldown) — gives player direct control at critical moments *(right-click selected tower fires/activates; 12s manual cooldown)*
- [x] **Tower pivoting**: towers currently auto-rotate to face targets — add a visual "seek" animation where the barrel sweeps before locking on *(Tower.angle now eases toward live target)*
- [x] **Overcharge mechanic**: if a tower hasn't fired for 5+ seconds (no targets), its next shot is 3× damage — rewards strategic placement in dead zones *(yellow overcharge ring and ×3 shot text)*

### 6.2 Economy Depth
- [x] **Credit interest**: a small percentage (1-2%) of banked credits is added per wave — rewards careful saving *(2% interest payout on wave complete)*
- [x] **Sell loss reduction**: upgrade that reduces sell penalty from 50% to 60%, 70%, 80% — makes repositioning less punishing *(salvage upgrades now offer 60/70/80% and aggregate keeps the best refund)*
- [x] **Credit multiplier events**: random mid-wave events where a bonus "data cache" enemy spawns — kill it for a large credit burst *(42% chance at 50% wave kills; cache is fast+fragile, worth 50 credits, breach:0 so it just escapes)*
- [ ] **Salvage system**: when an enemy walks past a tower without being shot (out of range), it drops salvage the player can click to collect

### 6.3 Core Mechanics
- [x] **Core repair**: allow spending credits to repair core integrity between waves (5% repair per 30 credits, up to 80% max) *(HUD repair button during planning/wave-complete)*
- [x] **Core abilities**: the core itself should have 1 active ability (e.g. EMP burst that stuns all enemies for 2s, cooldown 60s) — activated by clicking the core *(click core or HUD EMP button during waves)*
- [ ] **Breach mechanics**: enemies that reach the core should briefly "interact" with it — animation of them attacking the core station, not just walking through
- [x] **Core shield**: Barrier tower specialization "Deflector Grid" should visually create a shield around the core that absorbs 1 hit *(Barrier specialization reduces each breach by 1 while covering core)*

### 6.4 Strategic Depth
- [ ] **Chokepoint rewards**: if enemies are forced through a single tile for an extended time, spawn a "tactical bonus" notification
- [ ] **Kill zones**: player can designate 1 "kill zone" per wave — an area where all tower damage is +20% for that wave
- [ ] **Tower recall**: one-time ability per sector to reclaim a tower at full cost (not just 50% sell) — massive QoL for early misplacements
- [x] **Emergency mode**: if core integrity drops below 20%, a timer-based "Emergency Protocol" activates: all tower fire rates +50% for 15s, then towers overheat for 5s *(one-shot emergency trigger per run)*

---

## 7. ENEMY DESIGN & AI

### 7.1 Behavioral AI Improvements
- [ ] **Flanking behavior**: a percentage of scouts in later waves attempt alternate routes — if the primary path is heavily defended, they spread to lightly-defended edges
- [ ] **Formation movement**: Grunts and Brutes travel in loose formations and close ranks when one is killed, providing mutual "cover" (shared threat reduction)
- [ ] **Adaptive pathing**: enemies with pathfinding intelligence (Weaver, Overlord) slightly deviate from the flow field to avoid tower splash zones when possible
- [x] **Fear response**: when a Carrier is killed, nearby spawned scouts briefly scatter in random directions before regrouping toward the core *(radial knockback 160 + 1.2s stun to all scouts within 130px)*

### 7.2 New Enemy Mechanics
- [ ] **Shield Drone companion**: small drone that orbits a Brute and absorbs the next projectile hit, then is destroyed
- [x] **Tunneler enemy**: enemy that moves underground (invisible on grid) and surfaces at a random tile closer to the core *(dive/surface cycle every 3.5–5.5s; 3× speed + untargetable underground; dirt burst FX; ripple ring while tunneling)*
- [x] **Saboteur enemy**: enemy that temporarily disables a random tower it walks past (similar to boss phase 3 mechanic) *(38px proximity check; 3s disable, 8s cooldown; orange spark burst + DISABLED text)*
- [ ] **Mirror enemy**: enemy that copies the last projectile type that hit it and fires it back at the shooting tower

### 7.3 Boss Improvements
- [ ] **Leviathan visual overhaul**: multi-segment serpentine body with each segment taking independent damage and dying separately
- [x] **Boss entrance**: Leviathan enters via a dramatic arrival animation — emerging from the spawner portal with a shockwave and boss music sting *(2.2s frozen entrance with contracting portal ring, scale-in body, screen flash, shake, slow-mo, floating alert text)*
- [ ] **Phase transition cinematics**: brief "phase change" cutscene — 0.5s slow-mo, boss flashes, new ability telegraph shown as a glowing warning ring before activating
- [ ] **Second boss (Harbinger)**: introduce a ranged boss that stays at map edge and fires massive artillery shells — requires tower + positioning to draw it into range
- [x] **Boss health bar**: dedicated boss HP bar at the top center of screen (separate from regular enemy HP bars) with phase markers shown as thresholds *(yellow tick marks at 70%/40%/15%; dim red once crossed; "INCOMING" label during entrance)*

### 7.4 Enemy Variety & Spawning
- [x] **Mini-boss waves**: occasional single-enemy "elite" variants of standard enemies at 150% HP and size with a glowing border *(6% chance at wave 5+; 150% HP; golden glow border in RenderSystem)*
- [ ] **Ambush events**: surprise spawns from non-standard directions (not just the 8 designated spawners) — e.g., a crack appears mid-map
- [x] **Swarm intelligence**: Swarm enemies visually flock using boid separation/cohesion — they bunch together and split around obstacles in a fluid way *(cohesion force toward center-of-mass of nearby swarm within 55px)*
- [x] **Enemy telegraphing**: 1s before a wave sub-group spawns, the spawner portal glows brighter and shows the enemy type icon above it *(WaveSystem `telegraphSigns` getter + RenderSystem red pulse ring 1.5s before spawn)*

---

## 8. TOWER DESIGN & DEPTH

### 8.1 New Tower Types
- [ ] **Reflector Tower**: places a mirror on the grid that redirects Railgun beams — allows creative angled shots
- [ ] **Amplifier Tower**: doesn't fire; instead boosts all towers within 3 tiles by +15% damage — a purely support tower
- [ ] **Snare Tower**: fires a net projectile that instantly stops an enemy for 2s then shatters — no damage, pure control
- [ ] **Overclock Station**: applies a temporary +50% fire rate to one adjacent tower for 5s, then recharges for 15s

### 8.2 Specialization Expansion
- [x] Every tower should have **3 specialization choices at level 3** (some currently have fewer) — offer meaningful divergence *(all towerSpecializations entries expose three choices)*
- [ ] Add **level 5 "Pinnacle" upgrades**: a second specialization choice unlocked at max level that combines with the first
- [ ] **Cross-tower specializations**: unlock a specialization for one tower type by having another tower type at level 3 nearby (e.g., "Cryo Proximity" for Pulse Tower only available if Stasis is adjacent)
- [x] Show specialization **unlock preview at level 2**: the specialization options are shown as silhouettes so the player knows what's coming *(TowerPanel shows locked specialization cards one level before unlock)*

### 8.3 Tower Economy Balance
- [x] **Tower tiers**: organize towers into 3 tiers (Early / Mid / Late) unlocked progressively within a run based on wave number — prevents players from rushing Railgun at wave 1 *(mid towers unlock wave 3, Railgun wave 6)*
- [x] **Build limit**: cap the total number of each expensive tower (Railgun: max 3, Tesla: max 4) — forces diversification *(TowerSystem canPlace enforces limits and BuildMenu shows limit state)*
- [x] **Combo discounts**: building a specific combination (e.g. Stasis + Tesla adjacent) reduces the combined cost by 10% *(Stasis/Tesla and Barrier/Harvester adjacency discounts apply at placement)*

---

## 9. PHYSICS & MOVEMENT

### 9.1 Projectile Physics
- [x] **Projectile arc**: Mortar shells follow a true parabolic arc with a visible shadow on the ground below the shell *(rendered with sin-arc elevation and dynamic ground shadow)*
- [ ] **Bounce projectile** (Railgun upgrade "Ricochet"): beam bounces off rocks/walls up to 2 times
- [ ] **Gravity field**: Stasis upgraded to "Singularity" should pull nearby enemies toward the target point in addition to slowing
- [x] **Projectile collision with terrain**: projectiles that miss their target should hit rocks and spawn small sparks *(orphaned bullets now test rock cells and emit impact sparks)*

### 9.2 Enemy Movement
- [x] **Enemy acceleration**: enemies don't instantly move at max speed — they accelerate from stop and decelerate as they slow (adds weight and feel) *(velocity eases toward desired flow speed and decays while stunned/slowed)*
- [x] **Collision avoidance**: enemies slightly steer around each other, preventing perfect stacking (currently they can stack perfectly) *(nearby enemy separation feeds desired velocity)*
- [x] **Path smoothing**: enemies follow flow-field gradient but with a slight momentum — they don't hard-turn 90° at grid corners; they curve *(flow vector is blended into current velocity over time)*
- [x] **Knockback**: heavy hits (Mortar direct hit, Railgun) knock enemy back 10-20px with a velocity that decays — satisfying and creates mini crowd control *(railgun/heavy hits and mortar splash add decaying knockback velocity)*

### 9.3 Drone Physics
- [x] **Drone inertia**: drones already use boid steering — add momentum lag so they don't immediately respond to new targets (feels more physical) *(steering acceleration is lerped before applying to velocity)*
- [x] **Drone bobbing**: add a sinusoidal vertical hover oscillation to all drones (different phase per drone for organic feel) *(per-drone bobPhase offsets render Y position)*
- [x] **Formation flying**: 3+ drones of the same type naturally form a geometric pattern when idling (triangle, diamond) *(idle same-type drones seek rotating formation slots around the core)*

---

## 10. AUDIO & SOUNDSCAPE

### 10.1 Music System
- [ ] Replace the single-oscillator sawtooth BGM with a **layered music system**: bass layer + melody layer + percussion layer, each independently mixed
- [x] Add **adaptive music**: music intensity layer adds during wave active, drops to ambient during planning *(tension oscillator cross-fades in 1.8s; boss spawns trigger intensity 2; beat pulse every 1.8s during waves)*
- [x] Add **boss music**: trigger a separate tense music track when the boss spawns (e.g., faster tempo, minor key, added percussion) *(boss spawn → setMusicIntensity(2); louder tension layer + more frequent beats)*
- [x] **Victory / Game Over stings**: brief distinct musical phrases, not just one oscillator sweeping *(victory arpeggio + descending game-over phrase)*
- [ ] Support for importing **OGG/MP3 tracks** via the Web Audio API as a future upgrade path (architecture ready)

### 10.2 SFX Overhaul
- [x] **Tower-type SFX**: each of the 9 towers should have a unique procedurally generated sound — Railgun is a powerful crack/thud, Flamer is a roaring sizzle, Stasis is a crystalline chime, Tesla is an electric snap *(sfxTesla, sfxRailgun, sfxMortar, sfxFlamer, sfxStasis all implemented with distinct timbres)*
- [x] **Enemy SFX**: enemies make sounds on arrival (portal entry), on special ability use (Weaver heal hum, Phantom phase toggle shimmer), and on death (type-specific death sounds) *(spawn, heal, phase, carrier spawn, and death calls wired through EnemySystem)*
- [x] **UI SFX**: button hover, button click, panel open/close, achievement unlock, reward card flip — all need short punchy SFX *(UIManager event delegation + toast/card/panel sounds)*
- [x] **Spatial audio**: world SFX pan left/right based on screen X using Web Audio `StereoPannerNode` *(tower fire/build/upgrade/sell, enemy arrival/death/abilities, boss alerts, core hits, drone fire, and mortar explosions pass positions into AudioSystem)*
- [x] **Reverb tail**: add a convolver reverb effect to explosion SFX for depth *(short procedural impulse response mixed into explosion wet path)*
- [x] **Credit pickup sound**: a satisfying "cha-ching" style SFX when credits are collected from harvesters *(harvester ticks call sfxCredit)*

### 10.3 Audio Polish
- [x] **Volume ducking**: automatically lower music volume when a boss alert or critical SFX plays *(boss alerts and core hits temporarily duck music gain)*
- [x] **Audio limiter**: add a dynamics compressor on the master output to prevent clipping when many SFX overlap *(master bus now feeds DynamicsCompressorNode)*
- [x] **Sound prioritization**: cap simultaneous SFX voices by category (max 8 bullet sounds, max 4 explosions) — prevents audio mud *(category expiry caps for bullets, explosions, enemy, UI, alert, reward)*

---

## 11. META-PROGRESSION & ROGUELITE LOOP

### 11.1 Run Variety
- [x] **Modifier events**: each sector can roll 1-3 random modifiers at start — "Haunted: enemies heal 2 HP/s", "Overclock: towers fire 20% faster but cost 20% more", "Scarcity: no harvester income this run" *(8 modifiers across debuff + mixed categories; HUD chip strip; effects in EnemySystem + TowerSystem)*
- [ ] **Starting loadouts**: player picks a starting kit instead of starting with nothing — "Assault": 200 credits + 2 free blasters; "Economic": 150 credits + 1 free harvester; "Experimental": 100 credits + random legendary upgrade
- [ ] **Milestone unlocks**: completing specific challenges mid-run (e.g. "Reach wave 10 with core above 80%") unlocks a bonus upgrade slot
- [ ] **Curse system**: at the Reward Choice screen, add a 4th optional "cursed" card — powerful bonus at the cost of a permanent debuff for the run

### 11.2 Research & Unlock System
- [ ] **Research tree visual**: replace the flat list with a proper **tech tree visualization** — nodes connected by lines, greyed out until unlocked, with hover-over previews
- [ ] **Prestige system**: after completing all sectors, unlock a "Prestige" that resets research but gives a permanent multiplier
- [ ] **Daily challenge**: a fixed seed run with a leaderboard — same map, same wave, same modifiers for all players on a given day
- [ ] **Achievement showcase**: achievements displayed as medals/badges on the main menu with percentage of players who have earned each

### 11.3 Roguelite Depth
- [ ] **Build archetype bonuses**: if by wave 8 you have 5+ Harvesters, trigger the "Merchant" bonus archetype (+20% income for the rest of the run)
- [ ] **Synergy discoveries**: first time you combine specific tower pairs and get above a damage threshold, unlock a named "Discovered Combo" with a bonus
- [ ] **Run journal**: a persistent log of each run with timestamp, sector, wave reached, build, key events — players can review past runs

---

## 12. CONTENT & LEVEL DESIGN

### 12.1 New Sectors & Maps
- [ ] **Sector 2: Orbital Platform** — tight corridors, multiple entry points, metal grate aesthetic, gravity wells as new terrain type
- [ ] **Sector 3: Deep Space Wreckage** — asymmetric ruined hull, cracked walls that enemies can breach, crystals everywhere, dark with limited tower light radius
- [ ] **Sector 4: Hostile Core** — the final sector, enemies start pre-buffed, 20 waves, 2 bosses, no planning timer
- [ ] **Procedurally generated sectors**: a "Void" mode where the map layout is randomized each run from a set of pre-designed room templates stitched together

### 12.2 New Wave Events
- [ ] **"Blitz" waves**: all enemies spawn simultaneously (no stagger) — tests AoE capability
- [ ] **"Silence" waves**: no new enemies, but existing surviving enemies get healed to full — tests cleanup efficiency
- [x] **"Escalation" sub-events**: mid-wave reinforcement drops once per wave from wave 3 onward near the 65% enemy-killed mark *(spawns 2 + waveIndex/2 reinforcements of the wave's dominant enemy type at a random spawner)*
- [ ] **"Boss Rush"**: wave 15 sends all unique enemy types in sequence — a gauntlet finale

### 12.3 Environmental Hazards
- [ ] **Meteor showers**: random tiles in the map become danger zones (shown with warning rings) that deal damage to enemies AND towers after 2s
- [ ] **Power surges**: random towers get a 3s free "overcharge" (double fire rate) from environmental power spikes
- [ ] **Gravity anomaly**: a moving slow field drifts across the map, slowing enemies AND projectile speeds in its radius
- [ ] **Signal interference**: towers within a radius of the interference zone have reduced range — the zone moves every 10s

---

## 13. PERFORMANCE & TECHNICAL POLISH

### 13.1 Rendering Performance
- [ ] **Dirty rect optimization**: only re-render changed regions of the canvas each frame instead of clearing and redrawing everything
- [ ] **Off-screen canvas caching**: pre-render static elements (terrain, grid, rocks) to an off-screen canvas and blit them once per frame
- [x] **Particle batching**: group particles by color and draw them in batches (single `beginPath` → multiple rects → single `fillStyle` → `fill`) instead of one draw call per particle *(opaque particles render by color bucket, translucent particles keep per-alpha draws)*
- [ ] **LOD (Level of Detail)**: reduce detail on enemies/towers far from the camera center — simpler shapes at distance for performance headroom
- [ ] **Web Workers**: offload pathfinding BFS recalculation to a Web Worker to prevent frame spikes when towers are placed

### 13.2 Code & Architecture
- [ ] **Event bus typed events**: convert the EventBus to use typed event maps — eliminates string typos and adds IntelliSense for all events
- [ ] **Entity pooling**: implement object pools for Particles, Projectiles, FloatingText — prevent GC spikes from constant allocation/deallocation
- [ ] **Save/load system**: serialize full game state to JSON for mid-run save (browser reload recovery)
- [ ] **Replay system**: record inputs and random seeds to allow replaying any run
- [ ] **Hot-reload data**: in dev mode, watch the data files and hot-reload balance values without restarting the game

### 13.3 Mobile / Responsive
- [ ] **Touch controls**: tap to select/place tower, pinch to zoom, long-press for tower details
- [ ] **Responsive canvas scaling**: currently fixed 800×640 — add `devicePixelRatio` scaling and CSS `transform: scale()` to fill any screen size
- [ ] **Mobile HUD layout**: stack HUD panels vertically on portrait screens, horizontal on landscape

---

## 14. ACCESSIBILITY & SETTINGS

### 14.1 Visual Accessibility
- [x] **Colorblind mode**: replace the color-only encoding of tower/enemy types with shape + color — no information should be color-only *(enemy and tower letter markers supplement existing silhouettes)*
- [x] **High contrast mode**: option to increase all UI element contrast ratios *(settings toggle adds high-contrast UI class)*
- [x] **Reduce motion mode**: toggle to disable screen shake, camera effects, particle overload *(render shake/CRT persistence are suppressed and particle budgets drop)*
- [x] **Font size scaling**: UI text should respect a font scale setting (0.8× → 1.0× → 1.2× → 1.5×) *(settings panel writes --ls-font-scale to UI root)*

### 14.2 Control Customization
- [ ] **Rebindable hotkeys**: all keyboard shortcuts (1-9, U, S, P, Space, +/-) should be configurable
- [ ] **Mouse button swap**: option to swap left/right click for tower placement
- [ ] **Gamepad support**: add controller support — D-pad to move cursor, A to select/place, B to cancel, triggers for speed control

### 14.3 Settings Panel Expansion
- [x] **Graphics quality**: Low / Medium / High presets that toggle: particle count, glow effects, CRT overlay, phosphor persistence *(low drops glow/CRT and particle count; medium reduces glow/particles; high enables full CRT/persistence)*
- [x] **Audio mixer**: individual sliders for Master, Music, SFX, UI — not just master + mute *(UI volume slider routes UI category sounds through a separate gain)*
- [ ] **Subtitles**: show text descriptions of audio cues ("TESLA CHAIN", "BOSS PHASE CHANGE", "CORE ALERT") for deaf/hard-of-hearing players

---

## IMPLEMENTATION PRIORITY ORDER

### Phase 1 — Foundation (Polish What's There)
1. HUD core integrity display segmentation and pulse
2. Damage number drama (crits, boss, immune text)
3. Tower cooldown arc indicator
4. Enemy path threat heatmap overlay
5. Phosphor persistence / motion blur pass
6. SFX per-tower differentiation
7. Targeting mode selector per tower
8. Screen shake directional + rotational

### Phase 2 — Visual Overhaul
1. Dynamic point light system
2. Tower idle animations + firing animations
3. Enemy multi-part procedural bodies
4. Projectile tracer trails
5. Mortar parabolic arc + shadow
6. Tesla recursive jagged lightning
7. Flamer particle ribbon
8. Core redesign (multi-layer, degrading)

### Phase 3 — Gameplay Depth
1. Tower synergy system
2. Targeting priority modes
3. Reward card rarity tiers + reroll
4. Run modifiers system
5. Boss entrance cinematics + dedicated boss HP bar
6. New enemy types (Tunneler, Saboteur)
7. Environmental hazards (meteor, gravity)
8. Credit interest / salvage economy

### Phase 4 — Content & Meta
1. Sector 2 map + theme
2. Research tree visual overhaul
3. Adaptive music layers (done)
4. Spatial audio panning (done)
5. Run journal / history
6. Daily challenge / seeded runs
7. New tower types (Reflector, Amplifier)
8. Prestige system

### Phase 5 — Polish & Platform
1. Colorblind / accessibility modes
2. Mobile touch + responsive canvas
3. Entity pooling + off-screen canvas cache
4. Web Worker pathfinding
5. Rebindable hotkeys
6. Save/load mid-run state
7. Gamepad support
8. Replay system

---

*Total improvement items: ~150 discrete tasks across 14 categories.*
*Document version: 1.1 — 2026-04-25*
