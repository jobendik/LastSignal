# LAST SIGNAL — Audio Asset List

A complete list of professional audio assets required for the game.  
All entries are intended to replace the current procedural Web Audio synthesis with real, recorded/produced sounds.

---

## 1. MUSIC

| ID | Description | Intensity / State | Notes |
|----|-------------|-------------------|-------|
| `music_menu` | Main menu ambient track | Calm, atmospheric sci-fi | Loops seamlessly |
| `music_planning` | Planning phase background music | Calm, strategic | Low intensity; plays between waves |
| `music_wave` | Wave-active combat music | Tense, percussive | Intensity 1; transitions from planning |
| `music_boss` | Boss encounter music | Intense, dramatic | Intensity 2; triggered on boss spawn |
| `music_victory` | Victory end screen music | Triumphant, resolving | Short loop or one-shot |
| `music_defeat` | Defeat / Signal Lost end screen music | Somber, descending | One-shot or short loop |

---

## 2. TOWER FIRE SOUNDS

One firing sound per tower type, triggered every time the tower attacks.

| ID | Tower | Character |
|----|-------|-----------|
| `sfx_tower_pulse_fire` | Pulse Cannon | Sharp kinetic thump/pop |
| `sfx_tower_blaster_fire` | Blaster Node | Fast, high-rate metallic click/snap |
| `sfx_tower_stasis_fire` | Stasis Projector | Crystalline, cold resonant chime |
| `sfx_tower_mortar_launch` | Mortar Relay | Deep thud / hollow tube launch |
| `sfx_tower_mortar_impact` | Mortar Relay (explosion impact) | Mid-range explosion with debris |
| `sfx_tower_tesla_fire` | Tesla Array | Sharp electric crack / arc discharge |
| `sfx_tower_railgun_fire` | Railgun | Massive kinetic boom with high-velocity snap |
| `sfx_tower_flamer_fire` | Flamer | Hissing roar / gas-fueled flame burst |
| `sfx_tower_barrier_pulse` | Barrier Node | Low hum / energy field pulse |
| `sfx_tower_snare_launch` | Snare Tower | Mechanical net launcher thwack |
| `sfx_tower_snare_impact` | Snare Tower (net hits enemy) | Net tangle / shatter crack |
| `sfx_tower_harvester_tick` | Eco Harvester | Soft crystal extraction pulse / mechanical click |
| `sfx_tower_amplifier_resonance` | Amplifier | Warm resonant hum / power-up chord |
| `sfx_tower_overclock_charge` | Overclock Station | Electric surge / capacitor charging |
| `sfx_tower_overclock_fire` | Overclock Station (boost fires) | Sharp power discharge |
| `sfx_tower_reflector_redirect` | Reflector | Glassy mirror refraction ping |

---

## 3. TOWER STATE SOUNDS

Events that happen to towers during play.

| ID | Event | Character |
|----|-------|-----------|
| `sfx_tower_build` | Tower placed/deployed | Mechanical assembly / placement clunk |
| `sfx_tower_upgrade` | Tower upgraded | Rising electronic chime / tech power-up |
| `sfx_tower_sell` | Tower sold / removed | Deconstruct mechanical whirr |
| `sfx_tower_damaged` | Tower takes damage | Structural hit / sparking thud |
| `sfx_tower_critical` | Tower at critical HP | Alarm ping / warning beep |
| `sfx_tower_disabled` | Tower disabled (Saboteur / Jammer aura) | Descending power-down hum |
| `sfx_tower_restored` | Tower re-enabled after disable | Rising power-on hum |
| `sfx_tower_repaired` | Tower fully repaired | Soft positive confirm chirp |

---

## 4. ENEMY SOUNDS

### 4a. Death / Kill Sounds

Played when each enemy type is destroyed.

| ID | Enemy | Character |
|----|-------|-----------|
| `sfx_enemy_scout_death` | Scout | Light digital pop / dissolve |
| `sfx_enemy_grunt_death` | Grunt | Medium impact crack |
| `sfx_enemy_brute_death` | Brute | Heavy, low explosion/crunch |
| `sfx_enemy_weaver_death` | Weaver | Organic shriek / energy dissipation |
| `sfx_enemy_phantom_death` | Phantom | Ethereal phase-out shimmer |
| `sfx_enemy_carrier_death` | Carrier | Heavy crack + burst scatter (spawn release) |
| `sfx_enemy_sprinter_death` | Sprinter | Short sharp zip / pop |
| `sfx_enemy_juggernaut_death` | Juggernaut | Massive low explosion / heavy metal collapse |
| `sfx_enemy_shielder_death` | Shielder | Shield shatter + secondary body death |
| `sfx_enemy_splitter_death` | Splitter | Organic crack / binary fission pop |
| `sfx_enemy_jammer_death` | Jammer | Electronic burst / signal cut-out |
| `sfx_enemy_swarm_death` | Swarm | Tiny crackle / micro-destruction |
| `sfx_enemy_tunneler_death` | Tunneler | Subterranean rumble / collapse |
| `sfx_enemy_saboteur_death` | Saboteur | Short circuit pop / crackling discharge |
| `sfx_enemy_cache_death` | Data Cache | Data packet corruption blip |
| `sfx_enemy_mirror_death` | Mirror | Glass-like shattering / crystalline break |
| `sfx_enemy_overlord_death` | Overlord (boss) | Large layered explosion / energy collapse |
| `sfx_enemy_leviathan_death` | Leviathan (boss) | Massive multi-layered destruction |
| `sfx_enemy_harbinger_death` | Harbinger (boss) | Artillery-scale explosion / structural collapse |

### 4b. Enemy Ability Sounds

| ID | Enemy / Ability | Character |
|----|----------------|-----------|
| `sfx_enemy_weaver_heal` | Weaver — healing aura pulse | Organic warm pulse / bio-energy hum |
| `sfx_enemy_phantom_phase_in` | Phantom — phasing out of reality | Ghostly fade / shimmer disappear |
| `sfx_enemy_phantom_phase_out` | Phantom — phasing back in | Ghostly materialize / shimmer appear |
| `sfx_enemy_carrier_spawn` | Carrier — releases Scout swarm on death | Burst scatter / mass release |
| `sfx_enemy_splitter_spawn` | Splitter — splits into Grunts | Organic fission crack |
| `sfx_enemy_jammer_aura` | Jammer — disruption aura active | Continuous low-frequency interference buzz |
| `sfx_enemy_tunneler_burrow` | Tunneler — dives underground | Rumble / drill into earth |
| `sfx_enemy_tunneler_emerge` | Tunneler — surfaces near core | Ground rupture / emerge burst |
| `sfx_enemy_saboteur_sabotage` | Saboteur — disables a tower | Dirty electric interference pulse |
| `sfx_enemy_mirror_absorb` | Mirror — absorbs a projectile hit | Reflective ping / deflect click |
| `sfx_enemy_shielder_bubble_break` | Shielder — shield bubble depleted | Bubble-pop / energy collapse |
| `sfx_enemy_overlord_spawn` | Overlord — births Swarm escort | Rapid spawn burst / micro-drone release |
| `sfx_enemy_harbinger_artillery_launch` | Harbinger — fires artillery shell | Heavy cannon boom |
| `sfx_enemy_harbinger_artillery_impact` | Harbinger — shell lands | Massive ground explosion |
| `sfx_enemy_leviathan_corruption_pulse` | Leviathan — corruption wave | Ominous deep pulse / wave of distortion |
| `sfx_enemy_leviathan_tower_disable` | Leviathan — disables towers | Mass electronic shutdown blast |
| `sfx_enemy_leviathan_summon_escorts` | Leviathan — summons escorts | Dark harmonic tone / summon burst |

---

## 5. CORE SOUNDS

| ID | Event | Character |
|----|-------|-----------|
| `sfx_core_hit` | Core takes breach damage | Deep structural impact / alarm resonance |
| `sfx_core_critical` | Core at low integrity | Sustained warning alarm |
| `sfx_core_ambient` | Signal Core ambient loop | Low background hum (looping) |

---

## 6. DRONE SOUNDS

| ID | Drone / Event | Character |
|----|--------------|-----------|
| `sfx_drone_hunter_attack` | Hunter Drone fires | Light kinetic buzz / quick shot |
| `sfx_drone_scanner_scan` | Scanner Drone scans / pings | Sonar-like sweep / digital ping |
| `sfx_drone_guardian_attack` | Guardian Drone intercept shot | Light energetic tap |
| `sfx_drone_deployed` | Any drone deployed | Soft mechanical launch |
| `sfx_drone_destroyed` | Drone destroyed | Small pop / shutdown |

---

## 7. SQUAD SOUNDS

### 7a. Deployment and Commands

| ID | Event | Character |
|----|-------|-----------|
| `sfx_squad_arm` | Squad command armed (player presses squad button) | Short affirmative bip |
| `sfx_squad_select` | Squad selected | Two-tone click / double chirp |
| `sfx_squad_recon_deploy` | Recon Squad deployed | Bright digital ping / sonar sweep |
| `sfx_squad_engineer_deploy` | Engineer Squad deployed | Soft mechanical chirp |
| `sfx_squad_strike_deploy` | Strike Squad deployed | Sharp pulse / ready alert |
| `sfx_squad_shield_deploy` | Shield Squad deployed | Low stabilizing hum / chord |
| `sfx_squad_evac` | Squad evac ordered | Ascending radio blip |
| `sfx_squad_recalled` | Squad recalled (evac complete) | Descending warm tone |
| `sfx_squad_lost` | Squad destroyed | Short distorted failure tone |
| `sfx_squad_retask` | Squad re-tasked / new order | Quick affirmative chirp |

### 7b. Per-Tick Action Sounds

| ID | Event | Character |
|----|-------|-----------|
| `sfx_squad_recon_scan` | Recon squad active scan pulse | Fast bright sonar ping |
| `sfx_squad_engineer_repair` | Engineer repairing a tower (per tick) | Mechanical repair chirp |
| `sfx_squad_strike_attack` | Strike squad firing (per shot) | Short laser tap |
| `sfx_squad_shield_field` | Shield squad field hum (ambient loop) | Stabilizing low chord hum |

---

## 8. GAME EVENT SOUNDS

| ID | Event | Character |
|----|-------|-----------|
| `sfx_wave_start` | Wave begins | Alert siren / combat ready sting |
| `sfx_wave_complete` | Wave cleared | Short positive resolve |
| `sfx_boss_alert` | Boss spawns | Three-beat descending alarm |
| `sfx_victory` | Victory / Signal Held | Rising triumphant chord arpeggio |
| `sfx_defeat` | Defeat / Signal Lost | Descending somber chord sequence |
| `sfx_reward_ready` | Reward screen unlocked | Positive pickup chime |
| `sfx_objective_complete` | Objective completed | Milestone chord / success tone |
| `sfx_capture_point` | Strategic point captured | Ascending arpeggio / "secured" tone |
| `sfx_data_cache_recovered` | Data Cache recovered | Two-blip pickup jingle |
| `sfx_credits_collected` | Credits earned / coin pickup | Light coin pickup ping |
| `sfx_power_surge` | Power surge / special ability fired | Energy discharge surge |
| `sfx_achievement_unlocked` | Achievement earned | Short triumphant three-note sting |

---

## 9. UI SOUNDS

| ID | Event | Character |
|----|-------|-----------|
| `sfx_ui_hover` | Button or element hovered | Very subtle short tick |
| `sfx_ui_click` | Button clicked / confirmed | Crisp click |
| `sfx_ui_panel_open` | Panel / menu opened | Short whoosh or slide-in |
| `sfx_ui_panel_close` | Panel / menu closed | Short whoosh or slide-out |
| `sfx_ui_card_flip` | Reward card revealed | Card flip or shuffle sound |
| `sfx_ui_error` | Invalid action / not enough credits | Short negative buzz |
| `sfx_ui_select` | Item/option selected | Clean select tap |

---

## 10. AMBIENT / WORLD SOUNDS

| ID | Description | Notes |
|----|-------------|-------|
| `amb_battlefield` | General battlefield ambience | Subtle background hum / wind / distant electrical |
| `amb_core_stable` | Signal Core stable ambient loop | Low electrical hum (calm intensity) |
| `amb_core_warning` | Signal Core under stress | More intense hum / warning undertone |
| `amb_crystal_field` | Crystal deposit ambient loop | Crystalline resonance / natural hum |
| `amb_wave_approach` | Enemy wave approaching from off-screen | Rising distant rumble |

---

## Summary by Category

| Category | Count |
|----------|-------|
| Music tracks | 6 |
| Tower fire sounds | 16 |
| Tower state sounds | 8 |
| Enemy death sounds | 19 |
| Enemy ability sounds | 17 |
| Core sounds | 3 |
| Drone sounds | 5 |
| Squad sounds | 14 |
| Game event sounds | 12 |
| UI sounds | 7 |
| Ambient / world sounds | 5 |
| **Total** | **112** |
