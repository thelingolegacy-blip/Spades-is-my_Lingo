/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SoloProgression } from '../types';
import { auth, updateUserProfile } from '../utils/firebase';
import { 
  Trophy, Gift, Sparkles, Film, Compass, RefreshCw, ShoppingBag, 
  CheckCircle, Zap, ShieldAlert, Award, Star, Clock, Lock, Palette
} from 'lucide-react';

interface RewardsHubProps {
  soloProgress: SoloProgression;
  onUpdateProgress: (updates: Partial<SoloProgression>) => void;
  activeDeckStyle: string;
  onSelectDeckStyle: (style: string) => void;
  activeThemeId: string;
  onSelectTheme: (themeId: string) => void;
}

const SPIN_PRIZES = [
  { text: '500 Chips', value: 500, type: 'chips', color: 'bg-indigo-600' },
  { text: '2 Tickets', value: 2, type: 'tickets', color: 'bg-amber-600' },
  { text: '1,500 Chips', value: 1500, type: 'chips', color: 'bg-emerald-600' },
  { text: '100 XP Spark', value: 100, type: 'xp', color: 'bg-purple-600' },
  { text: '10 Tickets!', value: 10, type: 'tickets', color: 'bg-pink-600' },
  { text: '5,000 Chips!!', value: 5000, type: 'chips', color: 'bg-yellow-600' },
  { text: '100 Chips', value: 100, type: 'chips', color: 'bg-slate-700' },
  { text: '3 Tickets', value: 3, type: 'tickets', color: 'bg-cyan-600' },
];

const STORE_ITEMS = [
  { id: 'deck_classic', name: 'Classic Blue Royal', cost: 1000, type: 'deck', desc: 'Standard elegant blue vector card skin.' },
  { id: 'deck_gold', name: 'Elite Golden Reneg', cost: 5000, type: 'deck', desc: 'Sleek luxury gold card backs with shiny black spades.' },
  { id: 'deck_neon', name: 'Shinjuku Cyber Neon', cost: 15000, type: 'deck', desc: 'Vibrant neon purple glow borders and futuristic faces.' },
  { id: 'avatar_renegade', name: 'Spades Legend Avatar', cost: 10, type: 'tickets', costVal: 10, desc: 'Special AI premium illustration card.' }
];

export default function RewardsHub({
  soloProgress,
  onUpdateProgress,
  activeDeckStyle,
  onSelectDeckStyle,
  activeThemeId,
  onSelectTheme
}: RewardsHubProps) {
  // Spin states
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinDegree, setSpinDegree] = useState(0);
  const [spinWinner, setSpinWinner] = useState<any>(null);
  const [showSpinModal, setShowSpinModal] = useState(false);

  // Daily spin 24h timer states
  const [lastSpinTime, setLastSpinTime] = useState<number | null>(() => {
    const saved = localStorage.getItem('spades_last_spin_time_v1');
    return saved ? parseInt(saved, 10) : null;
  });
  const [timeUntilNextSpin, setTimeUntilNextSpin] = useState<string>('');
  const [canSpin, setCanSpin] = useState<boolean>(true);

  useEffect(() => {
    const updateCountdown = () => {
      if (!lastSpinTime) {
        setCanSpin(true);
        setTimeUntilNextSpin('');
        return;
      }
      const now = Date.now();
      const nextSpinAvailable = lastSpinTime + 24 * 60 * 60 * 1000;
      const msRemaining = nextSpinAvailable - now;

      if (msRemaining <= 0) {
        setCanSpin(true);
        setTimeUntilNextSpin('');
      } else {
        setCanSpin(false);
        const hours = Math.floor(msRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((msRemaining % (1000 * 60)) / 1000);
        setTimeUntilNextSpin(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lastSpinTime]);
  
  // Ad simulator states
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adTimer, setAdTimer] = useState(5);
  const [activeAdPartner, setActiveAdPartner] = useState('');
  
  // Sweepstakes states
  const [userEntries, setUserEntries] = useState(0);
  const [purchasedDecks, setPurchasedDecks] = useState<string[]>(() => {
    const saved = localStorage.getItem('spades_purchased_decks_v1');
    return saved ? JSON.parse(saved) : ['deck_classic'];
  });

  useEffect(() => {
    localStorage.setItem('spades_purchased_decks_v1', JSON.stringify(purchasedDecks));
    if (auth.currentUser) {
      updateUserProfile(auth.currentUser.uid, {
        purchasedDecks: purchasedDecks
      }).catch(err => console.error("Cloud skin sync failed:", err));
    }
  }, [purchasedDecks]);

  // Wheel sound & spin logic
  const handleSpinWheel = () => {
    if (isSpinning) return;
    if (!canSpin) {
      alert(`Daily spin already claimed! Next spin available in ${timeUntilNextSpin}.`);
      return;
    }

    setIsSpinning(true);
    setSpinWinner(null);

    // Save spin timestamp
    const now = Date.now();
    localStorage.setItem('spades_last_spin_time_v1', now.toString());
    setLastSpinTime(now);

    // Generate random spin degrees (at least 5 rotations)
    const randomIdx = Math.floor(Math.random() * SPIN_PRIZES.length);
    const sliceDegrees = 360 / SPIN_PRIZES.length;
    // Align winner card with pointer (at top: 270 degrees)
    const extraDegrees = 360 - (randomIdx * sliceDegrees) - (sliceDegrees / 2);
    const finalDegrees = spinDegree + 1800 + extraDegrees; // 5 full loops + target

    setSpinDegree(finalDegrees);

    // Audio cue
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      let playTick = (time: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(600, time);
        gain.gain.setValueAtTime(0.04, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        osc.start(time);
        osc.stop(time + 0.05);
      };
      // play rhythmic ticks representing wheel spinning
      for (let i = 0; i < 20; i++) {
        playTick(audioCtx.currentTime + (i * 0.15));
      }
    } catch(e) {}

    setTimeout(() => {
      setIsSpinning(false);
      const winner = SPIN_PRIZES[randomIdx];
      setSpinWinner(winner);
      setShowSpinModal(true);

      // Payout rewards
      if (winner.type === 'chips') {
        onUpdateProgress({ chips: soloProgress.chips + winner.value });
      } else if (winner.type === 'tickets') {
        onUpdateProgress({ sweepstakesTickets: soloProgress.sweepstakesTickets + winner.value });
      } else if (winner.type === 'xp') {
        // Handle level up logic if they cross threshold
        let newXp = soloProgress.xp + winner.value;
        let newLevel = soloProgress.level;
        if (newXp >= newLevel * 500) {
          newXp -= (newLevel * 500);
          newLevel += 1;
          alert(`🎉 LEVEL UP! You reached Level ${newLevel}! Global high-stakes lounges are now unlocking!`);
        }
        onUpdateProgress({ xp: newXp, level: newLevel });
      }
    }, 3200);
  };

  // Watch sponsored ad countdown
  const handleWatchAd = () => {
    if (isWatchingAd) return;
    const partners = ['Google Workspace Pro', 'Spades Is My Lingo Merch Store', 'Premium Diamond Card Club', 'Galoop Sweepstakes Drawing'];
    const randomPartner = partners[Math.floor(Math.random() * partners.length)];
    
    setActiveAdPartner(randomPartner);
    setIsWatchingAd(true);
    setAdTimer(5);

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch(e) {}
  };

  useEffect(() => {
    if (!isWatchingAd) return;
    if (adTimer === 0) {
      setIsWatchingAd(false);
      // Payout sponsor bonuses
      onUpdateProgress({ 
        chips: soloProgress.chips + 500,
        sweepstakesTickets: soloProgress.sweepstakesTickets + 1 
      });
      alert(`🎉 Sponsored ad completed! You earned +500 Coins 💰 and +1 Sweepstakes Ticket 🎟️ from ${activeAdPartner}!`);
      return;
    }

    const interval = setInterval(() => {
      setAdTimer(prev => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isWatchingAd, adTimer]);

  // Buy item from store
  const handleBuyItem = (item: any) => {
    if (purchasedDecks.includes(item.id)) {
      onSelectDeckStyle(item.id);
      return;
    }

    if (item.type === 'deck') {
      if (soloProgress.chips < item.cost) {
        alert("Insufficient Coins! complete tables or watch ads to earn enough!");
        return;
      }
      onUpdateProgress({ chips: soloProgress.chips - item.cost });
      setPurchasedDecks(prev => [...prev, item.id]);
      onSelectDeckStyle(item.id);
      alert(`Purchased and activated ${item.name}! Play with your custom cards!`);
    } else {
      // avatar purchase
      if (soloProgress.sweepstakesTickets < 10) {
        alert("Insufficient Sweepstakes Tickets! You need at least 10 tickets.");
        return;
      }
      onUpdateProgress({ sweepstakesTickets: soloProgress.sweepstakesTickets - 10 });
      setPurchasedDecks(prev => [...prev, item.id]);
      alert(`Congratulations! You unlocked the legendary ${item.name} for your AI practice avatar!`);
    }
  };

  // Add tickets to sweepstakes
  const handleEnterSweepstakes = () => {
    if (soloProgress.sweepstakesTickets <= 0) {
      alert("You need at least 1 Sweepstakes Ticket to enter! Spin the Lucky Wheel or watch ads to collect tickets.");
      return;
    }

    onUpdateProgress({
      sweepstakesTickets: soloProgress.sweepstakesTickets - 1,
      activeSweepstakesEntries: soloProgress.activeSweepstakesEntries + 1
    });

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch(e) {}
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeIn" id="rewards-hub-wrapper">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="rewards-hub-root">
      
      {/* LEFT COLUMN: SWEEPSTAKES & AD CENTER */}
      <div className="lg:col-span-1 space-y-6">
        
        {/* SWEEPSTAKES DRAWING CARD */}
        <div className="glass p-5 flex flex-col justify-between min-h-[220px]" id="sweepstakes-draw-card">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg shrink-0">
                <Trophy className="w-5 h-5" />
              </span>
              <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-black tracking-wide">
                GRAND DRAWING
              </span>
            </div>
            <h3 className="text-base font-extrabold text-white">Lingo Grand Sweepstakes</h3>
            <p className="text-xs text-slate-350 mt-1.5 leading-relaxed">
              Every ticket entered boosts your chance to win the legendary **1,000,000 Chip Ultimate Grand Prize** drawn weekly.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Your Tickets:</span>
              <span className="text-amber-400 font-bold">🎟️ {soloProgress.sweepstakesTickets}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Active Entries:</span>
              <span className="text-indigo-400 font-bold">{soloProgress.activeSweepstakesEntries} entries</span>
            </div>

            <button
              onClick={handleEnterSweepstakes}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/10 hover:scale-103 transition-all"
            >
              <Gift className="w-4.5 h-4.5" />
              Submit Ticket (1 Ticket)
            </button>
          </div>
        </div>

        {/* MONETIZATION AD CENTER */}
        <div className="glass p-5 flex flex-col justify-between" id="ad-sponsored-center">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0">
                <Film className="w-5 h-5" />
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold tracking-wider font-mono">
                SPONSOR AD
              </span>
            </div>
            <h3 className="text-base font-extrabold text-white">Sponsored Video Payout</h3>
            <p className="text-xs text-slate-350 mt-1.5 leading-relaxed">
              Watch a quick 5-second sponsored ad to earn immediate bonus play funding! Claim **+500 Chips** and **+1 Sweepstakes Ticket** instantly.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10">
            {isWatchingAd ? (
              <div className="bg-slate-900/85 p-4 rounded-xl border border-indigo-500/20 text-center space-y-2 animate-pulse">
                <Clock className="w-6 h-6 text-indigo-400 mx-auto animate-spin" />
                <div className="text-xs font-bold text-white">Streaming Sponsor Ad...</div>
                <div className="text-[11px] text-indigo-300 font-mono">
                  Ad partner: {activeAdPartner} • Completing in {adTimer}s
                </div>
              </div>
            ) : (
              <button
                onClick={handleWatchAd}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10 hover:scale-103 transition-all"
                id="watch-ad-submit"
              >
                <Film className="w-4.5 h-4.5" />
                Watch Sponsored Ad (+500💰)
              </button>
            )}
          </div>
        </div>

      </div>

      {/* CENTER COLUMN: LUCKY SPIN THE WHEEL */}
      <div className="lg:col-span-1 glass p-6 flex flex-col items-center justify-between min-h-[480px] relative overflow-hidden" id="lucky-spin-center">
        
        <div className="text-center">
          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
            Daily Bonus Spin
          </span>
          <h3 className="text-lg font-black text-white mt-2">Lucky Spades Wheel</h3>
          <p className="text-xs text-slate-400 mt-1">
            Claim your completely free spin once every 24 hours for massive chip and ticket rewards!
          </p>
        </div>

        {/* ROTATABLE WHEEL GRAPHIC */}
        <div className="relative my-6 w-56 h-56" id="lucky-rotatable-wheel">
          {/* Top arrow pointer */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[18px] border-t-amber-400 z-30 filter drop-shadow" />

          {/* Wheel Circle */}
          <div 
            className={`w-full h-full rounded-full border-4 border-slate-700 bg-slate-900 shadow-2xl relative overflow-hidden transition-all duration-[3200ms] cubic-bezier(0.1, 0.8, 0.2, 1) ${
              !canSpin && !isSpinning ? 'opacity-40 grayscale blur-[1px]' : ''
            }`}
            style={{ transform: `rotate(${spinDegree}deg)` }}
          >
            {/* Slices representation using vector gradients */}
            {SPIN_PRIZES.map((prize, idx) => {
              const rotation = idx * (360 / SPIN_PRIZES.length);
              return (
                <div 
                  key={idx}
                  className="absolute top-0 left-0 w-full h-full origin-center flex flex-col items-center pt-3 select-none"
                  style={{ transform: `rotate(${rotation}deg)` }}
                >
                  <span className="text-[9px] font-black font-mono text-white tracking-tighter text-center max-w-[40px] leading-tight">
                    {prize.text}
                  </span>
                  <div className={`w-1.5 h-12 ${prize.color} rounded-b mt-2 opacity-60`} />
                </div>
              );
            })}

            {/* Inner Center Hub Cap */}
            <div className="absolute inset-0 m-auto w-10 h-10 bg-slate-800 border-2 border-slate-600 rounded-full shadow flex items-center justify-center z-10">
              <span className="text-white text-base font-bold select-none">♠</span>
            </div>
          </div>

          {/* Lock overlay if not spin-ready */}
          {!canSpin && !isSpinning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/20 backdrop-blur-[2px] rounded-full z-20 transition-all">
              <div className="w-12 h-12 rounded-full bg-slate-900/90 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/20 animate-pulse">
                <Lock className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold text-indigo-300 mt-2 bg-slate-950/80 px-2.5 py-1 rounded-full border border-indigo-500/10">
                Ready in: {timeUntilNextSpin}
              </span>
            </div>
          )}
        </div>

        {/* SPIN BUTTON */}
        <div className="w-full text-center space-y-2">
          <button
            onClick={handleSpinWheel}
            disabled={isSpinning || !canSpin}
            className={`w-full py-3 text-sm font-black rounded-xl shadow-lg transition-all cursor-pointer ${
              isSpinning
                ? 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                : !canSpin
                ? 'bg-slate-900 text-slate-500 border border-white/10 cursor-not-allowed'
                : 'bg-indigo-500 text-slate-950 hover:bg-indigo-600 shadow-indigo-500/10 hover:scale-103'
            }`}
            id="spin-wheel-btn"
          >
            {isSpinning ? 'SPINNING...' : !canSpin ? `NEXT SPIN IN ${timeUntilNextSpin}` : 'SPIN WHEEL (FREE DAILY)'}
          </button>

          {!canSpin && !isSpinning && (
            <button
              onClick={() => {
                localStorage.removeItem('spades_last_spin_time_v1');
                setLastSpinTime(null);
                setCanSpin(true);
              }}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-mono cursor-pointer transition-all"
              id="dev-bypass-spin"
            >
              ⚡ Test Shortcut: Reset Cooldown
            </button>
          )}
        </div>

      </div>

      {/* RIGHT COLUMN: BONUS PLAY IN-APP DECK STORE */}
      <div className="lg:col-span-1 glass p-5 flex flex-col justify-between" id="deck-skins-store">
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <span className="text-xs text-slate-400 font-bold font-mono">
              {purchasedDecks.length} SKINS UNLOCKED
            </span>
          </div>
          <h3 className="text-base font-extrabold text-white">Lingo Play Store</h3>
          <p className="text-xs text-slate-350 mt-1 leading-relaxed">
            Personalize your Spades practice table with luxury card backing skins! Pick a theme and play with style.
          </p>
        </div>

        <div className="space-y-3 mt-4 overflow-y-auto max-h-[300px] pr-1">
          {STORE_ITEMS.map((item) => {
            const purchased = purchasedDecks.includes(item.id);
            const active = activeDeckStyle === item.id;

            return (
              <div 
                key={item.id}
                onClick={() => handleBuyItem(item)}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${
                  active 
                    ? 'bg-purple-500/10 border-purple-500/40' 
                    : 'bg-white/5 border-white/5 hover:bg-white/8'
                }`}
                id={`store-item-${item.id}`}
              >
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-white truncate">{item.name}</h4>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.desc}</p>
                </div>

                <div className="shrink-0 text-right">
                  {purchased ? (
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded tracking-wide ${
                      active ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {active ? 'ACTIVE' : 'EQUIP'}
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-black font-mono px-2 py-1 rounded">
                      💰 {item.cost}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FULL-WIDTH UNIFIED THEME CUSTOMIZATION PANEL */}
      <div className="glass p-6 sm:p-8" id="unified-theme-selector">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Palette className="w-6 h-6" />
            </span>
            <div>
              <h3 className="text-lg font-black text-white">♠ Spades Theme Customization ♠</h3>
              <p className="text-xs text-slate-350 mt-0.5">
                Switch themes to dynamically customize the background, buttons, card skin styles, and typography of every page instantly!
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-black tracking-wide uppercase px-2.5 py-1 rounded-full shrink-0">
            Unified Theme Layer
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            {
              id: 'theme_cyber',
              name: 'Cosmic Cyber',
              emoji: '🌌',
              cardBack: 'Neon Cyber',
              description: 'The standard elite cyberpunk-felt vibe. Neon indigo/violet ambient backdrops and futuristic faces.'
            },
            {
              id: 'theme_emerald',
              name: 'Emerald Felt',
              emoji: '💚',
              cardBack: 'Royal Blue',
              description: 'Deep professional casino green felt. Traditional golden trims and high stakes luxury.'
            },
            {
              id: 'theme_amethyst',
              name: 'Royal Amethyst',
              emoji: '🔮',
              cardBack: 'Elite Gold',
              description: 'Regal majesty with deep dark grape gradients and brilliant royal gold highlights.'
            },
            {
              id: 'theme_mahogany',
              name: 'Vintage Mahogany',
              emoji: '🪵',
              cardBack: 'Elite Gold',
              description: 'Prestige private-club wood veneer with warm brass borders and traditional typeface.'
            }
          ].map((theme) => {
            const isActive = activeThemeId === theme.id;
            return (
              <div
                key={theme.id}
                onClick={() => {
                  onSelectTheme(theme.id);
                  // Play dynamic sound feedback matching the theme feel
                  try {
                    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    if (theme.id === 'theme_cyber') {
                      osc.type = 'sawtooth';
                      osc.frequency.setValueAtTime(300, audioCtx.currentTime);
                      osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.2);
                    } else if (theme.id === 'theme_emerald') {
                      osc.type = 'sine';
                      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
                    } else if (theme.id === 'theme_amethyst') {
                      osc.type = 'triangle';
                      osc.frequency.setValueAtTime(554.37, audioCtx.currentTime);
                    } else {
                      osc.type = 'sine';
                      osc.frequency.setValueAtTime(220, audioCtx.currentTime);
                    }
                    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
                    osc.start();
                    osc.stop(audioCtx.currentTime + 0.2);
                  } catch(e) {}
                }}
                className={`p-5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                  isActive 
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/5' 
                    : 'border-white/5 bg-white/5 hover:bg-white/8 hover:border-white/10'
                }`}
                id={`theme-card-${theme.id}`}
              >
                {isActive && (
                  <span className="absolute top-3 right-3 text-xs bg-indigo-500 text-slate-950 font-black px-2 py-0.5 rounded tracking-wide uppercase">
                    ACTIVE
                  </span>
                )}
                <div>
                  <div className="text-3xl mb-3">{theme.emoji}</div>
                  <h4 className="font-extrabold text-sm text-white flex items-center gap-1.5">
                    {theme.name}
                  </h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {theme.description}
                  </p>
                </div>
                
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Card back coordinate:</span>
                  <span className="font-mono text-indigo-400 font-bold uppercase text-[10px]">
                    {theme.cardBack}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>

    {/* WHEEL WINNER CELEBRATION MODAL OVERLAY */}
    <AnimatePresence>
        {showSpinModal && spinWinner && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" id="wheel-payout-modal">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass p-8 max-w-sm w-full text-center space-y-4"
            >
              <div className="w-16 h-16 bg-yellow-500/10 border border-yellow-500/20 rounded-full flex items-center justify-center mx-auto text-yellow-400 shadow-xl shadow-yellow-500/5">
                <Sparkles className="w-8 h-8 animate-bounce" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">CONGRATULATIONS!</h3>
                <p className="text-xs text-slate-350 mt-1.5 leading-relaxed">
                  You successfully spun the Lucky Spades Wheel and landed on a grand reward:
                </p>
                <div className="my-5 p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <span className="text-2xl font-black text-amber-400 font-mono tracking-tight">
                    {spinWinner.text}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowSpinModal(false)}
                className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-slate-950 font-black rounded-xl text-xs cursor-pointer shadow-md"
              >
                Claim Reward &amp; Exit
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
