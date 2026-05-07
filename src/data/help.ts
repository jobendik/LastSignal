/**
 * Help / Codex content for LAST SIGNAL.
 *
 * The codex is the player-facing reference manual: every major system the
 * game introduces gets a short, readable entry organized into categories.
 * Wave-by-wave threat detail still lives in /src/data/codex.ts (one entry
 * per enemy type) — this module covers everything else (Basics, Signal
 * Network, Strategic Points, Hostile Structures, Squads, Tower Durability,
 * Command Tier, Controls, Sector Types).
 */

export type HelpCategoryId =
  | "basics"
  | "signal"
  | "strategic"
  | "hostile"
  | "squads"
  | "durability"
  | "command"
  | "enemies"
  | "controls"
  | "sectors";

export interface HelpEntry {
  /** Short label used as a heading. */
  title: string;
  /** Optional accent color for the entry header (defaults to category color). */
  color?: string;
  /** 1-3 short paragraphs explaining the topic. Plain player-facing language. */
  body: string[];
  /** Optional bullet list rendered after the body. */
  bullets?: string[];
  /** Optional one-line tip rendered as a callout. */
  tip?: string;
}

export interface HelpCategory {
  id: HelpCategoryId;
  /** Tab label (uppercase). */
  label: string;
  /** Short subtitle below the label. */
  subtitle: string;
  /** Accent color used for tab + section headers. */
  color: string;
  /** Ordered topic entries. */
  entries: HelpEntry[];
}

export const helpCategories: HelpCategory[] = [
  {
    id: "basics",
    label: "BASICS",
    subtitle: "Goal of the game and how a sector plays out.",
    color: "#66fcf1",
    entries: [
      {
        title: "Goal",
        body: [
          "Defend the Core through every wave of the active sector. If Core Integrity reaches zero, the run ends.",
          "Each sector is a self-contained mission. Clearing a sector unlocks the next one and grants Research that carries between runs.",
        ],
      },
      {
        title: "Core Integrity",
        body: [
          "Core Integrity is the home base's hit points. Enemies deal damage when they reach a Core or Relay tile.",
          "Repair the home Core during planning for 30 credits. Repair is capped at 80% of max — heavy damage stays until the next sector.",
        ],
        tip: "Watch the Core bar at the top-left. Below 30% it pulses red and the screen rim flashes.",
      },
      {
        title: "Waves",
        body: [
          "Waves spawn enemies from one or more gates. The HUD shows the current wave name, wave number, and an upcoming-waves preview.",
          "Press Space (or START WAVE) during planning to launch the next wave early — earlier starts award bonus credits.",
        ],
        bullets: [
          "Planning: build, repair, deploy squads, capture points.",
          "Active: simulation runs; you can still build and command.",
          "Complete: short pause before the next wave begins.",
        ],
      },
      {
        title: "Credits",
        body: [
          "Credits are the wave-to-wave currency. You earn them by killing enemies, finishing waves, harvesting crystals, and capturing strategic points.",
          "Spend them on towers, upgrades, repairs, command tier, relays, and squad deployments.",
        ],
        tip: "Keep ~30 credits in reserve for emergency repairs or a Shield squad.",
      },
      {
        title: "Building Towers",
        body: [
          "Pick a tower from the build menu (or press its hotkey), then click a buildable cell inside Signal Coverage.",
          "Click an existing tower to inspect it: stats, HP, upgrades, sell, recall, and specialization options.",
        ],
        tip: "You can sell or recall a tower at any time. Recall is one full refund per sector — use it to redesign.",
      },
      {
        title: "Surviving a Sector",
        body: [
          "Read the sector briefing on launch — every sector lists its primary objective, hazards, and recommended counters.",
          "Mix damage and control towers, capture points to expand, and don't ignore squad commands when they unlock.",
        ],
      },
    ],
  },

  {
    id: "signal",
    label: "SIGNAL NETWORK",
    subtitle: "Where you can build, see, and project power.",
    color: "#80deea",
    entries: [
      {
        title: "Main Core",
        body: [
          "The home Core anchors your network. Its signal coverage defines the initial buildable area and reveals nearby map.",
          "Damaging the home Core ends the run if it falls to zero.",
        ],
      },
      {
        title: "Relay Cores",
        body: [
          "Relay Cores extend your signal network. Each relay creates a new buildable territory and adds a forward repair point.",
          "Press R (or click RELAY in the HUD) to enter relay deploy mode, then place inside the relay deploy radius around an existing core.",
        ],
        bullets: [
          "Tier 1: up to 2 relays.",
          "Tier 2: up to 3 relays.",
          "Tier 3: up to 4 relays.",
          "Cost falls slightly at higher Command Tier.",
        ],
        tip: "Relays are how you expand a sector. Without them, distant crystals and capture points stay unreachable.",
      },
      {
        title: "Signal Coverage",
        body: [
          "Signal Coverage is the cyan glow around every Core and Relay. You can only build inside Signal Coverage.",
          "Higher Command Tier slightly grows relay coverage and deploy reach.",
        ],
      },
      {
        title: "Buildable Territory",
        body: [
          "Buildable cells must be empty terrain (no rocks/crystals) inside Signal Coverage. Crystal cells take Eco Harvesters.",
          "Strategic points and hostile structures occupy single tiles and block builds until captured or destroyed.",
        ],
      },
      {
        title: "Darkness & Reveal",
        body: [
          "On dark sectors, areas outside Signal Coverage are dimmed and partially hidden.",
          "Reveal grows from your network, captured radar dishes, and Recon squads scouting forward.",
        ],
        tip: "If you can't see something, you can't defend it. Push Recon or a relay to light it up.",
      },
      {
        title: "Why Expansion Matters",
        body: [
          "Larger sectors stash crystals, signal nodes, and capture rewards behind distance. Expansion turns map control into economy and visibility.",
          "Failing to expand on Sector 6 / 7 leaves you starved of credits and blind to incoming pressure.",
        ],
      },
    ],
  },

  {
    id: "strategic",
    label: "STRATEGIC POINTS",
    subtitle: "Capturable points scattered across larger sectors.",
    color: "#9be7a7",
    entries: [
      {
        title: "Signal Node",
        body: [
          "Captured signal nodes extend your signal network locally — they create a small buildable zone around themselves and reveal nearby map.",
          "Cheapest way to project power forward without spending a relay slot.",
        ],
        tip: "Capture is automatic when the node is connected to your network and no enemies channel on it.",
      },
      {
        title: "Radar Dish",
        body: [
          "Captured radar dishes reveal a wide area around them and can expose hostile structures that were hidden by darkness.",
          "Wave intel and incoming-wave previews scale up once a radar is online.",
        ],
      },
      {
        title: "Data Cache",
        body: [
          "One-time pickup. Capturing a data cache awards a chunk of credits and a research point, then the point depletes.",
          "Caches are usually deep in hostile territory — they're a risk/reward trip, not a free reward.",
        ],
      },
      {
        title: "Abandoned Turret",
        body: [
          "Captures into a friendly static gun that fires automatically. It has its own HP and can be damaged or disabled.",
          "Engineer squads can repair captured turrets just like a tower.",
        ],
        tip: "Turrets are a free forward foothold. Capture early in any sector that has one.",
      },
      {
        title: "Capture Progress",
        body: [
          "Capture fills while a friendly is in range and no enemies channel against it. Standing inside the point's ring channels capture.",
          "Engineer squads accelerate capture significantly — drop one on a contested point to lock it down.",
        ],
      },
      {
        title: "Contested Capture",
        body: [
          "If enemies stand on a capture point, your progress stalls and may decay slightly.",
          "Clear the immediate area or shield the point with a Shield squad to resume capture.",
        ],
      },
      {
        title: "Jammed Capture",
        body: [
          "Capture progress slows inside an active jammer field. Destroy the jammer first or capture under Shield protection.",
          "Tower fire rate also drops inside the jammer field — a single jammer can stall an entire push.",
        ],
      },
    ],
  },

  {
    id: "hostile",
    label: "HOSTILE STRUCTURES",
    subtitle: "Enemy structures you must dismantle to win.",
    color: "#ff8a65",
    entries: [
      {
        title: "Rift Anchor",
        body: [
          "A hostile structure that empowers enemy waves. While alive, it periodically pulses, releasing extra enemies or buffing the spawner closest to it.",
          "Kill it with tower fire or Strike squads. Range matters — relays may need to roll forward to bring an anchor into range.",
        ],
        tip: "When the HUD shows 'RIFT PULSE IMMINENT', shield exposed relays or destroy the anchor immediately.",
      },
      {
        title: "Jammer",
        body: [
          "Hostile structure that suppresses tower fire rate, slows capture progress, and dampens squad effects within its field.",
          "Destroy or avoid the field. A single jammer can cripple an over-clustered defense.",
        ],
      },
      {
        title: "Rift Pulses",
        body: [
          "Rift anchors fire periodic pulses telegraphed by an expanding ring. Pulses chip Core Integrity and damage exposed relays.",
          "Shield squads halve incoming pulse damage in their field. Strike squads can suppress the anchor mid-channel.",
        ],
      },
      {
        title: "Jammer Suppression",
        body: [
          "A jammer's suppression field is a soft circle around the structure. Tower DPS drops, Engineer repair slows, and squad effectiveness degrades.",
          "The field isn't lethal on its own, but it forces the rest of the sector to fight short-handed.",
        ],
      },
      {
        title: "Why It Matters",
        body: [
          "On Sector 6 and Sector 7, hostile structures are the actual win condition. You can't out-turtle a sector that keeps spawning rift pulses.",
          "Plan an offensive line — towers, relays, and squads — to push them down.",
        ],
      },
    ],
  },

  {
    id: "squads",
    label: "MOBILE SQUADS",
    subtitle: "Mobile command beacons that move, scout, repair, and fight.",
    color: "#80d8ff",
    entries: [
      {
        title: "What Squads Are",
        body: [
          "Squads are timed mobile drone teams you deploy as command abilities. They're not micro-managed units — you arm a squad type, click the world, and they go.",
          "Squads cost credits and have a per-type cooldown. They expire after a duration or can be evacuated for a partial refund.",
        ],
      },
      {
        title: "Recon Squad (T1)",
        color: "#80d8ff",
        body: [
          "Fast scout squad. Reveals darkness on the move and exposes hidden hostile structures.",
          "Best use: scouting expansion routes, finding rift anchors, lifting darkness on Sector 6 / 7.",
        ],
        tip: "Recon survives more than it fights — drop one before the wave to peek at the eastern frontier.",
      },
      {
        title: "Engineer Squad (T2)",
        color: "#9be7a7",
        body: [
          "Utility squad. Captures strategic points faster and repairs damaged or disabled towers.",
          "Best use: securing capture points under pressure, restoring towers after Saboteur attacks.",
        ],
      },
      {
        title: "Strike Squad (T3)",
        color: "#ff8a65",
        body: [
          "Combat squad. Suppresses enemies and deals extra damage to hostile structures.",
          "Best use: cracking rift anchors, finishing a wounded jammer that's too far for towers.",
        ],
      },
      {
        title: "Shield Squad (T3)",
        color: "#80deea",
        body: [
          "Defensive squad. Projects a damage-reduction field that protects nearby cores, towers, and relays. Slows enemies inside the field.",
          "Best use: weathering a rift pulse, protecting forward relays, surviving the boss.",
        ],
      },
      {
        title: "Retasking",
        body: [
          "Click an active squad to select it, then press E (or RETASK on its row) and click a new target. You can retask to capture, repair, strike, shield, or just move.",
          "Right-click on the world while a squad is selected for a quick retask-here.",
        ],
      },
      {
        title: "EVAC & Recall",
        body: [
          "Press Q to recall the selected squad to the nearest core/relay. Shift+Q recalls every active squad.",
          "EVAC prevents losses, frees your squad slot, and refunds part of the deployment cost.",
        ],
        tip: "Damaged squads are usually worth saving. EVAC early — you'll redeploy fresh in seconds.",
      },
      {
        title: "Squad Cap & Cooldowns",
        body: [
          "You have a global squad cap (rises with Command Tier) and per-type caps. Each squad type also has a deployment cooldown.",
          "Upgrades can lower cost, lower cooldown, or raise the cap — chase squad-friendly cards on rerolls if you lean on them.",
        ],
      },
      {
        title: "Squad Vulnerability",
        body: [
          "Squads have HP. They take damage in combat, from rift pulses, and from Saboteurs touching them.",
          "Jammed squads lose effectiveness. Shield them, retask them, or evac before they're lost.",
        ],
      },
    ],
  },

  {
    id: "durability",
    label: "TOWER DURABILITY",
    subtitle: "Towers can be damaged, disabled, and repaired.",
    color: "#ffd54f",
    entries: [
      {
        title: "Tower HP",
        body: [
          "Every tower has hit points. Saboteurs damage tower HP; meteors and rift pulses can also chip it.",
          "Damage state shows as a colored HP bar in the tower panel and a state label (operational / damaged / critical / disabled).",
        ],
      },
      {
        title: "Damaged → Critical → Disabled",
        body: [
          "Below 60% HP a tower is Damaged. Below 25% it's Critical (slower fire and reduced range). At 0% it's Disabled and stops firing.",
          "Disabled towers don't sell themselves — they wait for an Engineer.",
        ],
        tip: "Disabled is recoverable, not destroyed. Plan repairs, don't panic-sell.",
      },
      {
        title: "Saboteurs",
        body: [
          "Saboteurs are enemies that target your towers directly. They deal real HP damage and apply a temporary disable.",
          "Snare, Stasis, and burst damage stop them. Don't cluster expensive towers — Saboteurs love a tight pack.",
        ],
      },
      {
        title: "Engineer Repair",
        body: [
          "Engineer squads repair towers in the field, restoring HP and clearing the disabled state when HP rises above 0.",
          "Engineers also repair captured abandoned turrets and accelerate strategic point capture.",
        ],
      },
      {
        title: "Shield Protection",
        body: [
          "Shield squads project a damage-reduction field. Towers and cores inside the field take less damage from all sources, including rift pulses.",
          "Shield is the answer to artillery, mass Saboteurs, and forward-relay protection during boss waves.",
        ],
      },
      {
        title: "End-of-Wave Repair",
        body: [
          "Towers passively repair a small amount of HP between waves so you don't need to babysit minor damage.",
          "Critical and Disabled towers still need Engineer attention — passive repair won't restore a 0-HP tower.",
        ],
      },
    ],
  },

  {
    id: "command",
    label: "COMMAND TIER",
    subtitle: "Your overall command capability.",
    color: "#ffeb3b",
    entries: [
      {
        title: "What Command Tier Is",
        body: [
          "Command Tier is a sector-wide upgrade that scales your strategic options. It starts at Tier 1 and can be upgraded to Tier 2 and Tier 3 with credits.",
          "Tier ups happen during planning. The button sits in the HUD next to the relay button.",
        ],
      },
      {
        title: "Tier 1",
        body: [
          "Baseline. Recon squad available. Up to 2 relay cores. Standard relay coverage and deploy reach.",
        ],
      },
      {
        title: "Tier 2",
        body: [
          "Engineer squad unlocked. Up to 3 relay cores. Slightly larger relay coverage and deploy reach. Modest relay cost discount.",
        ],
      },
      {
        title: "Tier 3",
        body: [
          "Strike and Shield squads unlocked. Up to 4 relay cores. Best relay coverage, deploy reach, and cost.",
        ],
        tip: "On large or hostile sectors, racing to Tier 2 is often worth more than a single extra tower.",
      },
      {
        title: "Why Upgrading Matters",
        body: [
          "Higher tier means more squads, more relays, and a larger network. On Sector 6 / 7 the game is tuned to expect mid-run tier ups.",
        ],
      },
    ],
  },

  {
    id: "enemies",
    label: "ENEMIES",
    subtitle: "Common threats and their counters.",
    color: "#ff5252",
    entries: [
      {
        title: "Scouts & Sprinters",
        body: [
          "Fast, fragile chaff. Sprinters are even faster than Scouts and require slow effects to land any hits.",
        ],
        bullets: ["Counters: Pulse, Blaster, Stasis, Tesla."],
      },
      {
        title: "Grunts",
        body: [
          "The standard attacker. Average HP and speed. Anything reasonable handles them — save credits for harder waves.",
        ],
      },
      {
        title: "Brutes & Juggernauts",
        body: [
          "Slow, armored siege units. Punish heavy damage but soak chip damage.",
        ],
        bullets: [
          "Counters: Mortar inside Stasis, armor-piercer Blaster, Railgun.",
        ],
      },
      {
        title: "Phantoms",
        body: [
          "Phase in and out — immune to damage while phased. Wide coverage and Tesla Phase Disruptor are essential.",
        ],
        bullets: ["Counters: Tesla Phase Disruptor, Scanner Drone, wide coverage."],
      },
      {
        title: "Saboteurs",
        body: [
          "High-priority threat. Saboteurs damage tower HP and disable towers on contact.",
        ],
        bullets: ["Counters: Snare/Stasis to slow, Railgun to burst, Shield squad to absorb damage."],
      },
      {
        title: "Jammer Enemies",
        body: [
          "Mobile suppression. While alive, towers near a jammer enemy fire slower.",
        ],
        bullets: ["Counters: Snipe with Railgun, Strike Squad to chase, Tesla to interrupt."],
      },
      {
        title: "Carriers, Splitters, Weavers",
        body: [
          "Special role enemies. Carriers spawn scouts on death; Splitters fission; Weavers heal nearby enemies.",
        ],
        bullets: ["Kill them deep in the network. Tesla and Mortar splash do most of the work."],
      },
      {
        title: "Bosses",
        body: [
          "Multi-phase late-wave threats. The Harbinger shells dense towers; the Leviathan summons escorts and pulses.",
        ],
        bullets: [
          "Spread your towers out (anti-artillery).",
          "Shield the home core during pulses.",
          "Strike anchors / phantoms first to free your fire.",
        ],
        tip: "See the in-run Threat Codex for full per-enemy detail (CODEX → Threat Codex tab).",
      },
    ],
  },

  {
    id: "controls",
    label: "CONTROLS",
    subtitle: "Hotkeys for everything you can do mid-run.",
    color: "#b39ddb",
    entries: [
      {
        title: "Camera",
        body: [
          "Pan with WASD or arrow keys. Middle-mouse drag to free-pan. Mouse wheel to zoom.",
          "The screen edge auto-pans when the cursor reaches the border.",
        ],
      },
      {
        title: "Build / Sell / Upgrade",
        body: [],
        bullets: [
          "1–9, 0: pick a tower from the build menu.",
          "Click empty cell: place selected tower.",
          "Click placed tower: open the tower panel.",
          "U: upgrade selected tower.",
          "S: sell selected tower.",
          "Esc: cancel build/relay/squad mode.",
        ],
      },
      {
        title: "Wave & Pause",
        body: [],
        bullets: [
          "Space: start the next wave (planning) / continue (wave complete).",
          "P: pause / resume.",
          "+ / −: speed up / slow down.",
          "Tab: toggle wave preview panel.",
          "T: tactical pause (if researched).",
        ],
      },
      {
        title: "Relay & Command Tier",
        body: [],
        bullets: [
          "R: enter relay deploy mode.",
          "Y: upgrade Command Tier.",
          "K: designate kill zone (if researched).",
        ],
      },
      {
        title: "Squad Commands",
        body: [],
        bullets: [
          "F1: arm Recon squad.",
          "F2: arm Engineer squad.",
          "F3: arm Strike squad.",
          "F4: arm Shield squad.",
          "Click squad on map: select.",
          "E: retask selected squad.",
          "Right-click world: quick retask of selected squad.",
          "Q: EVAC selected squad.",
          "Shift+Q: EVAC all active squads.",
        ],
      },
      {
        title: "Help & Codex",
        body: [],
        bullets: [
          "H or ?: open Help / Codex.",
          "Esc: close any open overlay.",
        ],
        tip: "All hotkeys can be rebound in the Settings panel.",
      },
    ],
  },

  {
    id: "sectors",
    label: "SECTOR TYPES",
    subtitle: "What each kind of mission asks of you.",
    color: "#ffb300",
    entries: [
      {
        title: "Early Sectors (1–4)",
        body: [
          "Compact maps that teach core defense. Hold the Core through every wave.",
          "Build a front line, mix damage and control, and read each sector's hazard hint.",
        ],
      },
      {
        title: "Sector 3 — Phantom Gate",
        body: [
          "Introduces darkness, signal interference, phantom enemies, and the first strategic point — an Abandoned Turret on the western lane.",
          "Capture the turret early for a free forward gun. Bring Tesla and Scanner for phase-immune phantoms.",
        ],
      },
      {
        title: "Sector 6 — Fractured Expanse",
        body: [
          "Large open sector that showcases Relay Expansion and Map Control. You must roll relays outward to reach distant crystals, signal nodes, and a radar dish.",
          "Recon scouts the dark frontier. Engineer accelerates capture under pressure. Two rift anchors and a jammer punish pure turtle play.",
        ],
        tip: "Race to Tier 2 early so Engineer is online when you start contesting strategic points.",
      },
      {
        title: "Sector 7 — Blackout Array",
        body: [
          "Hostile-suppression mission. Three rift anchors, two jammer arrays, darkness, signal interference, Saboteurs, and an 18-wave bespoke campaign.",
          "Restore visibility with the radar, capture the forward auto-gun, then dismantle hostile infrastructure with Strike squads. Shield exposed relays during boss waves.",
        ],
        tip: "Tower Durability matters here. Engineer for repairs, Shield for boss pulses, EVAC squads you can't save.",
      },
      {
        title: "Endless / Void",
        body: [
          "Procedurally drifting maps and waves. All hazards combine. Adapt every wave — no template survives the Void.",
        ],
      },
    ],
  },
];

export const helpCategoryOrder: HelpCategoryId[] = helpCategories.map((c) => c.id);
