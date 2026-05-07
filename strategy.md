# LastSignal — Strategic Direction Document

> Written: May 2026  
> Context: AI-assisted development session analysing the game's evolution and future direction.

---

## 1. How We Got Here — The Story So Far

This is important context. The current state of LastSignal is not the result of a plan — it is the result of organic evolution driven by instinct. Understanding that history is the key to making the right decision now.

1. **Started as a simple Tower Defence game.** Clean, focused, one genre.
2. **Expanded the TD game** — more towers, more enemies, more sectors. Still pure TD.
3. **The game started reminding the developer of Command & Conquer** — a beloved childhood game. This instinct was real and worth listening to.
4. **Asked the AI to make the game more like C&C.** The AI pushed back and suggested expanding the TD game further rather than cloning C&C.
5. **This is where we are today.** The result is a sophisticated hybrid: a TD game with RTS mechanics (mobile command squads, strategic point capture, command tiers, fog of war, contested resource nodes) bolted on top of a TD foundation that was never designed for them.

The game is in an **identity crisis** — too complex for casual TD players, not deep enough in the right ways for RTS players. The discomfort the developer feels is the game telling them something.

---

## 2. What LastSignal Currently Is

LastSignal is genuinely impressive for a game built in days with AI assistance. It is **not** a prototype — it is production-quality:

| System | Detail |
|--------|--------|
| 13 tower types | Full specialisation trees, upgrade flags, synergies |
| 19 enemy types + bosses | Armor, abilities, tunneling, mirroring, carrier spawning |
| Flow-field pathfinding | Per-sector, cache-aware, handles large maps |
| Mobile Command Squads | Recon, Engineer, Strike, Shield — semi-autonomous |
| Strategic map points | Capture objectives, radar dishes, jammers, rift anchors |
| Research / upgrade trees | 40+ effects, roguelite reward system |
| Large-format maps | Camera pan/zoom, minimap, 80×56 grid support |
| Full audio engine | Web Audio API, procedural sound |
| Sector system | 6 sectors, scripted waves, hazards, darkness mode |
| Run modifiers | Roguelite layer with cursed upgrades |

**The problem:** Many of these systems — squads, strategic points, command tiers — are RTS mechanics wearing a TD skin. The architecture was never designed for them. They work, but they fight the foundation.

---

## 3. The Four Options — Honest Analysis

### Option 1: Polish and Ship As-Is

**What it means:** Stabilise the current game, add monetisation, submit to CrazyGames, stop adding major features.

**The honest case for it:**
- The game is good enough to earn money right now
- CrazyGames has a large TD audience
- Takes 1–2 weeks of AI-assisted work
- Generates passive income while you work on something else

**The honest case against it:**
- Polishing won't resolve the identity crisis
- The game sits between two audiences and fully satisfies neither
- The developer's creative heart is not in pure TD anymore
- It will never become the game it has the potential to be

**Verdict:** ✅ Do this — but as a *side track*, not the main goal. Ship it, let it earn, move on.

---

### Option 2: Commit to the Hybrid

**What it means:** Accept that LastSignal is a TD/RTS hybrid and deliberately design further features around that identity.

**The honest case for it:**
- "They Are Billions" proved the TD/RTS hybrid market exists and is underserved
- The game is already a hybrid — committing just means being deliberate about it
- Lower risk than a full RTS: casual players can still enjoy the TD layer
- The multiplayer "Signal War" concept (players start on opposite sides, explore, ally or attack) fits this perfectly

**The honest case against it:**
- The developer's instinct is toward C&C, not a hybrid
- Hybrid games risk satisfying neither TD nor RTS fans fully
- The architecture is still fighting itself

**Verdict:** ⚠️ Viable and commercially sensible. Creatively unsatisfying if C&C is the actual dream. A hybrid is what the game already is — choosing this means choosing the middle permanently.

---

### Option 3: Gradually Evolve Into a C&C-Style Game

**What it means:** Keep adding C&C-inspired features to the existing codebase until it becomes more RTS than TD.

**Why this is the worst option:**

The current codebase has **fundamental architectural assumptions incompatible with a true RTS:**

- **Flow-field pathfinding** assumes all mobile entities are enemies flowing to a fixed point. In RTS, player-controlled units move to arbitrary player-specified targets. These are different problems.
- **The input system** was designed for "click grid cell to place tower." RTS requires rubber-band selection, right-click attack-move, formation commands, double-click select-all-same-type.
- **The render system** draws a static defensive grid with attacking waves. RTS rendering is fundamentally more dynamic — two active forces, unit animations, projectile arcs, building construction animations.
- **The wave system** scripted attackers coming from spawners. In RTS, the enemy builds a base and decides when to attack.

Every C&C feature added from this point will require hacking around TD assumptions. Technical debt compounds with each addition. This is the "gradually turning a car into a boat" problem.

**This is also what has already been happening** — and it produced the identity crisis the game is in now.

**Verdict:** ❌ The path of most resistance. Do not do this.

---

### Option 4: Start Fresh With C&C in Mind

**What it means:** New project. Build every system with RTS architecture from the start. Use LastSignal's design assets (balance data, lore, aesthetics) as source material, not the code.

**What you actually lose (less than it seems):**
- The TypeScript/Canvas code (most of it — but AI rebuilds this in days)
- The flow-field pathfinding (replaced by A* — better for RTS)
- The input system (completely different for RTS — needs to be rewritten anyway)
- The wave system (replaced by AI base that produces units)

**What you keep (this is substantial):**
- The game world, lore, and visual aesthetic
- All balance data: 13 tower types → 13 buildable structures/units/buildings
- 19 enemy types → enemy faction unit roster
- The upgrade/research tree design philosophy
- The audio system (largely reusable)
- The sector/map design knowledge
- Everything learned about building this kind of game
- The developer's design intuition (priceless)

**The core argument:** With AI assistance, lost *code* is rebuilt in days. Lost *design knowledge* takes months to recreate. You don't lose the design knowledge — you carry it forward.

**Verdict:** ✅ The only clean path to a true C&C-inspired game. Recommended if that is the actual goal.

---

## 4. Market Reality Check

### Is the world full of C&C clones?

**No. The opposite is true.**

- The last major C&C game was **Red Alert 3 in 2008** — 17 years ago
- There are remasters (C&C Remastered Collection) but no new entries in the franchise
- Starcraft 2 stopped active development in 2020
- Age of Empires 4 (2021) is the only AAA RTS released in years, targeting nostalgia
- **Browser/web RTS games are nearly nonexistent** — OpenRA runs in browser but it's a clone, nothing modern and original exists
- The RTS genre is widely considered "dead" but that is a self-fulfilling prophecy caused by no one making new ones

A well-made, modern, browser-native RTS in 2026 would not be entering a crowded market. It would be **filling a vacuum**.

### What makes a C&C-inspired game different from "just another RTS"

The key is to make it **your own game inspired by C&C**, not a clone:
- Your own factions, lore, and units (already developed in LastSignal)
- Browser-native, no download required (massive accessibility advantage)
- Built-in multiplayer from day one (C&C's most beloved feature)
- Modern UX conventions (C&C's interface has not aged well)

### The real risks

1. **AI opponent quality.** A bad RTS AI is more damaging than a bad TD AI. Players quit immediately if the AI is trivially beaten or feels scripted. This is the hardest single problem in RTS development — even with AI assistance, it requires many play test iterations.

2. **Unit pathfinding feel.** Getting units to move convincingly (no stuttering, no clumping, no walking into walls) requires tuning, not just correct algorithms. The code can be written in a day; making it *feel like C&C* takes longer.

3. **Casual audience accessibility.** TD games have a much lower skill floor than RTS games. An RTS requires tutorials, careful onboarding, and patience from the player. The CrazyGames casual audience will bounce from a full RTS more quickly than from a TD.

---

## 5. The Recommended Strategy: Two Tracks

### Track A — Ship LastSignal (Weeks 1–2)

**Goal:** Passive income. Proof of concept for the monetisation stack.

1. Add the CrazyGames SDK (rewarded ads, interstitial ads) — 1–2 days
2. Add the monetisation layer from `monetize.md`:
   - Energy gate ("Signal Power")
   - Starter pack (shown after Sector 1)
   - Daily login streak
   - Gem shop with 5 packs
3. Submit to CrazyGames for review
4. Let it earn while Track B begins

**Expected outcome:** $200–$800/month in ad revenue from CrazyGames. Not life-changing, but real money for a game that's essentially done.

---

### Track B — New Project: The C&C-Inspired Game (Ongoing)

**Goal:** Build the game you actually want to build, from the right foundation.

#### Architecture designed for RTS from day one:

| System | Design Decision |
|--------|----------------|
| Pathfinding | A* for individual units + steering behaviours (not flow fields) |
| Input | Right-click move, rubber-band select, attack-move, formation keys |
| Map | Open terrain, two base zones + contested middle (not spawner lanes) |
| Economy | Ore fields to harvest + credit income from structures |
| Factions | Two distinct factions — reuse LastSignal's unit roster as a starting point |
| Multiplayer | Colyseus.js server from day one — not bolted on later |
| Fog of war | Team-based from day one |
| AI opponent | Scripted build orders + attack timing (hard but essential) |

#### What to carry forward from LastSignal:

- **Unit roster:** LastSignal's 13 tower types become buildable structures and units. The Pulse tower becomes a turret. The Harvester becomes an ore collector. The Railgun becomes a siege unit. The 19 enemy types become the enemy faction's unit roster.
- **Upgrade system:** The research tree becomes a tech tree gating unit/building unlocks.
- **Visual aesthetic:** The dark sci-fi signal/breach theme is strong. Keep it.
- **Audio:** Reuse or re-prompt the audio system.
- **Lore:** The "Last Signal" world, the breach, the factions — all usable.

#### Suggested game name and framing:

Rather than "Last Signal RTS," consider: the game is about **two factions fighting over a collapsing signal network** in a dying world. One faction wants to restore it. One wants to harvest it for power. This maps naturally to C&C's Allied vs. Soviet framing and is entirely original IP.

---

## 6. The Multiplayer Concept — Still Excellent

The opposite-sides multiplayer concept discussed in this session applies equally to both tracks:

> Players start on opposite sides of the map. They build their base, defend against AI waves attacking from the outer edges, and eventually discover each other through fog of war. They then choose: ally against escalating waves, or turn on each other.

This works in the hybrid (Track A extended) AND in the full RTS (Track B). It's the strongest design idea from this session. It should be implemented regardless of which direction is chosen.

---

## 7. Decision Framework

Answer these questions honestly:

**Q1: If LastSignal earned $500/month on CrazyGames, would you be satisfied — or would you spend that time thinking about the C&C game you didn't build?**
- If satisfied → Option 1. Polish and ship. Done.
- If you'd be thinking about C&C → That's your answer.

**Q2: Is the creative satisfaction of building a C&C-inspired game more important than the safety of evolving an existing working game?**
- Safety → Hybrid (Option 2)
- Satisfaction → Fresh start (Option 4)

**Q3: Do you want to be playing LastSignal's successor in 6 months, or do you want to be playing something that feels like the C&C games you remember?**

---

## 8. Final Recommendation

**Ship LastSignal to CrazyGames in the next two weeks.** It is good enough. Monetise it. Let it earn passively.

**Then start the C&C-inspired game fresh.** Call it a new project. Design every system for RTS from day one. Use LastSignal's design assets — the unit roster, the lore, the aesthetic, the upgrade philosophy — as the foundation. Do not try to evolve LastSignal into it. That path has already been tried and produced the current identity crisis.

The C&C-inspired game is buildable in **3–5 months of AI-assisted development** — not years. The systems (A* pathfinding, unit production, rubber-band selection, basic AI, Colyseus multiplayer) are days of work each. The content (missions, balance, faction design) is the real time investment, and that's creative work you'll enjoy.

You loved C&C as a kid. Build the game you loved. You now have the tools to do it.

---

## 9. Summary Table

| Option | Verdict | Timeline | Satisfaction |
|--------|---------|----------|-------------|
| Polish & ship as-is | ✅ Do it — as a side track | 1–2 weeks | Low (creatively) |
| Commit to hybrid | ⚠️ Viable but middle ground | 4–8 weeks to meaningful feature | Medium |
| Gradually evolve to C&C | ❌ Worst option — fights architecture | Indefinite, frustrating | Low |
| Fresh C&C-inspired project | ✅ Recommended main track | 3–5 months to full game | High |

**The recommended path: Ship LastSignal → Start fresh.**

Two tracks. Real income from the existing game. Real satisfaction from the new one.
