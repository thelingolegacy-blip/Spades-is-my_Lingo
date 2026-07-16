/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Suit {
  CLUBS = 'CLUBS',
  DIAMONDS = 'DIAMONDS',
  HEARTS = 'HEARTS',
  SPADES = 'SPADES',
}

export enum Rank {
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
  NINE = 9,
  TEN = 10,
  JACK = 11,
  QUEEN = 12,
  KING = 13,
  ACE = 14,
}

export interface CardModel {
  suit: Suit;
  rank: Rank;
  id: string; // unique ID like "S14" (Ace of Spades) or "H2"
}

export interface Player {
  id: string; // 'user' (South), 'partner' (North), 'left' (East), 'right' (West)
  name: string;
  hand: CardModel[];
  bid: number | null; // null means not bid yet. -1 means Nil, -2 means Blind Nil
  tricksWon: number;
  avatarUrl?: string; // custom avatar
  deckStyle?: string; // custom card deck skin
  trashTalkBubble?: string; // active text speech bubble
  actualSuitsInHand?: Suit[]; // helper to check if they are reneging!
}

export interface TrickPlay {
  playerId: string;
  card: CardModel;
}

export interface Trick {
  plays: TrickPlay[];
  leadSuit: Suit | null;
  winnerId: string | null;
}

export type GamePhase = 'setup' | 'bidding' | 'playing' | 'trick_result' | 'round_score' | 'game_over';

export interface EliteGameRules {
  allowReneging: boolean; // trick play: let players play out-of-suit even if they have it!
  soundEffectsEnabled: boolean;
  aiTrashTalkEnabled: boolean;
  musicEnabled: boolean;
  bagsPenaltyLimit: number; // default 10 bags
}

export interface SpadesGameState {
  players: Player[];
  dealerIdx: number; // 0: user, 1: left, 2: partner, 3: right
  currentPlayerIdx: number;
  currentTrick: Trick;
  tricksHistory: Trick[];
  spadesBroken: boolean;
  phase: GamePhase;
  roundNumber: number;
  scoreTeamA: number; // User + Partner (South + North)
  scoreTeamB: number; // Left + Right (East + West)
  bagsTeamA: number;
  bagsTeamB: number;
  logs: string[];
  lingoHighlights: LingoAlert[];
  gameRules: EliteGameRules;
  announcerCommentary?: string; // live AI broadcast commentary
  renegeViolationsCount?: { teamA: number; teamB: number }; // counts of successfully caught renegers
}

export interface LingoAlert {
  id: string;
  term: string;
  explanation: string;
  timestamp: string;
}

export interface LingoTerm {
  term: string;
  definition: string;
  example: string;
  category: 'bidding' | 'scoring' | 'gameplay' | 'slang';
}

// Score Tracker interfaces for real-life scorekeeping
export interface TrackerTeam {
  name: string;
  score: number;
  bags: number;
}

export interface TrackerRound {
  roundNumber: number;
  teamABid: number;
  teamABagBid: boolean; // Nil or Blind Nil
  teamAActual: number;
  teamAScoreChange: number;
  teamABagsChange: number;
  
  teamBBid: number;
  teamBBagBid: boolean;
  teamBActual: number;
  teamBScoreChange: number;
  teamBBagsChange: number;
}

export interface TrackerState {
  teamA: TrackerTeam;
  teamB: TrackerTeam;
  rounds: TrackerRound[];
  winningScore: number;
}

// Global Lounge Room maps (Google Maps Rooms)
export interface LoungeRoom {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  entryFee: number;
  prizePool: number;
  minLevel: number;
  description: string;
  isUnlocked: boolean;
}

// Solo Progression Hub States
export interface SoloProgression {
  chips: number;
  sweepstakesTickets: number;
  xp: number;
  level: number;
  activeSweepstakesEntries: number;
  streakDays: number;
}
