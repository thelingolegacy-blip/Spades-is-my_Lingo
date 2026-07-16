/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, RotateCcw, AlertTriangle, ShieldAlert, Award, ArrowUpRight, ArrowDownRight, Edit2, Check, Cloud, Save, Trash, Download, RefreshCw, UploadCloud, CheckCircle } from 'lucide-react';
import { TrackerState, TrackerRound } from '../types';
import { calculateTeamRoundScore } from '../utils/spadesLogic';
import { saveScorecardSession, getScorecardSessions, deleteScorecardSession } from '../utils/firebase';

const DEFAULT_STATE: TrackerState = {
  teamA: { name: 'Team Us', score: 0, bags: 0 },
  teamB: { name: 'Team Them', score: 0, bags: 0 },
  rounds: [],
  winningScore: 500
};

interface ScoreTrackerProps {
  currentUser?: any;
}

export default function ScoreTracker({ currentUser }: ScoreTrackerProps) {
  const [state, setState] = useState<TrackerState>(() => {
    const saved = localStorage.getItem('spades_lingo_tracker_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_STATE;
      }
    }
    return DEFAULT_STATE;
  });

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('spades_lingo_tracker_v1', JSON.stringify(state));
  }, [state]);

  // Cloud Sync state variables
  const [activeInfoTab, setActiveInfoTab] = useState<'rules' | 'sync'>('rules');
  const [cloudSessions, setCloudSessions] = useState<any[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);

  const fetchCloudHistory = async () => {
    if (!currentUser) return;
    setIsLoadingCloud(true);
    try {
      const history = await getScorecardSessions(currentUser.uid);
      setCloudSessions(history);
    } catch (err) {
      console.error("Failed to fetch cloud sessions:", err);
    } finally {
      setIsLoadingCloud(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchCloudHistory();
    } else {
      setCloudSessions([]);
    }
  }, [currentUser]);

  const handleSaveToCloud = async () => {
    if (!currentUser) return;
    setIsSavingCloud(true);
    try {
      const sessionId = `session_${Date.now()}`;
      await saveScorecardSession(currentUser.uid, {
        id: sessionId,
        teamAName: state.teamA.name,
        teamAScore: state.teamA.score,
        teamABags: state.teamA.bags,
        teamBName: state.teamB.name,
        teamBScore: state.teamB.score,
        teamBBags: state.teamB.bags,
        winningScore: state.winningScore,
        rounds: state.rounds
      });
      alert("🎉 Game session successfully saved to your Lingo Legacy Cloud Profile!");
      await fetchCloudHistory();
    } catch (err) {
      console.error(err);
      alert("Failed to back up game to cloud.");
    } finally {
      setIsSavingCloud(false);
    }
  };

  const handleRestoreSession = (session: any) => {
    if (window.confirm(`Load session: "${session.teamAName} vs ${session.teamBName}"? This will overwrite your active scorecard.`)) {
      setState({
        teamA: { name: session.teamAName, score: session.teamAScore, bags: session.teamABags },
        teamB: { name: session.teamBName, score: session.teamBScore, bags: session.teamBBags },
        rounds: session.rounds || [],
        winningScore: session.winningScore || 500
      });
    }
  };

  const handleDeleteCloudSession = async (sessionId: string) => {
    if (window.confirm("Are you sure you want to permanently delete this session from your Cloud Backup?")) {
      try {
        await deleteScorecardSession(currentUser.uid, sessionId);
        setCloudSessions(prev => prev.filter(s => s.id !== sessionId));
      } catch (err) {
        alert("Failed to delete session.");
      }
    }
  };

  // Team names inputs
  const [editNames, setEditNames] = useState(false);
  const [tempTeamAName, setTempTeamAName] = useState(state.teamA.name);
  const [tempTeamBName, setTempTeamBName] = useState(state.teamB.name);

  // New round input form
  const [bidA, setBidA] = useState<number>(4);
  const [actualA, setActualA] = useState<number>(4);
  const [isNilA, setIsNilA] = useState(false);

  const [bidB, setBidB] = useState<number>(4);
  const [actualB, setActualB] = useState<number>(4);
  const [isNilB, setIsNilB] = useState(false);

  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset helper
  const handleReset = () => {
    if (window.confirm('Are you sure you want to clear the entire score sheet? This cannot be undone.')) {
      setState(DEFAULT_STATE);
      setBidA(4);
      setActualA(4);
      setBidB(4);
      setActualB(4);
      setIsNilA(false);
      setIsNilB(false);
      setValidationError(null);
    }
  };

  // Submit Names
  const handleSaveNames = () => {
    setState(prev => ({
      ...prev,
      teamA: { ...prev.teamA, name: tempTeamAName || 'Team Us' },
      teamB: { ...prev.teamB, name: tempTeamBName || 'Team Them' }
    }));
    setEditNames(false);
  };

  // Add Round
  const handleAddRound = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Sum of actual tricks shouldn't exceed 13, but let's warn rather than hard block since house rules can vary
    const totalActual = (isNilA ? 0 : actualA) + (isNilB ? 0 : actualB);
    if (actualA + actualB > 13) {
      if (!window.confirm(`Warning: Total tricks entered is ${actualA + actualB}, which is greater than the 13 available cards in a standard round. Do you want to proceed anyway?`)) {
        return;
      }
    }

    // Prepare inputs
    const finalBidA = isNilA ? 0 : bidA;
    const finalBidB = isNilB ? 0 : bidB;

    // Calculate score change using the Spades logical engine
    const teamAResults = calculateTeamRoundScore(finalBidA, actualA, 0, 0); // calculate P1
    // Wait, in real scoreboards, team score is calculated on partnership: Team A bid together.
    // If one bid Nil, it's processed with partner's bid. Let's make sure our calculator represents Partnership play.
    // In our team manual tracker:
    // User enters a combined bid for Team A, and combined actual. Or Nil.
    // Let's check: if one bids Nil, the other player bids a normal number.
    // Let's model this simply:
    // If Nil is checked: Team A has 1 Nil bidder, and the rest of the team bids `bidA`.
    // If Nil is NOT checked: Team A bids `bidA` as a combined team bid.
    
    // Let's compute Score changes for Team A
    let scoreChangeA = 0;
    let bagsChangeA = 0;
    
    if (isNilA) {
      // Nil bidder got actualA (which should be 0 to succeed)
      if (actualA === 0) {
        scoreChangeA += 100;
      } else {
        scoreChangeA -= 100;
        bagsChangeA += actualA;
      }
      // What about the rest of the team? In this simplified manual tracker, if they bid Nil, we assume the rest of the team bid 0 as well.
      // Wait, let's let the user specify. If Team A bids Nil, they can still specify a secondary bid, but to keep the UI clean,
      // let's do standard Nil (worth 100/-100) or standard positive bid.
      // If it's a positive bid, score is: actualA >= bidA -> score += bidA * 10 + (actualA - bidA), bags += (actualA - bidA)
      // If set: score -= bidA * 10
    } else {
      if (actualA >= bidA) {
        scoreChangeA = bidA * 10 + (actualA - bidA);
        bagsChangeA = actualA - bidA;
      } else {
        scoreChangeA = -bidA * 10;
        bagsChangeA = 0;
      }
    }

    // Team B scoring
    let scoreChangeB = 0;
    let bagsChangeB = 0;

    if (isNilB) {
      if (actualB === 0) {
        scoreChangeB += 100;
      } else {
        scoreChangeB -= 100;
        bagsChangeB += actualB;
      }
    } else {
      if (actualB >= bidB) {
        scoreChangeB = bidB * 10 + (actualB - bidB);
        bagsChangeB = actualB - bidB;
      } else {
        scoreChangeB = -bidB * 10;
        bagsChangeB = 0;
      }
    }

    // New cumulative bags
    let nextBagsA = state.teamA.bags + bagsChangeA;
    let nextScoreA = state.teamA.score + scoreChangeA;
    let nextBagsB = state.teamB.bags + bagsChangeB;
    let nextScoreB = state.teamB.score + scoreChangeB;

    // Check 10-bag penalty
    let bagPenaltyAppliedA = false;
    if (nextBagsA >= 10) {
      nextBagsA -= 10;
      nextScoreA -= 100;
      bagPenaltyAppliedA = true;
    }

    let bagPenaltyAppliedB = false;
    if (nextBagsB >= 10) {
      nextBagsB -= 10;
      nextScoreB -= 100;
      bagPenaltyAppliedB = true;
    }

    const newRound: TrackerRound = {
      roundNumber: state.rounds.length + 1,
      teamABid: finalBidA,
      teamABagBid: isNilA,
      teamAActual: actualA,
      teamAScoreChange: scoreChangeA - (bagPenaltyAppliedA ? 100 : 0),
      teamABagsChange: bagsChangeA - (bagPenaltyAppliedA ? 10 : 0),
      
      teamBBid: finalBidB,
      teamBBagBid: isNilB,
      teamBActual: actualB,
      teamBScoreChange: scoreChangeB - (bagPenaltyAppliedB ? 100 : 0),
      teamBBagsChange: bagsChangeB - (bagPenaltyAppliedB ? 10 : 0),
    };

    setState(prev => ({
      ...prev,
      teamA: {
        ...prev.teamA,
        score: nextScoreA,
        bags: nextBagsA
      },
      teamB: {
        ...prev.teamB,
        score: nextScoreB,
        bags: nextBagsB
      },
      rounds: [...prev.rounds, newRound]
    }));

    // Reset some form values
    setIsNilA(false);
    setIsNilB(false);
    setBidA(4);
    setActualA(4);
    setBidB(4);
    setActualB(4);
  };

  // Delete last round to undo mistakes
  const handleDeleteLastRound = () => {
    if (state.rounds.length === 0) return;
    
    if (window.confirm('Remove the last logged round? This will recalculate team scores.')) {
      const remainingRounds = state.rounds.slice(0, -1);
      
      // Recompute everything from scratch to ensure perfect math!
      let scoreA = 0;
      let bagsA = 0;
      let scoreB = 0;
      let bagsB = 0;

      remainingRounds.forEach(r => {
        // Find net changes
        scoreA += r.teamAScoreChange;
        bagsA += r.teamABagsChange;
        scoreB += r.teamBScoreChange;
        bagsB += r.teamBBagsChange;

        // Ensure bags don't go negative or glitch
        if (bagsA < 0) bagsA = 0;
        if (bagsB < 0) bagsB = 0;
      });

      setState(prev => ({
        ...prev,
        teamA: { ...prev.teamA, score: scoreA, bags: bagsA },
        teamB: { ...prev.teamB, score: scoreB, bags: bagsB },
        rounds: remainingRounds
      }));
    }
  };

  // Is game over?
  const winner = state.teamA.score >= state.winningScore && state.teamA.score > state.teamB.score
    ? state.teamA.name
    : state.teamB.score >= state.winningScore && state.teamB.score > state.teamA.score
      ? state.teamB.name
      : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6" id="score-tracker-root">
      
      {/* Upper Status & Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Scoreboard Column */}
        <div className="md:col-span-2 glass p-6 relative overflow-hidden" id="tracker-scoreboard-card">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Award className="w-48 h-48 text-white" />
          </div>

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>🏆 Scoreboard</span>
              <span className="text-xs px-2 py-0.5 bg-white/10 border border-white/10 rounded font-semibold text-slate-300">
                Target: {state.winningScore} pts
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setTempTeamAName(state.teamA.name);
                  setTempTeamBName(state.teamB.name);
                  setEditNames(!editNames);
                }}
                className="text-xs bg-white/5 hover:bg-white/10 text-slate-200 px-2.5 py-1.5 rounded-lg border border-white/10 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                id="edit-names-btn"
              >
                {editNames ? <Check className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />}
                {editNames ? 'Done' : 'Rename'}
              </button>
              <button
                onClick={handleReset}
                className="text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 px-2.5 py-1.5 rounded-lg border border-rose-500/30 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                id="reset-tracker-btn"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
          </div>

          {editNames ? (
            <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-white/5 rounded-xl border border-white/10 animate-fadeIn" id="team-name-editor">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Team A Name</label>
                <input
                  type="text"
                  value={tempTeamAName}
                  onChange={(e) => setTempTeamAName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 text-white"
                  id="team-a-name-input"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Team B Name</label>
                <input
                  type="text"
                  value={tempTeamBName}
                  onChange={(e) => setTempTeamBName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 text-white"
                  id="team-b-name-input"
                />
              </div>
              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setEditNames(false)}
                  className="px-3 py-1 text-xs text-slate-400 cursor-pointer hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNames}
                  className="px-3 py-1 text-xs bg-indigo-500 text-slate-950 rounded-md font-bold cursor-pointer"
                  id="save-names-btn"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : null}

          {/* Scores grid */}
          <div className="grid grid-cols-2 gap-6 relative z-10" id="team-scores-display">
            {/* Team A Card */}
            <div className="p-5 rounded-2xl glass-card border-l-4 border-l-emerald-500 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-300 text-sm tracking-wide uppercase truncate">
                  {state.teamA.name}
                </h3>
                <div className="text-4xl sm:text-5xl font-black text-white mt-2 select-none font-mono">
                  {state.teamA.score}
                </div>
              </div>
              
              {/* Bags indicator */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                  Sandbags:
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                        i < state.teamA.bags
                          ? 'bg-amber-500 shadow-sm scale-110 shadow-amber-500/40'
                          : 'bg-white/10'
                      }`}
                      title={`${state.teamA.bags} bags`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Team B Card */}
            <div className="p-5 rounded-2xl glass-card border-l-4 border-l-indigo-500 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-300 text-sm tracking-wide uppercase truncate">
                  {state.teamB.name}
                </h3>
                <div className="text-4xl sm:text-5xl font-black text-white mt-2 select-none font-mono">
                  {state.teamB.score}
                </div>
              </div>

              {/* Bags indicator */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                  Sandbags:
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                        i < state.teamB.bags
                          ? 'bg-amber-500 shadow-sm scale-110 shadow-amber-500/40'
                          : 'bg-white/10'
                      }`}
                      title={`${state.teamB.bags} bags`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Winner alert */}
          {winner && (
            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between animate-pulse" id="winner-banner">
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-amber-500 animate-bounce" />
                <div>
                  <h4 className="text-base font-bold text-amber-300">{winner} Wins the Game!</h4>
                  <p className="text-xs text-slate-300">They exceeded the winning target of {state.winningScore} points.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info box with Rules & Cloud Backups tabs */}
        <div className="glass p-6 flex flex-col justify-between" id="bag-rule-explainer">
          <div>
            {/* Tab Swapping Headers */}
            <div className="flex border-b border-white/10 mb-4 pb-2" id="tracker-info-tabs">
              <button
                type="button"
                onClick={() => setActiveInfoTab('rules')}
                className={`flex-1 py-1.5 text-xs font-bold transition-all rounded-lg cursor-pointer ${
                  activeInfoTab === 'rules'
                    ? 'bg-white/10 text-white border border-white/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                id="info-tab-rules-btn"
              >
                ♠ Spades Rules
              </button>
              <button
                type="button"
                onClick={() => setActiveInfoTab('sync')}
                className={`flex-1 py-1.5 text-xs font-bold transition-all rounded-lg cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeInfoTab === 'sync'
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                id="info-tab-sync-btn"
              >
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                Cloud Sync
              </button>
            </div>

            {activeInfoTab === 'rules' ? (
              <div className="space-y-4 animate-fadeIn" id="rules-content">
                <h3 className="font-bold text-white flex items-center gap-1.5 text-sm">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  Lingo Rule: The 10-Bag Penalty
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed opacity-90">
                  In Spades lingo, **"Sandbagging"** occurs when you win more tricks (books) than you bid. Each overtrick is called a **Bag**. 
                </p>
                <p className="text-xs text-slate-300 leading-relaxed opacity-90">
                  When a team accumulates **10 bags**, they suffer a **-100 point penalty** deduction, and their bag count resets. Bid precisely to win points and keep bags low!
                </p>
              </div>
            ) : (
              <div className="space-y-4 animate-fadeIn" id="sync-content">
                {currentUser ? (
                  <div>
                    <h4 className="font-bold text-white text-xs mb-2">Cloud Synced Profile</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                      Direct connection established with <strong>{currentUser.displayName?.split(' ')[0] || 'your cloud account'}</strong>. Save your active physical session to the cloud.
                    </p>

                    <button
                      type="button"
                      onClick={handleSaveToCloud}
                      disabled={isSavingCloud || state.rounds.length === 0}
                      className={`w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        state.rounds.length === 0 ? 'opacity-40 cursor-not-allowed' : 'active:scale-98 shadow-md shadow-emerald-500/15'
                      }`}
                      id="save-to-cloud-btn"
                    >
                      {isSavingCloud ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="w-3.5 h-3.5" />
                      )}
                      <span>Save Scorecard Session</span>
                    </button>
                    {state.rounds.length === 0 && (
                      <p className="text-[10px] text-slate-500 mt-1.5 text-center">
                        * Add at least one round to enable backup
                      </p>
                    )}

                    {/* Backups list */}
                    <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                          Cloud Backups ({cloudSessions.length})
                        </span>
                        <button
                          type="button"
                          onClick={fetchCloudHistory}
                          className="text-[9px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer font-bold font-mono"
                        >
                          <RefreshCw className={`w-2.5 h-2.5 ${isLoadingCloud ? 'animate-spin' : ''}`} />
                          Sync
                        </button>
                      </div>

                      {isLoadingCloud ? (
                        <div className="text-center py-4">
                          <RefreshCw className="w-5 h-5 animate-spin text-emerald-500 mx-auto" />
                          <p className="text-[10px] text-slate-500 mt-1">Downloading logs...</p>
                        </div>
                      ) : cloudSessions.length > 0 ? (
                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1" id="cloud-backups-list">
                          {cloudSessions.map(session => (
                            <div 
                              key={session.id}
                              className="p-2 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between gap-2 hover:bg-white/8 transition-all"
                            >
                              <div className="min-w-0">
                                <div className="text-[10px] font-bold text-white truncate">
                                  {session.teamAName} v {session.teamBName}
                                </div>
                                <span className="text-[9px] text-slate-400 font-mono block">
                                  {session.teamAScore} - {session.teamBScore} ({session.rounds?.length || 0} rounds)
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleRestoreSession(session)}
                                  className="p-1 bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 rounded cursor-pointer transition-all"
                                  title="Restore Scorecard"
                                >
                                  <Download className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCloudSession(session.id)}
                                  className="p-1 bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 rounded cursor-pointer transition-all"
                                  title="Delete Backup"
                                >
                                  <Trash className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 border border-dashed border-white/10 rounded-xl">
                          <p className="text-[10px] text-slate-500">No cloud back ups recorded.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 space-y-3" id="cloud-sync-cta">
                    <Cloud className="w-10 h-10 text-slate-500 mx-auto animate-pulse" />
                    <h4 className="font-extrabold text-xs text-slate-300 uppercase tracking-wide">Offline Scorekeeper</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Sync your Google Profile in the main app header to back up your manual companion game sessions, load previous tables, and coordinate match logs securely.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {activeInfoTab === 'rules' && (
            <div className="mt-6 p-3 bg-white/5 rounded-xl border border-white/10 text-xs text-slate-400">
              <span className="font-bold text-slate-300">Target Selector:</span>
              <div className="flex gap-2 mt-2">
                {[250, 300, 500].map(score => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setState(prev => ({ ...prev, winningScore: score }))}
                    className={`flex-1 py-1 rounded font-bold cursor-pointer transition-colors ${
                      state.winningScore === score
                        ? 'bg-indigo-500 text-slate-950 shadow-md'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                    }`}
                    id={`target-score-${score}`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Manual Input Form */}
      {!winner && (
        <form onSubmit={handleAddRound} className="glass p-6" id="add-round-form">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-400" />
            Log Next Round Results
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Team A Input Group */}
            <div className="p-4 glass-card border border-emerald-500/20 rounded-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="font-bold text-emerald-400 text-sm tracking-wide">
                  {state.teamA.name.toUpperCase()}
                </span>
                <label className="inline-flex items-center gap-1 text-xs cursor-pointer select-none font-semibold text-slate-300">
                  <input
                    type="checkbox"
                    checked={isNilA}
                    onChange={(e) => setIsNilA(e.target.checked)}
                    className="rounded border-white/10 text-indigo-500 focus:ring-indigo-400 cursor-pointer"
                    id="team-a-nil-checkbox"
                  />
                  Bid Nil (0)?
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    {isNilA ? 'Bid' : 'Combined Bid'}
                  </label>
                  <select
                    disabled={isNilA}
                    value={isNilA ? 0 : bidA}
                    onChange={(e) => setBidA(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                    id="team-a-bid-select"
                  >
                    {Array.from({ length: 14 }).map((_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Tricks Won
                  </label>
                  <select
                    value={actualA}
                    onChange={(e) => setActualA(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    id="team-a-actual-select"
                  >
                    {Array.from({ length: 14 }).map((_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Team B Input Group */}
            <div className="p-4 glass-card border border-indigo-500/20 rounded-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="font-bold text-indigo-400 text-sm tracking-wide">
                  {state.teamB.name.toUpperCase()}
                </span>
                <label className="inline-flex items-center gap-1 text-xs cursor-pointer select-none font-semibold text-slate-300">
                  <input
                    type="checkbox"
                    checked={isNilB}
                    onChange={(e) => setIsNilB(e.target.checked)}
                    className="rounded border-white/10 text-indigo-500 focus:ring-indigo-400 cursor-pointer"
                    id="team-b-nil-checkbox"
                  />
                  Bid Nil (0)?
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    {isNilB ? 'Bid' : 'Combined Bid'}
                  </label>
                  <select
                    disabled={isNilB}
                    value={isNilB ? 0 : bidB}
                    onChange={(e) => setBidB(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                    id="team-b-bid-select"
                  >
                    {Array.from({ length: 14 }).map((_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Tricks Won
                  </label>
                  <select
                    value={actualB}
                    onChange={(e) => setActualB(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    id="team-b-actual-select"
                  >
                    {Array.from({ length: 14 }).map((_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span className="text-xs text-slate-400 italic">
              * The system will automatically calculate scores, bags, Nils, sets, and handle 10-bag resets.
            </span>
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-slate-950 rounded-xl font-bold shadow-md shadow-indigo-500/10 cursor-pointer flex items-center justify-center gap-2 transition-all hover:translate-y-[-1px]"
              id="submit-round-btn"
            >
              <Plus className="w-4 h-4" />
              Save Round Results
            </button>
          </div>
        </form>
      )}

      {/* Historical Ledger Table */}
      <div className="glass p-6" id="tracker-history-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
            📝 Round-by-Round Log
          </h3>
          {state.rounds.length > 0 && (
            <button
              onClick={handleDeleteLastRound}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold cursor-pointer"
              id="undo-last-round-btn"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Undo Last Round
            </button>
          )}
        </div>

        {state.rounds.length > 0 ? (
          <div className="overflow-x-auto" id="tracker-ledger-table-container">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Round</th>
                  <th className="py-3 px-4 text-emerald-400">{state.teamA.name} Bid/Tricks</th>
                  <th className="py-3 px-4 text-emerald-400">{state.teamA.name} Net Score</th>
                  <th className="py-3 px-4 text-indigo-400">{state.teamB.name} Bid/Tricks</th>
                  <th className="py-3 px-4 text-indigo-400">{state.teamB.name} Net Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-slate-300">
                {state.rounds.map((round) => {
                  const isASet = round.teamAScoreChange < 0 && !round.teamABagBid;
                  const isBSet = round.teamBScoreChange < 0 && !round.teamBBagBid;

                  return (
                    <tr key={round.roundNumber} className="hover:bg-white/5">
                      <td className="py-3.5 px-4 font-bold text-slate-400 font-mono">
                        #{round.roundNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            {round.teamABagBid ? 'Nil' : round.teamABid}
                          </span>
                          <span className="text-slate-500 font-bold">→</span>
                          <span className="font-bold text-emerald-400">
                            {round.teamAActual}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`font-bold font-mono flex items-center gap-1 ${
                          round.teamAScoreChange >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}>
                          {round.teamAScoreChange >= 0 ? (
                            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                          )}
                          {round.teamAScoreChange > 0 ? `+${round.teamAScoreChange}` : round.teamAScoreChange}
                        </span>
                        {round.teamABagsChange !== 0 && (
                          <span className="text-[10px] text-amber-400 font-semibold block">
                            {round.teamABagsChange > 0 ? `+${round.teamABagsChange}` : round.teamABagsChange} bags
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            {round.teamBBagBid ? 'Nil' : round.teamBBid}
                          </span>
                          <span className="text-slate-500 font-bold">→</span>
                          <span className="font-bold text-indigo-400">
                            {round.teamBActual}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`font-bold font-mono flex items-center gap-1 ${
                          round.teamBScoreChange >= 0
                            ? 'text-indigo-400'
                            : 'text-rose-400'
                        }`}>
                          {round.teamBScoreChange >= 0 ? (
                            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                          )}
                          {round.teamBScoreChange > 0 ? `+${round.teamBScoreChange}` : round.teamBScoreChange}
                        </span>
                        {round.teamBBagsChange !== 0 && (
                          <span className="text-[10px] text-amber-400 font-semibold block">
                            {round.teamBBagsChange > 0 ? `+${round.teamBBagsChange}` : round.teamBBagsChange} bags
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 border border-dashed border-white/10 rounded-xl" id="ledger-empty-state">
            <p className="text-slate-400 text-sm font-semibold">No rounds have been logged yet.</p>
            <p className="text-xs text-slate-500 mt-1">Start entering bids and actual tricks won to construct the scoreboard.</p>
          </div>
        )}
      </div>

    </div>
  );
}
