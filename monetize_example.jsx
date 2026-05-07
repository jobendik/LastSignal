import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// EMBER ULTIMATE COMPLETE MERGED
// Canvas-safe React build. No external icon libraries. No external assets.
// Includes the old canvas-safe feature set + the expanded live-service version.

const WORLD_SIZE = 4000;
const MAX_ENERGY = 100;
const ENERGY_PER_FRAGMENT = 5;
const ENERGY_PER_BEACON = 10;
const ENERGY_REGEN_RATE = 1;
const FRAGMENT_SPAWN_RATE = 0.055;
const LIGHT_MIN_RADIUS = 30;
const MAX_INVENTORY_FREE = 50;
const MAX_INVENTORY_PREMIUM = 500;
const PITY_LEGENDARY = 90;
const PITY_MYTHIC = 180;

const BEACONS = [
  { id: 'b1', x: WORLD_SIZE / 2 + 350, y: WORLD_SIZE / 2 - 350, icon: '🌟', type: 'sanctuary', name: 'Sanctuary', buff: 'Light radius +50%' },
  { id: 'b2', x: WORLD_SIZE / 2 - 1000, y: WORLD_SIZE / 2 - 1000, icon: '🔮', type: 'wisdom', name: 'Wisdom', buff: 'See all players on map' },
  { id: 'b3', x: WORLD_SIZE / 2 + 1000, y: WORLD_SIZE / 2 + 1000, icon: '✨', type: 'hope', name: 'Hope', buff: 'Golden trail' },
  { id: 'b4', x: WORLD_SIZE / 2 + 1000, y: WORLD_SIZE / 2 - 1000, icon: '⚡', type: 'courage', name: 'Courage', buff: 'Move speed boost' },
  { id: 'b5', x: WORLD_SIZE / 2 - 1000, y: WORLD_SIZE / 2 + 1000, icon: '💫', type: 'unity', name: 'Unity', buff: 'Map-wide chat' },
];

const VIP_TIERS = [
  { level: 0, name: 'Free Player', price: 0, benefits: ['Basic features'], color: '#9CA3AF' },
  { level: 1, name: 'Bronze VIP', price: 49, benefits: ['+10% fragments', '2x energy regen', '5 daily gems'], color: '#CD7F32' },
  { level: 2, name: 'Silver VIP', price: 99, benefits: ['+25% fragments', '3x energy regen', '15 daily gems', 'No ads', 'Bigger inventory'], color: '#C0C0C0' },
  { level: 3, name: 'Gold VIP', price: 199, benefits: ['+50% fragments', '5x energy regen', 'Exclusive colors', 'Priority support'], color: '#FFD700' },
  { level: 4, name: 'Platinum VIP', price: 499, benefits: ['+100% fragments', '10x energy regen', 'Mythic access', 'All content unlocked'], color: '#E5E4E2' },
  { level: 5, name: 'Diamond VIP', price: 999, benefits: ['+200% fragments', 'Infinite energy', 'Exclusive events', 'God mode'], color: '#B9F2FF' },
];

const SHOP_PRODUCTS = {
  colors: [
    { id: 'c1', name: 'Rose Pink', price: 1.99, gems: 0, rarity: 'common', color: '#F472B6', stock: 100 },
    { id: 'c2', name: 'Ocean Blue', price: 1.99, gems: 0, rarity: 'common', color: '#60A5FA', stock: 100 },
    { id: 'c3', name: 'Forest Green', price: 1.99, gems: 0, rarity: 'common', color: '#34D399', stock: 100 },
    { id: 'c4', name: 'Nebula Purple', price: 4.99, gems: 0, rarity: 'rare', color: '#A78BFA', stock: 50 },
    { id: 'c5', name: 'Phoenix Gold', price: 4.99, gems: 0, rarity: 'rare', color: '#FFD700', stock: 50 },
    { id: 'c6', name: 'Aurora Teal', price: 4.99, gems: 0, rarity: 'rare', color: '#14B8A6', stock: 50 },
    { id: 'c7', name: 'Rainbow Prism', price: 9.99, gems: 0, rarity: 'legendary', color: 'linear-gradient(90deg,#FF0080,#7928CA)', canvasColor: '#FF0080', stock: 7, vipRequired: 3 },
    { id: 'c8', name: 'Divine Light', price: 9.99, gems: 0, rarity: 'legendary', color: '#FFFFFF', stock: 10, vipRequired: 2 },
    { id: 'c9', name: 'Void Shadow', price: 9.99, gems: 0, rarity: 'legendary', color: '#1F2937', stock: 10 },
    { id: 'c10', name: 'Chromatic Infinity', price: 19.99, gems: 0, rarity: 'mythic', color: 'conic-gradient(#FF0080,#FF8C00,#00FFFF,#FF0080)', canvasColor: '#FF0080', stock: 3, vipRequired: 4 },
    { id: 'c11', name: 'Titan Celestial', price: 0, gems: 5000, rarity: 'mythic', color: '#00FFFF', canvasColor: '#00FFFF', stock: 2, vipRequired: 5 },
  ],
  trails: [
    { id: 't1', name: 'Sparkle', price: 2.99, gems: 0, rarity: 'common', icon: '✨', stock: 100 },
    { id: 't2', name: 'Stardust', price: 2.99, gems: 0, rarity: 'common', icon: '🌌', stock: 100 },
    { id: 't3', name: 'Phoenix Fire', price: 7.99, gems: 0, rarity: 'rare', icon: '🔥', stock: 50 },
    { id: 't4', name: 'Galactic Veil', price: 0, gems: 2000, rarity: 'legendary', icon: '🌠', stock: 9, vipRequired: 3 },
  ],
  auras: [
    { id: 'a1', name: 'Soft Glow', price: 9.99, gems: 0, rarity: 'rare', icon: '🌟', stock: 40 },
    { id: 'a2', name: 'Radiant Burst', price: 14.99, gems: 0, rarity: 'legendary', icon: '💥', stock: 12 },
    { id: 'a3', name: 'Cosmic Resonance', price: 0, gems: 8000, rarity: 'mythic', icon: '🌀', stock: 4, vipRequired: 4 },
  ],
  emotes: [
    { id: 'e1', name: 'Wave', price: 0, gems: 0, rarity: 'common', icon: '👋' },
    { id: 'e2', name: 'Heart', price: 0, gems: 0, rarity: 'common', icon: '💛' },
    { id: 'e3', name: 'Sparkle', price: 0, gems: 0, rarity: 'common', icon: '✨' },
    { id: 'e4', name: 'Bow', price: 0, gems: 0, rarity: 'common', icon: '🙏' },
    { id: 'e5', name: 'Crown', price: 0, gems: 500, rarity: 'rare', icon: '👑', vipRequired: 2 },
  ],
};

const SEASONAL_EVENT = {
  id: 'winter_2025',
  name: 'Frozen Ember Festival',
  theme: { primary: '#60A5FA', secondary: '#93C5FD', icon: '❄️' },
  exclusiveItems: [
    { id: 'winter_color', name: 'Frost Crystal', rarity: 'mythic', price: 14.99, gems: 0, color: '#BFDBFE', canvasColor: '#BFDBFE', stock: 8 },
    { id: 'winter_trail', name: 'Snowfall Trail', rarity: 'legendary', price: 9.99, gems: 0, icon: '❄️', stock: 12 },
  ],
  limitedFragments: { id: 'snowflake', name: 'Snowflake', icon: '❄️', convertRate: 2 },
  endDate: Date.now() + 86400000 * 3,
  neverReturns: true,
};

const SCHEDULED_EVENTS = [
  { id: 'morning_rush', name: 'Morning Rush', time: '08:00', duration: 60, multiplier: 2, icon: '☀️' },
  { id: 'golden_hour', name: 'Golden Hour', time: '18:00', duration: 60, multiplier: 5, icon: '🌅' },
  { id: 'night_raid', name: 'Midnight Raid', time: '00:00', duration: 120, multiplier: 3, icon: '🌙' },
];

const GEM_PACKS = [
  { id: 'g1', gems: 100, price: 9.9, bonus: 0 },
  { id: 'g2', gems: 500, price: 49.9, bonus: 50 },
  { id: 'g3', gems: 1200, price: 99.9, bonus: 200, popular: true, badge: 'POPULAR!' },
  { id: 'g4', gems: 2500, price: 199.9, bonus: 500 },
  { id: 'g5', gems: 6500, price: 499.9, bonus: 1500, badge: 'BEST VALUE!' },
  { id: 'g6', gems: 14000, price: 999.9, bonus: 4000, badge: 'MEGA DEAL!' },
];

const STARTER_PACKS = [
  { id: 'starter1', name: 'Starter Pack', price: 4.99, originalPrice: 49.99, items: ['500 Gems', '1000 Fragments', '3 Energy Refills', '1 Rare Mystery Box'], expiresIn: 3600, icon: '🎁' },
  { id: 'starter2', name: 'Kickstart Mega Bundle', price: 19.99, originalPrice: 199.99, items: ['2000 Gems', '5000 Fragments', '10 Energy Refills', '1 Legendary Item', 'VIP Bronze 7 days'], expiresIn: 7200, icon: '🚀' },
];

const DAILY_DEALS = [
  { id: 'dd1', name: '2x Fragments', item: '2x Fragments', duration: '24h', price: 2.99, originalPrice: 5.99, discount: 50, icon: '💎' },
  { id: 'dd2', name: 'Full Energy Refill', item: 'Full Energy Refill', duration: 'Instant', price: 0.99, originalPrice: 1.99, discount: 50, icon: '⚡' },
  { id: 'dd3', name: 'Mystery Box x3', item: 'Mystery Box x3', duration: 'Instant', price: 9.99, originalPrice: 19.99, discount: 50, icon: '📦' },
  { id: 'dd4', name: 'Rainbow Prism', item: 'Rainbow Prism', duration: 'Today only', price: 4.99, originalPrice: 9.99, discount: 50, icon: '🌈' },
];

const BOOSTERS = [
  { id: 'bo1', name: '2x Fragments', duration: '1 hour', price: 0.99, gems: 100, icon: '💎', multiplier: 2 },
  { id: 'bo2', name: '3x XP', duration: '2 hours', price: 2.99, gems: 300, icon: '⭐', multiplier: 3 },
  { id: 'bo3', name: '10x Light Radius', duration: '30 min', price: 1.99, gems: 200, icon: '⚡', multiplier: 10 },
  { id: 'bo4', name: 'Teleport', duration: 'One use', price: 0.49, gems: 50, icon: '🌀', multiplier: 1 },
  { id: 'bo5', name: 'Full Energy Refill', duration: 'Instant', price: 0.99, gems: 100, icon: '🔋', multiplier: 1 },
  { id: 'bo6', name: 'Auto-Collect', duration: '1 hour', price: 3.99, gems: 400, icon: '🤖', multiplier: 1, vipRequired: 2 },
];

const DAILY_QUESTS_INITIAL = [
  { id: 'q1', title: 'Collect 50 Fragments', progress: 0, goal: 50, reward: 100, xpReward: 500, gemReward: 10, icon: '💎' },
  { id: 'q2', title: 'Light 3 Beacons', progress: 0, goal: 3, reward: 200, xpReward: 1000, gemReward: 20, icon: '🌟' },
  { id: 'q3', title: 'Meet 5 Souls', progress: 0, goal: 5, reward: 50, xpReward: 300, gemReward: 5, icon: '👥' },
  { id: 'q4', title: 'Play with Friends', progress: 0, goal: 1, reward: 150, xpReward: 750, gemReward: 15, icon: '🤝' },
  { id: 'q5', title: 'Use 50 Energy', progress: 0, goal: 50, reward: 300, xpReward: 1500, gemReward: 30, icon: '⚡' },
];

const ACHIEVEMENTS_INITIAL = [
  { id: 'first_light', title: 'First Light', desc: 'Light your first beacon', icon: '🌟', rarity: 'common', progress: 0, goal: 1, gemReward: 50 },
  { id: 'illuminator', title: 'Illuminator', desc: 'Light 10 beacons', icon: '💡', rarity: 'common', progress: 0, goal: 10, gemReward: 100 },
  { id: 'master', title: 'Lightmaster', desc: 'Light all 5 beacon types', icon: '👑', rarity: 'rare', progress: 0, goal: 5, gemReward: 500 },
  { id: 'collector', title: 'Collector', desc: 'Collect 1000 fragments', icon: '💎', rarity: 'rare', progress: 0, goal: 1000, gemReward: 250 },
  { id: 'spender', title: 'Supporter', desc: 'Spend 100', icon: '💰', rarity: 'legendary', progress: 0, goal: 100, gemReward: 1000 },
  { id: 'whale', title: 'Legend', desc: 'Spend 1000', icon: '🐋', rarity: 'mythic', progress: 0, goal: 1000, gemReward: 10000 },
];

const DAILY_LOGIN_REWARDS = [
  { day: 1, fragments: 100, gems: 10, icon: '💎' },
  { day: 2, fragments: 150, gems: 15, icon: '💎' },
  { day: 3, fragments: 200, gems: 20, icon: '💎', item: 'Energy Refill' },
  { day: 4, fragments: 250, gems: 25, icon: '💎' },
  { day: 5, fragments: 300, gems: 30, icon: '💎', item: 'Mystery Box' },
  { day: 6, fragments: 400, gems: 50, icon: '💎' },
  { day: 7, fragments: 1000, gems: 100, icon: '🎁', item: 'Legendary Mystery Box', special: true },
];

const BATTLE_PASS_TIERS = Array.from({ length: 100 }, (_, i) => ({
  tier: i + 1,
  free: i % 5 === 0 ? { fragments: 50 * (i + 1), xp: 100 * (i + 1) } : null,
  premium: {
    fragments: 200 + i * 10,
    xp: 500 + i * 50,
    item: i % 10 === 0 ? `Exclusive Item #${i + 1}` : null,
    rarity: i === 99 ? 'mythic' : i % 25 === 0 ? 'legendary' : i % 8 === 0 ? 'rare' : 'common',
  },
}));

const MOCK_FRIENDS = [
  { id: 'f1', name: 'Emma Starlight', level: 23, online: true, lastSeen: 'Now', streak: 47, fragments: 12847, vipLevel: 2, lastPurchase: '2 hours ago' },
  { id: 'f2', name: 'Alex Dreamer', level: 19, online: true, lastSeen: 'Now', streak: 31, fragments: 8234, vipLevel: 1, lastPurchase: '1 day ago' },
  { id: 'f3', name: 'Sarah VIP Whale', level: 87, online: true, lastSeen: 'Now', streak: 234, fragments: 847234, vipLevel: 5, lastPurchase: '5 min ago' },
];

const ACTIVITY_FEED_INITIAL = [
  { id: 'a1', user: 'Emma Starlight', action: 'lit the Hope Beacon', time: '2m ago', icon: '🌟' },
  { id: 'a2', user: 'Alex Dreamer', action: 'found a LEGENDARY fragment', time: '5m ago', icon: '💎' },
  { id: 'a3', user: 'Sarah VIP Whale', action: 'bought Diamond VIP!', time: '8m ago', icon: '💰', highlight: true },
  { id: 'a4', user: 'Mike Phoenix', action: 'reached Level 34', time: '12m ago', icon: '⭐' },
  { id: 'a5', user: 'Lisa Light', action: 'bought Mega Gem Pack!', time: '15m ago', icon: '💎', highlight: true },
  { id: 'a6', user: 'Tom Thunder', action: 'completed the Battle Pass!', time: '23m ago', icon: '🏆' },
];

const GLOBAL_LEADERBOARD = [
  { rank: 1, name: 'Eternal Wanderer', level: 127, fragments: 2847123, country: '🇺🇸', spent: 4523, vipLevel: 5 },
  { rank: 2, name: 'Cosmic Dreamer', level: 119, fragments: 2645891, country: '🇬🇧', spent: 3891, vipLevel: 5 },
  { rank: 3, name: 'Starlight Queen', level: 113, fragments: 2501234, country: '🇨🇦', spent: 2134, vipLevel: 4 },
  { rank: 234, name: 'You', level: 1, fragments: 0, country: '🇳🇴', isYou: true, spent: 0, vipLevel: 0 },
];

const EVENTS_CALENDAR = [
  { id: 'ev1', name: 'Golden Hour', time: '08:00, 17:00, 22:00', frequency: 'Daily', rewards: '10x Fragments' },
  { id: 'ev2', name: 'Weekend Siege', time: 'Sat-Sun', frequency: 'Weekly', rewards: 'Legendary Chest' },
  { id: 'ev3', name: 'Flash Fragment Frenzy', time: 'Random', frequency: '3x per day', rewards: '50x Fragments' },
  { id: 'ev4', name: 'VIP Double Weekend', time: 'Every 2nd weekend', frequency: 'Monthly', rewards: '2x Everything for VIP', vipOnly: true },
];

const QUICK_CHAT_MESSAGES = [
  { id: 'hello', text: 'Hello! 👋', icon: '👋' },
  { id: 'thanks', text: 'Thanks! 💛', icon: '💛' },
  { id: 'follow', text: 'Follow me! ➡️', icon: '➡️' },
  { id: 'beacon', text: 'Light the beacon! 🌟', icon: '🌟' },
  { id: 'energy', text: 'Need energy! ⚡', icon: '⚡' },
  { id: 'gems', text: 'Buy gems! 💎', icon: '💎' },
];

const GACHA_RATES = { common: 0.7, rare: 0.2, epic: 0.08, legendary: 0.019, mythic: 0.001 };
const INITIAL_OWNED_ITEMS = { colors: ['c1', 'c2'], trails: ['t1'], auras: [], emotes: ['e1', 'e2', 'e3', 'e4'] };

const countOwned = (items) => Object.values(items).reduce((sum, arr) => sum + arr.length, 0);
const cloneProducts = (p) => ({ colors: p.colors.map((x) => ({ ...x })), trails: p.trails.map((x) => ({ ...x })), auras: p.auras.map((x) => ({ ...x })), emotes: p.emotes.map((x) => ({ ...x })) });
const getRandomName = () => `${['Wandering', 'Glowing', 'Silent', 'Seeking', 'Shimmering', 'Eternal', 'Radiant', 'Dancing'][Math.floor(Math.random() * 8)]} ${['Sun', 'Flame', 'Spark', 'Light', 'Star', 'Ember', 'Phoenix', 'Soul'][Math.floor(Math.random() * 8)]}`;
const vibrate = (pattern) => { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern); };

const formatTime = (seconds) => {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${h > 0 ? `${h}:` : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatTimeUntil = (seconds) => {
  const safe = Math.max(0, Math.floor(seconds || 0));
  if (safe < 60) return `${safe}s`;
  if (safe < 3600) return `${Math.floor(safe / 60)}m`;
  if (safe < 86400) return `${Math.floor(safe / 3600)}h`;
  return `${Math.floor(safe / 86400)}d`;
};

const playSound = (type = 'click') => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.32);
      osc.start(); osc.stop(now + 0.34);
    } else if (type === 'rare') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(980, now + 0.55);
      gain.gain.setValueAtTime(0.13, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.65);
      osc.start(); osc.stop(now + 0.68);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(90, now + 0.18);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.22);
      osc.start(); osc.stop(now + 0.24);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(760, now);
      gain.gain.setValueAtTime(0.055, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.start(); osc.stop(now + 0.1);
    }
  } catch {
    // Audio can be blocked in sandboxed previews.
  }
};

function useLatest(value) {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; }, [value]);
  return ref;
}

function GlobalStyles() {
  return <style>{`
    @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
    @keyframes bounce-in { 0% { transform: scale(.5); opacity: 0; } 60% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
    @keyframes confetti { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(850px) rotate(720deg); opacity: 0; } }
    @keyframes spin-fast { 0% { transform: translateY(0); } 100% { transform: translateY(-2100px); } }
    @keyframes pulse-soft { 0%,100% { opacity:.65; transform:scale(1); } 50% { opacity:1; transform:scale(1.04); } }
    @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
    .animate-float { animation: float 3s ease-in-out infinite; }
    .animate-bounce-in { animation: bounce-in .55s cubic-bezier(.175,.885,.32,1.275); }
    .animate-confetti { animation: confetti 4s ease-out forwards; }
    .animate-spin-fast { animation: spin-fast 1.05s linear infinite; }
    .animate-pulse-soft { animation: pulse-soft 2s ease-in-out infinite; }
    .animate-shimmer { animation: shimmer 2s linear infinite; }
  `}</style>;
}

const rarityClass = (rarity) => rarity === 'mythic' ? 'text-red-400' : rarity === 'legendary' ? 'text-yellow-400' : rarity === 'epic' ? 'text-fuchsia-400' : rarity === 'rare' ? 'text-purple-400' : 'text-gray-400';
const EmojiIcon = ({ children, className = '' }) => <span className={`inline-flex items-center justify-center leading-none ${className}`}>{children}</span>;

export default function EmberUltimateCompleteMerged() {
  const canvasRef = useRef(null);
  const [isStarted, setIsStarted] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [user] = useState(() => ({ uid: 'local-hero', name: getRandomName() }));
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [fragments, setFragments] = useState(120);
  const [gems, setGems] = useState(650);
  const [energy, setEnergy] = useState(MAX_ENERGY);
  const [streak] = useState(5);
  const [combo, setCombo] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [vipLevel, setVipLevel] = useState(0);
  const [vipExpiry, setVipExpiry] = useState(null);
  const [hasBattlePass, setHasBattlePass] = useState(false);
  const [battlePassTier, setBattlePassTier] = useState(0);
  const [battlePassXP, setBattlePassXP] = useState(0);
  const [battlePassSeasonEnd] = useState(() => Date.now() + 30 * 24 * 3600 * 1000);
  const [inventorySlots, setInventorySlots] = useState(MAX_INVENTORY_FREE);
  const [inventoryUsed, setInventoryUsed] = useState(() => countOwned(INITIAL_OWNED_ITEMS));
  const [energyRefillsUsed, setEnergyRefillsUsed] = useState(0);
  const [ownedItems, setOwnedItems] = useState(INITIAL_OWNED_ITEMS);
  const [equippedItems, setEquippedItems] = useState({ color: 'c1', trail: 't1', aura: null });
  const [productStock, setProductStock] = useState(() => cloneProducts(SHOP_PRODUCTS));
  const [seasonalStock, setSeasonalStock] = useState(() => SEASONAL_EVENT.exclusiveItems.map((x) => ({ ...x })));
  const [dailyDeal, setDailyDeal] = useState(() => DAILY_DEALS[Math.floor(Math.random() * DAILY_DEALS.length)]);
  const [dailyDealTimer, setDailyDealTimer] = useState(86400);
  const [seasonalTimeRemaining, setSeasonalTimeRemaining] = useState(0);
  const [activeEvent, setActiveEvent] = useState(null);
  const [nextEvent, setNextEvent] = useState(null);
  const [eventTimeRemaining, setEventTimeRemaining] = useState(0);
  const [starterPackExpiry, setStarterPackExpiry] = useState({});
  const [flashSaleTime, setFlashSaleTime] = useState(900);
  const [offerTimeLeft, setOfferTimeLeft] = useState(3600);
  const [loginDayStreak, setLoginDayStreak] = useState(1);
  const [lastLoginDate, setLastLoginDate] = useState(null);
  const [gachaPulls, setGachaPulls] = useState(0);
  const [pitySinceLegendary, setPitySinceLegendary] = useState(0);
  const [pitySinceMythic, setPitySinceMythic] = useState(0);
  const [dailyQuests, setDailyQuests] = useState(DAILY_QUESTS_INITIAL);
  const [achievements, setAchievements] = useState(ACHIEVEMENTS_INITIAL);
  const [friends] = useState(MOCK_FRIENDS);
  const [activityFeed, setActivityFeed] = useState(ACTIVITY_FEED_INITIAL);
  const [constellation, setConstellation] = useState(null);
  const [constellationMembers, setConstellationMembers] = useState([]);
  const [chatMode, setChatMode] = useState('whisper');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([{ id: 'm1', user: 'Emma Starlight', text: 'Where are you? Want to light a beacon together?', time: '2m', avatar: '🌟' }]);
  const [notifications, setNotifications] = useState([
    { id: 'n1', text: 'Emma Starlight sent you a gift!', time: '5m ago', type: 'friend' },
    { id: 'n2', text: 'Daily quests refreshed!', time: '2h ago', type: 'quest' },
    { id: 'n3', text: '⚡ FLASH SALE: 90% OFF!', time: 'Now', type: 'urgent' },
  ]);

  const [showNotifications, setShowNotifications] = useState(false);
  const [showDailyLogin, setShowDailyLogin] = useState(false);
  const [showOfflineRewards, setShowOfflineRewards] = useState(false);
  const [showLimitedOffer, setShowLimitedOffer] = useState(false);
  const [showFirstPurchaseOffer, setShowFirstPurchaseOffer] = useState(false);
  const [showFlashSale, setShowFlashSale] = useState(false);
  const [showSocialPressure, setShowSocialPressure] = useState(false);
  const [showSocialComparison, setShowSocialComparison] = useState(false);
  const [showVIPUpsell, setShowVIPUpsell] = useState(false);
  const [showBattlePassUpsell, setShowBattlePassUpsell] = useState(false);
  const [showOutOfEnergy, setShowOutOfEnergy] = useState(false);
  const [showEnergyModal, setShowEnergyModal] = useState(false);
  const [showInventoryFull, setShowInventoryFull] = useState(false);
  const [showMysteryBox, setShowMysteryBox] = useState(false);
  const [boxOpening, setBoxOpening] = useState(false);
  const [boxReward, setBoxReward] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [showQuickChat, setShowQuickChat] = useState(false);
  const [showEmoteWheel, setShowEmoteWheel] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showAchievement, setShowAchievement] = useState(null);
  const [showSurpriseBonus, setShowSurpriseBonus] = useState(false);
  const [surpriseBonus, setSurpriseBonus] = useState(null);
  const [showPostPurchase, setShowPostPurchase] = useState(false);
  const [purchaseData, setPurchaseData] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [showSunkCostReminder, setShowSunkCostReminder] = useState(false);
  const [showStreakWarning, setShowStreakWarning] = useState(false);
  const [showWhaleStatus, setShowWhaleStatus] = useState(false);
  const [showCongratulatory, setShowCongratulatory] = useState(false);
  const [showProgressWall, setShowProgressWall] = useState(false);

  const energyRef = useLatest(energy);
  const vipLevelRef = useLatest(vipLevel);
  const equippedRef = useLatest(equippedItems);
  const activeEventRef = useLatest(activeEvent);
  const achievementsRef = useLatest(achievements);
  const xpRef = useLatest(xp);
  const levelRef = useLatest(level);
  const hasBattlePassRef = useLatest(hasBattlePass);
  const battlePassTierRef = useLatest(battlePassTier);
  const outOfEnergyShownAtRef = useRef(0);
  const lastActiveEventIdRef = useRef(null);

  const allColorItems = useMemo(() => [...SHOP_PRODUCTS.colors, ...SEASONAL_EVENT.exclusiveItems], []);
  const gameState = useRef({
    x: WORLD_SIZE / 2,
    y: WORLD_SIZE / 2,
    vx: 0,
    vy: 0,
    particles: [],
    localFragments: [],
    aiAgents: [],
    isInteracting: false,
    targetX: null,
    targetY: null,
    beaconStates: BEACONS.reduce((acc, b) => ({ ...acc, [b.id]: { active: false, charge: 0 } }), {}),
  });

  const confettiBurst = useCallback(() => {
    setShowConfetti(true);
    window.setTimeout(() => setShowConfetti(false), 3000);
  }, []);

  const addNotification = useCallback((text, type = 'info') => {
    setNotifications((prev) => [{ id: `n_${Date.now()}_${Math.random().toString(16).slice(2)}`, text, type, time: 'Now' }, ...prev.slice(0, 30)]);
    vibrate([50]);
  }, []);

  const unlockAchievement = useCallback((achievement) => {
    setAchievements((prev) => {
      const current = prev.find((a) => a.id === achievement.id);
      if (!current || current.progress >= current.goal) return prev;
      return prev.map((a) => (a.id === achievement.id ? { ...a, progress: a.goal } : a));
    });
    setShowAchievement(achievement);
    setGems((g) => g + achievement.gemReward);
    confettiBurst();
    playSound('success');
  }, [confettiBurst]);

  const checkSpendingAchievements = useCallback((spent) => {
    const spender = achievementsRef.current.find((a) => a.id === 'spender');
    const whale = achievementsRef.current.find((a) => a.id === 'whale');
    if (spender && spent >= 100 && spender.progress < spender.goal) window.setTimeout(() => unlockAchievement(spender), 0);
    if (whale && spent >= 1000 && whale.progress < whale.goal) {
      window.setTimeout(() => unlockAchievement(whale), 0);
      setShowWhaleStatus(true);
    }
  }, [achievementsRef, unlockAchievement]);

  const registerPurchase = useCallback((item, price, silent = false) => {
    const nextSpent = price > 0 ? totalSpent + price : totalSpent;
    if (price > 0) {
      setTotalSpent(nextSpent);
      checkSpendingAchievements(nextSpent);
    }
    setActivityFeed((prev) => [{ id: `a_${Date.now()}`, user: user.name, action: `bought ${item}!`, time: 'Now', icon: '💰', highlight: true }, ...prev.slice(0, 19)]);
    addNotification(`🎉 Bought ${item}!`, 'success');
    if (!silent) {
      setPurchaseData({ item, price });
      setShowPostPurchase(true);
    }
    confettiBurst();
    playSound('success');
  }, [addNotification, checkSpendingAchievements, confettiBurst, totalSpent, user.name]);

  const addXP = useCallback((amount) => {
    const bonus = vipLevelRef.current > 0 ? 1 + vipLevelRef.current * 0.25 : 1;
    const actual = Math.floor(amount * bonus);
    const nextXP = xpRef.current + actual;
    const req = levelRef.current * 1000;
    if (nextXP >= req) {
      const nextLevel = levelRef.current + 1;
      setLevel(nextLevel);
      setXp(nextXP - req);
      setShowLevelUp(true);
      playSound('success');
      if ([10, 25, 50].includes(nextLevel)) window.setTimeout(() => setShowProgressWall(true), 900);
    } else {
      setXp(nextXP);
    }
    if (hasBattlePassRef.current) {
      setBattlePassXP((prev) => {
        const bp = prev + actual;
        const tier = Math.min(100, Math.floor(bp / 500));
        if (tier > battlePassTierRef.current) {
          setBattlePassTier(tier);
          addNotification(`🏆 Battle Pass Tier ${tier} reached!`, 'success');
        }
        return bp;
      });
    }
  }, [addNotification, battlePassTierRef, hasBattlePassRef, levelRef, vipLevelRef, xpRef]);

  const handleInput = useCallback((type, clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const s = gameState.current;
    if (type === 'start') {
      s.isInteracting = true;
      s.targetX = x;
      s.targetY = y;
    } else if (type === 'move' && s.isInteracting) {
      s.targetX = x;
      s.targetY = y;
    } else if (type === 'end') {
      s.isInteracting = false;
      s.targetX = null;
      s.targetY = null;
    }
  }, []);

  const buyVIP = useCallback((tier) => {
    const vip = VIP_TIERS[tier];
    if (!vip) return;
    setVipLevel(tier);
    setVipExpiry(Date.now() + 30 * 24 * 3600 * 1000);
    if (tier >= 2) setInventorySlots(MAX_INVENTORY_PREMIUM);
    registerPurchase(`${vip.name}`, vip.price);
    setShowVIPUpsell(false);
  }, [registerPurchase]);

  const buyBattlePass = useCallback(() => {
    setHasBattlePass(true);
    registerPurchase('Battle Pass', 99);
    setShowBattlePassUpsell(false);
  }, [registerPurchase]);

  const buyGemPack = useCallback((pack) => {
    const first = totalSpent === 0 ? 500 : 0;
    setGems((g) => g + pack.gems + pack.bonus + first);
    registerPurchase(`${pack.gems + pack.bonus} Gems${first ? ' + First Purchase Bonus' : ''}`, pack.price);
  }, [registerPurchase, totalSpent]);

  const decrementStock = useCallback((item) => {
    if (typeof item.stock !== 'number') return;
    const update = (arr) => arr.map((x) => (x.id === item.id ? { ...x, stock: Math.max(0, x.stock - 1) } : x));
    if (item.id.startsWith('winter')) setSeasonalStock((prev) => update(prev));
    else if (item.id.startsWith('c')) setProductStock((prev) => ({ ...prev, colors: update(prev.colors) }));
    else if (item.id.startsWith('t')) setProductStock((prev) => ({ ...prev, trails: update(prev.trails) }));
    else if (item.id.startsWith('a')) setProductStock((prev) => ({ ...prev, auras: update(prev.auras) }));
  }, []);

  const itemType = (item) => item.id.startsWith('t') || item.id.includes('trail') ? 'trails' : item.id.startsWith('a') ? 'auras' : item.id.startsWith('e') ? 'emotes' : 'colors';

  const buyItem = useCallback((item) => {
    if (!item) return;
    if (typeof item.stock === 'number' && item.stock <= 0) return alert('Sold out!');
    if (item.vipRequired && vipLevel < item.vipRequired) return setShowVIPUpsell(true);
    if (inventoryUsed >= inventorySlots) return setShowInventoryFull(true);
    if (item.gems > 0) {
      if (gems < item.gems) return setActivePanel('shop');
      setGems((g) => g - item.gems);
      registerPurchase(item.name, 0);
    } else {
      registerPurchase(item.name, item.price || 0);
    }
    const type = itemType(item);
    setOwnedItems((prev) => {
      if (prev[type].includes(item.id)) return prev;
      setInventoryUsed((n) => n + 1);
      return { ...prev, [type]: [...prev[type], item.id] };
    });
    decrementStock(item);
  }, [decrementStock, gems, inventorySlots, inventoryUsed, registerPurchase, vipLevel]);

  const buyDailyDeal = useCallback((deal) => {
    if (deal.id === 'dd2') {
      energyRef.current = MAX_ENERGY;
      setEnergy(MAX_ENERGY);
    } else if (deal.id === 'dd3') {
      setGems((g) => g + 150);
      setShowMysteryBox(true);
    } else if (deal.id === 'dd4') {
      const item = SHOP_PRODUCTS.colors.find((c) => c.id === 'c7');
      if (item) buyItem(item);
    } else {
      setFragments((f) => f + 500);
    }
    registerPurchase(deal.name, deal.price);
  }, [buyItem, energyRef, registerPurchase]);

  const buyStarterPack = useCallback((pack) => {
    setGems((g) => g + (pack.id === 'starter1' ? 500 : 2000));
    setFragments((f) => f + (pack.id === 'starter1' ? 1000 : 5000));
    if (pack.id === 'starter2' && vipLevel < 1) setVipLevel(1);
    setStarterPackExpiry((prev) => ({ ...prev, [pack.id]: 0 }));
    registerPurchase(pack.name, pack.price);
  }, [registerPurchase, vipLevel]);

  const performGachaPull = useCallback(() => {
    const nextLeg = pitySinceLegendary + 1;
    const nextMyth = pitySinceMythic + 1;
    setGachaPulls((n) => n + 1);
    setPitySinceLegendary(nextLeg);
    setPitySinceMythic(nextMyth);
    const all = [...SHOP_PRODUCTS.colors, ...SHOP_PRODUCTS.trails, ...SHOP_PRODUCTS.auras, ...SEASONAL_EVENT.exclusiveItems];
    let rarity = 'common';
    if (nextMyth >= PITY_MYTHIC) {
      rarity = 'mythic';
      setPitySinceMythic(0);
      setPitySinceLegendary(0);
    } else if (nextLeg >= PITY_LEGENDARY) {
      rarity = 'legendary';
      setPitySinceLegendary(0);
    } else {
      const roll = Math.random();
      if (roll < GACHA_RATES.mythic) rarity = 'mythic';
      else if (roll < GACHA_RATES.mythic + GACHA_RATES.legendary) rarity = 'legendary';
      else if (roll < GACHA_RATES.mythic + GACHA_RATES.legendary + GACHA_RATES.epic) rarity = 'epic';
      else if (roll < GACHA_RATES.mythic + GACHA_RATES.legendary + GACHA_RATES.epic + GACHA_RATES.rare) rarity = 'rare';
    }
    let pool = all.filter((x) => x.rarity === rarity && (!x.vipRequired || vipLevel >= x.vipRequired));
    if (pool.length === 0 && rarity === 'epic') pool = all.filter((x) => x.rarity === 'rare');
    if (pool.length === 0) pool = all.filter((x) => x.rarity === 'common');
    return pool[Math.floor(Math.random() * pool.length)] || SHOP_PRODUCTS.colors[0];
  }, [pitySinceLegendary, pitySinceMythic, vipLevel]);

  const openMysteryBox = useCallback(() => {
    if (gems < 500) return setActivePanel('shop');
    if (inventoryUsed >= inventorySlots) return setShowInventoryFull(true);
    setGems((g) => g - 500);
    setBoxOpening(true);
    setBoxReward(null);
    playSound('click');
    const pull = performGachaPull();
    window.setTimeout(() => {
      setBoxReward(pull);
      setBoxOpening(false);
      const type = itemType(pull);
      setOwnedItems((prev) => {
        if (prev[type].includes(pull.id)) {
          setFragments((f) => f + 250);
          return prev;
        }
        setInventoryUsed((n) => n + 1);
        return { ...prev, [type]: [...prev[type], pull.id] };
      });
      if (['legendary', 'mythic'].includes(pull.rarity)) {
        confettiBurst();
        playSound('rare');
      } else playSound('success');
    }, 1800);
  }, [confettiBurst, gems, inventorySlots, inventoryUsed, performGachaPull]);

  const refillEnergy = useCallback((method = 'paid') => {
    if (method === 'paid') {
      if (gems < 100) return setActivePanel('shop');
      setGems((g) => g - 100);
      setEnergy(MAX_ENERGY);
      energyRef.current = MAX_ENERGY;
      setEnergyRefillsUsed((n) => n + 1);
      if (energyRefillsUsed > 3) window.setTimeout(() => setShowCongratulatory(true), 400);
    } else {
      const next = Math.min(MAX_ENERGY, energyRef.current + 20);
      energyRef.current = next;
      setEnergy(next);
    }
    setShowOutOfEnergy(false);
    setShowEnergyModal(false);
    playSound('success');
  }, [energyRef, energyRefillsUsed, gems]);

  const sendChatMessage = useCallback((e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [{ id: `m_${Date.now()}`, user: user.name, text: chatInput.trim(), time: 'Now', avatar: '⭐', isYou: true }, ...prev]);
    setChatInput('');
    playSound('click');
  }, [chatInput, user.name]);

  const sendQuickChat = useCallback((message) => {
    setChatMessages((prev) => [{ id: `m_${Date.now()}`, user: user.name, text: message.text, time: 'Now', avatar: '⭐', isYou: true }, ...prev]);
    setShowQuickChat(false);
    playSound('click');
  }, [user.name]);

  const createConstellation = useCallback(() => {
    const name = window.prompt('Name your constellation:', 'Northern Light');
    if (!name) return;
    setConstellation({ id: 'const_1', name, members: [user.name, ...MOCK_FRIENDS.slice(0, 2).map((f) => f.name)], weeklyGoal: { current: 23, target: 100 }, rank: 234 });
    setConstellationMembers([{ name: user.name, contribution: 23, isYou: true }, { name: 'Emma Starlight', contribution: 47 }, { name: 'Alex Dreamer', contribution: 31 }]);
    playSound('success');
  }, [user.name]);

  const claimDailyLogin = useCallback(() => {
    const day = Math.max(1, Math.min(loginDayStreak, 7));
    const reward = DAILY_LOGIN_REWARDS[day - 1] || DAILY_LOGIN_REWARDS[0];
    setFragments((f) => f + reward.fragments);
    setGems((g) => g + reward.gems);
    setShowDailyLogin(false);
    playSound('success');
  }, [loginDayStreak]);

  const handleQuit = useCallback(() => {
    if (totalSpent > 0 || level > 5 || fragments > 1000) setShowSunkCostReminder(true);
    else setShowExitWarning(true);
  }, [fragments, level, totalSpent]);

  useEffect(() => {
    if (!isStarted) return;
    const interval = window.setInterval(() => {
      if (vipLevelRef.current >= 5) return;
      const mult = vipLevelRef.current === 0 ? 1 : vipLevelRef.current === 1 ? 2 : vipLevelRef.current === 2 ? 3 : vipLevelRef.current === 3 ? 5 : 10;
      const next = Math.min(MAX_ENERGY, energyRef.current + ENERGY_REGEN_RATE * mult);
      energyRef.current = next;
      setEnergy(next);
    }, 6000);
    return () => window.clearInterval(interval);
  }, [energyRef, isStarted, vipLevelRef]);

  useEffect(() => {
    if (!isStarted) return;
    const timeouts = [
      window.setTimeout(() => setShowDailyLogin(true), 700),
      window.setTimeout(() => setShowOfflineRewards(true), 1500),
      window.setTimeout(() => setShowFirstPurchaseOffer(true), 5000),
      window.setTimeout(() => setShowLimitedOffer(true), 9000),
      window.setTimeout(() => setShowSocialPressure(true), 12000),
      window.setTimeout(() => setShowVIPUpsell(true), 16000),
      window.setTimeout(() => setShowFlashSale(true), 22000),
      window.setTimeout(() => setShowSocialComparison(true), 30000),
      window.setTimeout(() => setShowBattlePassUpsell(true), 45000),
      window.setTimeout(() => setShowStreakWarning(true), 70000),
    ];
    const social = window.setInterval(() => { if (Math.random() < 0.25) setShowSocialPressure(true); }, 120000);
    return () => { timeouts.forEach(window.clearTimeout); window.clearInterval(social); };
  }, [isStarted]);

  useEffect(() => {
    if (!showLimitedOffer) return undefined;
    const id = window.setInterval(() => setOfferTimeLeft((t) => {
      if (t <= 1) { setShowLimitedOffer(false); return 0; }
      return t - 1;
    }), 1000);
    return () => window.clearInterval(id);
  }, [showLimitedOffer]);

  useEffect(() => {
    if (!showFlashSale) return undefined;
    const id = window.setInterval(() => setFlashSaleTime((t) => {
      if (t <= 1) { setShowFlashSale(false); return 0; }
      if (t === 60) addNotification('⚠️ LAST MINUTE! Flash sale is expiring!', 'urgent');
      return t - 1;
    }), 1000);
    return () => window.clearInterval(id);
  }, [addNotification, showFlashSale]);

  useEffect(() => {
    const id = window.setInterval(() => setDailyDealTimer((t) => {
      if (t <= 1) {
        setDailyDeal(DAILY_DEALS[Math.floor(Math.random() * DAILY_DEALS.length)]);
        return 86400;
      }
      return t - 1;
    }), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setSeasonalTimeRemaining((SEASONAL_EVENT.endDate - Date.now()) / 1000), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const current = now.getHours() * 60 + now.getMinutes();
      let active = null;
      let next = null;
      let minDiff = Infinity;
      SCHEDULED_EVENTS.forEach((ev) => {
        const [h, m] = ev.time.split(':').map(Number);
        const start = h * 60 + m;
        const end = start + ev.duration;
        if (current >= start && current < end) {
          active = ev;
          setEventTimeRemaining((end - current) * 60);
        } else {
          let diff = start - current;
          if (diff < 0) diff += 1440;
          if (diff < minDiff) { minDiff = diff; next = ev; }
        }
      });
      if (active && lastActiveEventIdRef.current !== active.id) {
        lastActiveEventIdRef.current = active.id;
        addNotification(`⚡ EVENT STARTED: ${active.name}!`, 'urgent');
        confettiBurst();
        playSound('success');
      }
      if (!active) lastActiveEventIdRef.current = null;
      setActiveEvent(active);
      setNextEvent(next);
    };
    check();
    const id = window.setInterval(check, 1000);
    return () => window.clearInterval(id);
  }, [addNotification, confettiBurst]);

  useEffect(() => {
    if (!isStarted) return;
    const expiry = Object.fromEntries(STARTER_PACKS.map((p) => [p.id, p.expiresIn]));
    setStarterPackExpiry(expiry);
    const id = window.setInterval(() => setStarterPackExpiry((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((key) => {
        if (updated[key] > 0) {
          updated[key] -= 1;
          if (updated[key] === 300) addNotification(`⚠️ ${STARTER_PACKS.find((p) => p.id === key)?.name} expires in 5 minutes!`, 'urgent');
        }
      });
      return updated;
    }), 1000);
    return () => window.clearInterval(id);
  }, [addNotification, isStarted]);

  useEffect(() => {
    if (!isStarted) return;
    const today = new Date().toDateString();
    if (lastLoginDate !== today) {
      setLastLoginDate(today);
      setLoginDayStreak((d) => Math.max(1, Math.min(7, d || 1)));
      setShowDailyLogin(true);
    }
  }, [isStarted, lastLoginDate]);

  useEffect(() => {
    if (!isStarted) return;
    const names = ['Emma', 'Sarah', 'Alex', 'Mike', 'Lisa', 'Tom', 'Anna', 'Kevin'];
    const actions = ['bought Platinum VIP!', 'bought Mega Gem Pack!', 'bought Battle Pass!', 'completed VIP Tier 5!', 'bought Legendary Mystery Box x10!'];
    const id = window.setInterval(() => {
      if (Math.random() < 0.3) {
        const name = names[Math.floor(Math.random() * names.length)];
        const action = actions[Math.floor(Math.random() * actions.length)];
        setActivityFeed((prev) => [{ id: `a_${Date.now()}`, user: name, action, time: 'Now', icon: '💰', highlight: true }, ...prev.slice(0, 19)]);
        addNotification(`💰 ${name} ${action}`, 'social');
      }
    }, 15000);
    return () => window.clearInterval(id);
  }, [addNotification, isStarted]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setProductStock((prev) => ({
        ...prev,
        colors: prev.colors.map((c) => (typeof c.stock === 'number' && c.stock > 0 && Math.random() < 0.18 ? { ...c, stock: c.stock - 1 } : c)),
        trails: prev.trails.map((c) => (typeof c.stock === 'number' && c.stock > 0 && Math.random() < 0.08 ? { ...c, stock: c.stock - 1 } : c)),
        auras: prev.auras.map((c) => (typeof c.stock === 'number' && c.stock > 0 && Math.random() < 0.05 ? { ...c, stock: c.stock - 1 } : c)),
      }));
      setSeasonalStock((prev) => prev.map((c) => (typeof c.stock === 'number' && c.stock > 0 && Math.random() < 0.06 ? { ...c, stock: c.stock - 1 } : c)));
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isStarted) return;
    const s = gameState.current;
    s.localFragments = Array.from({ length: 100 }, () => ({ x: s.x + (Math.random() - 0.5) * 1000, y: s.y + (Math.random() - 0.5) * 1000, phase: Math.random() * Math.PI * 2, cooldown: 0 }));
    s.aiAgents = Array.from({ length: 15 }, (_, i) => ({ id: `ai_${i}`, x: s.x + (Math.random() - 0.5) * 900, y: s.y + (Math.random() - 0.5) * 900, name: getRandomName(), color: ['#60A5FA', '#F472B6', '#34D399', '#A78BFA'][i % 4], phase: Math.random() * Math.PI * 2 }));
  }, [isStarted]);

  useEffect(() => {
    if (!isStarted || !canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    let id = 0;
    let last = performance.now();

    const collectFragmentCanvas = (s, f, now) => {
      if (now < (f.cooldown || 0)) return false;
      if (vipLevelRef.current < 5 && energyRef.current < ENERGY_PER_FRAGMENT) {
        f.cooldown = now + 850;
        if (now - outOfEnergyShownAtRef.current > 1300) {
          outOfEnergyShownAtRef.current = now;
          setShowOutOfEnergy(true);
          playSound('error');
        }
        return false;
      }
      if (vipLevelRef.current < 5) {
        const next = Math.max(0, energyRef.current - ENERGY_PER_FRAGMENT);
        energyRef.current = next;
        setEnergy(next);
        setDailyQuests((prev) => prev.map((q) => (q.id === 'q5' ? { ...q, progress: Math.min(q.goal, q.progress + ENERGY_PER_FRAGMENT) } : q)));
      }
      const vipBonus = vipLevelRef.current > 0 ? 1 + vipLevelRef.current * 0.1 : 1;
      const eventMult = activeEventRef.current?.multiplier || 1;
      const jackpot = Math.random() < 0.02;
      const amount = Math.max(1, Math.floor((jackpot ? 100 : 1) * vipBonus * eventMult));
      setFragments((prev) => prev + amount);
      setCombo((c) => c + 1);
      window.setTimeout(() => setCombo((c) => Math.max(0, c - 1)), 3000);
      addXP(jackpot ? 100 : 10);
      setDailyQuests((prev) => prev.map((q) => (q.id === 'q1' ? { ...q, progress: Math.min(q.goal, q.progress + amount) } : q)));
      const collector = achievementsRef.current.find((a) => a.id === 'collector');
      if (collector && collector.progress < collector.goal && fragments + amount >= collector.goal) unlockAchievement(collector);
      for (let i = 0; i < 7; i += 1) s.particles.push({ x: s.x, y: s.y, vx: (Math.random() - 0.5) * 9, vy: (Math.random() - 0.5) * 9, life: 1, color: jackpot ? '#facc15' : '#fbbf24' });
      if (jackpot) {
        setSurpriseBonus({ amount, message: 'JACKPOT!', icon: '🎰' });
        setShowSurpriseBonus(true);
        confettiBurst();
        playSound('rare');
      } else playSound('click');
      return true;
    };

    const loop = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const s = gameState.current;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = w / 2;
      const cy = h / 2;
      if (s.isInteracting && s.targetX !== null && s.targetY !== null) {
        const dx = s.targetX - cx;
        const dy = s.targetY - cy;
        const angle = Math.atan2(dy, dx);
        const dist = Math.min(Math.hypot(dx, dy), 140);
        s.vx += Math.cos(angle) * dist * 0.045 * dt * 60;
        s.vy += Math.sin(angle) * dist * 0.045 * dt * 60;
      }
      s.vx *= Math.pow(0.9, dt * 60);
      s.vy *= Math.pow(0.9, dt * 60);
      s.x = Math.max(100, Math.min(WORLD_SIZE - 100, s.x + s.vx));
      s.y = Math.max(100, Math.min(WORLD_SIZE - 100, s.y + s.vy));
      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.8);
      bg.addColorStop(0, '#101827');
      bg.addColorStop(0.55, '#05030a');
      bg.addColorStop(1, '#000');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const ox = cx - s.x;
      const oy = cy - s.y;
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = '#8b5cf6';
      const grid = 160;
      const startX = ((ox % grid) + grid) % grid;
      const startY = ((oy % grid) + grid) % grid;
      for (let x = startX; x < w; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = startY; y < h; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.restore();

      BEACONS.forEach((b) => {
        const bx = b.x + ox;
        const by = b.y + oy;
        if (bx < -200 || bx > w + 200 || by < -200 || by > h + 200) return;
        const active = s.beaconStates[b.id]?.active;
        ctx.save();
        ctx.shadowBlur = active ? 42 : 22;
        ctx.shadowColor = active ? '#fef3c7' : '#a78bfa';
        ctx.fillStyle = active ? '#fbbf24' : b.id === 'b1' ? '#FDB813' : '#a78bfa';
        ctx.beginPath(); ctx.arc(bx, by, active ? 20 : 15, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.24)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(bx, by, 42 + Math.sin(now / 600) * 3, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0; ctx.font = '22px system-ui'; ctx.textAlign = 'center'; ctx.fillText(b.icon, bx, by + 8);
        ctx.font = '12px system-ui'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText(b.name, bx, by + 62);
        ctx.restore();
        if (Math.hypot(s.x - b.x, s.y - b.y) < 72 && !active && (vipLevelRef.current >= 5 || energyRef.current >= ENERGY_PER_BEACON)) {
          s.beaconStates[b.id].active = true;
          if (vipLevelRef.current < 5) {
            const next = Math.max(0, energyRef.current - ENERGY_PER_BEACON);
            energyRef.current = next;
            setEnergy(next);
          }
          setDailyQuests((prev) => prev.map((q) => (q.id === 'q2' ? { ...q, progress: Math.min(q.goal, q.progress + 1) } : q)));
          const first = achievementsRef.current.find((a) => a.id === 'first_light');
          if (first && first.progress < first.goal) unlockAchievement(first);
          const activeCount = Object.values(s.beaconStates).filter((x) => x.active).length;
          const master = achievementsRef.current.find((a) => a.id === 'master');
          if (master && activeCount >= 5 && master.progress < master.goal) unlockAchievement(master);
          addNotification(`🌟 You lit ${b.name}!`, 'success');
          confettiBurst();
          playSound('success');
        }
      });

      s.localFragments = s.localFragments.filter((f) => {
        const fx = f.x + ox;
        const fy = f.y + oy;
        if (Math.hypot(s.x - f.x, s.y - f.y) < 58 && collectFragmentCanvas(s, f, now)) return false;
        if (fx > -80 && fx < w + 80 && fy > -80 && fy < h + 80) {
          f.phase += 0.035 + dt;
          const scale = 1 + Math.sin(f.phase) * 0.22;
          ctx.save(); ctx.fillStyle = '#fbbf24'; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.arc(fx, fy, 4.5 * scale, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
        return true;
      });
      if (Math.random() < FRAGMENT_SPAWN_RATE && s.localFragments.length < 150) {
        const a = Math.random() * Math.PI * 2;
        const r = 420 + Math.random() * 460;
        s.localFragments.push({ x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r, phase: Math.random() * Math.PI * 2, cooldown: 0 });
      }
      s.aiAgents.forEach((ai, i) => {
        ai.phase += dt * (0.8 + i * 0.04);
        ai.x += Math.cos(ai.phase) * 0.42 + (Math.random() - 0.5) * 0.18;
        ai.y += Math.sin(ai.phase * 0.8) * 0.42 + (Math.random() - 0.5) * 0.18;
        const ax = ai.x + ox;
        const ay = ai.y + oy;
        if (ax < -100 || ax > w + 100 || ay < -100 || ay > h + 100) return;
        ctx.save(); ctx.fillStyle = ai.color; ctx.shadowColor = ai.color; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(ax, ay, 12, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.58)'; ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(ai.name, ax, ay - 20); ctx.restore();
      });
      s.particles = s.particles.filter((p) => {
        p.x += p.vx * dt * 60; p.y += p.vy * dt * 60; p.life -= 0.045 * dt * 60;
        ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x + ox, p.y + oy, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        return p.life > 0;
      });
      const selected = allColorItems.find((c) => c.id === equippedRef.current.color);
      let color = selected?.canvasColor || selected?.color || '#FDB813';
      if (!color.startsWith('#') && !color.startsWith('rgb') && !color.startsWith('hsl')) color = '#FDB813';
      const radius = LIGHT_MIN_RADIUS + 70 + Math.sin(now / 420) * 4;
      const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, radius);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.2, color); grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.shadowColor = 'white'; ctx.shadowBlur = 20; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (s.isInteracting && s.targetX !== null && s.targetY !== null) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.24)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(s.targetX, s.targetY); ctx.stroke(); ctx.restore();
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(id); };
  }, [activeEventRef, addNotification, addXP, achievementsRef, allColorItems, confettiBurst, energyRef, equippedRef, fragments, isStarted, unlockAchievement, vipLevelRef]);

  const dailyReward = DAILY_LOGIN_REWARDS[Math.max(0, Math.min(6, loginDayStreak - 1))] || DAILY_LOGIN_REWARDS[0];
  const lowInventory = inventoryUsed / inventorySlots > 0.8;

  if (!isStarted) return <StartScreen onStart={() => setIsStarted(true)} />;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden font-sans select-none text-white">
      <GlobalStyles />
      <canvas ref={canvasRef} className="absolute inset-0 cursor-pointer touch-none" onMouseDown={(e) => handleInput('start', e.clientX, e.clientY)} onMouseMove={(e) => handleInput('move', e.clientX, e.clientY)} onMouseUp={() => handleInput('end')} onMouseLeave={() => handleInput('end')} onTouchStart={(e) => { e.preventDefault(); handleInput('start', e.touches[0].clientX, e.touches[0].clientY); }} onTouchMove={(e) => { e.preventDefault(); handleInput('move', e.touches[0].clientX, e.touches[0].clientY); }} onTouchEnd={() => handleInput('end')} />
      {showConfetti && <Confetti />}
      {activeEvent ? <ActiveEventBanner activeEvent={activeEvent} time={eventTimeRemaining} /> : <SeasonBanner event={SEASONAL_EVENT} remaining={seasonalTimeRemaining} onClick={() => setActivePanel('shop')} />}
      <TopHUD user={user} level={level} xp={xp} energy={energy} streak={streak} fragments={fragments} gems={gems} vipLevel={vipLevel} notifications={notifications} hasBattlePass={hasBattlePass} battlePassTier={battlePassTier} onEnergy={() => setShowEnergyModal(true)} onShop={() => setActivePanel('shop')} onQuit={handleQuit} onNotifications={() => setShowNotifications((v) => !v)} onMenu={() => setShowMenu(true)} />
      {showNotifications && <NotificationsPanel notifications={notifications} onClose={() => setShowNotifications(false)} />}
      <QuestMiniList quests={dailyQuests} />
      {dailyDeal && <DailyDealBanner deal={dailyDeal} timer={dailyDealTimer} onClick={() => setActivePanel('shop')} />}
      {lowInventory && <LowInventoryWarning used={inventoryUsed} slots={inventorySlots} vipLevel={vipLevel} onVIP={() => setShowVIPUpsell(true)} />}
      {combo > 1 && <ComboText combo={combo} />}
      {starterPackExpiry.starter1 > 0 && <StarterPackBanner pack={STARTER_PACKS[0]} timeLeft={starterPackExpiry.starter1} onBuy={() => buyStarterPack(STARTER_PACKS[0])} />}
      <BottomControls onQuick={() => setShowQuickChat(true)} onEmote={() => setShowEmoteWheel(true)} onChat={() => setShowChat((v) => !v)} />
      {showMenu && <MainMenu hasBattlePass={hasBattlePass} vipLevel={vipLevel} onClose={() => setShowMenu(false)} openPanel={(p) => { setActivePanel(p); setShowMenu(false); }} openMystery={() => { setShowMysteryBox(true); setShowMenu(false); }} openVIP={() => { setShowVIPUpsell(true); setShowMenu(false); }} openBattlePass={() => { setShowBattlePassUpsell(true); setShowMenu(false); }} />}

      {activePanel === 'shop' && <ShopPanel productStock={productStock} seasonalStock={seasonalStock} ownedItems={ownedItems} vipLevel={vipLevel} dailyDealTimer={dailyDealTimer} onClose={() => setActivePanel(null)} onBuyItem={buyItem} onBuyGemPack={buyGemPack} onBuyDailyDeal={buyDailyDeal} />}
      {activePanel === 'inventory' && <InventoryPanel ownedItems={ownedItems} equippedItems={equippedItems} inventoryUsed={inventoryUsed} inventorySlots={inventorySlots} vipLevel={vipLevel} allColorItems={allColorItems} onEquip={(id) => setEquippedItems((p) => ({ ...p, color: id }))} onVIP={() => setShowVIPUpsell(true)} onClose={() => setActivePanel(null)} />}
      {activePanel === 'friends' && <FriendsPanel friends={friends} onClose={() => setActivePanel(null)} />}
      {activePanel === 'leaderboard' && <LeaderboardPanel onClose={() => setActivePanel(null)} />}
      {activePanel === 'quests' && <QuestsPanel quests={dailyQuests} onClose={() => setActivePanel(null)} />}
      {activePanel === 'achievements' && <AchievementsPanel achievements={achievements} onClose={() => setActivePanel(null)} />}
      {activePanel === 'battlepass' && <BattlePassPanel hasBattlePass={hasBattlePass} battlePassTier={battlePassTier} onBuy={buyBattlePass} onClose={() => setActivePanel(null)} />}
      {activePanel === 'constellation' && <ConstellationPanel constellation={constellation} members={constellationMembers} onCreate={createConstellation} onClose={() => setActivePanel(null)} />}
      {activePanel === 'events' && <EventsPanel events={EVENTS_CALENDAR} nextEvent={nextEvent} onClose={() => setActivePanel(null)} />}
      {activePanel === 'stats' && <StatsPanel fragments={fragments} gems={gems} streak={streak} vipLevel={vipLevel} vipExpiry={vipExpiry} totalSpent={totalSpent} battlePassXP={battlePassXP} battlePassTier={battlePassTier} gachaPulls={gachaPulls} beaconStates={gameState.current.beaconStates} onClose={() => setActivePanel(null)} />}
      {activePanel === 'activity' && <ActivityPanel feed={activityFeed} onClose={() => setActivePanel(null)} />}
      {activePanel === 'boosters' && <BoostersPanel vipLevel={vipLevel} gems={gems} setGems={setGems} setEnergy={setEnergy} energyRef={energyRef} onClose={() => setActivePanel(null)} />}

      {showQuickChat && <QuickChatMenu messages={QUICK_CHAT_MESSAGES} onSend={sendQuickChat} onClose={() => setShowQuickChat(false)} />}
      {showEmoteWheel && <EmoteWheel emotes={ownedItems.emotes} onSelect={() => setShowEmoteWheel(false)} onClose={() => setShowEmoteWheel(false)} />}
      {showChat && <ChatPopup chatMode={chatMode} setChatMode={setChatMode} messages={chatMessages} input={chatInput} setInput={setChatInput} onSubmit={sendChatMessage} onClose={() => setShowChat(false)} />}

      {showDailyLogin && <DailyLoginModal day={Math.max(1, loginDayStreak)} reward={dailyReward} onClaim={claimDailyLogin} />}
      {showOfflineRewards && <OfflineRewardsModal fragments={240} gems={50} onClaim={() => { setFragments((f) => f + 240); setGems((g) => g + 50); setShowOfflineRewards(false); }} />}
      {showFirstPurchaseOffer && <FirstPurchaseOffer onBuy={() => { registerPurchase('Starter Pack', 4.99); setShowFirstPurchaseOffer(false); }} onClose={() => setShowFirstPurchaseOffer(false)} />}
      {showLimitedOffer && <LimitedOfferModal timeLeft={offerTimeLeft} onBuy={() => { setGems((g) => g + 2000); registerPurchase('Limited Offer Pack', 99); setShowLimitedOffer(false); }} onClose={() => setShowLimitedOffer(false)} />}
      {showFlashSale && <FlashSaleModal timeLeft={flashSaleTime} onBuy={() => { setGems((g) => g + 5000); setFragments((f) => f + 10000); registerPurchase('Flash Sale Bundle', 49.99); setShowFlashSale(false); }} onClose={() => setShowFlashSale(false)} />}
      {showSocialPressure && <SocialPressureModal friendsOnline={3} onClose={() => setShowSocialPressure(false)} />}
      {showSocialComparison && <SocialComparisonModal level={level} onBoost={() => { setShowSocialComparison(false); setActivePanel('shop'); }} onClose={() => setShowSocialComparison(false)} />}
      {showVIPUpsell && <VIPModal onBuy={buyVIP} onClose={() => setShowVIPUpsell(false)} />}
      {showBattlePassUpsell && !hasBattlePass && <BattlePassUpsell seasonEnd={battlePassSeasonEnd} onBuy={buyBattlePass} onClose={() => setShowBattlePassUpsell(false)} />}
      {showOutOfEnergy && <OutOfEnergyModal energy={energy} vipLevel={vipLevel} onRefill={refillEnergy} onVIP={() => { setShowOutOfEnergy(false); setShowVIPUpsell(true); }} onClose={() => setShowOutOfEnergy(false)} />}
      {showEnergyModal && <EnergyModal energy={energy} onRefill={refillEnergy} onClose={() => setShowEnergyModal(false)} />}
      {showInventoryFull && <InventoryFullModal used={inventoryUsed} slots={inventorySlots} vipLevel={vipLevel} onVIP={() => { setShowInventoryFull(false); setShowVIPUpsell(true); }} onClose={() => setShowInventoryFull(false)} />}
      {showMysteryBox && <MysteryBoxModal gems={gems} opening={boxOpening} reward={boxReward} pityL={pitySinceLegendary} pityM={pitySinceMythic} onOpen={openMysteryBox} onClose={() => { setShowMysteryBox(false); setBoxOpening(false); setBoxReward(null); }} />}
      {showLevelUp && <LevelUpModal level={level} onClose={() => setShowLevelUp(false)} />}
      {showAchievement && <AchievementModal achievement={showAchievement} onClose={() => setShowAchievement(null)} />}
      {showSurpriseBonus && surpriseBonus && <SurpriseBonusModal bonus={surpriseBonus} onClose={() => setShowSurpriseBonus(false)} />}
      {showPostPurchase && purchaseData && <PostPurchaseModal purchase={purchaseData} onClose={() => setShowPostPurchase(false)} />}
      {showExitWarning && <ExitWarningModal streak={streak} onClose={() => setShowExitWarning(false)} />}
      {showSunkCostReminder && <SunkCostReminder totalSpent={totalSpent} level={level} onClose={() => setShowSunkCostReminder(false)} />}
      {showStreakWarning && <StreakWarningModal streak={streak} hoursLeft={3} onClose={() => setShowStreakWarning(false)} />}
      {showWhaleStatus && totalSpent >= 1000 && <WhaleModal totalSpent={totalSpent} onClaim={() => { setShowWhaleStatus(false); setGems((g) => g + 10000); }} />}
      {showCongratulatory && <CongratulatoryModal onClose={() => setShowCongratulatory(false)} />}
      {showProgressWall && <ProgressWall level={level} gems={gems} setGems={setGems} addXP={addXP} onClose={() => setShowProgressWall(false)} />}
    </div>
  );
}

function StartScreen({ onStart }) {
  return <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-purple-950 via-black to-pink-950 text-white overflow-hidden"><GlobalStyles /><div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, #f59e0b55, transparent 24%), radial-gradient(circle at 70% 80%, #a855f755, transparent 28%)' }} /><div className="relative px-6 text-center space-y-8 animate-bounce-in"><div className="text-9xl animate-float">✨</div><h1 className="text-7xl font-black tracking-tighter">EMBER</h1><p className="text-xl text-white/60">Ultimate Complete Edition • canvas-safe</p><button onClick={onStart} className="rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 px-16 py-5 text-2xl font-black text-black shadow-2xl transition hover:scale-105">Start Journey</button></div></div>;
}

function Confetti() { return <div className="pointer-events-none fixed inset-0 z-[250]">{Array.from({ length: 60 }).map((_, i) => <div key={i} className="absolute h-2 w-2 animate-confetti" style={{ left: `${Math.random() * 100}%`, top: '-10px', animationDelay: `${Math.random()}s`, background: ['#f00', '#0f0', '#00f', '#ff0', '#ff7af3', '#60a5fa'][Math.floor(Math.random() * 6)] }} />)}</div>; }
function ActiveEventBanner({ activeEvent, time }) { return <div className="pointer-events-none fixed left-1/2 top-20 z-30 -translate-x-1/2"><div className="flex items-center gap-3 rounded-full border-2 border-white/30 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-8 py-2 shadow-lg"><span className="text-2xl animate-spin">{activeEvent.icon}</span><div className="text-sm font-black uppercase text-black">{activeEvent.name} ACTIVE!</div><div className="rounded bg-black/20 px-2 font-mono text-xs text-black">{formatTime(time)}</div></div></div>; }
function SeasonBanner({ event, remaining, onClick }) { return <button onClick={onClick} className="fixed left-1/2 top-20 z-20 -translate-x-1/2 pointer-events-auto"><div className="flex items-center gap-2 rounded-full border border-blue-400/50 bg-blue-950/80 px-6 py-2 backdrop-blur"><span>{event.theme.icon}</span><span className="text-xs font-bold uppercase">{event.name}</span><span className="font-mono text-xs text-red-300">{Math.max(0, Math.floor(remaining / 86400))}d left</span></div></button>; }
function TopHUD({ user, level, xp, energy, streak, fragments, gems, vipLevel, notifications, hasBattlePass, battlePassTier, onEnergy, onShop, onQuit, onNotifications, onMenu }) { return <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/85 to-transparent pointer-events-none z-10"><div className="flex items-center justify-between gap-3"><div className="space-y-1 pointer-events-auto min-w-0"><div className="flex items-center gap-3 flex-wrap"><div className="font-bold truncate max-w-[220px]">{user.name}</div><div className="text-xs text-amber-300 bg-amber-900/30 px-2 py-0.5 rounded-full">Lvl {level}</div>{vipLevel > 0 && <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: `${VIP_TIERS[vipLevel].color}22`, color: VIP_TIERS[vipLevel].color }}>👑 {VIP_TIERS[vipLevel].name}</div>}</div><div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-500 to-yellow-300" style={{ width: `${Math.min(100, (xp / (level * 1000)) * 100)}%` }} /></div><div className="flex items-center gap-3 text-xs flex-wrap"><button onClick={onEnergy} className="flex items-center gap-1"><span className={energy < 20 ? 'text-red-400 animate-pulse' : 'text-blue-300'}>🔋</span><span>{Math.floor(energy)}/{MAX_ENERGY}</span></button><div className="text-orange-400 font-bold">🔥 {streak}</div><div className="text-white/70">✨ {fragments.toLocaleString()}</div><button onClick={onShop} className="text-purple-300 font-bold">💎 {gems.toLocaleString()} ＋</button></div></div><div className="flex items-center gap-2 pointer-events-auto"><button onClick={onQuit} className="w-10 h-10 rounded-full bg-red-900/50 hover:bg-red-900/70 border border-red-500/30">⏻</button><button onClick={onNotifications} className="relative w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20">🔔{notifications.filter((n) => n.type === 'urgent').length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center animate-pulse">{notifications.filter((n) => n.type === 'urgent').length}</span>}</button><button onClick={onMenu} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20">⚙️</button></div></div>{hasBattlePass && <div className="mt-2 bg-black/40 backdrop-blur-sm rounded-lg p-2 pointer-events-auto max-w-xl"><div className="flex items-center justify-between text-xs text-white/80 mb-1"><span>Battle Pass</span><span>Tier {battlePassTier}/100</span></div><div className="w-full h-1 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${battlePassTier}%` }} /></div></div>}</div>; }
function QuestMiniList({ quests }) { return <div className="absolute top-36 left-4 w-64 space-y-2 pointer-events-none opacity-90 hidden sm:block">{quests.slice(0, 3).map((q) => <div key={q.id} className="bg-black/40 backdrop-blur-sm p-3 rounded-lg border border-white/10"><div className="flex justify-between text-xs mb-1 gap-2"><span className="truncate">{q.title}</span><span className="text-amber-300">+{q.gemReward}💎</span></div><div className="w-full h-1 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-green-400" style={{ width: `${Math.min(100, (q.progress / q.goal) * 100)}%` }} /></div></div>)}</div>; }
function DailyDealBanner({ deal, timer, onClick }) { return <button onClick={onClick} className="absolute top-44 left-4 w-64 bg-gradient-to-r from-red-950/85 to-orange-950/85 p-3 rounded-xl border border-red-500/30 pointer-events-auto animate-pulse-soft hidden md:block z-10 text-left"><div className="flex justify-between items-center mb-1"><span className="text-xs font-bold text-red-300 uppercase">⚡ Daily Deal</span><span className="text-xs font-mono">{formatTime(timer)}</span></div><div className="text-sm font-bold">{deal.item}</div><div className="text-xs text-white/60 line-through">${deal.originalPrice}</div><div className="text-lg font-black text-green-400">${deal.price}</div></button>; }
function LowInventoryWarning({ used, slots, vipLevel, onVIP }) { return <div className="absolute top-1/3 right-4 bg-yellow-900/80 p-3 rounded-lg border border-yellow-500/50 max-w-xs pointer-events-auto animate-bounce hidden md:block"><div className="flex gap-2 text-yellow-300 text-sm"><span className="text-xl">⚠️</span><div><div className="font-bold">Inventory almost full!</div><div className="text-xs">{used}/{slots} used</div>{vipLevel < 2 && <button onClick={onVIP} className="mt-2 text-xs bg-yellow-400 text-black px-3 py-1 rounded-full font-bold">Upgrade VIP</button>}</div></div></div>; }
function ComboText({ combo }) { return <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"><div className="text-center animate-bounce"><div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-amber-600 italic">{combo}x</div><div className="text-amber-200 text-sm font-bold tracking-widest uppercase">COMBO!</div></div></div>; }
function BottomControls({ onQuick, onEmote, onChat }) { return <div className="absolute bottom-8 left-0 right-0 px-4 flex justify-center gap-4 pointer-events-none z-20"><RoundButton onClick={onQuick}>💬</RoundButton><RoundButton onClick={onEmote}>😊</RoundButton><button onClick={onChat} className="pointer-events-auto w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 border border-white/20 flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg text-2xl">🗨️</button></div>; }
function RoundButton({ children, onClick }) { return <button onClick={onClick} className="pointer-events-auto w-14 h-14 rounded-full bg-black/40 backdrop-blur border border-white/20 flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-2xl">{children}</button>; }
function MainMenu({ hasBattlePass, vipLevel, onClose, openPanel, openMystery, openVIP, openBattlePass }) { return <div className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-auto z-40" onClick={onClose}><div className="absolute right-0 top-0 bottom-0 w-80 max-w-[90vw] bg-gradient-to-b from-gray-950 to-black border-l border-white/10 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}><div className="space-y-3"><div className="flex items-center justify-between mb-6"><h2 className="text-2xl font-bold">Menu</h2><button onClick={onClose} className="text-white/60 text-2xl">×</button></div>{!hasBattlePass && <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 rounded-xl mb-4 cursor-pointer" onClick={openBattlePass}><div className="flex items-center justify-between"><div><div className="font-bold">Battle Pass</div><div className="text-white/80 text-xs">Unlock 100 tiers!</div></div><span>›</span></div></div>}<MenuButton icon="🏆" text="Battle Pass" gradient="from-purple-600 to-pink-600" onClick={() => openPanel('battlepass')} /><MenuButton icon="🛒" text="Shop" gradient="from-amber-600 to-yellow-600" onClick={() => openPanel('shop')} /><MenuButton icon="📦" text="Inventory" gradient="from-blue-600 to-cyan-600" onClick={() => openPanel('inventory')} /><MenuButton icon="👥" text="Friends" gradient="from-green-600 to-emerald-600" onClick={() => openPanel('friends')} /><MenuButton icon="📈" text="Leaderboard" gradient="from-red-600 to-orange-600" onClick={() => openPanel('leaderboard')} /><MenuButton icon="🎯" text="Quests" gradient="from-indigo-600 to-purple-600" onClick={() => openPanel('quests')} /><MenuButton icon="🏅" text="Achievements" gradient="from-yellow-600 to-amber-600" onClick={() => openPanel('achievements')} /><MenuButton icon="⚔️" text="Constellation" gradient="from-purple-600 to-blue-600" onClick={() => openPanel('constellation')} /><MenuButton icon="📅" text="Events" gradient="from-pink-600 to-rose-600" onClick={() => openPanel('events')} /><MenuButton icon="📊" text="Stats" gradient="from-teal-600 to-cyan-600" onClick={() => openPanel('stats')} /><MenuButton icon="⚡" text="Boosters" gradient="from-orange-600 to-red-600" onClick={() => openPanel('boosters')} /><MenuButton icon="🎁" text="Mystery Box" gradient="from-purple-600 to-pink-600" onClick={openMystery} /><MenuButton icon="📡" text="Activity" gradient="from-blue-600 to-indigo-600" onClick={() => openPanel('activity')} /><MenuButton icon="👑" text="VIP Membership" gradient="from-yellow-600 to-orange-600" onClick={openVIP} badge={vipLevel === 0 ? 'NEW!' : null} /></div></div></div>; }
function MenuButton({ icon, text, gradient, onClick, badge }) { return <button onClick={onClick} className={`w-full bg-gradient-to-r ${gradient} px-4 py-3 rounded-xl text-white font-bold flex items-center justify-between hover:scale-105 transition-transform relative`}><div className="flex items-center gap-2"><EmojiIcon className="w-5 h-5">{icon}</EmojiIcon>{text}</div>{badge && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">{badge}</span>}<span className="text-xl">›</span></button>; }
function FullPanel({ title, children, onClose }) { return <div className="absolute inset-0 bg-black/95 backdrop-blur-sm pointer-events-auto z-50 overflow-y-auto"><div className="min-h-screen p-6"><div className="max-w-xl mx-auto"><div className="flex items-center justify-between mb-6 sticky top-0 bg-black/90 backdrop-blur-md p-4 rounded-2xl border border-white/10 z-10"><h1 className="text-3xl font-bold text-white">{title}</h1><button onClick={onClose} className="text-white/60 hover:text-white text-4xl leading-none">×</button></div>{children}</div></div></div>; }
function Section({ title, children }) { return <div className="mb-6"><h3 className="text-white font-bold mb-3 text-lg">{title}</h3>{children}</div>; }
function StatLine({ label, value }) { return <div className="flex justify-between"><span className="text-white/60">{label}</span><span className="text-white font-bold">{value}</span></div>; }
function ShopPanel({ productStock, seasonalStock, ownedItems, vipLevel, dailyDealTimer, onClose, onBuyItem, onBuyGemPack, onBuyDailyDeal }) { return <FullPanel title="Shop" onClose={onClose}><Section title="❄️ Seasonal Shop"><div className="bg-blue-950/50 border border-blue-400/40 rounded-xl p-4 mb-3"><div className="flex justify-between"><div><div className="font-bold">{SEASONAL_EVENT.name}</div><div className="text-xs text-white/60">Never returns • limited stock</div></div><div className="text-3xl">❄️</div></div></div><div className="grid grid-cols-2 gap-3">{seasonalStock.map((i) => <ShopItem key={i.id} item={i} owned={ownedItems.colors.includes(i.id) || ownedItems.trails.includes(i.id)} onBuy={() => onBuyItem(i)} vipLevel={vipLevel} />)}</div></Section><Section title="💎 Gem Packs"><div className="grid grid-cols-2 gap-3">{GEM_PACKS.map((p) => <GemPack key={p.id} pack={p} onBuy={() => onBuyGemPack(p)} />)}</div></Section><Section title="🎨 Colors"><div className="grid grid-cols-2 gap-3">{productStock.colors.map((i) => <ShopItem key={i.id} item={i} owned={ownedItems.colors.includes(i.id)} onBuy={() => onBuyItem(i)} vipLevel={vipLevel} />)}</div></Section><Section title="✨ Trails"><div className="grid grid-cols-2 gap-3">{productStock.trails.map((i) => <ShopItem key={i.id} item={i} owned={ownedItems.trails.includes(i.id)} onBuy={() => onBuyItem(i)} vipLevel={vipLevel} />)}</div></Section><Section title="🌟 Auras"><div className="grid grid-cols-2 gap-3">{productStock.auras.map((i) => <ShopItem key={i.id} item={i} owned={ownedItems.auras.includes(i.id)} onBuy={() => onBuyItem(i)} vipLevel={vipLevel} />)}</div></Section><Section title="⚡ Daily Deals"><div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-xl p-3 mb-3"><div className="text-white/80 text-sm text-center">Refreshes in {formatTimeUntil(dailyDealTimer)}</div></div><div className="grid grid-cols-1 gap-3">{DAILY_DEALS.map((d) => <DailyDeal key={d.id} deal={d} onBuy={() => onBuyDailyDeal(d)} />)}</div></Section></FullPanel>; }
function GemPack({ pack, onBuy }) { return <div className={`rounded-xl p-4 border-2 ${pack.popular ? 'border-yellow-400 bg-gradient-to-br from-yellow-900/30 to-orange-900/30' : 'bg-white/5 border-white/10'} relative`}>{pack.badge && <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">{pack.badge}</div>}<div className="text-center space-y-2"><div className="text-3xl">💎</div><div className="text-white font-bold">{pack.gems.toLocaleString()} Gems</div>{pack.bonus > 0 && <div className="text-green-400 text-xs font-bold">+{pack.bonus} BONUS!</div>}<div className="text-2xl font-bold text-white">${pack.price}</div><button onClick={onBuy} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold px-4 py-2 rounded-full text-sm">Buy</button></div></div>; }
function ShopItem({ item, owned, onBuy, vipLevel }) { const locked = item.vipRequired && vipLevel < item.vipRequired; return <div className={`rounded-xl p-4 border ${locked ? 'bg-gray-800/30 border-gray-700' : 'bg-white/5 border-white/10'} relative`}>{locked && <div className="absolute top-2 right-2 text-gray-500">🔒</div>}<div className="w-full h-20 rounded-lg mb-3 border border-white/10 flex items-center justify-center text-4xl" style={{ background: item.color || '#333' }}>{!item.color && (item.icon || '✨')}</div><div className="text-white font-bold text-sm mb-1">{item.name}</div><div className={`text-xs mb-2 uppercase font-bold ${rarityClass(item.rarity)}`}>{item.rarity}</div>{typeof item.stock === 'number' && item.stock < 10 && <div className="mb-2 text-xs font-bold text-red-400">Only {item.stock} left!</div>}{locked ? <div className="text-xs text-purple-400">VIP {item.vipRequired} required</div> : owned ? <div className="text-green-400 text-sm font-bold">Owned ✓</div> : <>{item.gems > 0 ? <div className="text-purple-400 font-bold mb-2">💎 {item.gems}</div> : <div className="text-white text-lg font-bold mb-2">${item.price}</div>}<button onClick={onBuy} className="w-full bg-amber-500 text-black font-bold px-4 py-2 rounded-full text-sm">Buy</button></>}</div>; }
function InventoryPanel({ ownedItems, equippedItems, inventoryUsed, inventorySlots, vipLevel, allColorItems, onEquip, onVIP, onClose }) { return <FullPanel title="Inventory" onClose={onClose}><div className="space-y-6"><div className="bg-white/5 rounded-xl p-4 border border-white/10"><div className="flex justify-between mb-2"><span>Capacity</span><span>{inventoryUsed}/{inventorySlots}</span></div><div className="w-full h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${Math.min(100, (inventoryUsed / inventorySlots) * 100)}%` }} /></div>{vipLevel < 2 && <button onClick={onVIP} className="mt-3 w-full bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold">Expand with VIP</button>}</div><Section title="Equipped"><div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-2"><StatLine label="Color" value={equippedItems.color} /><StatLine label="Trail" value={equippedItems.trail} /><StatLine label="Aura" value={equippedItems.aura || 'None'} /></div></Section><Section title="Colors"><div className="grid grid-cols-3 gap-2">{ownedItems.colors.map((id) => { const item = allColorItems.find((i) => i.id === id); if (!item) return null; return <button key={id} onClick={() => onEquip(id)} className={`p-2 rounded border ${equippedItems.color === id ? 'border-amber-400' : 'border-white/10'}`}><div className="w-full h-8 rounded mb-1" style={{ background: item.color }} /><div className="text-[10px] text-white">{item.name}</div></button>; })}</div></Section></div></FullPanel>; }
function FriendsPanel({ friends, onClose }) { return <FullPanel title="Friends" onClose={onClose}><div className="space-y-3">{friends.map((f) => <FriendCard key={f.id} friend={f} />)}</div></FullPanel>; }
function FriendCard({ friend }) { return <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between"><div className="flex items-center gap-3"><div className={`w-3 h-3 rounded-full ${friend.online ? 'bg-green-400' : 'bg-gray-500'}`} /><div><div className="font-bold flex gap-2">{friend.name}{friend.vipLevel > 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${VIP_TIERS[friend.vipLevel].color}30`, color: VIP_TIERS[friend.vipLevel].color }}>VIP {friend.vipLevel}</span>}</div><div className="text-white/40 text-xs">Level {friend.level} • {friend.lastSeen}</div>{friend.lastPurchase && <div className="text-green-400 text-xs">💰 Bought {friend.lastPurchase}</div>}</div></div><div className="text-orange-400 text-sm">🔥 {friend.streak}</div></div>; }
function LeaderboardPanel({ onClose }) { return <FullPanel title="Leaderboard" onClose={onClose}><div className="space-y-3">{GLOBAL_LEADERBOARD.map((e) => <LeaderboardRow key={e.rank} entry={e} />)}</div></FullPanel>; }
function LeaderboardRow({ entry }) { return <div className={`rounded-xl p-4 border flex items-center justify-between ${entry.isYou ? 'bg-amber-900/30 border-amber-500/50' : 'bg-white/5 border-white/10'}`}><div className="flex items-center gap-4"><div className="text-2xl font-bold text-white/60">#{entry.rank}</div><div><div className="font-bold flex gap-2">{entry.name}{entry.isYou && <span className="text-xs text-amber-400">(You)</span>}{entry.vipLevel > 0 && <span>👑</span>}</div><div className="text-white/60 text-sm">Level {entry.level} • {entry.fragments.toLocaleString()} fragments</div>{entry.spent > 0 && <div className="text-green-400 text-xs">💰 ${entry.spent} spent</div>}</div></div><div className="text-2xl">{entry.country}</div></div>; }
function QuestsPanel({ quests, onClose }) { return <FullPanel title="Daily Quests" onClose={onClose}><div className="space-y-4">{quests.map((q) => <QuestCard key={q.id} quest={q} />)}</div></FullPanel>; }
function QuestCard({ quest }) { return <div className="bg-white/5 rounded-xl p-4 border border-white/10"><div className="flex items-center gap-3 mb-3"><div className="text-3xl">{quest.icon}</div><div className="flex-1"><div className="font-bold">{quest.title}</div><div className="text-white/60 text-sm">{quest.progress}/{quest.goal}</div></div></div><div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-3"><div className="h-full bg-gradient-to-r from-amber-500 to-yellow-300" style={{ width: `${Math.min(100, (quest.progress / quest.goal) * 100)}%` }} /></div><div className="flex justify-between text-sm"><span className="text-amber-400">+{quest.reward}</span><span className="text-blue-400">+{quest.xpReward} XP</span><span className="text-purple-400">+{quest.gemReward} 💎</span></div></div>; }
function AchievementsPanel({ achievements, onClose }) { return <FullPanel title="Achievements" onClose={onClose}><div className="grid grid-cols-2 gap-3">{achievements.map((a) => <AchievementCard key={a.id} ach={a} />)}</div></FullPanel>; }
function AchievementCard({ ach }) { return <div className={`rounded-xl p-4 border ${ach.progress >= ach.goal ? 'bg-gradient-to-br from-yellow-900/30 to-amber-900/30 border-yellow-500/50' : 'bg-white/5 border-white/10 opacity-60'}`}><div className="text-4xl text-center mb-2">{ach.icon}</div><div className="font-bold text-center text-sm">{ach.title}</div><div className="text-white/60 text-xs text-center mt-1">{ach.desc}</div><div className="text-purple-400 text-xs text-center mt-2 font-bold">+{ach.gemReward} 💎</div>{ach.progress < ach.goal && <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-2"><div className="h-full bg-amber-500" style={{ width: `${Math.min(100, (ach.progress / ach.goal) * 100)}%` }} /></div>}</div>; }
function BattlePassPanel({ hasBattlePass, battlePassTier, onBuy, onClose }) { return <FullPanel title="Battle Pass" onClose={onClose}>{!hasBattlePass ? <div className="text-center py-12"><div className="text-6xl mb-4">🏆</div><div className="text-2xl font-bold mb-4">Battle Pass Season 1</div><div className="text-white/60 mb-6">100 tiers with exclusive rewards!</div><button onClick={onBuy} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold px-8 py-3 rounded-full text-lg">Buy Battle Pass ($99)</button></div> : <div className="space-y-4"><div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-xl p-4"><div className="font-bold mb-2">Tier {battlePassTier}/100</div><div className="w-full h-3 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${battlePassTier}%` }} /></div></div><div className="space-y-2">{BATTLE_PASS_TIERS.slice(0, 20).map((t) => <div key={t.tier} className={`bg-white/5 rounded-lg p-3 border ${battlePassTier >= t.tier ? 'border-purple-500/50' : 'border-white/10'}`}><div className="flex justify-between"><div className="font-bold">Tier {t.tier}</div><div>{battlePassTier >= t.tier ? '✓' : '🔒'}</div></div><div className="text-white/60 text-sm mt-1">{t.premium.fragments} fragments, {t.premium.xp} XP{t.premium.item && <span className="text-purple-400"> + {t.premium.item}</span>}</div></div>)}</div></div>}</FullPanel>; }
function ConstellationPanel({ constellation, members, onCreate, onClose }) { return <FullPanel title="Constellation" onClose={onClose}>{constellation ? <div className="space-y-6"><div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-2xl p-6 border border-white/10"><h2 className="text-2xl font-bold mb-2">{constellation.name}</h2><div className="text-white/60 text-sm">{constellation.members.length} members • Rank #{constellation.rank}</div></div><Section title="Members"><div className="space-y-2">{members.map((m) => <div key={m.name} className="bg-white/5 rounded-lg p-3 border border-white/10 flex justify-between"><div>{m.name}{m.isYou && <span className="text-xs text-amber-400 ml-2">(You)</span>}</div><div className="text-amber-400 font-bold">{m.contribution}</div></div>)}</div></Section></div> : <div className="text-center py-12"><div className="text-6xl mb-4">✨</div><div className="text-xl mb-2">No Constellation Yet</div><button onClick={onCreate} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold px-8 py-3 rounded-full hover:scale-105 transition-transform">Create Constellation</button></div>}</FullPanel>; }
function EventsPanel({ events, nextEvent, onClose }) { return <FullPanel title="Events Calendar" onClose={onClose}><div className="space-y-3">{events.map((e) => <EventCard key={e.id} event={e} />)}{nextEvent && <EventCard event={{ id: 'next', name: `Next live event: ${nextEvent.name}`, time: nextEvent.time, frequency: 'Next', rewards: `${nextEvent.multiplier}x Fragments` }} />}</div></FullPanel>; }
function EventCard({ event }) { return <div className={`rounded-xl p-4 border ${event.vipOnly ? 'bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-500/50' : 'bg-white/5 border-white/10'}`}><div className="flex justify-between mb-2"><div className="font-bold">{event.name}</div><div className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">{event.frequency}</div></div><div className="text-white/60 text-sm mb-2">{event.time}</div><div className="text-amber-400 text-sm">{event.rewards}</div>{event.vipOnly && <div className="mt-2 text-purple-400 text-xs">👑 VIP only</div>}</div>; }
function StatsPanel({ fragments, gems, streak, vipLevel, vipExpiry, totalSpent, battlePassXP, battlePassTier, gachaPulls, beaconStates, onClose }) { return <FullPanel title="Stats" onClose={onClose}><div className="space-y-4"><StatRow label="Fragments Collected" value={fragments.toLocaleString()} /><StatRow label="Gems" value={gems.toLocaleString()} /><StatRow label="Beacons Lit" value={Object.values(beaconStates).filter((b) => b.active).length} /><StatRow label="Souls Met" value="47" /><StatRow label="Playtime" value="12h 34m" /><StatRow label="Streak" value={`${streak} days`} /><StatRow label="VIP Level" value={VIP_TIERS[vipLevel].name} /><StatRow label="VIP Expires" value={vipExpiry ? new Date(vipExpiry).toLocaleDateString() : '-'} /><StatRow label="Battle Pass XP" value={battlePassXP.toLocaleString()} /><StatRow label="Battle Pass Tier" value={`${battlePassTier}/100`} /><StatRow label="Total Spent" value={`$${totalSpent.toFixed(2)}`} /><StatRow label="Gacha Pulls" value={gachaPulls} /></div></FullPanel>; }
function StatRow({ label, value }) { return <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex justify-between"><span className="text-white/60">{label}</span><span className="text-white font-bold text-lg">{value}</span></div>; }
function ActivityPanel({ feed, onClose }) { return <FullPanel title="Activity" onClose={onClose}><div className="space-y-2">{feed.map((a) => <ActivityRow key={a.id} activity={a} />)}</div></FullPanel>; }
function ActivityRow({ activity }) { return <div className={`rounded-xl p-4 border flex gap-3 ${activity.highlight ? 'bg-green-900/20 border-green-500/30' : 'bg-white/5 border-white/10'}`}><div className="text-2xl">{activity.icon}</div><div><div className="text-sm"><span className="font-bold">{activity.user}</span> {activity.action}</div><div className="text-white/40 text-xs">{activity.time}</div></div></div>; }
function BoostersPanel({ vipLevel, gems, setGems, setEnergy, energyRef, onClose }) { return <FullPanel title="Boosters" onClose={onClose}><div className="grid grid-cols-2 gap-3">{BOOSTERS.map((b) => <div key={b.id} className={`rounded-xl p-4 border text-center ${b.vipRequired && vipLevel < b.vipRequired ? 'bg-gray-800/30 border-gray-700' : 'bg-white/5 border-white/10'}`}><div className="text-4xl mb-2">{b.icon}</div><div className="font-bold text-sm">{b.name}</div><div className="text-white/60 text-xs mt-1">{b.duration}</div>{b.vipRequired && vipLevel < b.vipRequired ? <div className="mt-3 text-xs text-purple-400">VIP {b.vipRequired} required</div> : <button onClick={() => { if (gems >= b.gems) { setGems((g) => g - b.gems); if (b.id === 'bo5') { energyRef.current = MAX_ENERGY; setEnergy(MAX_ENERGY); } playSound('success'); } }} className="mt-3 w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold px-4 py-2 rounded-full text-sm">{b.gems > 0 ? `${b.gems} 💎` : `$${b.price}`}</button>}</div>)}</div></FullPanel>; }
function NotificationsPanel({ notifications, onClose }) { return <div className="absolute top-20 right-4 w-80 max-w-[calc(100vw-2rem)] bg-gray-950/95 backdrop-blur-xl rounded-2xl border border-white/10 p-4 z-50 max-h-96 overflow-y-auto pointer-events-auto"><div className="flex justify-between mb-4"><h3 className="font-bold">Notifications</h3><button onClick={onClose} className="text-white/60 text-2xl leading-none">×</button></div><div className="space-y-2">{notifications.map((n) => <div key={n.id} className={`rounded-lg p-3 border ${n.type === 'urgent' ? 'bg-red-900/30 border-red-500/50 animate-pulse' : n.type === 'social' ? 'bg-blue-900/30 border-blue-500/50' : n.type === 'success' ? 'bg-green-900/30 border-green-500/50' : 'bg-white/5 border-white/10'}`}><div className="text-white text-sm">{n.text}</div><div className="text-white/40 text-xs mt-1">{n.time}</div></div>)}</div></div>; }
function DailyDeal({ deal, onBuy }) { return <div className="bg-white/5 rounded-xl p-4 border border-blue-500/30 flex items-center justify-between"><div className="flex items-center gap-3"><div className="text-3xl">{deal.icon}</div><div><div className="font-bold">{deal.name}</div><div className="text-white/60 text-sm">{deal.duration}</div></div></div><button onClick={onBuy} className="bg-blue-500 text-white px-4 py-2 rounded-full font-bold text-sm">${deal.price}</button></div>; }
function StarterPackBanner({ pack, timeLeft, onBuy }) { return <div className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-auto animate-bounce hidden lg:block z-20"><div className="bg-gradient-to-br from-red-600 to-orange-600 p-4 rounded-2xl border-4 border-yellow-400 shadow-2xl max-w-xs relative"><div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full animate-pulse">90% OFF!</div><div className="text-center space-y-2"><div className="text-4xl">{pack.icon}</div><div className="font-bold text-sm">{pack.name}</div><div className="text-white/80 text-xs line-through">${pack.originalPrice}</div><div className="text-2xl font-black">${pack.price}</div><div className="text-red-100 text-xs font-bold">⏰ {formatTimeUntil(timeLeft)}</div><button onClick={onBuy} className="w-full bg-yellow-400 text-black font-bold px-4 py-2 rounded-full text-sm hover:scale-105 transition-transform">BUY NOW!</button></div></div></div>; }
function QuickChatMenu({ messages, onSend, onClose }) { return <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 p-4 w-80 max-w-[calc(100vw-2rem)] pointer-events-auto z-40"><div className="flex justify-between mb-3"><div className="font-bold">Quick Chat</div><button onClick={onClose} className="text-white/60 text-2xl leading-none">×</button></div><div className="grid grid-cols-2 gap-2">{messages.map((m) => <button key={m.id} onClick={() => onSend(m)} className="bg-purple-900/50 hover:bg-purple-900/70 text-white px-4 py-3 rounded-xl flex items-center gap-2 text-sm"><span>{m.icon}</span><span>{m.text}</span></button>)}</div></div>; }
function EmoteWheel({ emotes, onSelect, onClose }) { return <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto z-40 flex items-center justify-center" onClick={onClose}><div className="relative w-80 h-80" onClick={(e) => e.stopPropagation()}><div className="absolute inset-0 rounded-full border-4 border-white/20 bg-black/60 backdrop-blur-md" />{emotes.map((id, i) => { const item = SHOP_PRODUCTS.emotes.find((e) => e.id === id); const angle = (i / Math.max(1, emotes.length)) * Math.PI * 2 - Math.PI / 2; const x = Math.cos(angle) * 100; const y = Math.sin(angle) * 100; return <button key={id} onClick={() => onSelect(id)} className="absolute w-16 h-16 bg-purple-900/80 rounded-full flex items-center justify-center text-3xl border-2 border-white/20 hover:scale-110 transition-all" style={{ left: `calc(50% + ${x}px - 2rem)`, top: `calc(50% + ${y}px - 2rem)` }}>{item?.icon || '✨'}</button>; })}</div></div>; }
function ChatPopup({ chatMode, setChatMode, messages, input, setInput, onSubmit, onClose }) { return <div className="absolute bottom-28 right-8 w-80 max-w-[calc(100vw-2rem)] h-96 bg-gray-950/95 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col pointer-events-auto z-30"><div className="p-4 border-b border-white/10 flex justify-between"><div className="flex gap-2"><button onClick={() => setChatMode('whisper')} className={`px-2 py-1 rounded text-xs ${chatMode === 'whisper' ? 'bg-purple-500' : 'bg-white/10'}`}>Whisper</button><button onClick={() => setChatMode('constellation')} className={`px-2 py-1 rounded text-xs ${chatMode === 'constellation' ? 'bg-purple-500' : 'bg-white/10'}`}>Constellation</button></div><button onClick={onClose} className="text-white/60 text-xl">×</button></div><div className="flex-1 overflow-y-auto p-4 space-y-3">{messages.map((m) => <div key={m.id} className={`flex gap-3 ${m.isYou ? 'flex-row-reverse' : ''}`}><div className="text-xl">{m.avatar}</div><div className={`flex-1 ${m.isYou ? 'text-right' : ''}`}><div className="text-white/60 text-[10px] mb-1">{m.user}</div><div className={`inline-block px-3 py-2 rounded-xl text-sm ${m.isYou ? 'bg-purple-500 text-white' : 'bg-white/10 text-white'}`}>{m.text}</div></div></div>)}</div><form onSubmit={onSubmit} className="p-3 border-t border-white/10 flex gap-2"><input value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 bg-white/10 rounded-full px-3 py-1.5 text-white text-sm outline-none" placeholder="Write..." /><button type="submit" className="w-8 h-8 bg-purple-500 rounded-full">➤</button></form></div>; }
function ModalShell({ children, className = '' }) { return <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] pointer-events-auto p-4"><div className={className}>{children}</div></div>; }
function EnergyModal({ energy, onRefill, onClose }) { return <ModalShell className="bg-gradient-to-br from-blue-900 to-purple-900 p-8 rounded-3xl border-2 border-blue-500 max-w-md shadow-2xl text-center space-y-4"><div className="text-6xl animate-pulse">⚡</div><h2 className="text-3xl font-bold">Energy</h2><p className="text-white/80">Current energy: {Math.floor(energy)}/{MAX_ENERGY}</p><button onClick={() => onRefill('paid')} className="w-full bg-yellow-500 text-black font-bold py-3 rounded-xl">Full Refill (100 💎)</button><button onClick={() => onRefill('ad')} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl">Watch Ad (+20 Energy)</button><button onClick={onClose} className="text-white/40 text-sm">Close</button></ModalShell>; }
function OutOfEnergyModal({ energy, vipLevel, onRefill, onVIP, onClose }) { return <ModalShell className="bg-gradient-to-br from-blue-900 to-purple-900 p-8 rounded-3xl border-4 border-blue-500 max-w-md shadow-2xl text-center space-y-4"><div className="text-6xl">🔋</div><h2 className="text-3xl font-bold">Out of Energy!</h2><p className="text-white/80">Wait or refill instantly to keep playing.</p><div className="bg-white/10 rounded-xl p-4"><div className="text-white/60 text-sm mb-2">Full energy in approx.</div><div className="text-2xl font-bold text-blue-300">{formatTimeUntil((MAX_ENERGY - energy) * 6)}</div></div><button onClick={() => onRefill('paid')} className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold px-6 py-3 rounded-full">Full Refill (100 💎)</button><button onClick={() => onRefill('ad')} className="w-full bg-green-600 text-white font-bold px-6 py-3 rounded-full">Watch Ad (+20 Energy)</button>{vipLevel < 2 && <button onClick={onVIP} className="w-full bg-purple-600 text-white font-bold px-6 py-3 rounded-full">VIP: Faster Regen</button>}<button onClick={onClose} className="text-white/40 text-sm">Close</button></ModalShell>; }
function InventoryFullModal({ used, slots, vipLevel, onVIP, onClose }) { return <ModalShell className="bg-gradient-to-br from-red-900 to-orange-900 p-8 rounded-3xl border-4 border-red-500 max-w-md shadow-2xl text-center space-y-4"><div className="text-6xl">📦</div><h2 className="text-3xl font-bold">Inventory Full!</h2><p>You used {used}/{slots} slots.</p><div className="bg-white/10 rounded-xl p-4"><div>Free: {MAX_INVENTORY_FREE} slots</div><div className="text-green-400 font-bold">VIP: {MAX_INVENTORY_PREMIUM} slots!</div></div>{vipLevel < 2 && <button onClick={onVIP} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold px-6 py-3 rounded-full">Upgrade VIP</button>}<button onClick={onClose} className="text-white/40 text-sm">Close</button></ModalShell>; }
function VIPModal({ onBuy, onClose }) { return <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] pointer-events-auto overflow-y-auto p-4"><div className="bg-gradient-to-br from-purple-950 via-pink-950 to-purple-950 p-8 rounded-3xl border-4 border-purple-500 max-w-2xl shadow-2xl my-8"><div className="text-center space-y-4 mb-6"><div className="text-6xl">👑</div><h2 className="text-4xl font-bold">Become VIP!</h2><p className="text-white/80">Unlock exclusive benefits and power-ups.</p></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{VIP_TIERS.slice(1).map((t) => <div key={t.level} className={`rounded-2xl p-6 border-2 ${t.level === 3 ? 'border-yellow-400 shadow-2xl md:scale-105' : 'border-white/20'}`} style={{ background: `linear-gradient(135deg, ${t.color}22, ${t.color}11)` }}>{t.level === 3 && <div className="text-center mb-2"><span className="bg-yellow-400 text-black px-3 py-1 rounded-full text-xs font-bold">MOST POPULAR</span></div>}<div className="text-center mb-4"><h3 className="text-2xl font-bold mb-2">{t.name}</h3><div className="text-4xl font-black">${t.price}</div><div className="text-white/60 text-sm">per month</div></div><div className="space-y-2 mb-4">{t.benefits.map((b) => <div key={b} className="flex items-center gap-2 text-sm"><span className="text-green-400">✓</span><span>{b}</span></div>)}</div><button onClick={() => onBuy(t.level)} className="w-full bg-white text-black font-bold px-4 py-3 rounded-full">Buy {t.name}</button></div>)}</div><div className="mt-6 text-center"><button onClick={onClose} className="text-white/40 text-sm">Maybe later</button></div></div></div>; }
function BattlePassUpsell({ seasonEnd, onBuy, onClose }) { return <ModalShell className="bg-gradient-to-br from-indigo-900 to-purple-900 p-8 rounded-3xl border-4 border-indigo-500 max-w-xl shadow-2xl text-center space-y-4"><div className="text-6xl">🏆</div><h2 className="text-4xl font-bold">Battle Pass Season 1</h2><p>100 tiers of exclusive rewards!</p><div className="bg-white/10 rounded-2xl p-6 space-y-3 text-left"><CheckLine text="100+ exclusive items" /><CheckLine text="15,000+ fragment value" /><CheckLine text="Legendary and mythic rewards" /><CheckLine text="Exclusive emotes" /></div><div className="text-white/60 text-sm">Season ends in {formatTimeUntil((seasonEnd - Date.now()) / 1000)}</div><button onClick={onBuy} className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold px-8 py-4 rounded-full text-xl">Buy Battle Pass ($99)</button><button onClick={onClose} className="text-white/40 text-sm">Not now</button></ModalShell>; }
function CheckLine({ text }) { return <div className="flex justify-between"><span>{text}</span><span className="text-green-400">✓</span></div>; }
function FirstPurchaseOffer({ onBuy, onClose }) { return <ModalShell className="bg-slate-950 p-8 rounded-3xl border border-white/10 max-w-sm shadow-2xl text-center relative overflow-hidden"><div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 animate-pulse" /><div className="relative"><div className="mb-4 inline-block rounded-full bg-amber-400 px-4 py-1 text-xs font-black text-black">ONE TIME OFFER</div><h2 className="mb-2 text-4xl font-black">STARTER PACK</h2><div className="mb-4 flex items-baseline justify-center gap-2"><span className="text-lg text-white/40 line-through">$49.99</span><span className="text-5xl font-black text-green-400">$4.99</span></div><button onClick={onBuy} className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 py-4 text-xl font-black text-black">CLAIM NOW</button><button onClick={onClose} className="mt-4 text-white/40 text-sm">Skip</button></div></ModalShell>; }
function LimitedOfferModal({ timeLeft, onBuy, onClose }) { return <ModalShell className="bg-gradient-to-br from-red-900 to-pink-900 p-8 rounded-3xl border-4 border-red-400 max-w-md shadow-2xl text-center space-y-4"><div className="text-6xl">🎁</div><h2 className="text-3xl font-bold">LIMITED OFFER!</h2><div className="bg-black/30 rounded-xl p-4"><div className="text-white/60 text-sm line-through">$299</div><div className="text-4xl font-bold">$99</div><div className="text-green-400 font-bold">67% OFF!</div></div><div className="text-red-300 font-bold">⏰ Expires in {formatTime(timeLeft)}</div><div className="flex gap-3"><button onClick={onBuy} className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold px-6 py-3 rounded-full">BUY NOW!</button><button onClick={onClose} className="px-4 py-3 bg-white/10 rounded-full text-white/60">Skip</button></div></ModalShell>; }
function FlashSaleModal({ timeLeft, onBuy, onClose }) { return <ModalShell className="bg-gradient-to-br from-red-900 via-orange-900 to-red-900 p-8 rounded-3xl border-4 border-yellow-400 max-w-md shadow-2xl text-center space-y-4"><div className="text-6xl animate-bounce">⚡</div><h2 className="text-4xl font-bold">FLASH SALE!</h2><div className="bg-black/40 rounded-xl p-4"><div className="text-white/60 text-sm line-through">$499.90</div><div className="text-6xl font-black">$49.90</div><div className="text-green-400 font-bold text-2xl">90% OFF!</div></div><div className="text-red-300 font-bold text-lg">⏰ Expires in {formatTime(timeLeft)}</div><button onClick={onBuy} className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-8 py-4 rounded-full text-xl">BUY NOW!</button><button onClick={onClose} className="text-white/40 text-sm">Skip</button></ModalShell>; }
function SocialPressureModal({ friendsOnline, onClose }) { return <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-gradient-to-br from-blue-900 to-purple-900 p-6 rounded-2xl border-2 border-blue-500/30 max-w-sm shadow-2xl pointer-events-auto z-40"><div className="space-y-3"><div className="flex items-center gap-2"><span className="text-2xl">👥</span><div className="font-bold">{friendsOnline} friends online NOW!</div></div><div className="text-white/80 text-sm">Join them and earn group bonuses.</div><div className="text-green-400 text-xs">+50% fragments with friends</div><div className="flex gap-2"><button onClick={onClose} className="flex-1 bg-blue-500 text-white font-bold px-4 py-2 rounded-full text-sm">Join</button><button onClick={onClose} className="px-4 py-2 bg-white/10 text-white/60 rounded-full text-sm">Later</button></div></div></div>; }
function SocialComparisonModal({ level, onBoost, onClose }) { return <ModalShell className="bg-gradient-to-br from-blue-900 to-indigo-900 p-8 rounded-3xl border-2 border-blue-500 max-w-md shadow-2xl text-center space-y-4"><div className="text-6xl">📊</div><h2 className="text-3xl font-bold">You are falling behind!</h2><div className="bg-white/10 rounded-xl p-4 space-y-2"><StatLine label="Sarah VIP Whale" value="Level 87" /><StatLine label="Emma Starlight" value="Level 23" /><div className="border-t border-white/20 pt-2"><StatLine label="You" value={`Level ${level}`} /></div></div><button onClick={onBoost} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold px-6 py-3 rounded-full">Boost Progress</button><button onClick={onClose} className="text-white/40 text-sm">Close</button></ModalShell>; }
function DailyLoginModal({ day, reward, onClaim }) { const safeDay = Math.max(1, Math.min(7, day || 1)); const r = reward || DAILY_LOGIN_REWARDS[0]; return <ModalShell className="bg-gradient-to-br from-amber-900 to-orange-900 p-8 rounded-3xl border-4 border-yellow-400 max-w-md shadow-2xl text-center space-y-4"><div className="text-6xl animate-bounce">{r.icon}</div><h2 className="text-3xl font-bold">Daily Reward!</h2><p>Day {safeDay} of 7</p><div className="bg-white/10 rounded-2xl p-6"><div className="text-4xl font-bold text-amber-400">+{r.fragments}</div><div className="text-white/60 text-sm">Fragments</div><div className="text-3xl font-bold text-purple-400">+{r.gems}</div><div className="text-white/60 text-sm">Gems</div>{r.item && <div className="text-green-400 font-bold">+ {r.item}</div>}</div><div className="grid grid-cols-7 gap-1">{DAILY_LOGIN_REWARDS.map((_, i) => <div key={i} className={`h-2 rounded-full ${i < safeDay ? 'bg-green-400' : 'bg-white/20'}`} />)}</div><button onClick={onClaim} className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold px-8 py-4 rounded-full text-xl">Claim!</button></ModalShell>; }
function OfflineRewardsModal({ fragments, gems, onClaim }) { return <ModalShell className="bg-gradient-to-br from-blue-900 to-purple-900 p-8 rounded-3xl border-2 border-blue-500/30 max-w-md shadow-2xl text-center space-y-4"><div className="text-6xl">💎</div><h2 className="text-3xl font-bold">Welcome Back!</h2><p className="text-white/80">You earned rewards while away.</p><div className="bg-white/10 rounded-xl p-4"><div className="text-4xl font-bold text-amber-400">+{fragments}</div><div className="text-white/60 text-sm">Fragments</div><div className="text-3xl font-bold text-purple-400">+{gems}</div><div className="text-white/60 text-sm">Gems</div></div><button onClick={onClaim} className="w-full bg-amber-500 text-black font-bold px-8 py-3 rounded-full">Collect</button></ModalShell>; }
function MysteryBoxModal({ gems, opening, reward, pityL, pityM, onOpen, onClose }) { return <ModalShell className="text-center space-y-6 max-w-md w-full">{opening ? <><div className="relative h-64 overflow-hidden rounded-xl border-4 border-yellow-500 bg-black/50"><div className="absolute left-0 right-0 top-1/2 z-10 h-1 bg-red-500" /><div className="animate-spin-fast flex flex-col items-center gap-4 py-10">{Array.from({ length: 24 }).map((_, i) => <div key={i} className="flex h-32 w-32 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-4xl">{['🎨', '✨', '💎', '🔥', '💀', '👑'][i % 6]}</div>)}</div></div><div className="text-2xl animate-pulse">Opening...</div></> : reward ? <><div className="text-9xl animate-bounce">✨</div><div className="text-3xl font-bold">You got:</div><div className="bg-gradient-to-br from-purple-900 to-pink-900 p-8 rounded-3xl border-2 border-white/20"><div className="text-2xl font-bold">{reward.name}</div><div className={`text-sm mt-2 ${rarityClass(reward.rarity)}`}>{reward.rarity.toUpperCase()}</div></div><div className="text-white/60 text-sm">Pity: {pityL}/{PITY_LEGENDARY}, {pityM}/{PITY_MYTHIC}</div><button onClick={onClose} className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold px-8 py-3 rounded-full">Claim!</button></> : <><div className="text-9xl">📦</div><div className="text-3xl font-bold">Mystery Box</div><div className="text-white/60">Contains 1 random item.</div><div className="bg-white/10 rounded-xl p-4 max-w-xs mx-auto"><div className="text-white/60 text-xs mb-2">Drop Rates:</div><div className="space-y-1 text-xs"><div className="flex justify-between"><span>Common</span><span>70%</span></div><div className="flex justify-between"><span>Rare</span><span>20%</span></div><div className="flex justify-between"><span>Epic</span><span>8%</span></div><div className="flex justify-between"><span>Legendary</span><span>1.9%</span></div><div className="flex justify-between"><span>Mythic</span><span>0.1%</span></div></div><div className="text-green-400 text-xs mt-2">Pity: Legendary after {PITY_LEGENDARY} pulls</div></div><div className="text-purple-400 font-bold">💎 500 Gems • You have {gems}</div><div className="flex gap-3 justify-center"><button onClick={onOpen} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold px-8 py-3 rounded-full">Open Box!</button><button onClick={onClose} className="px-6 py-3 bg-white/10 rounded-full text-white/60">Cancel</button></div></>}</ModalShell>; }
function LevelUpModal({ level, onClose }) { return <ModalShell className="text-center space-y-6"><div className="text-9xl animate-bounce">🎉</div><div className="text-6xl font-bold">LEVEL {level}</div><div className="text-2xl text-amber-400">Level Up!</div><button onClick={onClose} className="bg-amber-500 text-black font-bold px-8 py-3 rounded-full">Continue</button></ModalShell>; }
function AchievementModal({ achievement, onClose }) { return <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br from-amber-500 to-yellow-600 p-8 rounded-3xl border-4 border-yellow-300 shadow-2xl animate-bounce z-50 pointer-events-auto"><div className="text-center space-y-4"><div className="text-6xl">{achievement.icon}</div><h2 className="text-3xl font-bold">{achievement.title}</h2><p>{achievement.desc}</p><div className="text-purple-800 font-bold text-xl">+{achievement.gemReward} 💎</div><button onClick={onClose} className="bg-white text-amber-600 font-bold px-6 py-2 rounded-full">Awesome!</button></div></div>; }
function SurpriseBonusModal({ bonus, onClose }) { return <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center pointer-events-auto animate-bounce-in"><div className="text-center"><div className="text-8xl animate-bounce mb-4">{bonus.icon}</div><div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-amber-600 mb-2">{bonus.message}</div><div className="text-6xl font-black text-white mb-8">+{bonus.amount}</div><button onClick={onClose} className="bg-white text-black font-bold px-12 py-4 rounded-full text-xl">CLAIM!</button></div></div>; }
function PostPurchaseModal({ purchase, onClose }) { return <div className="fixed inset-0 bg-black/95 z-[300] flex items-center justify-center p-6"><div className="bg-gradient-to-br from-green-900 to-emerald-900 p-8 rounded-3xl max-w-md text-center shadow-2xl border-2 border-green-500/50 animate-bounce-in"><div className="text-6xl mb-4">🎉</div><h2 className="text-3xl font-black mb-2">Great Choice!</h2><p className="mb-6">You unlocked <span className="text-green-400 font-bold">{purchase.item}</span>.</p><button onClick={onClose} className="w-full bg-white text-green-900 font-bold py-3 rounded-xl">Enjoy!</button></div></div>; }
function ExitWarningModal({ streak, onClose }) { return <ModalShell className="bg-slate-950 p-8 rounded-3xl border border-white/10 max-w-sm shadow-2xl text-center space-y-4"><div className="text-6xl">⚠️</div><h2 className="text-3xl font-black">WAIT!</h2><div className="bg-white/10 p-4 rounded-xl text-left"><div className="text-red-400 font-bold uppercase text-xs">You will lose:</div><div>🔥 {streak} Day Streak</div></div><button onClick={onClose} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl">Keep Playing</button><button onClick={() => window.location.reload()} className="text-white/30 text-sm">Leave anyway</button></ModalShell>; }
function SunkCostReminder({ totalSpent, level, onClose }) { return <ModalShell className="bg-slate-950 p-8 rounded-3xl border border-white/10 max-w-sm shadow-2xl text-center space-y-6"><h2 className="text-3xl font-bold">Your Journey</h2><p>Don't abandon your progress now.</p><div className="bg-white/10 rounded-xl p-4 text-left"><StatLine label="Level" value={level} /><StatLine label="Spent" value={`$${totalSpent.toFixed(2)}`} /></div><button onClick={onClose} className="w-full bg-blue-600 font-bold py-3 rounded-xl">Continue Playing</button><button onClick={() => window.location.reload()} className="text-white/30 text-sm">Delete progress & quit</button></ModalShell>; }
function StreakWarningModal({ streak, hoursLeft, onClose }) { return <div className="absolute top-32 right-4 bg-gradient-to-br from-orange-900 to-red-900 p-6 rounded-2xl border-2 border-orange-500/50 max-w-sm shadow-2xl pointer-events-auto z-40 animate-bounce"><div className="space-y-3"><div className="flex gap-2"><span className="text-2xl">⚠️</span><div className="font-bold">Streak Warning!</div></div><div className="text-sm">Your {streak}-day streak ends in {hoursLeft} hours!</div><button onClick={onClose} className="w-full bg-orange-500 text-white font-bold px-4 py-2 rounded-full text-sm">Play Now!</button></div></div>; }
function WhaleModal({ totalSpent, onClaim }) { return <ModalShell className="bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 p-8 rounded-3xl border-4 border-yellow-400 max-w-md shadow-2xl text-center space-y-4"><div className="text-8xl animate-bounce">🐋</div><h2 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-pink-400">LEGEND!</h2><p>You are one of our most valuable players!</p><div className="bg-white/10 rounded-xl p-6"><div className="font-bold text-2xl">${totalSpent.toFixed(2)} spent</div><div className="text-yellow-400">Top 1% of players</div><div className="text-green-400">+10,000 BONUS GEMS!</div></div><button onClick={onClaim} className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-8 py-4 rounded-full text-xl">Claim Reward!</button></ModalShell>; }
function CongratulatoryModal({ onClose }) { return <div className="absolute top-1/4 left-1/2 -translate-x-1/2 bg-gradient-to-br from-green-900 to-emerald-900 p-6 rounded-2xl border-2 border-green-500 shadow-2xl pointer-events-auto z-40"><div className="text-center space-y-3"><div className="text-5xl">🎉</div><h3 className="text-2xl font-bold">Great Choice!</h3><p>You support the game and get a better experience!</p><button onClick={onClose} className="bg-green-500 text-white px-4 py-2 rounded-full text-sm">Thanks!</button></div></div>; }
function ProgressWall({ level, gems, setGems, addXP, onClose }) { return <ModalShell className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-3xl border-4 border-red-500 max-w-md shadow-2xl text-center space-y-4"><div className="text-6xl">🚫</div><h2 className="text-3xl font-bold">Content Locked!</h2><p>This area requires level {level + 5}</p><button onClick={() => { if (gems >= 300) { setGems((g) => g - 300); addXP(5000); onClose(); } }} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold px-6 py-3 rounded-full">Boost XP (300 💎)</button><button onClick={onClose} className="text-white/40 text-sm">Keep Playing</button></ModalShell>; }
