Comprehensive GPT Prompt: Turn LAST SIGNAL into a Professional Game Codebase

You are an expert senior game developer, TypeScript architect, gameplay designer, UI/UX designer, and technical director.

Your task is to take my current single-file HTML canvas prototype called LAST SIGNAL and turn it into a professional, modular, exciting, polished, expandable browser game.

This is not a small cleanup task. Treat this as a serious prototype-to-production transformation.

The current game is a sci-fi tactical tower-defense game where the player protects a signal core from waves of enemies by placing towers, harvesters, drones, and upgrades. The game already has a strong foundation: grid-based tower placement, flow-field pathfinding, waves, enemy types, towers, economy, drones, particles, procedural audio, screen shake, victory/game-over states, and a cyber/CRT visual identity.

Your job is to preserve the soul of the game, but rebuild it into a professional project with a proper file/folder structure, clean architecture, stronger gameplay, better UI, and much more exciting progression.

High-Level Goal

Transform LAST SIGNAL from a strong single-file prototype into a professional, modular, Vite + TypeScript game project.

The result should feel like a real small indie game prototype, not a toy demo.

It should demonstrate:

professional code architecture
modular TypeScript structure
clear separation of systems
maintainable data-driven design
polished gameplay loop
strategic depth
good UI/UX
strong game feel
extensibility
easy asset replacement
clean build/deploy setup
portfolio-quality presentation

The game should remain browser-based and playable locally with Vite.

Technology Requirements

Use:

Vite
TypeScript
HTML5 Canvas 2D
CSS
Web Audio API for procedural audio
no heavy game engine unless absolutely necessary
no React unless you have a very strong reason
no unnecessary dependencies
no placeholder architecture
no unfinished stubs

The game should run with:

npm install
npm run dev
npm run build

The final project should be deployable to GitHub Pages later.

Critical Output Rules

You must provide a complete implementation, not fragments.

You must output:

Complete file/folder structure.
Complete code for every important file.
package.json
vite.config.ts
tsconfig.json
index.html
all TypeScript files
all CSS files
all data files
clear instructions for installation and running
clear explanation of the architecture
no missing imports
no pseudocode
no “TODO: implement later” for core systems
no fake placeholder systems pretending to work
no broken references
no unused large dependencies

You may include minor future TODO comments only for optional future expansion, but the game itself must run.

Existing Game Identity to Preserve

Preserve and improve the following identity:

Title: LAST SIGNAL
Genre: Tactical sci-fi tower defense / roguelite defense
Tone: dark, mysterious, electronic, tactical, high-stakes
Visual style: CRT, neon cyan, dark grid, signal-core technology, corrupted anomalies
Core fantasy: You are defending the last remaining signal core against waves of hostile anomalies.

The player should feel like they are managing an emergency defense grid against increasingly dangerous digital/alien incursions.

Important existing terms to preserve or improve:

Signal Core
Core Integrity
Threat Level
Wave
Pulse Tower
Blaster
Stasis
Mortar
Tesla Array
Harvester
Hunter Drone
Phantom
Weaver
Carrier
Leviathan
Signal Secured
Signal Lost
Main Design Direction

Do not merely add more enemies and towers.

The game should become:

A tactical sci-fi roguelite tower-defense game where every wave asks the player to adapt.

The player should constantly make meaningful decisions:

Do I invest in economy or immediate defense?
Do I prepare for swarm, armor, healers, phasing, or boss pressure?
Do I upgrade one strong tower or build wider coverage?
Do I specialize a tower into damage, range, support, anti-phase, or economy?
Do I buy drones or save credits?
Do I start the next wave early for a bonus?
Do I repair the core or increase long-term power?
Which lane is most dangerous this wave?
Required Major Gameplay Improvements
1. Proper Game State Machine

Create a real state system.

Required states:

BOOT
MAIN_MENU
SECTOR_SELECT
PLANNING
WAVE_ACTIVE
WAVE_COMPLETE
REWARD_CHOICE
PAUSED
GAME_OVER
VICTORY

At minimum, implement:

main menu
planning phase
active wave phase
wave complete
reward choice
pause
game over
victory

The player should no longer be thrown immediately into endless automatic waves with no time to think.

2. Planning Phase Before Each Wave

Before each wave, show a planning phase.

The player should be able to:

inspect the next wave
see incoming enemy types
see which spawners/lanes will activate
place towers
upgrade/sell towers
buy drones
start the wave manually
optionally start early for a small credit bonus
pause or adjust speed

Required UI:

NEXT WAVE PANEL
- Wave number
- Wave name
- Enemy list
- Enemy abilities
- Lane/spawner information
- Threat summary
- Recommended counters
- Reward preview
- Start Wave button

Example:

WAVE 6 — WEAVER ESCORT

Incoming:
- 6 Brutes
- 3 Weavers

Threat:
Weavers heal nearby anomalies.

Recommended:
Stasis + Mortar, Tesla chain damage.

Reward:
+60 credits
Signal upgrade choice
3. Wave Preview and Lane Clarity

Before each wave, visually show the path from each active spawner to the core.

Implement:

glowing path preview
animated directional arrows
highlighted active spawner cells
lane threat labels
wave warning overlay

Example:

North Gate: 12 Scouts
East Gate: 3 Brutes
South Gate: 2 Weavers
West Gate: clear

This is very important. Tower-defense games need clear path readability.

4. Roguelite Reward Choices

After selected waves, show a reward screen where the player chooses one upgrade.

Implement at least 12 possible signal upgrades.

Examples:

Overclock Protocol
All towers fire 10% faster.

Drone Command Link
Drones gain +1 damage and +20 range.

Crystal Resonance
Harvesters generate +25% credits.

Stasis Amplifier
Slowed enemies take 20% more damage.

Emergency Core Shield
Restore 20 Core Integrity.

Tesla Conductor
Tesla chains jump one extra time.

Mortar Payload
Mortar splash radius increased by 20%.

Scanner Pulse
Phased enemies are visible longer.

Pulse Calibration
Pulse towers gain +15% range and +15% damage.

Rapid Construction
New towers cost 10% less.

Salvage Protocol
Selling towers refunds 70% instead of 50%.

Last Stand Circuit
When core integrity drops below 25%, all towers fire faster.

Reward choices should affect actual gameplay, not just UI.

Make the system data-driven.

5. Tower Upgrade Branches

Replace or extend simple linear upgrades with specialization choices.

Each tower should still be upgradable, but at certain levels it should offer a specialization.

At minimum, implement specializations for:

Pulse
Blaster
Stasis
Mortar
Tesla
Harvester

Examples:

Pulse Tower
Focus Lens
+40% range.

Burst Capacitor
Every third attack fires a triple burst.

Signal Marker
Enemies hit by Pulse take increased drone damage.
Blaster
Twin Barrels
Fires two shots per attack.

Armor Piercer
Deals bonus damage to Brutes and Carriers.

Suppressive Fire
Small chance to briefly slow enemies.
Stasis
Deep Freeze
Slow effect becomes stronger.

Cryo Field
Applies slow in a small area.

Vulnerability Pulse
Slowed enemies take bonus damage.
Mortar
Shrapnel Shells
Increases splash radius.

Armor Breaker
Bonus damage against large enemies.

Burning Ground
Leaves a short-lived damage zone.
Tesla
Chain Storm
More chain jumps.

EMP Arc
Chance to briefly stun enemies.

Phase Disruptor
Can hit phased enemies for reduced damage.
Harvester
Deep Extraction
More income.

Crystal Stabilizer
Crystal lasts longer or generates bonus pulse.

Relay Node
Nearby towers gain small fire-rate boost.

Tower specialization choices should be shown in a tower detail panel.

6. Tower Selection Panel

When the player clicks an existing tower, show a proper selected tower panel.

Panel should include:

Tower name
Level
Specialization, if any
Damage
Range
Fire rate
Kills
Total damage dealt
Upgrade cost
Sell value
Upgrade button
Specialize button when available
Sell button

This panel should replace awkward “upgrade mode/sell mode only” UX where possible.

Bottom build buttons can still exist, but selecting a tower should be the main way to manage it.

7. Better Enemy Readability

Enemy types must be visually distinct and tactically readable.

Implement improved rendering and UI descriptions for:

Scout
Fast weak enemy.

Grunt
Baseline enemy.

Brute
Slow armored enemy with high health.

Weaver
Healer that periodically repairs nearby enemies.

Phantom
Phases in and out of reality. Cannot be damaged while phased unless countered.

Carrier
Large enemy that releases Scouts on death.

Leviathan
Boss enemy with multiple phases.

Required visual improvements:

Scouts should have speed trails.
Weavers should have healing aura and beam/pulse.
Phantoms should shimmer/flicker clearly.
Carriers should look like spawn containers.
Brutes should look armored.
Boss should be much larger and more dramatic.
8. Enemy Codex / Threat Scanner

When a new enemy type appears for the first time, show a short threat message.

Example:

NEW THREAT DETECTED: PHANTOM

Phases in and out of reality.
Cannot be damaged while phased.

Counters:
- Scanner Pulse
- Tesla Phase Disruptor
- Drones during visible windows

Also include an optional codex panel where the player can review enemy types encountered.

The codex should be data-driven.

9. Boss Mechanics

Do not make Leviathan only a high-HP enemy.

Implement boss phases.

Example:

Phase 1: Advance
Moves slowly toward the core.

Phase 2 at 70% HP:
Summons Scouts from side gates.

Phase 3 at 40% HP:
Disables nearest tower temporarily.

Phase 4 at 15% HP:
Final rush, emits corruption pulse.

The final wave should feel like an event.

Add:

boss health bar
boss phase alerts
special visual effects
dramatic audio cue
stronger death effect
short slow-motion or screen pulse on boss death
10. Drone System Expansion

Keep Hunter Drone, but improve drones.

At minimum, implement:

Hunter Drone
Attacks enemies.

Scanner Drone
Improves visibility against Phantoms or reveals phase windows.

Guardian Drone
Patrols near the core and can intercept one enemy impact or reduce core damage.

Drones should have:

cost scaling
clear UI
upgrade interaction
readable behavior
stats in HUD

Optional:

drone command modes: defend core / seek enemies / hold position
11. Economy Improvements

Harvesters should be more interesting.

Implement at least some of these:

limited crystal energy
crystal depletion
harvester upgrade paths
harvester risk/reward placement
bonus if placed near danger
visible income ticks
crystal overcharge events
economy summary after wave

The player should feel tension between:

Build defense now
vs.
Invest in economy for later
12. Designed Sectors / Maps

Do not rely only on random terrain.

Create a data-driven sector/map system.

Implement at least 3 playable sectors:

Sector 1: Broken Relay
Simple four-lane map. Good teaching layout.

Sector 2: Crystal Scar
More crystals, more economy decisions, harder side lanes.

Sector 3: Phantom Gate
More Phantoms, anti-phase mechanics become important.

Optional future sectors:

Sector 4: Dead Orbit
Rotating spawners and mixed waves.

Sector 5: Leviathan Core
Final boss map.

Each sector should define:

name
description
map layout
rock placement
crystal placement
spawners
wave list
modifiers
visual theme color accents
reward frequency

Use data files, not hardcoded logic.

13. Improved Waves

Waves should have names, descriptions, and teaching purpose.

Do not use only anonymous arrays.

Example wave data:

{
  id: "wave_06_weaver_escort",
  name: "Weaver Escort",
  description: "Healers protect a group of armored Brutes.",
  warning: "Weavers repair nearby enemies.",
  recommendedCounters: ["Stasis", "Mortar", "Tesla"],
  rewardCredits: 60,
  rewardChoice: true,
  lanes: [
    {
      spawnerId: "north",
      enemies: [
        { type: "brute", count: 4, interval: 1.2 },
        { type: "weaver", count: 2, interval: 2.5 }
      ]
    }
  ]
}

Waves should teach:

Wave 1: basic enemies
Wave 2: tougher enemies
Wave 3: fast swarms
Wave 4: anti-armor need
Wave 5: carriers
Wave 6: healers
Wave 7: phasing
Wave 8: mixed pressure
Wave 9: economy pressure
Wave 10: mini-boss
Final: Leviathan
14. Better Game Over and Victory Screens

Game over should include analysis.

Example:

SIGNAL LOST

You survived until Wave 11.

Main failure:
- Most damage came from Brutes.
- You had low anti-armor damage.
- You built no Stasis towers.
- Your economy peaked too late.

Stats:
Enemies killed: 186
Credits earned: 1320
Best tower: Mortar Level 4
Core damage taken: 124

Suggestion:
Use Stasis + Mortar against Brute waves.

Victory should feel rewarding.

Example:

SIGNAL SECURED

Sector cleared.
Core Integrity remaining: 42%
Enemies neutralized: 312
Favorite tower: Tesla Array
Signal rating: A-
15. Settings and Accessibility

Implement a simple settings panel.

Required:

master volume
music volume
SFX volume
mute
screen shake toggle
reduced flashing toggle
show damage numbers toggle
colorblind support toggle or alternate enemy markers

Save settings to localStorage.

16. Save / Persistence

Use localStorage for:

settings
best sector clear
best wave reached
codex discovered enemies
unlocked sectors, if implemented
high score / best run stats

Do not overcomplicate this, but include a clean persistence service.

17. Keyboard and Mouse Controls

Implement responsive controls.

Required hotkeys:

1 = Pulse
2 = Blaster
3 = Stasis
4 = Mortar
5 = Tesla
6 = Harvester

D = Drone menu / buy Hunter Drone if simple
U = Upgrade selected tower
S = Sell selected tower
Space = Start wave / continue
P = Pause
Esc = Cancel selection / close panel
Tab = Toggle wave preview
+ / - = speed up / slow down, or use dedicated buttons

Mouse:

hover tile preview
click build
click tower to select
click enemy optionally to inspect
clear feedback for invalid placement
Game Feel / Juice Requirements

The game should feel exciting.

Improve:

muzzle flashes
tower recoil
enemy death effects
mortar explosions
tesla lightning
stasis beam
phasing shimmer
healing pulses
boss phase effects
core hit effects
low-health alarm
screen shake
floating damage/income text
animated UI transitions
start-wave warning
victory pulse

But avoid making the screen unreadable.

Readability is more important than chaos.

Rendering Requirements

Use Canvas 2D.

Create a proper render system with layers:

background grid
terrain
path previews
crystals
core
towers
enemies
drones
projectiles
effects
floating text
placement preview
selection highlights
debug overlays, if enabled

Avoid mixing game state updates directly into rendering.

Architecture Requirements

The codebase must be modular and professional.

Use a structure close to this:

last-signal/
  index.html
  package.json
  vite.config.ts
  tsconfig.json

  src/
    main.ts

    core/
      Game.ts
      GameState.ts
      StateMachine.ts
      Vector2.ts
      EventBus.ts
      Time.ts
      Config.ts
      Random.ts
      Types.ts

    data/
      towers.ts
      enemies.ts
      waves.ts
      sectors.ts
      upgrades.ts
      drones.ts
      codex.ts

    entities/
      Enemy.ts
      Tower.ts
      Projectile.ts
      Drone.ts
      Particle.ts
      FloatingText.ts
      DamageZone.ts

    systems/
      GridSystem.ts
      FlowFieldSystem.ts
      WaveSystem.ts
      EnemySystem.ts
      TowerSystem.ts
      ProjectileSystem.ts
      DroneSystem.ts
      EconomySystem.ts
      UpgradeSystem.ts
      RewardSystem.ts
      CodexSystem.ts
      AudioSystem.ts
      InputSystem.ts
      RenderSystem.ts
      ParticleSystem.ts
      PersistenceSystem.ts
      SettingsSystem.ts
      StatsSystem.ts

    ui/
      UIManager.ts
      HUD.ts
      BuildMenu.ts
      TowerPanel.ts
      WavePreviewPanel.ts
      RewardScreen.ts
      MainMenu.ts
      PauseMenu.ts
      GameOverScreen.ts
      VictoryScreen.ts
      SettingsPanel.ts
      CodexPanel.ts

    styles/
      main.css
      ui.css

    assets/
      README.md

You may adjust this structure if you have a better reason, but it must remain professional and modular.

TypeScript Quality Requirements

Use strong TypeScript types.

Define proper types/interfaces for:

TowerType
EnemyType
DroneType
WaveDefinition
SectorDefinition
TowerDefinition
EnemyDefinition
UpgradeDefinition
GameState
DamageType
StatusEffect
SpawnerDefinition
RunStats
Settings

Avoid:

massive any
global mutable objects everywhere
circular imports
giant god files
hidden dependencies
systems reaching randomly into each other without clear APIs

Use clean APIs.

Good examples:

waveSystem.startNextWave()
towerSystem.placeTower(type, cell)
gridSystem.canPlaceTower(type, cell)
rewardSystem.applyUpgrade(upgradeId)
audioSystem.playSfx("tower_build")
uiManager.showRewardChoices(choices)
Data-Driven Design

Towers, enemies, waves, sectors, upgrades, and drones must be data-driven.

Good:

export const towerDefinitions: Record<TowerType, TowerDefinition> = {
  pulse: { ... }
};

Bad:

if (tower.type === "pulse") {
  // all pulse behavior hardcoded everywhere
}

Some behavior-specific logic is acceptable, but the definitions should live in data files.

Performance Requirements

The game should run smoothly.

Implement:

capped delta time
particle cap
projectile cap
cleanup of inactive entities
no expensive path recalculation every frame
placement validation cache
no unnecessary DOM updates every frame
no memory leaks in audio or animation loops
avoid creating huge numbers of temporary objects in tight loops where easy

Grid pathfinding should recalculate only when map/towers change, not every render frame.

Audio Requirements

Keep and improve procedural audio.

Use Web Audio API.

Implement:

AudioSystem class
master/music/SFX gain nodes
procedural tower sounds
procedural enemy death sounds
procedural core hit sounds
boss alert sound
wave start sound
ambient background drone
settings-controlled volume

Audio must only start after user interaction due to browser autoplay rules.

UI/UX Requirements

The UI should look professional and match the sci-fi identity.

Style direction:

Dark tactical interface
neon cyan highlights
amber warnings
red corruption alerts
glass/CRT panels
subtle scanlines
compact but readable

Required UI elements:

main menu
HUD
build menu
wave preview panel
tower detail panel
reward choice screen
pause menu
settings panel
game-over analysis screen
victory screen
codex/threat scanner
speed controls
current phase indicator

The UI should not cover the battlefield too much.

Asset Replacement Readiness

Even if using canvas-drawn placeholder shapes for now, structure the game so real assets can be added later.

Create:

src/assets/README.md

or:

assets.md

This file should describe recommended future assets:

tower sprites
enemy sprites
core sprite
crystal sprite
projectile effects
UI icons
background tiles
sound effects
music loops
boss art
codex icons

Explain naming conventions and dimensions.

Example:

tower_pulse_base.png
tower_pulse_turret.png
enemy_scout.png
enemy_brute.png
effect_tesla_arc.png
ui_icon_core.png

Design the code so later asset rendering can replace procedural canvas drawing without rewriting game logic.

Balancing Requirements

Initial balance does not need to be perfect, but it must be playable.

Make sure:

early waves are survivable
economy matters
all tower types have a reason to exist
Stasis is useful despite low/no damage
Mortar is strong against groups but slow
Tesla is powerful but expensive
Harvesters are tempting but not mandatory
drones are useful but not overpowered
Phantoms have counters
Weavers are noticeable
Carrier death spawn is fair
boss is challenging but not impossible

Include comments or a small balancing note in the code/data where helpful.

Debugging / Developer Tools

Add optional debug support.

Possible debug toggles:

F1 = show/hide debug overlay
F2 = show flow field
F3 = show enemy paths
F4 = add credits
F5 = damage core

Debug tools should be disabled or harmless by default.

Add a simple debug overlay showing:

FPS
current state
enemies alive
projectiles
particles
current wave
selected tower
grid cell under mouse
Required Acceptance Criteria

The project is successful only if:

The game starts from a main menu.
The player can select a sector.
The player enters a planning phase.
The next wave preview is visible.
The player can build towers.
The player can select towers.
The player can upgrade/sell towers.
The player can start the wave manually.
Enemies path toward the core.
Towers attack enemies.
Drones work.
Harvesters generate income.
Waves progress correctly.
Reward choices appear after selected waves.
Chosen upgrades affect gameplay.
Enemy abilities work.
Boss phases work.
Game over works.
Victory works.
Settings work.
The game can be paused.
Speed controls work.
The code compiles.
The app runs with Vite.
No critical console errors.
The file structure is modular.
No important implementation is left as a stub.
Suggested Implementation Strategy

Do this in stages, but provide the final result.

Stage 1: Analyze Existing Prototype

First, analyze the existing single-file HTML game.

Identify:

current systems
current data structures
mechanics to preserve
bugs to fix
features to improve
systems to extract into modules
Stage 2: Design Architecture

Create the folder structure and core system responsibilities.

Stage 3: Port Existing Mechanics

Port the working mechanics into TypeScript modules:

grid
flow field
enemies
towers
projectiles
particles
drones
audio
UI
waves
Stage 4: Add Improved Game Loop

Add:

planning phase
manual wave start
wave preview
reward choices
pause
speed controls
sector select
Stage 5: Add Strategic Depth

Add:

tower specialization
signal upgrades
enemy codex
better boss mechanics
better economy
improved drones
Stage 6: Polish

Add:

better rendering
better UI
better feedback
settings
persistence
game-over analysis
Important Design Restraints

Do not make the game bloated.

Prefer:

clean systems
readable code
strong core loop
meaningful choices
polished feedback

Over:

huge feature lists
unnecessary abstractions
fake complexity
massive dependency chains
visual clutter
unbalanced mechanics

The game should be impressive because it is coherent, playable, polished, and architecturally clean.

Final Deliverable Format

When you answer, provide:

A short overview of what you built.
Full folder/file tree.
Complete code for every file.
Installation instructions.
Controls.
Architecture explanation.
Gameplay systems explanation.
Known limitations, if any.
Suggested next improvements.

Do not omit files.

Do not say “the rest is unchanged.”

Do not provide only snippets.

Do not leave out CSS.

Do not leave out config files.

Do not leave out data files.

Do not leave unresolved imports.
