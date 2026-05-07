# LastSignal — Monetisation Strategy Report

> **Date:** May 2026  
> **Scope:** Tower Defence web game (Vite/TypeScript canvas) + lessons from `ember_ultimate_complete_merged.jsx`

---

## 1. What the Ember JSX Teaches Us

`ember_ultimate_complete_merged.jsx` is a **live-service monetisation showcase** — a reference implementation of virtually every retention and spending technique used by top-grossing mobile/web games. Below is every technique found in the file and how it maps onto LastSignal.

### 1.1 Energy / Resource Gate
**Ember:** `MAX_ENERGY = 100`, consumed per fragment collected, regenerates at 1/tick (multiplied by VIP tier). Out-of-energy modal fires automatically, offering a gem refill or rewarded-ad top-up.

**LastSignal mapping:** Add a **"Signal Power"** resource consumed by placing towers or activating sector abilities. Free players regenerate slowly; VIP/premium players regenerate faster. When power hits zero mid-wave, a modal offers:
- Watch a 30-second ad → +20 power
- Spend 100 gems → full refill
- Buy VIP → permanent 3× regen

This is the single highest-converting monetisation hook in F2P games.

---

### 1.2 VIP Subscription Tiers (Recurring Revenue)
**Ember:** 6 tiers ($0–$999/month) with escalating benefits.

**LastSignal mapping:**

| Tier | Price/mo | Benefits |
|------|----------|---------|
| Sentinel | Free | Base game |
| Corporal | $2.99 | +25% wave reward, 2× regen, 5 daily gems |
| Captain | $4.99 | +50% reward, ad-free, extra tower slot |
| Commander | $9.99 | +100% reward, exclusive skins, priority events |
| Admiral | $19.99 | All content, mythic skins, private sector access |

Monthly recurring revenue (MRR) is the most stable income stream for a solo developer.

---

### 1.3 Battle Pass (Seasonal)
**Ember:** 100-tier battle pass ($99) with free and premium tracks. Season end timer creates urgency.

**LastSignal mapping:** **"Sector Season Pass"** ($4.99–$9.99/season, ~60 days):
- Free track: basic currency, common skins
- Premium track: new tower skins, special enemies, sector cosmetics, bonus maps
- Season timer visible on HUD at all times
- XP earned from completing waves/sectors, daily quests

Battle passes convert 40–60% better than raw gacha and face fewer regulatory issues.

---

### 1.4 Gacha / Mystery Box
**Ember:** `GACHA_RATES = { common:70%, rare:20%, epic:8%, legendary:1.9%, mythic:0.1% }` with a pity system (guaranteed legendary at 90 pulls, mythic at 180). Animated slot-machine reveal.

**LastSignal mapping:** **"Signal Crate"** (500 gems each):
- Common: cosmetic bullet trail / tower colour
- Rare: tower skin variant
- Epic: animated tower effect
- Legendary: unique tower model
- Mythic: full sector theme pack
- **Pity counter** always displayed (required under EU PEGI 2026 transparency rules)

---

### 1.5 Gem/Currency Packs (Direct Spend)
**Ember:** 6 gem pack tiers ($9.90 → $999.90), most popular marked with badge, bonus gems on larger packs.

**LastSignal mapping:**

| Pack | Gems | Price | Bonus |
|------|------|-------|-------|
| Starter | 100 | $0.99 | — |
| Standard | 550 | $4.99 | +50 |
| Popular | 1200 | $9.99 | +200 |
| Mega | 2500 | $19.99 | +500 |
| Ultra | 6500 | $49.99 | +1500 |
| Legend | 14000 | $99.99 | +4000 |

Always mark one "BEST VALUE" and one "MOST POPULAR" — anchoring dramatically increases average order value.

---

### 1.6 Starter Pack (One-Time Offer)
**Ember:** $4.99 (crossed out $49.99), shown 5 seconds after game starts with countdown timer. One time only.

**LastSignal mapping:** **"Commander's Kit"** — shown after the player completes Sector 1 (proven they enjoy it):
- 500 Gems, 3 exclusive tower skins, 7-day Captain VIP trial
- Price: $2.99 (crossed out $29.99), 24-hour countdown

First-purchase offers convert at 3–5× the rate of normal purchases.

---

### 1.7 Flash Sales & Limited-Time Offers
**Ember:** `showFlashSale` fires at t+22s with countdown. Sends urgent notification at 60 seconds remaining.

**LastSignal mapping:**
- Random flash sales 2×/day (90% off a gem pack, 15-minute window)
- Weekend events: "Signal Storm Weekend — 2× tower XP"
- Browser notification at 60-second mark (with permission)

---

### 1.8 Daily Login Rewards (Streak)
**Ember:** 7-day streak with escalating rewards. `showStreakWarning` fires at t+70s.

**LastSignal mapping:** 7-day daily login streak on the main menu. Day 7 reward: rare tower skin. Streak warning notification appears if the player hasn't logged in by 6 PM.

---

### 1.9 Timed Daily Deals
**Ember:** `DAILY_DEALS` array with 50% discounts, 24-hour refresh countdown visible on HUD.

**LastSignal mapping:** One rotating daily deal always visible on the main screen — e.g. "2× gem reward on next wave — $0.99" refreshes at midnight UTC.

---

### 1.10 Scheduled Live Events
**Ember:** Morning Rush (2× frags at 08:00), Golden Hour (5× at 18:00), Midnight Raid (3× at 00:00).

**LastSignal mapping:**
- **Signal Surge** — daily at 18:00, 2× wave gem reward for 1 hour
- **Sector Siege Weekend** — Saturday/Sunday boss rush with exclusive drop
- **Midnight Breach** — 00:00 for 2 hours, 3× enemy cash drops
- Events shown on an "Events Calendar" panel

---

### 1.11 Seasonal Events (FOMO)
**Ember:** `SEASONAL_EVENT` with `neverReturns: true`. Items have limited stock that visibly ticks down.

**LastSignal mapping:**
- **"Fractured Winter"** seasonal event with exclusive maps and tower skins
- "Never returns" label on all seasonal items
- Stock counter: "Only 7 left!" ticking down in real time

---

### 1.12 Social Pressure & Activity Feed
**Ember:** Activity feed shows friends buying VIP/gems. Every 15 seconds a random simulated player "buys Platinum VIP!"

**LastSignal mapping:** Live activity ticker on main menu: "Ragnar just bought the Season Pass!" and "FrostKing completed Sector 6!" — social proof normalises spending.

---

### 1.13 Social Comparison (FOMO)
**Ember:** `showSocialComparison` fires at t+30s: "You are falling behind! Sarah VIP Whale — Level 87, You — Level 1."

**LastSignal mapping:** After Sector 3, show: "Your defences are ranked #1,204. The top player has 34 sectors cleared — Boost your progress?" → links to shop.

---

### 1.14 Sunk Cost / Exit Warning
**Ember:** `handleQuit` checks `totalSpent > 0 || level > 5` and shows `SunkCostReminder`.

**LastSignal mapping:** On browser tab close (beforeunload): "Your streak and tower progress will be saved — but don't forget your daily wave resets in 3h!"

---

### 1.15 Progress Wall (Pay to Continue)
**Ember:** `ProgressWall` fires at levels 10, 25, 50: "Content Locked! Boost XP (300 gems)."

**LastSignal mapping:** Sector gates — Sector 5 requires either grinding previous sectors or paying 200 gems to unlock immediately.

---

### 1.16 Achievements & Whale Recognition
**Ember:** `whale` achievement unlocks at $1,000 total spent, shows WhaleModal with +10,000 bonus gems and "Top 1% of players."

**LastSignal mapping:** "Signal Legend" badge for top spenders, exclusive animated HUD border, name on global leaderboard. Rewarding big spenders publicly encourages others to aspire to the same status.

---

### 1.17 Inventory Pressure
**Ember:** Free = 50 slots, VIP Silver+ = 500. `LowInventoryWarning` appears at 80% full.

**LastSignal mapping:** Free players save 3 tower loadouts; VIP players save 20. When slot 3 is full: "Save more loadouts with Captain VIP."

---

### 1.18 Offline Rewards
**Ember:** `showOfflineRewards` fires 1.5s after start: "You earned X fragments while away."

**LastSignal mapping:** Passive income while offline — towers defend a "ghost sector" and generate currency. Show "collected while you were away" modal on every session start. Motivates daily return.

---

### 1.19 Rewarded Ads (Watch-to-Earn)
**Ember:** `refillEnergy('ad')` adds 20 energy. Referenced in `EnergyModal` and `OutOfEnergyModal`.

**LastSignal mapping — strategic placement:**
- After a lost wave: "Watch an ad to revive with 50% base health restored"
- Before a sector starts: "Watch an ad for 2× cash this wave"
- On daily deal panel: "Watch an ad to unlock today's deal for free"

Never show ads mid-wave. Always make them voluntary.

---

### 1.20 Pity System (Transparency & Compliance)
**Ember:** `PITY_LEGENDARY = 90`, `PITY_MYTHIC = 180`. Pull counter and pity thresholds shown in the Mystery Box UI.

**LastSignal mapping:** Always display the pity counter. Under EU PEGI 2026 rules this is likely mandatory. Transparency also reduces player frustration and improves trust/LTV.

---

## 2. All Known Game Monetisation Methods (2025/2026)

### Direct Revenue
| # | Method | Description |
|---|--------|-------------|
| 1 | **In-App Purchases (IAP)** | One-time purchases of currency, items, unlocks |
| 2 | **Subscription / VIP** | Recurring monthly fee for premium benefits |
| 3 | **Battle Pass** | Seasonal tiered reward tracks (free + premium) |
| 4 | **Gacha / Loot Boxes** | Random-chance item pulls (PEGI 16 in EU) |
| 5 | **Direct Item Sales** | Fixed-price cosmetics, skins, maps |
| 6 | **Starter / Founder Packs** | Deep-discounted one-time bundle for new players |
| 7 | **Daily Deals** | Rotating limited-time discounts |
| 8 | **Flash Sales** | Ultra-short (15-min) extreme discounts |
| 9 | **Energy Refills** | Pay to remove the resource gate |
| 10 | **XP Boosters** | Pay to level up / progress faster |
| 11 | **Remove Ads** | One-time purchase to go ad-free |
| 12 | **Early Access / Beta** | Charge for access before public launch |

### Advertising Revenue
| # | Method | Description |
|---|--------|-------------|
| 13 | **Rewarded Video Ads** | Player chooses to watch for in-game reward |
| 14 | **Interstitial Ads** | Full-screen ads at natural breaks (between waves) |
| 15 | **Banner Ads** | Persistent low-intrusion ads at screen edges |
| 16 | **Offer Wall** | Players complete third-party offers for currency |
| 17 | **Playable Ads** | Mini playable ad for another game |

### Platform / Distribution
| # | Method | Description |
|---|--------|-------------|
| 18 | **Portal Revenue Share** | CrazyGames, Poki, Armor Games share ad revenue |
| 19 | **Exclusive Licensing** | Sell exclusive portal rights for an upfront fee |
| 20 | **Non-Exclusive Licensing** | License to multiple portals simultaneously |
| 21 | **Roblox Game Passes** | Permanent upgrades sold for Robux |
| 22 | **Roblox Developer Products** | Consumable Robux purchases |
| 23 | **Roblox Engagement Rewards** | Earn Robux based on play-session minutes |
| 24 | **Steam Release** | Paid game or DLC on Steam |

### Community / Content
| # | Method | Description |
|---|--------|-------------|
| 25 | **Patreon / Ko-fi** | Fans donate monthly for exclusive behind-the-scenes content |
| 26 | **Discord Nitro Perks** | Exclusive in-game items for Discord Nitro subscribers |
| 27 | **Twitch Drops** | Viewers earn in-game items by watching streams |
| 28 | **Sponsored Streams** | Brands pay to be featured in live streams |
| 29 | **YouTube Revenue** | Devlog / gameplay videos monetised via AdSense |

### Emerging / Web3
| # | Method | Description |
|---|--------|-------------|
| 30 | **Branded Sponsorships** | Brand pays for in-game placement (named tower, loading screen) |
| 31 | **NFT Cosmetics** | Verifiable ownership of rare skins (PEGI 18 in EU) |
| 32 | **Play-to-Earn** | Players earn tradeable tokens through gameplay |
| 33 | **D2C Web Store** | Bypass platform fees by selling direct on your own site |
| 34 | **Charity Events** | Limited items where proceeds go to charity (PR + sales boost) |
| 35 | **Leaderboard Sponsorship** | Brand sponsors a seasonal leaderboard ("Powered by X") |

---

## 3. Platform Strategies

---

### 3A. Standalone Webpage

**Overview:** Host LastSignal on its own domain (e.g. `lastsignal.gg`). Full control over monetisation with no revenue share.

**How to Get Recurring Players:**
- SEO-optimised landing page targeting "free tower defence game", "browser tower defence"
- Email capture on first play (optional newsletter for events and updates)
- Browser push notifications (Web Push API) for daily login reminders and event announcements
- Social sharing buttons — "I defended Sector 6! Can you beat my score?"
- Discord server linked from the game, with exclusive in-game code rewards for members
- Weekly devlog blog posts for organic SEO traffic

**Monetisation Stack:**
1. **Gem packs** via Stripe, LemonSqueezy, or Paddle (handles VAT globally)
2. **VIP subscription** via Stripe Billing (recurring)
3. **Battle Pass** — seasonal, sold via the shop panel
4. **Rewarded ads** via Google AdSense or Venatus (browser game specialist)
5. **Interstitial ads** between sectors (never mid-wave)
6. **Remove Ads** one-time purchase — $2.99
7. **Daily deals** and flash sales driven by client-side timers (no backend needed for MVP)
8. **Starter pack** shown after Sector 1 completion (one-time, stored in localStorage)

**Revenue Estimate (rough):** 10,000 MAU → ~500 paying users at $4 ARPU = ~$2,000/month + $200–$800/month in ad revenue.

**Tech Requirements:** Payment processor account, basic backend for purchase verification (or use Xsolla/GameAnalytics which handles this server-side for you).

---

### 3B. CrazyGames

**Overview:** CrazyGames is one of the largest HTML5 game portals (~50M monthly players). They host the game for free and share ad revenue with developers.

**Requirements:**
- Integrate the **CrazyGames SDK** (JavaScript, ~1 day of work)
- No branding from other portals in the game
- Pass a quality review
- Set up billing profile (Tipalti) — minimum payout €100
- Move from "Basic Launch" to "Full Launch" to unlock monetisation

**CrazyGames SDK Features to Use:**
- `sdk.ad.requestAd('rewarded')` — trigger rewarded ads (wave revive, bonus gems)
- `sdk.ad.requestAd('midgame')` — between sector transitions
- `sdk.game.sdkGameLoadingStart/Stop()` — required loading hooks
- `sdk.user.isUserAccountAvailable()` — basic user auth for leaderboards

**How to Get Recurring Players:**
- CrazyGames discovery algorithm rewards high session length and day-1 retention — optimise your onboarding
- Tag correctly: "tower defense", "strategy", "free", "browser game"
- Respond to player comments on the game page to boost engagement signals
- Update the game regularly — CrazyGames features recently updated games on the home page
- Reach out to CrazyGames developer relations for cross-promotion

**Monetisation Stack:**
- **Ad revenue share** (primary) — CrazyGames serves ads, you earn a percentage
- **Rewarded ads** — highest CPM format; use at wave loss screen and bonus start
- **In-app purchases** — CrazyGames allows IAP via their payment flow for qualifying games; otherwise direct to your domain
- **Featured placement** — negotiate paid featured slots after proving strong metrics

**Revenue Estimate:** A well-performing title with 100K monthly plays → $300–$1,500/month in ad revenue. Rewarded ads pay $8–$25 CPM vs $0.50–$2 for banners.

**Tip:** Push for **rewarded ads exclusively**. A tower defence game is perfect — offer "Watch ad to revive the base" after a lost wave. Highest converting and highest paying format.

---

### 3C. Roblox

**Overview:** Port or reimagine LastSignal as a Roblox experience. Roblox has 88M+ daily active users, a built-in economy (Robux), and a Developer Exchange (DevEx) program to convert Robux to real money.

**How Roblox Monetisation Works:**
- Players buy **Robux** with real money (1,000 Robux ≈ $10)
- Developers earn Robux from Game Passes, Developer Products, and Engagement Rewards
- **DevEx rate:** ~$0.0035 per Robux (30,000 Robux → ~$105). Rate is better for U.S. 18+ spend.
- Minimum DevEx threshold: 30,000 earned Robux

**Porting LastSignal to Roblox:**
LastSignal would need to be rebuilt in Lua/Roblox Studio. The core tower-defence loop translates perfectly — Roblox has many successful TD games (Tower Defense Simulator, All Star Tower Defense).

**Monetisation Stack:**

1. **Game Passes (permanent):**
   - "Signal Commander" — 2× wave cash (299 Robux / ~$2.99)
   - "Extra Tower Slot" — 4th tower slot (149 Robux)
   - "VIP Server Access" — private server (100 Robux)

2. **Developer Products (consumable):**
   - "Gem Pack Small" — 100 gems (75 Robux)
   - "Wave Revive" — revive current wave (25 Robux)
   - "Tower XP Boost 1h" — 2× XP for 1 hour (50 Robux)

3. **Gacha units:** Random tower draws using in-game or purchased currency — standard and hugely popular in Roblox TD games

4. **Seasonal limited items:** Event-exclusive towers with unique animations (high FOMO)

5. **Trading economy:** Allow players to trade duplicate tower units — creates organic engagement and a player-driven economy

6. **Engagement Rewards:** Roblox pays based on minutes played by premium users — optimise for session length (longer sectors, endless mode)

**How to Get Recurring Players on Roblox:**
- Roblox discovery is primarily via the **home page algorithm** — games with strong day-1 retention and concurrent player count rank higher
- Pay for **Roblox Sponsored Ads** (cost-per-click within the platform) for initial traffic
- **YouTube and TikTok creators** who cover Roblox TD games are the #1 growth lever — send codes for free gems
- **Update thumbnails regularly** — signals to the algorithm that the game is active
- **Codes system** — release codes on Twitter/X and Discord for free gems; players share codes organically
- **Collaboration events** — partner with another popular Roblox game for a crossover event

**Revenue Estimate:** A mid-tier Roblox TD game (1,000 concurrent players) → 50,000–200,000 Robux/month → ~$175–$700/month. Top Roblox TD games earn millions of Robux per month.

---

## 4. Recommended Rollout Order

| Phase | Action | Goal |
|-------|--------|------|
| **1 (Now)** | Add energy gate + daily login + starter pack on standalone webpage | Prove retention loop |
| **2 (Month 1–2)** | Integrate CrazyGames SDK, submit for review, launch rewarded ads | First ad revenue |
| **3 (Month 2–3)** | Add gem packs + VIP subscription via Stripe/LemonSqueezy | First direct revenue |
| **4 (Month 3–4)** | Launch Season 1 Battle Pass | Recurring seasonal income |
| **5 (Month 6+)** | Evaluate Roblox port based on web traction | Larger audience |

---

## 5. Key Design Principles (From Ember's Playbook)

1. **Never block core gameplay** — put monetisation at natural break points (between waves/sectors, on loss screen, on session start)
2. **Always show value** — use crossed-out original prices. "$2.99 (was $29.99)" converts far better than "$2.99"
3. **Use timers** — a countdown on any offer increases conversion by 20–40%
4. **Normalise spending** — the activity feed showing other players buying items makes spending feel socially acceptable
5. **Reward loyalty** — daily login streaks and streak-loss warnings are the cheapest retention tool available
6. **Multiple price points** — have items at $0.99, $4.99, $9.99, and $49.99+ to capture impulse buyers and whales
7. **Pity systems build trust** — always show gacha odds and pity progress; under EU PEGI 2026 rules this may be legally required
8. **VIP > ads** — a player on $4.99/month VIP is worth 5–10× more than an ad-viewing free player; always upsell from energy and ad modals
9. **Social proof closes sales** — "3 friends online now" and "Emma just bought VIP" are free conversion tools
10. **Sunk cost is your friend** — remind players of their progress, streak, and purchases whenever they try to leave
