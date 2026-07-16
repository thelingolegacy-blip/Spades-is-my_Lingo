/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { LoungeRoom, SoloProgression } from '../types';
import { Globe, MapPin, Sparkles, Award, Lock, Play, CreditCard } from 'lucide-react';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY' && API_KEY.trim() !== '';

const GLOBAL_LOUNGES: LoungeRoom[] = [
  {
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
  },
  {
    id: 'lounge_atlanta',
    name: 'Atlanta Renegers\' Alley',
    city: 'Georgia, USA',
    lat: 33.7490,
    lng: -84.3880,
    entryFee: 500,
    prizePool: 1200,
    minLevel: 2,
    description: 'Trash-talking central. Street rules apply. Hold on to your bags and watch your partner\'s leads!',
    isUnlocked: true
  },
  {
    id: 'lounge_chicago',
    name: 'Windy City Sandbaggers\' Club',
    city: 'Illinois, USA',
    lat: 41.8781,
    lng: -87.6298,
    entryFee: 2000,
    prizePool: 5000,
    minLevel: 3,
    description: 'A dark, smoky lounge where bags are a weapon. Keep your overtricks low or get penalized severely.',
    isUnlocked: false
  },
  {
    id: 'lounge_tokyo',
    name: 'Tokyo Neon Spades Garden',
    city: 'Shinjuku, Tokyo',
    lat: 35.6762,
    lng: 139.6503,
    entryFee: 10000,
    prizePool: 25000,
    minLevel: 5,
    description: 'An elite, high-tech tournament deck. Fast-paced AI players that calculate odds with perfect digital accuracy.',
    isUnlocked: false
  },
  {
    id: 'lounge_monaco',
    name: 'Monte Carlo Grand Casino Suite',
    city: 'Monte Carlo, Monaco',
    lat: 43.7384,
    lng: 7.4246,
    entryFee: 50000,
    prizePool: 150000,
    minLevel: 7,
    description: 'The absolute pinnacle of high-stakes Spades. Millions of chips on the table. Only elite grandmasters allowed.',
    isUnlocked: false
  }
];

interface LoungeMapProps {
  soloProgress: SoloProgression;
  onSelectLounge: (lounge: LoungeRoom) => void;
  onUpdateProgress: (updates: Partial<SoloProgression>) => void;
  activeLounge: LoungeRoom;
}

export default function LoungeMap({
  soloProgress,
  onSelectLounge,
  onUpdateProgress,
  activeLounge
}: LoungeMapProps) {
  const [selectedLounge, setSelectedLounge] = useState<LoungeRoom | null>(GLOBAL_LOUNGES[0]);
  const [hoveredLoungeId, setHoveredLoungeId] = useState<string | null>(null);
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [showKeySuccessMsg, setShowKeySuccessMsg] = useState(false);
  const [isMapAuthValid, setIsMapAuthValid] = useState(hasValidKey);

  // Catch Google Maps API Authentication Failures (InvalidKeyMapError)
  React.useEffect(() => {
    const handleAuthFailure = () => {
      console.warn("Google Maps API: InvalidKeyMapError detected. Gracefully falling back to Simulation Mode.");
      setIsMapAuthValid(false);
    };

    (window as any).gm_authFailure = handleAuthFailure;

    return () => {
      if ((window as any).gm_authFailure === handleAuthFailure) {
        delete (window as any).gm_authFailure;
      }
    };
  }, []);

  // Helper to check if a lounge is unlocked based on player level
  const isUnlockedByLevel = (lounge: LoungeRoom) => {
    return soloProgress.level >= lounge.minLevel;
  };

  // Select or buy-in to lounge
  const handleJoinLounge = (lounge: LoungeRoom) => {
    if (!isUnlockedByLevel(lounge)) {
      alert(`This lounge is locked! You must reach Level ${lounge.minLevel} to unlock it. Complete AI practice tables to earn XP!`);
      return;
    }

    if (soloProgress.chips < lounge.entryFee) {
      alert(`Insufficient Chips! The entry fee for ${lounge.name} is ${lounge.entryFee} chips, but you only have ${soloProgress.chips}. Watch a sponsored ad in the Rewards Hub to claim free chips!`);
      return;
    }

    // Deduct entry fee
    onUpdateProgress({ chips: soloProgress.chips - lounge.entryFee });
    onSelectLounge(lounge);
    
    // Play sound (simulated by standard audio beep if enabled)
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {}

    alert(`Successfully bought into ${lounge.name}! Deducted ${lounge.entryFee} entry chips. Your table is set with a ${lounge.prizePool} chip prize pool!`);
  };

  return (
    <div className="glass p-6 max-w-7xl mx-auto space-y-6" id="google-maps-rooms-container">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Globe className="w-5 h-5 animate-spin-slow" />
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Google Maps Rooms: Global Spades Lounges
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Fly around the world and enter high-stakes tournaments. Buy in with chips, claim victory, and win massive coin prize pools!
          </p>
        </div>

        {/* User Balance Bar */}
        <div className="flex items-center gap-3 bg-slate-900/55 p-2 rounded-xl border border-white/10 shrink-0">
          <div className="text-xs px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-lg font-black font-mono">
            💰 {soloProgress.chips.toLocaleString()} CHIPS
          </div>
          <div className="text-xs px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-lg font-black font-mono">
            ⭐ LEVEL {soloProgress.level} ({soloProgress.xp} XP)
          </div>
        </div>
      </div>

      {/* MAP + SIDEBAR BOX */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LOBBY LOUNGES SIDEBAR */}
        <div className="lg:col-span-1 space-y-3 max-h-[500px] overflow-y-auto pr-1" id="lounge-rooms-sidebar">
          <h3 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-2">
            Select Tournament Lounge
          </h3>
          {GLOBAL_LOUNGES.map((lounge) => {
            const unlocked = isUnlockedByLevel(lounge);
            const active = selectedLounge?.id === lounge.id;
            const currentPlaying = activeLounge.id === lounge.id;

            return (
              <div
                key={lounge.id}
                onClick={() => setSelectedLounge(lounge)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 relative overflow-hidden ${
                  active 
                    ? 'bg-indigo-500/10 border-indigo-500/40 shadow-md shadow-indigo-500/5' 
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                }`}
                id={`lounge-list-item-${lounge.id}`}
              >
                {/* Active marker glow */}
                {currentPlaying && (
                  <div className="absolute top-2 right-2 bg-emerald-500 text-slate-950 text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide animate-pulse">
                    ACTIVE TABLE
                  </div>
                )}

                {/* Left icon marker */}
                <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                  unlocked 
                    ? active ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'
                    : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {unlocked ? <MapPin className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-white truncate flex items-center gap-1.5">
                    {lounge.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                    {lounge.city}
                  </p>
                  
                  {/* Stats overlay */}
                  <div className="flex items-center gap-3 mt-3 text-[10px] font-bold">
                    <span className="text-slate-350">
                      Fee: <span className="text-amber-400">{lounge.entryFee} 💰</span>
                    </span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-350">
                      Prize: <span className="text-emerald-400">{lounge.prizePool} 💰</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* INTERACTIVE MAP INTEGRATION CONTAINER */}
        <div className="lg:col-span-2 bg-slate-950/60 rounded-3xl overflow-hidden border border-white/10 min-h-[350px] lg:min-h-[500px] flex flex-col relative" id="interactive-maps-canvas">
          
          {isMapAuthValid ? (
            /* REAL GOOGLE MAPS COMPONENT */
            <APIProvider apiKey={API_KEY} version="weekly">
              <div className="w-full h-full flex-1 relative min-h-[350px]">
                <Map
                  defaultCenter={{ lat: 30, lng: -20 }}
                  defaultZoom={2}
                  mapId="SPADES_LOUNGE_MAP"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  style={{ width: '100%', height: '100%', minHeight: '350px' }}
                  gestureHandling={'cooperative'}
                  disableDefaultUI={true}
                >
                  {GLOBAL_LOUNGES.map((lounge) => {
                    const unlocked = isUnlockedByLevel(lounge);
                    return (
                      <AdvancedMarker
                        key={lounge.id}
                        position={{ lat: lounge.lat, lng: lounge.lng }}
                        title={lounge.name}
                        onClick={() => setSelectedLounge(lounge)}
                      >
                        <Pin 
                          background={unlocked ? (selectedLounge?.id === lounge.id ? '#6366f1' : '#10b981') : '#f43f5e'} 
                          glyphColor="#fff"
                          borderColor="#1e293b"
                        />
                      </AdvancedMarker>
                    );
                  })}
                </Map>
              </div>
            </APIProvider>
          ) : (
            /* DECORATIVE HIGH-POLISHED MAP VISUAL FALLBACK */
            <div className="flex-1 w-full flex flex-col items-center justify-center p-8 text-center relative bg-gradient-to-b from-slate-900 to-slate-950 overflow-hidden" id="maps-mock-fallback">
              
              {/* Spinning grid bg */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06)_0%,transparent_60%)] pointer-events-none" />
              <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
 
              <div className="relative z-10 space-y-4 max-w-md">
                <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto text-rose-400 shadow-xl shadow-rose-500/5">
                  <Globe className="w-8 h-8 animate-spin-slow text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Google Maps API: Simulation Mode</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    You are in **Simulation Mode** because the Google Maps API key is either undeclared or invalid. 
                    No worries! You can still explore all global Spades lounges and enter high-stakes rooms seamlessly using high-fidelity simulated coordinates!
                  </p>
                </div>
 
                {/* API Key Setup Information block */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-left space-y-2">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                    Setup instructions to enable live Google Maps:
                  </span>
                  <ol className="text-[11px] text-slate-350 list-decimal pl-4 space-y-1">
                    <li>Get an API key from Google Cloud Console</li>
                    <li>Open <strong>Settings</strong> (⚙️ gear, top right) → <strong>Secrets</strong></li>
                    <li>Add <code>GOOGLE_MAPS_PLATFORM_KEY</code> and paste your key</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE SELECTED CARD DETAILS OVERLAY */}
          {selectedLounge && (
            <div className="p-5 bg-slate-900/90 border-t border-white/10 backdrop-blur-md relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeIn" id="lounge-details-overlay">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded font-bold font-mono">
                    📍 {selectedLounge.city}
                  </span>
                  {!isUnlockedByLevel(selectedLounge) && (
                    <span className="text-xs px-2 py-0.5 bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded font-black flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Lock (Level {selectedLounge.minLevel})
                    </span>
                  )}
                </div>
                <h3 className="text-base font-black text-white">{selectedLounge.name}</h3>
                <p className="text-xs text-slate-350 leading-relaxed max-w-xl">
                  {selectedLounge.description}
                </p>
              </div>

              <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto shrink-0">
                <div className="flex-1 md:text-right">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">PRIZE POOL</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    💰 {selectedLounge.prizePool.toLocaleString()}
                  </span>
                </div>

                <button
                  onClick={() => handleJoinLounge(selectedLounge)}
                  disabled={!isUnlockedByLevel(selectedLounge)}
                  className={`py-2 px-5 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all w-full ${
                    isUnlockedByLevel(selectedLounge)
                      ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-600 shadow-md shadow-emerald-500/10 cursor-pointer hover:scale-105'
                      : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                  }`}
                  id="join-lounge-submit"
                >
                  <Play className="w-4.5 h-4.5 fill-current" />
                  <span>Buy In ({selectedLounge.entryFee} 💰)</span>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
