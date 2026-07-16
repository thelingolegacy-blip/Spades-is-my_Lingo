/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, RotateCcw, AlertCircle, Volume2, VolumeX, Sparkles, HelpCircle, 
  ChevronRight, ArrowRight, BookOpen, Clock, Info, ShieldAlert,
  MessageSquare, User, Zap, Award, Star, ListOrdered, ToggleLeft, ToggleRight
} from 'lucide-react';
import { 
  CardModel, Player, Trick, TrickPlay, GamePhase, SpadesGameState, LingoAlert, Suit, Rank, EliteGameRules, SoloProgression
} from '../types';
import { 
  createDeck, shuffleDeck, dealHands, sortHand, getCardName, getSuitColor, 
  isCardPlayable, evaluateTrickWinner, calculateAIBid, selectAICard, calculateTeamRoundScore 
} from '../utils/spadesLogic';

// Default initial state
const createInitialGameState = (): SpadesGameState => ({
  players: [
    { id: 'user', name: 'You (South)', hand: [], bid: null, tricksWon: 0, avatarUrl: '', trashTalkBubble: '' },
    { id: 'left', name: 'West AI', hand: [], bid: null, tricksWon: 0, avatarUrl: '', trashTalkBubble: '' },
    { id: 'partner', name: 'North AI (Partner)', hand: [], bid: null, tricksWon: 0, avatarUrl: '', trashTalkBubble: '' },
    { id: 'right', name: 'East AI', hand: [], bid: null, tricksWon: 0, avatarUrl: '', trashTalkBubble: '' },
  ],
  dealerIdx: 0,
  currentPlayerIdx: 1, 
  currentTrick: { plays: [], leadSuit: null, winnerId: null },
  tricksHistory: [],
  spadesBroken: false,
  phase: 'setup',
  roundNumber: 0,
  scoreTeamA: 0, 
  scoreTeamB: 0, 
  bagsTeamA: 0,
  bagsTeamB: 0,
  logs: ['Welcome to Spades Is My Lingo™ ELITE! Choose settings below and deal!'],
  lingoHighlights: [
    {
      id: 'welcome',
      term: 'Bidding Partnership',
      explanation: 'In Spades, your bid combines with your partner\'s. You win points by taking at least your collective bid.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }
  ],
  gameRules: {
    allowReneging: true, // Reneging (Trick play) allowed by default in Elite mode!
    soundEffectsEnabled: true,
    aiTrashTalkEnabled: true,
    musicEnabled: false,
    bagsPenaltyLimit: 10
  },
  announcerCommentary: 'Ladies and gentlemen, welcome to the Spades Is My Lingo Grand Tournament! Shuffling the decks...',
  renegeViolationsCount: { teamA: 0, teamB: 0 }
});

// Mock Leaderboard users
const LEADERBOARD_ENTRIES = [
  { name: 'King Renegade', tier: 'Grandmaster', chips: 154000, active: false },
  { name: 'Auntie Mae', tier: 'Platinum III', chips: 94000, active: false },
  { name: 'Ace Sluffer', tier: 'Platinum II', chips: 65000, active: false },
  { name: 'North AI Companion', tier: 'Gold I', chips: 12000, active: false },
  { name: 'You (South Player)', tier: 'Bronze I', chips: 1000, active: true },
  { name: 'Slim Spader', tier: 'Bronze II', chips: 800, active: false },
];

interface AITableProps {
  soloProgress: SoloProgression;
  onUpdateProgress: (updates: Partial<SoloProgression>) => void;
  deckStyle: string;
}

export default function AITable({
  soloProgress,
  onUpdateProgress,
  deckStyle
}: AITableProps) {
  const [gameState, setGameState] = useState<SpadesGameState>(() => {
    const saved = localStorage.getItem('spades_lingo_game_v1_elite');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return createInitialGameState();
      }
    }
    return createInitialGameState();
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [isAIPlaying, setIsAIPlaying] = useState(false);
  const [activeLeaderboard, setActiveLeaderboard] = useState(false);
  
  // Custom House Rules settings toggles
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // Gemini AI Coach state
  const [coachChatInput, setCoachChatInput] = useState('');
  const [coachChatHistory, setCoachChatHistory] = useState<Array<{ role: 'user' | 'model'; text: string }>>([
    { role: 'model', text: "What's up, partner? I'm Sassy Ace, your elite AI Spades Coach. Tap 'Analyze Hand' or ask me about any strategy, bidding, or catching renegades!" }
  ]);
  const [isCoachLoading, setIsCoachLoading] = useState(false);

  // actual history of what was played to verify reneging
  // tracks card plays along with hand state at play time
  const [renegedRecords, setRenegedRecords] = useState<Record<string, boolean>>({});

  const aiTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Save game state
  useEffect(() => {
    localStorage.setItem('spades_lingo_game_v1_elite', JSON.stringify(gameState));
  }, [gameState]);

  // Clean up timers
  useEffect(() => {
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, []);

  // Auto-scroll coach chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [coachChatHistory]);

  // Procedural retro sound generator using Web Audio API
  const playSound = (type: 'deal' | 'play' | 'win_trick' | 'set' | 'reneg' | 'cash') => {
    if (!gameState.gameRules.soundEffectsEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'deal') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.setValueAtTime(500, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      } else if (type === 'play') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(330, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
      } else if (type === 'win_trick') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else if (type === 'set') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.setValueAtTime(180, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      } else if (type === 'reneg') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.setValueAtTime(110, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else if (type === 'cash') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(987.77, audioCtx.currentTime); // B5
        osc.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.08); // E6
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      }
    } catch (e) {}
  };

  const addLog = (msg: string) => {
    setGameState(prev => ({
      ...prev,
      logs: [msg, ...prev.logs.slice(0, 49)]
    }));
  };

  const triggerLingoAlert = (term: string, explanation: string) => {
    const alert: LingoAlert = {
      id: Math.random().toString(),
      term,
      explanation,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setGameState(prev => ({
      ...prev,
      lingoHighlights: [alert, ...prev.lingoHighlights.slice(0, 15)]
    }));
  };

  // House Rules Toggles
  const handleToggleReneging = () => {
    setGameState(prev => ({
      ...prev,
      gameRules: {
        ...prev.gameRules,
        allowReneging: !prev.gameRules.allowReneging
      },
      logs: [`House Rules: Illegal Reneging is now ${!prev.gameRules.allowReneging ? 'ALLOWED (trick plays enabled)' : 'FORBIDDEN'}.`, ...prev.logs]
    }));
  };

  // 1. Reset Game
  const handleResetGame = () => {
    if (window.confirm('Reset the active table? All match scores go back to 0.')) {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
      setGameState(createInitialGameState());
      setRenegedRecords({});
      setErrorMessage(null);
      setShowScoreModal(false);
      setIsAIPlaying(false);
    }
  };

  // 2. Deal Hand
  const handleDealRound = () => {
    playSound('deal');
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    const hands = dealHands(shuffled);

    const nextRound = gameState.roundNumber + 1;
    const dealer = gameState.dealerIdx;
    const firstBidderIdx = (dealer + 1) % 4;

    setRenegedRecords({});

    setGameState(prev => {
      const updatedPlayers = prev.players.map((p, idx) => ({
        ...p,
        hand: hands[idx],
        bid: null,
        tricksWon: 0,
        actualSuitsInHand: Array.from(new Set(hands[idx].map(c => c.suit))),
        trashTalkBubble: ''
      }));

      return {
        ...prev,
        players: updatedPlayers,
        roundNumber: nextRound,
        currentPlayerIdx: firstBidderIdx,
        currentTrick: { plays: [], leadSuit: null, winnerId: null },
        tricksHistory: [],
        spadesBroken: false,
        phase: 'bidding',
        logs: [`Round #${nextRound} dealt. Bidding starts with ${prev.players[firstBidderIdx].name}!`, ...prev.logs],
        announcerCommentary: `Welcome back! Round ${nextRound} is dealt. Let's hear those predictions and bids!`
      };
    });

    setErrorMessage(null);
    setShowScoreModal(false);
  };

  // 3. User Bidding
  const handleUserBid = (bid: number) => {
    playSound('play');
    setGameState(prev => {
      const updated = prev.players.map(p => p.id === 'user' ? { ...p, bid } : p);
      return {
        ...prev,
        players: updated,
        logs: [`You placed a bid of ${bid === 0 ? 'Nil' : bid} tricks.`, ...prev.logs],
        currentPlayerIdx: (prev.currentPlayerIdx + 1) % 4
      };
    });

    if (bid === 0) {
      triggerLingoAlert('Nil Bidding', 'Bidding zero tricks. Earns +100 bonus, or a devastating -100 penalty if you take a single book.');
    }
  };

  // 4. Handle AI Bidding sequence
  useEffect(() => {
    if (gameState.phase !== 'bidding') return;

    const currentPlayer = gameState.players[gameState.currentPlayerIdx];
    if (currentPlayer.id === 'user') return; // wait for user

    aiTimerRef.current = setTimeout(() => {
      const calculatedBid = calculateAIBid(currentPlayer.hand);
      
      // Random AI trash talk occasionally during bidding
      let aiBubble = '';
      if (gameState.gameRules.aiTrashTalkEnabled && Math.random() < 0.45) {
        const phrases = [
          `I bid ${calculatedBid}, and I'm taking all of 'em!`,
          `Easy ${calculatedBid} bid. South looks weak!`,
          calculatedBid === 0 ? `Bidding Nil! Protect me, partner!` : `Hold on, I'm cutting in this round.`,
          `Don't get set, West! Let's get these bags.`
        ];
        aiBubble = phrases[Math.floor(Math.random() * phrases.length)];
      }

      setGameState(prev => {
        const updated = prev.players.map((p, idx) => 
          idx === prev.currentPlayerIdx 
            ? { ...p, bid: calculatedBid, trashTalkBubble: aiBubble } 
            : p
        );

        let nextPhase = prev.phase;
        let nextPlayerIdx = (prev.currentPlayerIdx + 1) % 4;

        const allBid = updated.every(p => p.bid !== null);
        if (allBid) {
          nextPhase = 'playing';
          nextPlayerIdx = (prev.dealerIdx + 1) % 4;
        }

        const logMsg = `${currentPlayer.name} bid ${calculatedBid === 0 ? 'Nil' : calculatedBid}.`;
        const updatedLogs = [logMsg, ...prev.logs];

        return {
          ...prev,
          players: updated,
          phase: nextPhase,
          currentPlayerIdx: nextPlayerIdx,
          logs: updatedLogs
        };
      });

      playSound('play');

      // Clear trash talk bubble after a delay
      setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          players: prev.players.map(p => p.id === currentPlayer.id ? { ...p, trashTalkBubble: '' } : p)
        }));
      }, 3500);

    }, 1100);

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [gameState.phase, gameState.currentPlayerIdx]);

  // 5. Handle AI Playing turn
  useEffect(() => {
    if (gameState.phase !== 'playing') return;

    const currentPlayer = gameState.players[gameState.currentPlayerIdx];
    if (currentPlayer.id === 'user') return; // wait for user

    setIsAIPlaying(true);

    aiTimerRef.current = setTimeout(() => {
      // Pick card
      let cardToPlay = selectAICard(
        currentPlayer.hand,
        gameState.currentTrick.leadSuit,
        gameState.spadesBroken,
        gameState.currentTrick.plays,
        currentPlayer.id,
        currentPlayer.id === 'left' ? 'right' : currentPlayer.id === 'right' ? 'left' : 'partner'
      );

      // --- TRICK PLAY: RENEGING MODIFIER ---
      // If Reneging is allowed by rules, sometimes bots play out-of-suit illegally to throw bags at the user or save themselves!
      const leadSuit = gameState.currentTrick.leadSuit;
      if (gameState.gameRules.allowReneging && leadSuit !== null) {
        const hasLeadSuit = currentPlayer.hand.some(c => c.suit === leadSuit);
        // 12% chance for an AI to illegally renege if they hold a non-winning card of lead suit and a lower sluff card
        if (hasLeadSuit && Math.random() < 0.12) {
          const alternateCards = currentPlayer.hand.filter(c => c.suit !== leadSuit);
          if (alternateCards.length > 0) {
            // Select low card to renege illegally!
            cardToPlay = alternateCards[Math.floor(Math.random() * alternateCards.length)];
            
            // Record their reneging crime secretly!
            setRenegedRecords(prev => ({ ...prev, [currentPlayer.id]: true }));
            triggerLingoAlert('Reneging Crime!', 'An AI player played out of suit while secretly holding the led suit. Will you call a Reneging Violation on them?');
          }
        }
      }

      playCard(currentPlayer.id, cardToPlay);
      setIsAIPlaying(false);
    }, 1400);

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [gameState.phase, gameState.currentPlayerIdx]);

  // 6. Execute Play Card
  const playCard = (playerID: string, card: CardModel) => {
    playSound('play');

    setGameState(prev => {
      const player = prev.players.find(p => p.id === playerID)!;
      const cleanHand = player.hand.filter(c => c.id !== card.id);
      
      const updatedPlayers = prev.players.map(p => 
        p.id === playerID ? { ...p, hand: cleanHand, trashTalkBubble: '' } : p
      );

      const isFirstCard = prev.currentTrick.plays.length === 0;
      const nextLeadSuit = isFirstCard ? card.suit : prev.currentTrick.leadSuit;

      const play: TrickPlay = { playerId: playerID, card };
      const updatedPlays = [...prev.currentTrick.plays, play];

      let nextSpadesBroken = prev.spadesBroken;
      if (card.suit === Suit.SPADES && !prev.spadesBroken) {
        nextSpadesBroken = true;
      }

      const logMsg = `${player.name} played ${getCardName(card)}.`;
      const nextLogs = [logMsg, ...prev.logs];

      let nextPhase: GamePhase = 'playing';
      let nextPlayerIdx = (prev.currentPlayerIdx + 1) % 4;

      if (updatedPlays.length === 4) {
        nextPhase = 'trick_result';
      }

      return {
        ...prev,
        players: updatedPlayers,
        currentTrick: {
          plays: updatedPlays,
          leadSuit: nextLeadSuit,
          winnerId: null
        },
        spadesBroken: nextSpadesBroken,
        currentPlayerIdx: nextPlayerIdx,
        phase: nextPhase,
        logs: nextLogs
      };
    });
  };

  // User plays a card (with reneging checks)
  const handleUserPlayCard = (card: CardModel) => {
    if (gameState.phase !== 'playing') return;
    if (gameState.players[gameState.currentPlayerIdx].id !== 'user') return;

    const user = gameState.players[0];
    const leadSuit = gameState.currentTrick.leadSuit;

    // Standard checking
    const check = isCardPlayable(card, user.hand, leadSuit, gameState.spadesBroken);

    if (!check.playable) {
      // If renege rules are toggled ON, allow playing out of suit but mark them as reneged!
      if (gameState.gameRules.allowReneging) {
        if (window.confirm(`That card breaks standard rules because you hold the lead suit (${leadSuit}). Play it illegally to Reneg? Opponents can call a violation on you if caught!`)) {
          setRenegedRecords(prev => ({ ...prev, user: true }));
          setErrorMessage(null);
          playCard('user', card);

          // Opponent has a 25% chance to catch the user reneging immediately!
          setTimeout(() => {
            if (Math.random() < 0.25) {
              handleTriggerOpponentRenegCheck();
            }
          }, 1500);
          return;
        }
      }

      setErrorMessage(check.reason || "Invalid play!");
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    setErrorMessage(null);
    playCard('user', card);
  };

  // Caught reneg sequence by opponent AIs
  const handleTriggerOpponentRenegCheck = () => {
    if (renegedRecords['user']) {
      playSound('reneg');
      alert(`🚨 VIOLATION CAUGHT! West AI called a Reneging Violation on you! You played illegally out-of-suit. East & West team wins +3 tricks!`);
      
      setGameState(prev => {
        const updated = prev.players.map(p => {
          if (p.id === 'left' || p.id === 'right') {
            return { ...p, tricksWon: p.tricksWon + 3 };
          }
          if (p.id === 'user') {
            return { ...p, tricksWon: Math.max(0, p.tricksWon - 3) };
          }
          return p;
        });

        return {
          ...prev,
          players: updated,
          logs: ['Opponents caught South reneging! Penalty: 3 tricks deducted from Team Us.', ...prev.logs],
          renegeViolationsCount: {
            teamA: prev.renegeViolationsCount?.teamA || 0,
            teamB: (prev.renegeViolationsCount?.teamB || 0) + 1
          }
        };
      });

      // Clear record
      setRenegedRecords(prev => ({ ...prev, user: false }));
    }
  };

  // User calls a reneging violation on AIs
  const handleUserCallsReneg = (targetPlayerId: string) => {
    const targetName = gameState.players.find(p => p.id === targetPlayerId)?.name || 'Opponent';

    if (renegedRecords[targetPlayerId]) {
      playSound('reneg');
      alert(`🎉 EXCELLENT EYE! You caught ${targetName} reneging! Their team is penalized. Team Us wins +3 tricks!`);
      
      setGameState(prev => {
        const updated = prev.players.map(p => {
          if (p.id === 'user' || p.id === 'partner') {
            return { ...p, tricksWon: p.tricksWon + 3 };
          }
          if (p.id === targetPlayerId) {
            return { ...p, tricksWon: Math.max(0, p.tricksWon - 3) };
          }
          return p;
        });

        return {
          ...prev,
          players: updated,
          logs: [`You successfully caught ${targetName} reneging! Bonus tricks awarded.`, ...prev.logs],
          renegeViolationsCount: {
            teamA: (prev.renegeViolationsCount?.teamA || 0) + 1,
            teamB: prev.renegeViolationsCount?.teamB || 0
          }
        };
      });

      setRenegedRecords(prev => ({ ...prev, [targetPlayerId]: false }));
    } else {
      playSound('set');
      alert(`❌ FALSE ACCUSATION! ${targetName} played legally. Your team is penalized 1 trick for a false claim.`);
      
      setGameState(prev => {
        const updated = prev.players.map(p => {
          if (p.id === 'user') {
            return { ...p, tricksWon: Math.max(0, p.tricksWon - 1) };
          }
          return p;
        });
        return {
          ...prev,
          players: updated,
          logs: [`False reneg accusation against ${targetName}. -1 trick penalty.`, ...prev.logs]
        };
      });
    }
  };

  // User manually triggers a custom chat bubble
  const handleUserTriggerChat = (text: string) => {
    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === 'user' ? { ...p, trashTalkBubble: text } : p)
    }));

    // Trigger funny AI replies
    setTimeout(() => {
      setGameState(prev => {
        const replies = ['Watch your cards, South!', 'Save the talk for the scorecard!', 'Are you reneging?', 'Clean books only!'];
        const randomAIIdx = Math.floor(Math.random() * 3) + 1; // 1 (left), 2 (partner), 3 (right)
        const targetAI = prev.players[randomAIIdx];
        
        return {
          ...prev,
          players: prev.players.map((p, idx) => 
            idx === randomAIIdx 
              ? { ...p, trashTalkBubble: replies[Math.floor(Math.random() * replies.length)] }
              : p.id === 'user' ? { ...p, trashTalkBubble: '' } : p
          )
        };
      });

      // Clear bot speech bubble
      setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          players: prev.players.map(p => ({ ...p, trashTalkBubble: '' }))
        }));
      }, 3000);

    }, 1500);
  };

  // 7. Resolve completed trick with Gemini Announcer Commentary
  useEffect(() => {
    if (gameState.phase !== 'trick_result') return;

    const plays = gameState.currentTrick.plays;
    const leadSuit = gameState.currentTrick.leadSuit!;
    const winnerId = evaluateTrickWinner(plays, leadSuit);
    const winningPlay = plays.find(p => p.playerId === winnerId)!;
    const winningPlayer = gameState.players.find(p => p.id === winnerId)!;

    setGameState(prev => {
      const updatedPlayers = prev.players.map(p => 
        p.id === winnerId ? { ...p, tricksWon: p.tricksWon + 1 } : p
      );

      const updatedTrick = {
        ...prev.currentTrick,
        winnerId
      };

      const winnerName = winnerId === 'user' ? 'You' : winningPlayer.name;
      const logMsg = `🎉 ${winnerName} took the book with the ${getCardName(winningPlay.card)}!`;
      
      return {
        ...prev,
        players: updatedPlayers,
        currentTrick: updatedTrick,
        logs: [logMsg, ...prev.logs],
        announcerCommentary: `Winner of the book is ${winnerName} with the ${getCardName(winningPlay.card)}!`
      };
    });

    playSound('win_trick');

    // Trigger server-side Gemini commentary for extra premium broadcast experience
    fetch('/api/gemini/commentary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recentTrick: plays,
        leadSuit,
        tricksHistoryCount: gameState.tricksHistory.length,
        logs: gameState.logs
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.commentary) {
        setGameState(prev => ({
          ...prev,
          announcerCommentary: data.commentary
        }));
      }
    })
    .catch(() => {});

    aiTimerRef.current = setTimeout(() => {
      handleNextTrick(winnerId);
    }, 4000);

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [gameState.phase]);

  const handleNextTrick = (winnerId: string) => {
    setGameState(prev => {
      const nextHistory = [...prev.tricksHistory, prev.currentTrick];
      const cardsRemaining = prev.players[0].hand.length;

      let nextPhase: GamePhase = 'playing';
      let nextPlayerIdx = prev.players.findIndex(p => p.id === winnerId);

      if (cardsRemaining === 0) {
        nextPhase = 'round_score';
      }

      return {
        ...prev,
        tricksHistory: nextHistory,
        currentTrick: { plays: [], leadSuit: null, winnerId: null },
        currentPlayerIdx: nextPlayerIdx,
        phase: nextPhase
      };
    });
  };

  // 8. Resolve Round Scores & update player's Solo Progression
  useEffect(() => {
    if (gameState.phase !== 'round_score') return;

    const pUser = gameState.players.find(p => p.id === 'user')!;
    const pPartner = gameState.players.find(p => p.id === 'partner')!;
    const pLeft = gameState.players.find(p => p.id === 'left')!;
    const pRight = gameState.players.find(p => p.id === 'right')!;

    const teamAResults = calculateTeamRoundScore(
      pUser.bid!, pUser.tricksWon,
      pPartner.bid!, pPartner.tricksWon
    );

    const teamBResults = calculateTeamRoundScore(
      pLeft.bid!, pLeft.tricksWon,
      pRight.bid!, pRight.tricksWon
    );

    let nextBagsA = gameState.bagsTeamA + teamAResults.bagsChange;
    let nextScoreA = gameState.scoreTeamA + teamAResults.scoreChange;
    let penaltyA = false;
    if (nextBagsA >= gameState.gameRules.bagsPenaltyLimit) {
      nextBagsA -= gameState.gameRules.bagsPenaltyLimit;
      nextScoreA -= 100;
      penaltyA = true;
    }

    let nextBagsB = gameState.bagsTeamB + teamBResults.bagsChange;
    let nextScoreB = gameState.scoreTeamB + teamBResults.scoreChange;
    let penaltyB = false;
    if (nextBagsB >= gameState.gameRules.bagsPenaltyLimit) {
      nextBagsB -= gameState.gameRules.bagsPenaltyLimit;
      nextScoreB -= 100;
      penaltyB = true;
    }

    const isGameOver = (nextScoreA >= 500 && nextScoreA > nextScoreB) || (nextScoreB >= 500 && nextScoreB > nextScoreA) || (nextScoreA <= -200) || (nextScoreB <= -200);
    const nextPhase: GamePhase = isGameOver ? 'game_over' : 'round_score';

    setGameState(prev => ({
      ...prev,
      scoreTeamA: nextScoreA,
      scoreTeamB: nextScoreB,
      bagsTeamA: nextBagsA,
      bagsTeamB: nextBagsB,
      phase: nextPhase,
      logs: [
        `--- Round #${prev.roundNumber} Scoring Complete ---`,
        `Team Us score change: ${teamAResults.scoreChange} pts (${teamAResults.bagsChange} bags). ${penaltyA ? 'PACK PENALTY! -100 pts.' : ''}`,
        `Team Them score change: ${teamBResults.scoreChange} pts (${teamBResults.bagsChange} bags). ${penaltyB ? 'PACK PENALTY! -100 pts.' : ''}`,
        ...prev.logs
      ],
      announcerCommentary: `Scores are in for Round ${prev.roundNumber}! Team Us is sitting at ${nextScoreA}, Team Them at ${nextScoreB}.`
    }));

    if (teamAResults.scoreChange < 0) {
      playSound('set');
    } else {
      playSound('cash');
    }

    // Payout rewards to player when game ends
    if (isGameOver) {
      const won = nextScoreA >= 500 && nextScoreA > nextScoreB;
      const chipsGained = won ? 1000 : 200;
      const xpGained = won ? 500 : 100;

      let nextLevel = soloProgress.level;
      let nextXp = soloProgress.xp + xpGained;
      if (nextXp >= nextLevel * 500) {
        nextXp -= (nextLevel * 500);
        nextLevel += 1;
      }

      onUpdateProgress({
        chips: soloProgress.chips + chipsGained,
        xp: nextXp,
        level: nextLevel
      });

      alert(`🏆 GAME COMPLETED! ${won ? 'TEAM US WINS THE TOURNAMENT!' : 'Opponents claimed the cup.'} You earned +${chipsGained} Coins 💰 and +${xpGained} XP!`);
    }

    setShowScoreModal(true);

  }, [gameState.phase === 'round_score']);

  const handleProceedToNextRound = () => {
    setShowScoreModal(false);
    const nextDealerIdx = (gameState.dealerIdx + 1) % 4;
    setGameState(prev => ({
      ...prev,
      dealerIdx: nextDealerIdx,
      phase: 'setup'
    }));
  };

  // Gemini Coach hand advice fetcher
  const handleGetCoachChatReply = async (userMsgText?: string) => {
    setIsCoachLoading(true);
    const textToSend = userMsgText || coachChatInput;
    if (!textToSend.trim() && !userMsgText) return;

    setCoachChatHistory(prev => [...prev, { role: 'user', text: textToSend }]);
    setCoachChatInput('');

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerHand: gameState.players[0].hand,
          gameLogs: gameState.logs,
          userMessage: textToSend,
          chatHistory: coachChatHistory
        })
      });

      const data = await response.json();
      if (data.reply) {
        setCoachChatHistory(prev => [...prev, { role: 'model', text: data.reply }]);
      } else {
        setCoachChatHistory(prev => [...prev, { role: 'model', text: "Hey partner, my strategy cards got crossed. Try asking again!" }]);
      }
    } catch (err) {
      setCoachChatHistory(prev => [...prev, { role: 'model', text: "Sassy Ace is temporarily taking a phone call. Check your environment keys in Settings!" }]);
    } finally {
      setIsCoachLoading(false);
    }
  };

  const handleAnalyzeHandWithAI = () => {
    handleGetCoachChatReply("Analyze my current hand and tell me what my ideal bid is, coach!");
  };

  const pUser = gameState.players.find(p => p.id === 'user')!;
  const pPartner = gameState.players.find(p => p.id === 'partner')!;
  const pLeft = gameState.players.find(p => p.id === 'left')!;
  const pRight = gameState.players.find(p => p.id === 'right')!;

  const isUserTurn = gameState.phase === 'playing' && gameState.players[gameState.currentPlayerIdx].id === 'user';
  const activeBidder = gameState.phase === 'bidding' ? gameState.players[gameState.currentPlayerIdx] : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="elite-ai-table-root">
      
      {/* SIDEBAR: Live Coach Chat & Standings */}
      <div className="lg:col-span-1 space-y-6 flex flex-col justify-between" id="ai-table-sidebar">
        
        {/* STANDINGS BAR */}
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-350 tracking-wider uppercase">
              Match Standings
            </h3>
            <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/35 text-indigo-300 px-2 py-0.5 rounded font-black font-mono">
              TARGET 500
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-900/65 rounded-xl border border-white/5 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-emerald-400">TEAM US (S+N)</h4>
                <div className="text-xl font-black font-mono text-white mt-0.5">{gameState.scoreTeamA}</div>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-slate-400 block font-semibold uppercase">Bags</span>
                <span className="text-xs font-bold text-amber-400 font-mono">
                  {gameState.bagsTeamA} / {gameState.gameRules.bagsPenaltyLimit}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-900/65 rounded-xl border border-white/5 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-indigo-400">TEAM THEM (W+E)</h4>
                <div className="text-xl font-black font-mono text-white mt-0.5">{gameState.scoreTeamB}</div>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-slate-400 block font-semibold uppercase">Bags</span>
                <span className="text-xs font-bold text-amber-400 font-mono">
                  {gameState.bagsTeamB} / {gameState.gameRules.bagsPenaltyLimit}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* GEMINI AI COACH CHAT WIDGET */}
        <div className="glass p-5 flex-1 flex flex-col min-h-[300px] border border-white/15 shadow-xl relative" id="coach-ai-widget">
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-indigo-500/10 px-1.5 py-0.5 rounded text-[8px] font-black text-indigo-300 tracking-wider">
            <Zap className="w-2.5 h-2.5 fill-current text-indigo-300 animate-pulse" />
            <span>GEMINI INTELLIGENCE</span>
          </div>

          <h3 className="text-xs font-black text-white tracking-wide uppercase mb-3 flex items-center gap-1.5 border-b border-white/5 pb-2">
            <MessageSquare className="w-4 h-4 text-indigo-400 shrink-0" />
            Sassy AI Spades Coach
          </h3>

          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[180px] lg:max-h-[300px] scrollbar-thin text-xs">
            {coachChatHistory.map((chat, idx) => (
              <div 
                key={idx} 
                className={`p-2.5 rounded-xl max-w-[90%] leading-relaxed ${
                  chat.role === 'user' 
                    ? 'bg-indigo-500 text-slate-950 font-semibold self-end ml-auto rounded-tr-none' 
                    : 'bg-white/5 text-slate-200 border border-white/10 rounded-tl-none'
                }`}
              >
                {chat.text}
              </div>
            ))}
            {isCoachLoading && (
              <div className="bg-white/5 p-2 rounded-xl text-slate-400 italic flex items-center gap-2 animate-pulse">
                <Clock className="w-3.5 h-3.5 animate-spin" />
                <span>Coach is thinking...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="mt-3.5 pt-3 border-t border-white/10 space-y-2">
            <button
              onClick={handleAnalyzeHandWithAI}
              disabled={gameState.phase !== 'bidding' && gameState.phase !== 'playing'}
              className="w-full py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 font-bold text-[10px] rounded-lg tracking-wider cursor-pointer"
            >
              ⭐ Analyze Hand (Ideal Bid)
            </button>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask Sassy Ace..."
                value={coachChatInput}
                onChange={e => setCoachChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGetCoachChatReply()}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg text-xs p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-white"
              />
              <button
                onClick={() => handleGetCoachChatReply()}
                className="px-2.5 py-1.5 bg-indigo-500 text-slate-950 rounded-lg font-black text-xs cursor-pointer"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* CONTROLS HUB */}
        <div className="space-y-2">
          <button
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            className="w-full py-2 bg-slate-950/40 hover:bg-slate-950/60 border border-white/10 rounded-xl text-xs font-bold text-slate-350 cursor-pointer flex items-center justify-center gap-1.5"
          >
            ⚙️ House Rules &amp; Settings
          </button>
          <button
            onClick={() => setActiveLeaderboard(!activeLeaderboard)}
            className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 rounded-xl text-xs font-bold text-indigo-300 cursor-pointer flex items-center justify-center gap-1.5"
          >
            🏆 Live Leaderboard
          </button>
        </div>

      </div>

      {/* CENTER & RIGHT: Spades Felt Table Area */}
      <div className="lg:col-span-3 flex flex-col space-y-4" id="ai-table-arena">
        
        {/* Main Felt Table Screen */}
        <div className="relative bg-gradient-to-b from-emerald-900 to-slate-950 rounded-3xl p-6 min-h-[440px] sm:min-h-[520px] shadow-2xl border-4 border-slate-800 flex flex-col justify-between overflow-hidden" id="spades-felt-table">
          
          {/* Table Ambient glow overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08)_0%,transparent_70%)] pointer-events-none" />

          {/* BROADCAST TV COMMENTARY TICKER */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[90%] bg-black/80 border border-indigo-500/20 py-2 px-4 rounded-xl flex items-center gap-2 z-20" id="broadcast-ticker">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0" />
            <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-extrabold px-1.5 py-0.5 rounded shrink-0 font-mono">
              LIVE BROADCAST
            </span>
            <marquee className="text-xs font-mono text-slate-200" scrollamount="4">
              {gameState.announcerCommentary || "Announcer preparing commentary..."}
            </marquee>
          </div>

          {/* GAME NOTIFICATION / ERRORS */}
          {errorMessage && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-rose-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg border border-rose-400 flex items-center gap-2 z-40 animate-bounce" id="felt-error-toast">
              <AlertCircle className="w-4 h-4" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* SETUP STAGE CARD */}
          {gameState.phase === 'setup' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-xs z-30 rounded-2xl">
              <div className="glass p-8 max-w-sm text-center animate-scaleUp">
                <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-pulse" />
                <h3 className="text-xl font-bold text-white">Deal the Next Hand</h3>
                <p className="text-xs text-slate-350 mt-2 leading-relaxed font-mono">
                  Lounge Level modifier active: prize chips and progression points loaded. Play with your custom cards backing theme!
                </p>
                <button
                  onClick={handleDealRound}
                  className="mt-6 w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-slate-950 font-bold rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer text-sm font-black"
                  id="felt-deal-btn"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Deal Cards
                </button>
              </div>
            </div>
          )}

          {/* TOP PLAYER: North Partner */}
          <div className="flex flex-col items-center relative z-10 pt-10" id="top-player-seat">
            
            {/* Speech Bubble */}
            {pPartner.trashTalkBubble && (
              <div className="absolute -top-1 bg-white text-slate-900 font-bold text-[10px] px-2 py-1 rounded-lg shadow-xl border-2 border-indigo-400 z-30 animate-bounce">
                💬 {pPartner.trashTalkBubble}
              </div>
            )}

            <div className={`px-4 py-1.5 rounded-full border transition-all text-center ${
              gameState.currentPlayerIdx === 2 && gameState.phase === 'playing'
                ? 'bg-indigo-500 text-slate-950 border-indigo-400 scale-105 shadow-lg shadow-indigo-500/20 font-black'
                : 'bg-slate-950/80 text-slate-300 border-white/10'
            }`}>
              <div className="text-[10px] font-bold tracking-wide uppercase flex items-center gap-1 justify-center">
                <User className="w-3 h-3 text-slate-400" />
                {pPartner.name}
              </div>
              <div className="text-xs font-semibold flex items-center gap-2 mt-0.5 justify-center">
                <span>Bid: {pPartner.bid === null ? '...' : pPartner.bid === 0 ? 'Nil' : pPartner.bid}</span>
                <span className="text-slate-500 font-bold">|</span>
                <span className="text-emerald-400 font-bold">Tricks: {pPartner.tricksWon}</span>
              </div>
            </div>
            
            {/* Cards Remaining indicator */}
            <div className="flex gap-0.5 mt-2 overflow-hidden max-w-[200px]">
              {Array.from({ length: pPartner.hand.length }).map((_, i) => (
                <div key={i} className="w-3.5 h-5 bg-gradient-to-b from-indigo-950 to-indigo-900 border border-indigo-500/20 rounded-[2px]" />
              ))}
            </div>
          </div>

          {/* MID LAYER: WEST (Left), CENTRAL MAT, EAST (Right) */}
          <div className="flex justify-between items-center my-4 relative z-10" id="mid-table-layer">
            
            {/* LEFT PLAYER: West */}
            <div className="flex flex-col items-center w-28 shrink-0 text-center relative" id="left-player-seat">
              
              {/* Speech Bubble */}
              {pLeft.trashTalkBubble && (
                <div className="absolute -top-7 bg-white text-slate-900 font-bold text-[10px] px-2 py-1 rounded-lg shadow-xl border-2 border-indigo-400 z-30 animate-bounce">
                  💬 {pLeft.trashTalkBubble}
                </div>
              )}

              <div className={`px-3 py-1.5 rounded-xl border transition-all ${
                gameState.currentPlayerIdx === 1 && gameState.phase === 'playing'
                  ? 'bg-indigo-500 text-slate-950 border-indigo-400 scale-105 shadow-lg shadow-indigo-500/20 font-black'
                  : 'bg-slate-950/80 text-slate-300 border-white/10'
              }`}>
                <div className="text-[9px] font-bold tracking-wide uppercase">{pLeft.name}</div>
                <div className="text-[11px] font-bold mt-0.5 flex flex-col">
                  <span>Bid: {pLeft.bid === null ? '...' : pLeft.bid === 0 ? 'Nil' : pLeft.bid}</span>
                  <span className="text-emerald-400">Tricks: {pLeft.tricksWon}</span>
                </div>
              </div>
              
              {/* Reneg Suspect warning caller */}
              {gameState.gameRules.allowReneging && gameState.phase === 'playing' && (
                <button
                  onClick={() => handleUserCallsReneg('left')}
                  className="mt-2 py-0.5 px-1 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[8px] font-black rounded hover:bg-rose-500/35 cursor-pointer"
                >
                  ⚠️ Call Reneg!
                </button>
              )}

              <div className="flex flex-col gap-0.5 mt-2">
                {Array.from({ length: pLeft.hand.length }).map((_, i) => (
                  <div key={i} className="w-5 h-2 bg-gradient-to-r from-indigo-950 to-indigo-900 border border-indigo-500/20 rounded-[2px]" />
                ))}
              </div>
            </div>

            {/* CENTRAL TRICK MAT */}
            <div className="relative flex-1 max-w-[280px] h-[180px] bg-emerald-950/20 rounded-full border border-emerald-800/20 flex items-center justify-center mx-4" id="central-trick-mat">
              
              {/* Spades symbol watermark */}
              <div className="absolute inset-0 flex items-center justify-center text-emerald-800/10 pointer-events-none select-none">
                <span className="text-[120px] font-black">♠</span>
              </div>

              {/* Played Cards */}
              <div className="relative w-full h-full">
                
                {gameState.currentTrick.plays.map((play) => {
                  const card = play.card;
                  const isWinner = gameState.currentTrick.winnerId === play.playerId;

                  let cardStyle = '';
                  if (play.playerId === 'user') cardStyle = 'bottom-2 left-1/2 -translate-x-1/2';
                  if (play.playerId === 'partner') cardStyle = 'top-2 left-1/2 -translate-x-1/2';
                  if (play.playerId === 'left') cardStyle = 'left-2 top-1/2 -translate-y-1/2';
                  if (play.playerId === 'right') cardStyle = 'right-2 top-1/2 -translate-y-1/2';

                  const suitSymbols = {
                    [Suit.CLUBS]: '♣',
                    [Suit.DIAMONDS]: '♦',
                    [Suit.HEARTS]: '♥',
                    [Suit.SPADES]: '♠',
                  };

                  let displayRank = card.rank.toString();
                  if (card.rank === Rank.JACK) displayRank = 'J';
                  if (card.rank === Rank.QUEEN) displayRank = 'Q';
                  if (card.rank === Rank.KING) displayRank = 'K';
                  if (card.rank === Rank.ACE) displayRank = 'A';

                  const isRed = card.suit === Suit.HEARTS || card.suit === Suit.DIAMONDS;

                  return (
                    <motion.div
                      key={play.playerId}
                      layoutId={`played-card-${card.id}`}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`absolute w-12 h-18 bg-white dark:bg-slate-100 rounded-lg shadow-xl border-2 flex flex-col justify-between p-1 select-none ${
                        isWinner 
                          ? 'border-yellow-400 ring-4 ring-yellow-400/50 scale-105 z-20' 
                          : 'border-slate-300'
                      } ${cardStyle}`}
                      id={`felt-played-card-${play.playerId}`}
                    >
                      <div className={`text-[11px] font-bold flex items-center justify-between leading-none ${isRed ? 'text-rose-500' : 'text-slate-900'}`}>
                        <span>{displayRank}</span>
                        <span className="text-xs">{suitSymbols[card.suit]}</span>
                      </div>
                      <div className={`text-xl font-bold text-center leading-none ${isRed ? 'text-rose-500' : 'text-slate-900'}`}>
                        {suitSymbols[card.suit]}
                      </div>
                      <div className={`text-[11px] font-bold flex items-center justify-between leading-none rotate-180 ${isRed ? 'text-rose-500' : 'text-slate-900'}`}>
                        <span>{displayRank}</span>
                        <span className="text-xs">{suitSymbols[card.suit]}</span>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Lead suit indicator */}
                {gameState.currentTrick.leadSuit && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 text-white font-mono text-[9px] px-2 py-0.5 rounded border border-slate-700/80 uppercase">
                    Lead: {gameState.currentTrick.leadSuit}
                  </div>
                )}
                
                {/* Trick Result Callout */}
                {gameState.phase === 'trick_result' && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/90 border border-yellow-500/40 px-3 py-2 rounded-xl text-center shadow-2xl z-30 max-w-[200px]">
                    <div className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider font-mono">Winner of Book!</div>
                    <div className="text-xs font-bold text-white mt-1">
                      {gameState.currentTrick.winnerId === 'user' ? 'You' : gameState.players.find(p => p.id === gameState.currentTrick.winnerId)?.name}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* RIGHT PLAYER: East */}
            <div className="flex flex-col items-center w-28 shrink-0 text-center relative" id="right-player-seat">
              
              {/* Speech Bubble */}
              {pRight.trashTalkBubble && (
                <div className="absolute -top-7 bg-white text-slate-900 font-bold text-[10px] px-2 py-1 rounded-lg shadow-xl border-2 border-indigo-400 z-30 animate-bounce">
                  💬 {pRight.trashTalkBubble}
                </div>
              )}

              <div className={`px-3 py-1.5 rounded-xl border transition-all ${
                gameState.currentPlayerIdx === 3 && gameState.phase === 'playing'
                  ? 'bg-indigo-500 text-slate-950 border-indigo-400 scale-105 shadow-lg shadow-indigo-500/20 font-black'
                  : 'bg-slate-950/80 text-slate-300 border-white/10'
              }`}>
                <div className="text-[9px] font-bold tracking-wide uppercase">{pRight.name}</div>
                <div className="text-[11px] font-bold mt-0.5 flex flex-col">
                  <span>Bid: {pRight.bid === null ? '...' : pRight.bid === 0 ? 'Nil' : pRight.bid}</span>
                  <span className="text-emerald-400">Tricks: {pRight.tricksWon}</span>
                </div>
              </div>
              
              {/* Reneg Suspect warning caller */}
              {gameState.gameRules.allowReneging && gameState.phase === 'playing' && (
                <button
                  onClick={() => handleUserCallsReneg('right')}
                  className="mt-2 py-0.5 px-1 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[8px] font-black rounded hover:bg-rose-500/35 cursor-pointer"
                >
                  ⚠️ Call Reneg!
                </button>
              )}

              <div className="flex flex-col gap-0.5 mt-2">
                {Array.from({ length: pRight.hand.length }).map((_, i) => (
                  <div key={i} className="w-5 h-2 bg-gradient-to-l from-indigo-950 to-indigo-900 border border-indigo-500/20 rounded-[2px]" />
                ))}
              </div>
            </div>

          </div>

          {/* LOWER BAR: User Area */}
          <div className="flex flex-col items-center relative z-10 w-full" id="bottom-player-seat">
            
            {/* Speech Bubble */}
            {pUser.trashTalkBubble && (
              <div className="absolute -top-12 bg-indigo-500 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl shadow-xl border border-indigo-400 z-30 animate-bounce">
                📢 {pUser.trashTalkBubble}
              </div>
            )}

            {/* Bidding selection buttons */}
            {gameState.phase === 'bidding' && activeBidder?.id === 'user' && (
              <div className="p-4 glass max-w-lg w-full mb-4 animate-scaleUp text-center shadow-2xl">
                <h4 className="text-xs font-bold text-slate-300 tracking-wider uppercase mb-3">
                  Place Your Bid!
                </h4>
                <div className="grid grid-cols-7 gap-2">
                  <button
                    onClick={() => handleUserBid(0)}
                    className="p-2 bg-indigo-500 hover:bg-indigo-600 text-slate-950 font-black text-xs rounded-xl shadow-lg cursor-pointer hover:scale-105 transition-all"
                    id="bid-btn-nil"
                  >
                    Nil (0)
                  </button>
                  {Array.from({ length: 13 }).map((_, idx) => {
                    const b = idx + 1;
                    return (
                      <button
                        key={b}
                        onClick={() => handleUserBid(b)}
                        className="p-2 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl border border-white/10 cursor-pointer hover:scale-105 transition-all"
                        id={`bid-btn-${b}`}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status indicators */}
            <div className="flex gap-2 mb-3">
              <div className={`px-4 py-1.5 rounded-full border transition-all text-center ${
                isUserTurn
                  ? 'bg-indigo-500 text-slate-950 border-indigo-400 scale-105 shadow-lg shadow-indigo-500/20 font-black'
                  : 'bg-slate-950/80 text-slate-300 border-white/10'
              }`}>
                <div className="text-[10px] font-bold tracking-wide uppercase">
                  {isUserTurn ? '👉 YOUR TURN' : 'You (South)'}
                </div>
                <div className="text-xs font-semibold flex items-center gap-2 mt-0.5 justify-center">
                  <span>Bid: {pUser.bid === null ? '...' : pUser.bid === 0 ? 'Nil' : pUser.bid}</span>
                  <span className="text-slate-500 font-bold">|</span>
                  <span className="text-emerald-400 font-bold">Tricks: {pUser.tricksWon}</span>
                </div>
              </div>

              {/* Instant Trash talk keys */}
              {gameState.phase === 'playing' && (
                <div className="flex gap-1 items-center">
                  {['Spades is my lingo!', 'Watch that bag!', 'You reneg!'].map((phrase) => (
                    <button
                      key={phrase}
                      onClick={() => handleUserTriggerChat(phrase)}
                      className="px-2 py-1.5 bg-slate-950/80 hover:bg-slate-900 border border-white/10 rounded-full text-[9px] font-bold text-slate-300 cursor-pointer"
                    >
                      💬 {phrase}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Hand Cards */}
            <div className="flex gap-1 overflow-x-auto max-w-full pb-2 px-4 scrollbar-none justify-center" id="user-hand-cards">
              <AnimatePresence>
                {pUser.hand.map((card) => {
                  const check = isCardPlayable(card, pUser.hand, gameState.currentTrick.leadSuit, gameState.spadesBroken);
                  const isPlayable = check.playable || gameState.gameRules.allowReneging; // Reneg toggles override strict rules!

                  const suitSymbols = {
                    [Suit.CLUBS]: '♣',
                    [Suit.DIAMONDS]: '♦',
                    [Suit.HEARTS]: '♥',
                    [Suit.SPADES]: '♠',
                  };

                  let displayRank = card.rank.toString();
                  if (card.rank === Rank.JACK) displayRank = 'J';
                  if (card.rank === Rank.QUEEN) displayRank = 'Q';
                  if (card.rank === Rank.KING) displayRank = 'K';
                  if (card.rank === Rank.ACE) displayRank = 'A';

                  const isRed = card.suit === Suit.HEARTS || card.suit === Suit.DIAMONDS;

                  // custom card backing styles based on Purchased stores
                  let skinClass = 'bg-white border-slate-200';
                  if (deckStyle === 'deck_gold') skinClass = 'bg-amber-500/10 border-amber-400/40 text-amber-300 shadow-lg';
                  if (deckStyle === 'deck_neon') skinClass = 'bg-purple-950 border-purple-500/50 text-purple-300 shadow-xl';

                  return (
                    <motion.button
                      key={card.id}
                      layoutId={`played-card-${card.id}`}
                      onClick={() => handleUserPlayCard(card)}
                      disabled={gameState.phase !== 'playing' || !isUserTurn}
                      className={`relative w-12 sm:w-14 h-20 rounded-xl shadow-md border-2 p-1.5 flex flex-col justify-between text-left select-none transition-all cursor-pointer ${skinClass} ${
                        gameState.phase === 'playing' && isUserTurn
                          ? isPlayable
                            ? 'hover:-translate-y-4 hover:shadow-xl hover:border-emerald-500'
                            : 'opacity-40 cursor-not-allowed'
                          : 'opacity-90'
                      }`}
                      title={getCardName(card)}
                      id={`felt-card-btn-${card.id}`}
                    >
                      <div className={`text-xs font-bold flex items-center justify-between leading-none ${isRed && deckStyle === 'deck_classic' ? 'text-rose-500' : 'text-slate-950 dark:text-white'}`}>
                        <span>{displayRank}</span>
                        <span className="text-sm">{suitSymbols[card.suit]}</span>
                      </div>
                      <div className={`text-2xl font-bold text-center leading-none ${isRed && deckStyle === 'deck_classic' ? 'text-rose-500' : 'text-slate-950 dark:text-white'}`}>
                        {suitSymbols[card.suit]}
                      </div>
                      <div className={`text-xs font-bold flex items-center justify-between leading-none rotate-180 ${isRed && deckStyle === 'deck_classic' ? 'text-rose-500' : 'text-slate-950 dark:text-white'}`}>
                        <span>{displayRank}</span>
                        <span className="text-sm">{suitSymbols[card.suit]}</span>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>

          </div>

        </div>

      </div>

      {/* HOUSE RULES SETTINGS SIDE-PANEL / MODAL */}
      {showSettingsDrawer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" id="rules-settings-drawer">
          <div className="glass max-w-sm w-full p-6 space-y-4 animate-scaleUp">
            <h3 className="text-lg font-black text-white border-b border-white/10 pb-2">House Rules Customizer</h3>
            
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Allow Reneging (Trick Play)</h4>
                  <p className="text-[10px] text-slate-400">Enables illegal street play &amp; reneg penalties.</p>
                </div>
                <button onClick={handleToggleReneging} className="text-indigo-400">
                  {gameState.gameRules.allowReneging ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10 text-slate-500" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Audio &amp; Sounds</h4>
                  <p className="text-[10px] text-slate-400">Procedural synthesizers for deck action.</p>
                </div>
                <button onClick={() => setGameState(p => ({ ...p, gameRules: { ...p.gameRules, soundEffectsEnabled: !p.gameRules.soundEffectsEnabled }}))} className="text-indigo-400">
                  {gameState.gameRules.soundEffectsEnabled ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10 text-slate-500" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">AI Trash-Talking</h4>
                  <p className="text-[10px] text-slate-400">AI bots throw sassy lingo dialogue bubbles.</p>
                </div>
                <button onClick={() => setGameState(p => ({ ...p, gameRules: { ...p.gameRules, aiTrashTalkEnabled: !p.gameRules.aiTrashTalkEnabled }}))} className="text-indigo-400">
                  {gameState.gameRules.aiTrashTalkEnabled ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10 text-slate-500" />}
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowSettingsDrawer(false)}
              className="w-full py-2 bg-indigo-500 text-slate-950 font-black rounded-xl text-xs cursor-pointer"
            >
              Apply Rules &amp; Save
            </button>
          </div>
        </div>
      )}

      {/* LEADERBOARD DRAWER */}
      {activeLeaderboard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" id="leaderboard-drawer">
          <div className="glass max-w-sm w-full p-6 space-y-4 animate-scaleUp">
            <h3 className="text-lg font-black text-white border-b border-white/10 pb-2">Live Spades Leaderboard</h3>
            
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {LEADERBOARD_ENTRIES.map((player, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-xl flex items-center justify-between border ${
                    player.active 
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300' 
                      : 'bg-white/5 border-white/5 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-black font-mono">#{idx+1}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-black truncate">{player.name}</div>
                      <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">{player.tier}</div>
                    </div>
                  </div>
                  <div className="text-xs font-bold font-mono text-amber-400">
                    💰 {player.chips.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveLeaderboard(false)}
              className="w-full py-2 bg-indigo-500 text-slate-950 font-black rounded-xl text-xs cursor-pointer"
            >
              Close Leaderboards
            </button>
          </div>
        </div>
      )}

      {/* ROUND END RECAP MODAL DIALOG */}
      {showScoreModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" id="round-score-modal">
          <div className="glass max-w-lg w-full overflow-hidden animate-scaleUp">
            
            <div className="p-6 bg-gradient-to-r from-indigo-950 to-purple-950 text-white text-center relative border-b border-white/10">
              <Sparkles className="w-12 h-12 text-yellow-300 mx-auto mb-2 animate-bounce" />
              <h3 className="text-2xl font-black">Round #{gameState.roundNumber} Scoreboard</h3>
              <p className="text-xs text-slate-300 mt-1">
                Cumulative partnership scores loaded
              </p>
            </div>

            <div className="p-6 space-y-6">
              
              <div className="grid grid-cols-2 gap-4 text-center">
                
                {/* Team Us Card */}
                <div className="p-4 bg-slate-950/40 border border-emerald-500/20 rounded-xl">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                    Team Us (You + Partner)
                  </h4>
                  <div className="text-[11px] text-slate-300 mt-2 space-y-1">
                    <div>Your Bid: <span className="font-bold text-white">{pUser.bid === 0 ? 'Nil' : pUser.bid}</span> (Tricks: {pUser.tricksWon})</div>
                    <div>Partner Bid: <span className="font-bold text-white">{pPartner.bid === 0 ? 'Nil' : pPartner.bid}</span> (Tricks: {pPartner.tricksWon})</div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <span className="text-[10px] text-slate-400 uppercase block font-semibold">Cumulative Score</span>
                    <span className="text-3xl font-black text-white font-mono">
                      {gameState.scoreTeamA}
                    </span>
                    <span className="text-[10px] text-amber-400 block font-bold mt-1">
                      {gameState.bagsTeamA} / {gameState.gameRules.bagsPenaltyLimit} Sandbags
                    </span>
                  </div>
                </div>

                {/* Team Them Card */}
                <div className="p-4 bg-slate-950/40 border border-indigo-500/20 rounded-xl">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wide">
                    Team Them (AI Opponents)
                  </h4>
                  <div className="text-[11px] text-slate-300 mt-2 space-y-1">
                    <div>West Bid: <span className="font-bold text-white">{pLeft.bid === 0 ? 'Nil' : pLeft.bid}</span> (Tricks: {pLeft.tricksWon})</div>
                    <div>East Bid: <span className="font-bold text-white">{pRight.bid === 0 ? 'Nil' : pRight.bid}</span> (Tricks: {pRight.tricksWon})</div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <span className="text-[10px] text-slate-400 uppercase block font-semibold">Cumulative Score</span>
                    <span className="text-3xl font-black text-white font-mono">
                      {gameState.scoreTeamB}
                    </span>
                    <span className="text-[10px] text-amber-400 block font-bold mt-1">
                      {gameState.bagsTeamB} / {gameState.gameRules.bagsPenaltyLimit} Sandbags
                    </span>
                  </div>
                </div>

              </div>

              <button
                onClick={handleProceedToNextRound}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-slate-950 font-black rounded-xl text-sm cursor-pointer shadow-lg transition-all"
              >
                Proceed to Next Hand
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
