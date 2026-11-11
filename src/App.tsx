/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Trophy, Award, Landmark, HelpCircle, Info, Globe, Gift, Coins, Sparkles, MapPin, Play,
  Heart, Volume2, X, User, AlertCircle, Palette, LogIn, LogOut, Cloud, CloudOff, RefreshCw
} from 'lucide-react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  auth, 
  signInWithGoogle, 
  logOutUser, 
  syncUserProfile, 
  updateUserProfile, 
  testConnection 
} from './utils/firebase';
import AITable from './components/AITable';
import ScoreTracker from './components/ScoreTracker';
import LingoDictionary from './components/LingoDictionary';
import LoungeMap from './components/LoungeMap';
import RewardsHub from './components/RewardsHub';
import { LoungeRoom, SoloProgression } from './types';

type TabType = 'table' | 'tracker' | 'dictionary' | 'maps' | 'rewards';

// Custom Avatar Definition
interface PlayerAvatar {
  id: string;
  name: string;
  emoji: string;
  title: string;
  soundType: string;
  desc: string;
}

const AVATARS_LIST: PlayerAvatar[] = [
  { id: 'avatar_rookie', name: 'Ace Apprentice', emoji: '🐣', title: 'Rookie Bidding Partner', soundType: 'avatar_rookie', desc: 'Standard clean synthesizer wave with a fast pitch.' },
  { id: 'avatar_pro', name: 'Slick Sluffer', emoji: '🦊', title: 'Pro Spades Specialist', soundType: 'avatar_pro', desc: 'An upbeat 3-tone arpeggio wave of progressive chords.' },
  { id: 'avatar_cyber', name: 'Neo Renegade', emoji: '🤖', title: 'Cyber-Felt Overlord', soundType: 'avatar_cyber', desc: 'A custom retro sci-fi frequency sweep for technical play.' },
  { id: 'avatar_legend', name: 'Spades Grandmaster', emoji: '👑', title: 'Legendary Spade Master', soundType: 'avatar_legend', desc: 'A rich major pentatonic brass fanfare of elite victory.' },
];

export interface AppTheme {
  id: string;
  name: string;
  emoji: string;
  backgroundClass: string;
  bgGradient: string;
  bgSolid: string;
  primaryColor: string;
  primaryHover: string;
  primaryShadow: string;
  primaryRgb: string;
  textAccent: string;
  fontFamily: string;
  cardBack: string;
  description: string;
}

export const THEMES_LIST: AppTheme[] = [
  {
    id: 'theme_cyber',
    name: 'Cosmic Cyber',
    emoji: '🌌',
    backgroundClass: 'bg-slate-950',
    bgGradient: 'radial-gradient(circle at 20% 30%, #0c1a3e 0%, transparent 45%), radial-gradient(circle at 80% 20%, #2e0c3e 0%, transparent 45%), radial-gradient(circle at 50% 80%, #061110 0%, transparent 50%)',
    bgSolid: '#061110',
    primaryColor: '#6366f1', // Indigo 500
    primaryHover: '#4f46e5', // Indigo 600
    primaryShadow: 'rgba(99, 102, 241, 0.4)',
    primaryRgb: '99, 102, 241',
    textAccent: 'text-indigo-400',
    fontFamily: 'font-sans',
    cardBack: 'deck_neon',
    description: 'The standard elite cyberpunk-felt vibe. Neon indigo/violet ambient backdrops and futuristic faces.'
  },
  {
    id: 'theme_emerald',
    name: 'Emerald Felt',
    emoji: '💚',
    backgroundClass: 'bg-emerald-950',
    bgGradient: 'radial-gradient(circle at 20% 30%, #022c22 0%, transparent 45%), radial-gradient(circle at 80% 20%, #064e3b 0%, transparent 45%), radial-gradient(circle at 50% 80%, #042f1a 0%, transparent 50%)',
    bgSolid: '#021a12',
    primaryColor: '#10b981', // Emerald 500
    primaryHover: '#059669', // Emerald 600
    primaryShadow: 'rgba(16, 185, 129, 0.4)',
    primaryRgb: '16, 185, 129',
    textAccent: 'text-emerald-400',
    fontFamily: 'font-sans',
    cardBack: 'deck_classic',
    description: 'Deep professional casino green felt. Traditional golden trims and high stakes luxury.'
  },
  {
    id: 'theme_amethyst',
    name: 'Royal Amethyst',
    emoji: '🔮',
    backgroundClass: 'bg-purple-950',
    bgGradient: 'radial-gradient(circle at 20% 30%, #1e1b4b 0%, transparent 45%), radial-gradient(circle at 80% 20%, #3b0764 0%, transparent 45%), radial-gradient(circle at 50% 80%, #581c87 0%, transparent 50%)',
    bgSolid: '#0b0314',
    primaryColor: '#a855f7', // Purple 500
    primaryHover: '#9333ea', // Purple 600
    primaryShadow: 'rgba(168, 85, 247, 0.4)',
    primaryRgb: '168, 85, 247',
    textAccent: 'text-purple-400',
    fontFamily: 'font-sans',
    cardBack: 'deck_gold',
    description: 'Regal majesty with deep dark grape gradients and brilliant royal gold highlights.'
  },
  {
    id: 'theme_mahogany',
    name: 'Vintage Mahogany',
    emoji: '🪵',
    backgroundClass: 'bg-amber-950',
    bgGradient: 'radial-gradient(circle at 20% 30%, #1c1917 0%, transparent 45%), radial-gradient(circle at 80% 20%, #451a03 0%, transparent 45%), radial-gradient(circle at 50% 80%, #292524 0%, transparent 50%)',
    bgSolid: '#110b06',
    primaryColor: '#f59e0b', // Amber 500
    primaryHover: '#d97706', // Amber 600
    primaryShadow: 'rgba(245, 158, 11, 0.4)',
    primaryRgb: '245, 158, 11',
    textAccent: 'text-amber-400',
    fontFamily: 'font-mono',
    cardBack: 'deck_gold',
    description: 'Prestige private-club wood veneer with warm brass borders and traditional typeface.'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('table');

  // Firebase Auth and sync states
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Solo Progression State (Chips, Tickets, Level, XP, Streak)
  const [soloProgress, setSoloProgress] = useState<SoloProgression>(() => {
    const saved = localStorage.getItem('spades_solo_progress_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      chips: 2500, // Starts with a generous 2,500 buy-in chips!
      sweepstakesTickets: 3,
      xp: 120,
      level: 1,
      activeSweepstakesEntries: 0,
      streakDays: 1
    };
  });

  // Active Lounge Room (Google Maps selection)
  const [activeLounge, setActiveLounge] = useState<LoungeRoom>({
    id: 'lounge_harlem',
    name: 'Harlem Ace of Spades Club',
    city: 'New York, USA',
    lat: 40.8116,
    lng: -73.9465,
    entryFee: 100,
    prizePool: 250,
    minLevel: 1,
    description: 'The historic cradle of street Spades. Fast bidding, tight scorekeeping, and absolute respect for the Nil.',
    isUnlocked: true
  });

  // Purchased card skins backing style
  const [activeDeckStyle, setActiveDeckStyle] = useState<string>(() => {
    return localStorage.getItem('spades_active_deck_style_v1') || 'deck_classic';
  });

  // Active App Theme state
  const [activeThemeId, setActiveThemeId] = useState<string>(() => {
    return localStorage.getItem('spades_active_theme_id_v1') || 'theme_cyber';
  });

  // Active player avatar
  const [activeAvatar, setActiveAvatar] = useState<string>(() => {
    return localStorage.getItem('spades_active_avatar_v1') || 'avatar_rookie';
  });

  // Daily login & achievement state
  const [showDailyLoginModal, setShowDailyLoginModal] = useState(false);
  const [dailyRewardMessage, setDailyRewardMessage] = useState('');
  const [achievementAlert, setAchievementAlert] = useState<{ title: string; desc: string; icon: string } | null>(null);

  // Sound generator for avatar/achievements using Web Audio API
  const playAvatarSound = (avatarId: string) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (avatarId === 'avatar_rookie') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(329.63, audioCtx.currentTime); // E4
        osc.frequency.setValueAtTime(392.00, audioCtx.currentTime + 0.1); // G4
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else if (avatarId === 'avatar_pro') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(261.63, audioCtx.currentTime); // C4
        osc.frequency.setValueAtTime(329.63, audioCtx.currentTime + 0.08); // E4
        osc.frequency.setValueAtTime(392.00, audioCtx.currentTime + 0.16); // G4
        gain.gain.setValueAtTime(0.07, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      } else if (avatarId === 'avatar_cyber') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else if (avatarId === 'avatar_legend') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.07); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.14); // G5
        osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.21); // C6
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.55);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.55);
      } else {
        // Generic reward chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      }
    } catch (e) {}
  };

  // Check login streak on mount
  useEffect(() => {
    const lastLoginDate = localStorage.getItem('spades_last_login_date_v1');
    const todayStr = new Date().toISOString().split('T')[0];

    if (lastLoginDate !== todayStr) {
      let newStreak = soloProgress.streakDays;

      if (lastLoginDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (lastLoginDate === yesterdayStr) {
          newStreak = (soloProgress.streakDays % 7) + 1;
        } else {
          newStreak = 1;
        }
      } else {
        newStreak = 1;
      }

      // Calculate rewards
      let chipsReward = 150;
      let ticketReward = 0;
      let msg = '';

      if (newStreak === 3) {
        chipsReward = 250;
        ticketReward = 1;
        msg = "Day 3 Streak! You earned +250 Coins 💰 & +1 Sweepstakes Ticket 🎟️!";
      } else if (newStreak === 5) {
        chipsReward = 450;
        ticketReward = 2;
        msg = "Day 5 Combo! You earned +450 Coins 💰 & +2 Sweepstakes Tickets 🎟️!";
      } else if (newStreak === 7) {
        chipsReward = 1000;
        ticketReward = 5;
        msg = "Day 7 Perfect Weekly Streak! Jackpot: +1,000 Coins 💰, +5 Sweepstakes Tickets 🎟️, and unlocked the Legendary Grandmaster badge!";
      } else {
        chipsReward = 100 + newStreak * 50;
        msg = `Day ${newStreak} login streak! You claimed +${chipsReward} Coins 💰!`;
      }

      handleUpdateProgress({
        chips: soloProgress.chips + chipsReward,
        sweepstakesTickets: soloProgress.sweepstakesTickets + ticketReward,
        streakDays: newStreak
      });

      setDailyRewardMessage(msg);
      localStorage.setItem('spades_last_login_date_v1', todayStr);

      setTimeout(() => {
        setShowDailyLoginModal(true);
        playAvatarSound('avatar_legend'); // Play signature triumphant startup tone
        
        setAchievementAlert({
          title: "Streak Commenced!",
          desc: `Logged in for ${newStreak} consecutive days! Keep up the hearts!`,
          icon: "❤️"
        });

        setTimeout(() => {
          setAchievementAlert(null);
        }, 5000);

      }, 1000);
    }
  }, []);

  // Firebase Auth Subscription and Cloud Sync on Mount
  useEffect(() => {
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsSyncing(true);
        try {
          // Pre-populate with local configurations if no cloud profile exists
          const localProgress = JSON.parse(localStorage.getItem('spades_solo_progress_v1') || '{}');
          const localTheme = localStorage.getItem('spades_active_theme_id_v1') || 'theme_cyber';
          const localAvatar = localStorage.getItem('spades_active_avatar_v1') || 'avatar_rookie';
          const localDeck = localStorage.getItem('spades_active_deck_style_v1') || 'deck_classic';
          const localPurchasedDecks = JSON.parse(localStorage.getItem('spades_purchased_decks_v1') || '["deck_classic"]');

          const profile = await syncUserProfile(
            user,
            Object.keys(localProgress).length ? localProgress : undefined,
            localTheme,
            localAvatar,
            localDeck,
            localPurchasedDecks
          );

          if (profile) {
            // Restore local progression returned by the preference sync adapter
            setSoloProgress({
              chips: profile.chips,
              sweepstakesTickets: profile.sweepstakesTickets,
              xp: profile.xp,
              level: profile.level,
              activeSweepstakesEntries: profile.activeSweepstakesEntries,
              streakDays: profile.streakDays
            });
            setActiveThemeId(profile.themeId);
            setActiveAvatar(profile.avatarId);
            setActiveDeckStyle(profile.deckStyle);
            localStorage.setItem('spades_purchased_decks_v1', JSON.stringify(profile.purchasedDecks));
          }
          setCurrentUser(user);
        } catch (err) {
          console.error("Profile synchronization error:", err);
        } finally {
          setIsSyncing(false);
        }
      } else {
        setCurrentUser(null);
      }
      setAuthInitialized(true);
    });

    return () => unsubscribe();
  }, []);

  // Save progression locally only. Firestore client writes to balances/tickets/XP/levels
  // remain disabled until the server-authoritative wallet ledger is deployed and enabled.
  useEffect(() => {
    localStorage.setItem('spades_solo_progress_v1', JSON.stringify(soloProgress));
  }, [soloProgress]);

  // Save Avatar Selection
  useEffect(() => {
    localStorage.setItem('spades_active_avatar_v1', activeAvatar);
    if (currentUser) {
      updateUserProfile(currentUser.uid, {
        avatarId: activeAvatar
      }).catch(err => console.error("Cloud avatar sync failed:", err));
    }
  }, [activeAvatar, currentUser]);

  // Save Card Deck Style Selection
  useEffect(() => {
    localStorage.setItem('spades_active_deck_style_v1', activeDeckStyle);
    if (currentUser) {
      updateUserProfile(currentUser.uid, {
        deckStyle: activeDeckStyle
      }).catch(err => console.error("Cloud deck style sync failed:", err));
    }
  }, [activeDeckStyle, currentUser]);

  // Synchronize CSS custom properties with the active premium theme
  useEffect(() => {
    const theme = THEMES_LIST.find(t => t.id === activeThemeId) || THEMES_LIST[0];
    const root = document.documentElement;
    root.style.setProperty('--theme-bg-gradient', theme.bgGradient);
    root.style.setProperty('--theme-bg-solid', theme.bgSolid);
    root.style.setProperty('--theme-primary-color', theme.primaryColor);
    root.style.setProperty('--theme-primary-hover', theme.primaryHover);
    root.style.setProperty('--theme-primary-shadow', theme.primaryShadow);
    root.style.setProperty('--theme-primary-rgb', theme.primaryRgb);
  }, [activeThemeId]);

  const handleSelectTheme = (themeId: string) => {
    setActiveThemeId(themeId);
    localStorage.setItem('spades_active_theme_id_v1', themeId);

    // Coordinate the card backing with the selected theme's style
    const themeObj = THEMES_LIST.find(t => t.id === themeId);
    if (themeObj) {
      setActiveDeckStyle(themeObj.cardBack);
      if (currentUser) {
        updateUserProfile(currentUser.uid, {
          themeId: themeId,
          deckStyle: themeObj.cardBack
        }).catch(err => console.error("Cloud theme sync failed:", err));
      }
    } else {
      if (currentUser) {
        updateUserProfile(currentUser.uid, {
          themeId: themeId
        }).catch(err => console.error("Cloud theme sync failed:", err));
      }
    }
  };

  const handleUpdateProgress = (updates: Partial<SoloProgression>) => {
    setSoloProgress(prev => ({
      ...prev,
      ...updates
    }));
  };

  const handleSelectLounge = (lounge: LoungeRoom) => {
    setActiveLounge(lounge);
    setActiveTab('table'); // Auto-switch back to the practice table to start playing!
  };

  // Test Bypass: Simulate another login day
  const handleTestBypassLogin = () => {
    localStorage.removeItem('spades_last_login_date_v1');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    localStorage.setItem('spades_last_login_date_v1', yesterday.toISOString().split('T')[0]);
    alert("⚡ Dev Shortcut: Login cooldown reset. The app will now check your daily login!");
    window.location.reload();
  };

  return (
    <div className="min-h-screen text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-300 relative pb-12 animate-fadeIn" id="app-root">
      
      {/* GLOWING MESH BACKDROP */}
      <div className="mesh-gradient absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950/40 pointer-events-none -z-10" />
      
      {/* FLOATING ACHIEVEMENT ALERT NOTIFICATION */}
      {achievementAlert && (
        <div className="fixed top-24 right-4 z-50 max-w-sm w-full bg-slate-900/95 border-2 border-indigo-500/50 backdrop-blur-md rounded-2xl p-4 shadow-2xl shadow-indigo-500/20 animate-scaleUp" id="floating-achievement-alert">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/35 flex items-center justify-center text-lg shrink-0">
              {achievementAlert.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-400">🏆 Achievement Unlocked!</h4>
              <p className="text-sm font-bold text-white mt-0.5">{achievementAlert.title}</p>
              <p className="text-xs text-slate-300 mt-1 leading-snug">{achievementAlert.desc}</p>
            </div>
            <button 
              onClick={() => setAchievementAlert(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row items-center justify-between gap-4">
          
          {/* Logo Brand with animated sparkles */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/15 text-slate-950 select-none animate-pulse">
              ♠
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-400 bg-clip-text text-transparent">
                  Spades Is My Lingo™
                </h1>
                <span className="text-[9px] px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-extrabold rounded-full tracking-wider uppercase">
                  Elite Plus
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                The ultimate companion for Spades players &amp; sweepstakes entries
              </p>
            </div>
          </div>

          {/* Active Player Avatar badge and Firebase Cloud Sync controls */}
          <div className="flex flex-wrap items-center gap-3 shrink-0" id="header-avatar-auth-container">
            {(() => {
              const currentAv = AVATARS_LIST.find(a => a.id === activeAvatar) || AVATARS_LIST[0];
              return (
                <div 
                  onClick={() => {
                    setShowDailyLoginModal(true);
                    playAvatarSound(activeAvatar);
                  }}
                  className="flex items-center gap-3 px-3.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 rounded-xl cursor-pointer transition-all shrink-0 select-none"
                  title="Click to view Streak & change your Avatar Sound!"
                  id="header-avatar-badge"
                >
                  <span className="text-2xl animate-bounce">{currentAv.emoji}</span>
                  <div className="text-left">
                    <div className="text-[9px] text-slate-400 font-bold leading-none uppercase">MY AVATAR</div>
                    <div className="text-xs font-black text-indigo-300 mt-1 leading-none flex items-center gap-1">
                      {currentAv.name}
                      <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Firebase Cloud Synchronization Section */}
            {authInitialized ? (
              currentUser ? (
                <div className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl select-none" id="firebase-sync-badge">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <div className="text-left">
                    <div className="text-[8px] text-emerald-400 font-black leading-none uppercase flex items-center gap-1">
                      <Cloud className="w-3 h-3 text-emerald-400" />
                      Cloud Sync
                    </div>
                    <div className="text-[10px] font-bold text-slate-300 mt-1 leading-none max-w-[100px] truncate" title={currentUser.email || undefined}>
                      {currentUser.displayName?.split(' ')[0] || 'Synced'}
                    </div>
                  </div>
                  <button
                    onClick={() => logOutUser().catch(e => console.error(e))}
                    className="p-1 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 rounded-lg cursor-pointer transition-all ml-1"
                    title="Disconnect Google Cloud Backup"
                    id="firebase-logout-btn"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => signInWithGoogle().catch(e => console.error(e))}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/30 text-white font-extrabold rounded-xl text-xs cursor-pointer transition-all shadow-lg hover:shadow-indigo-500/15 active:scale-98"
                  id="firebase-login-btn"
                  title="Link Google account to back up progression & scoresheets to Firestore."
                >
                  <LogIn className="w-3.5 h-3.5 shrink-0 text-white animate-pulse" />
                  <span className="font-bold">Sync Progress</span>
                  {isSyncing && <RefreshCw className="w-3 h-3 animate-spin text-white" />}
                </button>
              )
            ) : (
              <div className="px-3.5 py-1.5 bg-white/5 border border-white/10 text-slate-400 text-xs rounded-xl flex items-center gap-2 select-none" id="firebase-loading-badge">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
                <span className="font-bold text-[10px] text-slate-500 uppercase">Auth Loading...</span>
              </div>
            )}
          </div>

          {/* Quick Player Stats Bar */}
          <div className="hidden sm:flex items-center gap-4 py-1.5 px-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-mono">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <Coins className="w-4 h-4 text-amber-500" />
              <span>💰 {soloProgress.chips.toLocaleString()} Coins</span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
              <Gift className="w-4 h-4 text-indigo-400" />
              <span>🎟️ {soloProgress.sweepstakesTickets} Tickets</span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Award className="w-4 h-4 text-emerald-500 animate-pulse" />
              <span>⭐ Level {soloProgress.level} ({soloProgress.xp}/500 XP)</span>
            </div>
          </div>

          {/* Nav tabs selector */}
          <nav className="flex flex-wrap gap-1.5 bg-white/5 p-1.5 rounded-xl border border-white/10" id="app-navigation-tabs">
            <button
              onClick={() => setActiveTab('table')}
              className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'table'
                  ? 'theme-bg-primary text-slate-950 font-black shadow-md theme-shadow-primary'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              id="tab-btn-table"
            >
              <Trophy className="w-3.5 h-3.5 shrink-0" />
              Table
            </button>
            <button
              onClick={() => setActiveTab('maps')}
              className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'maps'
                  ? 'theme-bg-primary text-slate-950 font-black shadow-md theme-shadow-primary'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              id="tab-btn-maps"
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              Lounges (Maps)
            </button>
            <button
              onClick={() => setActiveTab('rewards')}
              className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'rewards'
                  ? 'theme-bg-primary text-slate-950 font-black shadow-md theme-shadow-primary'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              id="tab-btn-rewards"
            >
              <Gift className="w-3.5 h-3.5 shrink-0" />
              Rewards Hub
            </button>
            <button
              onClick={() => setActiveTab('tracker')}
              className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'tracker'
                  ? 'theme-bg-primary text-slate-950 font-black shadow-md theme-shadow-primary'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              id="tab-btn-tracker"
            >
              <Landmark className="w-3.5 h-3.5 shrink-0" />
              Scorekeeper
            </button>
            <button
              onClick={() => setActiveTab('dictionary')}
              className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'dictionary'
                  ? 'theme-bg-primary text-slate-950 font-black shadow-md theme-shadow-primary'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              id="tab-btn-dictionary"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              Glossary
            </button>
            
            {/* Direct access to Daily Streaks and Soundboard */}
            <button
              onClick={() => {
                setShowDailyLoginModal(true);
                playAvatarSound(activeAvatar);
              }}
              className="px-3 py-2 rounded-lg text-[11px] font-bold text-pink-400 border border-pink-500/10 bg-pink-500/5 hover:bg-pink-500/15 hover:text-pink-300 transition-all flex items-center gap-1.5 cursor-pointer"
              id="tab-btn-streak-audio"
            >
              <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500 animate-pulse" />
              Daily ❤️ Streak
            </button>
          </nav>

        </div>
      </header>

      {/* BODY CONTENT ROUTER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Intro informational banner */}
        {activeTab === 'table' && (
          <div className="mb-6 p-4 glass flex flex-col sm:flex-row sm:items-center justify-between gap-4" id="intro-info-table">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 mt-0.5 shrink-0">
                <MapPin className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-200">
                    Playing in {activeLounge.name} 📍 {activeLounge.city}
                  </h4>
                  <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded uppercase">
                    Prize Pool: {activeLounge.prizePool} 💰
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {activeLounge.description} Custom deck skin <strong>{activeDeckStyle === 'deck_classic' ? 'Standard Blue' : activeDeckStyle === 'deck_gold' ? 'Elite Gold' : 'Cyber Neon'}</strong> loaded. Win to claim the jackpot!
                </p>
              </div>
            </div>

            {/* Test Reset Cooldown Banner Button */}
            <button 
              onClick={handleTestBypassLogin}
              className="text-[10px] font-mono px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl cursor-pointer transition-all"
              id="intro-test-reset-btn"
            >
              ⚡ Test Daily Check
            </button>
          </div>
        )}

        {/* ACTIVE TAB VIEWS */}
        <div className="animate-fadeIn">
          {activeTab === 'table' && (
            <AITable 
              soloProgress={soloProgress} 
              onUpdateProgress={handleUpdateProgress} 
              deckStyle={activeDeckStyle}
            />
          )}
          {activeTab === 'maps' && (
            <LoungeMap 
              soloProgress={soloProgress} 
              onSelectLounge={handleSelectLounge} 
              onUpdateProgress={handleUpdateProgress}
              activeLounge={activeLounge}
            />
          )}
          {activeTab === 'rewards' && (
            <RewardsHub 
              soloProgress={soloProgress} 
              onUpdateProgress={handleUpdateProgress}
              activeDeckStyle={activeDeckStyle}
              onSelectDeckStyle={setActiveDeckStyle}
              activeThemeId={activeThemeId}
              onSelectTheme={handleSelectTheme}
            />
          )}
          {activeTab === 'tracker' && <ScoreTracker currentUser={currentUser} />}
          {activeTab === 'dictionary' && <LingoDictionary />}
        </div>

      </main>

      {/* FOOTER SECTION */}
      <footer className="border-t border-white/10 mt-16 py-8 bg-slate-900/20 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-semibold text-slate-400">Spades Is My Lingo™</p>
          <p className="mt-1">
            Built as a comprehensive full-stack Spades tournament deck for the elite Lingo Legacy sweepstakes network.
          </p>
          <p className="text-[10px] text-slate-600 mt-3 font-mono">
            Secure Server-Side Gemini API Proxy • Google Maps Rooms V1 • Web Audio Soundwaves.
          </p>
        </div>
      </footer>

      {/* DAILY ❤️ LOGIN STREAK & PLAYER AVATAR SOUND BOARD MODAL */}
      {showDailyLoginModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn" id="daily-streak-modal-root">
          <div className="bg-slate-900/95 border-2 border-indigo-500/30 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl shadow-indigo-500/20 text-slate-100">
            
            {/* Header banner */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-2xl text-pink-500 animate-pulse">
                  ❤️
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Daily Login Heart Streak!</h3>
                  <p className="text-xs text-slate-400 font-mono">Current Streak: {soloProgress.streakDays} Days in a row</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDailyLoginModal(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-all text-slate-400 hover:text-white"
                id="close-streak-modal-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Daily Streak Map (7 Days of Rewards) */}
            <div className="space-y-3">
              <h4 className="text-xs font-black tracking-widest text-slate-400 uppercase">Weekly Reward Path</h4>
              <div className="grid grid-cols-7 gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                  const isActive = day <= soloProgress.streakDays;
                  const isCurrent = day === soloProgress.streakDays;
                  
                  // Reward details
                  let rewardLabel = `+${100 + day * 50}💰`;
                  if (day === 3) rewardLabel = "+250💰 +1🎟️";
                  if (day === 5) rewardLabel = "+450💰 +2🎟️";
                  if (day === 7) rewardLabel = "+1000💰 +5🎟️ 👑";

                  return (
                    <div 
                      key={day} 
                      className={`p-3 rounded-2xl flex flex-col items-center text-center justify-between gap-1 border transition-all ${
                        isActive
                          ? 'bg-gradient-to-b from-pink-500/10 to-indigo-500/10 border-pink-500/40 shadow-lg shadow-pink-500/5'
                          : 'bg-white/5 border-white/5 opacity-60'
                      } ${isCurrent ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900 scale-103' : ''}`}
                    >
                      <span className="text-[10px] font-black text-slate-400">Day {day}</span>
                      <Heart 
                        className={`w-6 h-6 my-1 transition-all ${
                          isActive 
                            ? 'text-pink-500 fill-pink-500 scale-110 drop-shadow-[0_0_8px_rgba(236,72,153,0.4)]' 
                            : 'text-slate-600'
                        }`} 
                      />
                      <span className="text-[8px] font-black font-mono leading-tight">{rewardLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Display custom claim alert message */}
            {dailyRewardMessage && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex items-center gap-3 animate-scaleUp">
                <div className="text-2xl">🎉</div>
                <div>
                  <h5 className="text-xs font-black text-emerald-400 uppercase">Reward Claimed Today!</h5>
                  <p className="text-xs text-emerald-100 font-semibold mt-0.5">{dailyRewardMessage}</p>
                </div>
              </div>
            )}

            {/* INTERACTIVE CUSTOM PLAYER AVATAR SOUND BOARD */}
            <div className="space-y-4 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black tracking-widest text-slate-400 uppercase">Player Avatar Soundboard</h4>
                  <p className="text-[11px] text-slate-400">Equip custom avatars and trigger their nostalgic retro electronic audio frequencies!</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full font-bold font-mono text-indigo-300">
                  {AVATARS_LIST.length} AVATARS
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AVATARS_LIST.map((av) => {
                  const isSelected = activeAvatar === av.id;

                  return (
                    <div 
                      key={av.id}
                      onClick={() => {
                        setActiveAvatar(av.id);
                        playAvatarSound(av.id);
                      }}
                      className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer relative overflow-hidden group select-none ${
                        isSelected
                          ? 'bg-gradient-to-tr from-indigo-950/40 via-indigo-900/10 to-purple-950/20 border-indigo-500/50 shadow-xl'
                          : 'bg-white/5 border-white/5 hover:bg-white/8 hover:border-white/10'
                      }`}
                      id={`soundboard-avatar-${av.id}`}
                    >
                      {/* Active indicator dot */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-400 shadow-md animate-ping" />
                      )}

                      <span className="text-3xl p-1 bg-white/5 rounded-xl group-hover:scale-110 transition-transform shrink-0">
                        {av.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h5 className="text-xs font-black text-white group-hover:text-indigo-300 transition-colors">{av.name}</h5>
                        <p className="text-[9px] text-slate-400 font-bold leading-tight mt-0.5">{av.title}</p>
                        <p className="text-[10px] text-slate-400 mt-1.5 leading-normal">{av.desc}</p>

                        <div className="mt-2.5 flex items-center gap-1.5">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playAvatarSound(av.id);
                            }}
                            className="px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 text-[9px] font-black font-mono rounded flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <Volume2 className="w-3 h-3 text-indigo-400" />
                            TEST SOUNDWAVE
                          </button>
                          {isSelected && (
                            <span className="text-[9px] text-emerald-400 font-extrabold font-mono uppercase tracking-widest">
                              Equipped ✓
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
              <div className="text-[10px] text-slate-500 font-mono">
                Cooldown Reset: 24h intervals • Manual Test Bypass provided.
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button 
                  onClick={handleTestBypassLogin}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono text-xs font-bold rounded-xl cursor-pointer transition-all"
                  id="modal-test-bypass-btn"
                >
                  ⚡ Simulate Cooldown Reset
                </button>
                <button 
                  onClick={() => setShowDailyLoginModal(false)}
                  className="flex-1 sm:flex-initial px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-slate-950 text-xs font-black rounded-xl cursor-pointer shadow-lg shadow-indigo-500/15"
                  id="modal-dismiss-btn"
                >
                  Close &amp; Keep Playing Spades!
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
