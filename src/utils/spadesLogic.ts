/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suit, Rank, CardModel, Player, Trick, TrickPlay } from '../types';

// Create a full 52-card deck
export function createDeck(): CardModel[] {
  const deck: CardModel[] = [];
  const suits = [Suit.CLUBS, Suit.DIAMONDS, Suit.HEARTS, Suit.SPADES];
  const ranks = [
    Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
    Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE
  ];

  for (const suit of suits) {
    for (const rank of ranks) {
      const suitChar = suit[0];
      const rankVal = rank;
      deck.push({
        suit,
        rank,
        id: `${suitChar}${rankVal}`,
      });
    }
  }
  return deck;
}

// Shuffle deck using Fisher-Yates
export function shuffleDeck(deck: CardModel[]): CardModel[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper to sort cards by Suit first (Spades, Hearts, Diamonds, Clubs) then by Rank descending
export function sortHand(hand: CardModel[]): CardModel[] {
  const suitOrder = {
    [Suit.SPADES]: 4,
    [Suit.HEARTS]: 3,
    [Suit.DIAMONDS]: 2,
    [Suit.CLUBS]: 1,
  };

  return [...hand].sort((a, b) => {
    if (a.suit !== b.suit) {
      return suitOrder[b.suit] - suitOrder[a.suit];
    }
    return b.rank - a.rank;
  });
}

// Deal 13 cards to 4 players and return sorted hands
export function dealHands(shuffledDeck: CardModel[]): CardModel[][] {
  const hands: CardModel[][] = [[], [], [], []];
  for (let i = 0; i < shuffledDeck.length; i++) {
    hands[i % 4].push(shuffledDeck[i]);
  }
  return hands.map(sortHand);
}

// Get elegant string representations for cards
export function getCardName(card: CardModel): string {
  const suitNames = {
    [Suit.CLUBS]: 'Clubs ♣',
    [Suit.DIAMONDS]: 'Diamonds ♦',
    [Suit.HEARTS]: 'Hearts ♥',
    [Suit.SPADES]: 'Spades ♠',
  };

  let rankName = card.rank.toString();
  if (card.rank === Rank.JACK) rankName = 'Jack';
  if (card.rank === Rank.QUEEN) rankName = 'Queen';
  if (card.rank === Rank.KING) rankName = 'King';
  if (card.rank === Rank.ACE) rankName = 'Ace';

  return `${rankName} of ${suitNames[card.suit]}`;
}

// Get CSS text color based on suit
export function getSuitColor(suit: Suit): string {
  if (suit === Suit.HEARTS || suit === Suit.DIAMONDS) {
    return 'text-rose-500';
  }
  return 'text-slate-800 dark:text-slate-200';
}

// Check if a card is valid to play in the current trick
export function isCardPlayable(
  card: CardModel,
  hand: CardModel[],
  leadSuit: Suit | null,
  spadesBroken: boolean
): { playable: boolean; reason?: string } {
  // If we are following a lead suit
  if (leadSuit !== null) {
    const hasLeadSuit = hand.some((c) => c.suit === leadSuit);
    if (hasLeadSuit) {
      if (card.suit === leadSuit) {
        return { playable: true };
      } else {
        return { playable: false, reason: `Must follow suit: Play a card of ${leadSuit}` };
      }
    }
    // If we don't have lead suit, we can play anything
    return { playable: true };
  }

  // If leading the trick (leadSuit is null)
  if (card.suit === Suit.SPADES) {
    // Cannot lead spades unless spades are broken or hand only contains spades
    const handOnlySpades = hand.every((c) => c.suit === Suit.SPADES);
    if (spadesBroken || handOnlySpades) {
      return { playable: true };
    } else {
      return { playable: false, reason: "Spades haven't been broken yet. Lead another suit." };
    }
  }

  return { playable: true };
}

// Evaluate the winner of the current trick
// Plays is an array of exactly 4 plays
export function evaluateTrickWinner(plays: TrickPlay[], leadSuit: Suit): string {
  if (plays.length !== 4) return '';

  let winningPlay = plays[0];

  for (let i = 1; i < plays.length; i++) {
    const currentPlay = plays[i];
    const bestCard = winningPlay.card;
    const currentCard = currentPlay.card;

    if (currentCard.suit === Suit.SPADES) {
      if (bestCard.suit === Suit.SPADES) {
        // Both are spades, highest rank wins
        if (currentCard.rank > bestCard.rank) {
          winningPlay = currentPlay;
        }
      } else {
        // Spade trumps non-spade
        winningPlay = currentPlay;
      }
    } else if (currentCard.suit === leadSuit) {
      if (bestCard.suit !== Suit.SPADES) {
        // Neither is spade, but current followed lead suit. If best didn't lead suit and isn't spade, current wins.
        // If best did follow lead suit, highest rank wins.
        if (bestCard.suit === leadSuit) {
          if (currentCard.rank > bestCard.rank) {
            winningPlay = currentPlay;
          }
        } else {
          winningPlay = currentPlay;
        }
      }
    }
    // If current is not spade and does not follow lead suit, it cannot win.
  }

  return winningPlay.playerId;
}

// Standard Spades AI Bidding Helper
// Returns suggested bid from 0 (Nil) to 13
export function calculateAIBid(hand: CardModel[]): number {
  let bid = 0;

  // Count Aces and Kings in non-spades
  const nonSpades = hand.filter((c) => c.suit !== Suit.SPADES);
  const clubs = nonSpades.filter((c) => c.suit === Suit.CLUBS);
  const diamonds = nonSpades.filter((c) => c.suit === Suit.DIAMONDS);
  const hearts = nonSpades.filter((c) => c.suit === Suit.HEARTS);
  const spades = hand.filter((c) => c.suit === Suit.SPADES);

  const suits = [clubs, diamonds, hearts];
  for (const suitCards of suits) {
    const hasAce = suitCards.some((c) => c.rank === Rank.ACE);
    const hasKing = suitCards.some((c) => c.rank === Rank.KING);
    const hasQueen = suitCards.some((c) => c.rank === Rank.QUEEN);

    if (hasAce) bid += 1.0;
    // King is safe if we have at least 2 cards in that suit
    if (hasKing && suitCards.length >= 2) bid += 0.75;
    if (hasQueen && suitCards.length >= 3) bid += 0.25;
  }

  // Spades evaluation
  if (spades.length > 0) {
    const hasAceS = spades.some((c) => c.rank === Rank.ACE);
    const hasKingS = spades.some((c) => c.rank === Rank.KING);
    const hasQueenS = spades.some((c) => c.rank === Rank.QUEEN);
    const hasJackS = spades.some((c) => c.rank === Rank.JACK);

    if (hasAceS) bid += 1.0;
    if (hasKingS) bid += 1.0;
    if (hasQueenS && spades.length >= 2) bid += 0.8;
    if (hasJackS && spades.length >= 3) bid += 0.5;

    // Length of spades: additional spades above 3 count as half a trick
    if (spades.length > 3) {
      bid += (spades.length - 3) * 0.5;
    }
  }

  // Adjust for extreme short suits (singleton or void) if we have enough trumps to trump in!
  if (spades.length >= 3) {
    const clubLen = clubs.length;
    const diaLen = diamonds.length;
    const heartLen = hearts.length;

    if (clubLen === 0) bid += 1.0;
    else if (clubLen === 1) bid += 0.5;

    if (diaLen === 0) bid += 1.0;
    else if (diaLen === 1) bid += 0.5;

    if (heartLen === 0) bid += 1.0;
    else if (heartLen === 1) bid += 0.5;
  }

  const finalBid = Math.round(bid);

  // If hand is extremely weak (no face cards, few spades, low spades), sometimes play Nil (0)!
  const hasHighCard = hand.some((c) => c.rank >= Rank.JACK);
  if (!hasHighCard && spades.length <= 2 && finalBid <= 1) {
    return 0; // Bid Nil!
  }

  return Math.max(1, finalBid);
}

// Standard Spades AI Playing Strategy
// Evaluates which card in hand is best to play
export function selectAICard(
  hand: CardModel[],
  leadSuit: Suit | null,
  spadesBroken: boolean,
  currentPlays: TrickPlay[],
  playerId: string,
  partnerId: string
): CardModel {
  // 1. Filter valid playable cards
  const playableCards = hand.filter((card) => isCardPlayable(card, hand, leadSuit, spadesBroken).playable);

  if (playableCards.length === 0) {
    // Fallback: should never happen if game logic is sound
    return hand[0];
  }

  // 2. If leading the trick (leadSuit is null)
  if (leadSuit === null) {
    // Try leading a solid winning card first (e.g. Ace or King of non-spades)
    const highNonSpades = playableCards.filter(
      (c) => c.suit !== Suit.SPADES && (c.rank === Rank.ACE || c.rank === Rank.KING)
    );
    if (highNonSpades.length > 0) {
      return highNonSpades[0];
    }

    // Otherwise, lead a medium-low card to clear a suit or avoid drawing spade too early
    const nonSpades = playableCards.filter((c) => c.suit !== Suit.SPADES);
    if (nonSpades.length > 0) {
      // Sort ascending, play a relatively low card
      nonSpades.sort((a, b) => a.rank - b.rank);
      return nonSpades[Math.floor(nonSpades.length / 3)] || nonSpades[0];
    }

    // Must lead spade
    playableCards.sort((a, b) => a.rank - b.rank);
    return playableCards[0];
  }

  // 3. If following a suit and cards played already
  // Let's analyze who is currently winning the trick
  let winningPlay: TrickPlay | null = null;
  if (currentPlays.length > 0) {
    let winningPlayerId = evaluateTrickWinner(currentPlays, leadSuit);
    winningPlay = currentPlays.find((p) => p.playerId === winningPlayerId) || null;
  }

  const isPartnerWinning = winningPlay && winningPlay.playerId === partnerId;

  // Let's check if we can follow the lead suit
  const leadSuitCards = playableCards.filter((c) => c.suit === leadSuit);

  if (leadSuitCards.length > 0) {
    // We must follow suit!
    leadSuitCards.sort((a, b) => a.rank - b.rank); // ascending

    if (isPartnerWinning) {
      // Partner is winning. No need to waste a high card! Play our absolute lowest card of lead suit
      return leadSuitCards[0];
    }

    // Opponent is winning. Can we beat the current highest card?
    if (winningPlay) {
      const highestCardInLead = winningPlay.card.suit === leadSuit ? winningPlay.card.rank : 0;
      const cardsThatCanBeatIt = leadSuitCards.filter((c) => c.rank > highestCardInLead);

      if (cardsThatCanBeatIt.length > 0 && winningPlay.card.suit !== Suit.SPADES) {
        // Play the smallest card that beats it (to be efficient)
        return cardsThatCanBeatIt[0];
      }
    }

    // Otherwise we can't beat it, or a Spade trumps it. Play our lowest card to shed.
    return leadSuitCards[0];
  }

  // 4. If we are void in lead suit! We can play anything (trump spade, or sluff/discard)
  const spades = playableCards.filter((c) => c.suit === Suit.SPADES);
  spades.sort((a, b) => a.rank - b.rank);

  if (spades.length > 0) {
    if (isPartnerWinning) {
      // Partner is winning. Don't waste a spade! Play our lowest non-spade card (sluff)
      const nonSpades = playableCards.filter((c) => c.suit !== Suit.SPADES);
      if (nonSpades.length > 0) {
        nonSpades.sort((a, b) => a.rank - b.rank);
        return nonSpades[0];
      }
      // If we only have spades, play our lowest spade
      return spades[0];
    }

    // Opponent is winning. Can we play a spade to trump?
    if (winningPlay) {
      if (winningPlay.card.suit === Suit.SPADES) {
        // They already trumped. Can we overtrump?
        const highestSpadeRank = winningPlay.card.rank;
        const strongerSpades = spades.filter((c) => c.rank > highestSpadeRank);
        if (strongerSpades.length > 0) {
          return strongerSpades[0]; // play lowest spade that can win
        }
      } else {
        // They played a non-spade. Any spade we play wins! Play our lowest spade.
        return spades[0];
      }
    }
  }

  // If no spades or partner winning or can't win, play our absolute lowest rank card of any suit to discard
  const sortedByRank = [...playableCards].sort((a, b) => a.rank - b.rank);
  // Avoid discarding high spades or high aces if we can help it
  const nonTrumpLow = sortedByRank.filter((c) => c.suit !== Suit.SPADES && c.rank < Rank.JACK);
  if (nonTrumpLow.length > 0) {
    return nonTrumpLow[0];
  }

  return sortedByRank[0];
}

// Calculate scores for a round based on Spades partnership rules
// If a team bid is Nil (0), it is processed separately from their partner's bid.
export interface RoundScoreOutput {
  scoreChange: number;
  bagsChange: number;
  message: string;
}

export function calculateTeamRoundScore(
  player1Bid: number, // e.g. user bid
  player1Actual: number, // user actual tricks
  player2Bid: number, // partner bid
  player2Actual: number, // partner actual tricks
): RoundScoreOutput {
  let scoreChange = 0;
  let bagsChange = 0;
  let logs: string[] = [];

  const isP1Nil = player1Bid === 0;
  const isP2Nil = player2Bid === 0;

  // Case 1: Both partners bid Nil (rare, but possible!)
  if (isP1Nil && isP2Nil) {
    // Player 1 Nil
    if (player1Actual === 0) {
      scoreChange += 100;
      logs.push("Player 1 successful Nil (+100)");
    } else {
      scoreChange -= 100;
      bagsChange += player1Actual;
      logs.push(`Player 1 failed Nil (-100, +${player1Actual} bags)`);
    }

    // Player 2 Nil
    if (player2Actual === 0) {
      scoreChange += 100;
      logs.push("Player 2 successful Nil (+100)");
    } else {
      scoreChange -= 100;
      bagsChange += player2Actual;
      logs.push(`Player 2 failed Nil (-100, +${player2Actual} bags)`);
    }

    return {
      scoreChange,
      bagsChange,
      message: logs.join(", ")
    };
  }

  // Case 2: Player 1 bid Nil, Player 2 bid normal
  if (isP1Nil) {
    // Process P1 Nil
    if (player1Actual === 0) {
      scoreChange += 100;
      logs.push("Successful Nil (+100)");
    } else {
      scoreChange -= 100;
      // In many rules, failed nil tricks count as bags, or contribute to partner's bid
      bagsChange += player1Actual;
      logs.push(`Failed Nil (-100, +${player1Actual} bags)`);
    }

    // Process P2 normal bid
    const target = player2Bid;
    const actual = player2Actual;

    if (actual >= target) {
      scoreChange += target * 10;
      const overtricks = actual - target;
      scoreChange += overtricks;
      bagsChange += overtricks;
      logs.push(`Partner met bid of ${target} with ${actual} (+${target * 10 + overtricks} pts, +${overtricks} bags)`);
    } else {
      scoreChange -= target * 10;
      logs.push(`Partner set on bid of ${target} with ${actual} (-${target * 10} pts)`);
    }

    return {
      scoreChange,
      bagsChange,
      message: logs.join(" | ")
    };
  }

  // Case 3: Player 2 bid Nil, Player 1 bid normal
  if (isP2Nil) {
    // Process P2 Nil
    if (player2Actual === 0) {
      scoreChange += 100;
      logs.push("Partner successful Nil (+100)");
    } else {
      scoreChange -= 100;
      bagsChange += player2Actual;
      logs.push(`Partner failed Nil (-100, +${player2Actual} bags)`);
    }

    // Process P1 normal bid
    const target = player1Bid;
    const actual = player1Actual;

    if (actual >= target) {
      scoreChange += target * 10;
      const overtricks = actual - target;
      scoreChange += overtricks;
      bagsChange += overtricks;
      logs.push(`Met bid of ${target} with ${actual} (+${target * 10 + overtricks} pts, +${overtricks} bags)`);
    } else {
      scoreChange -= target * 10;
      logs.push(`Set on bid of ${target} with ${actual} (-${target * 10} pts)`);
    }

    return {
      scoreChange,
      bagsChange,
      message: logs.join(" | ")
    };
  }

  // Case 4: Standard partnership combined bidding (the most common Spades rule)
  // Both players bid positive numbers, so their bids and tricks are combined!
  const combinedBid = player1Bid + player2Bid;
  const combinedActual = player1Actual + player2Actual;

  if (combinedActual >= combinedBid) {
    scoreChange += combinedBid * 10;
    const overtricks = combinedActual - combinedBid;
    scoreChange += overtricks;
    bagsChange += overtricks;
    logs.push(`Combined bid ${combinedBid} met with ${combinedActual} (+${combinedBid * 10 + overtricks} pts, +${overtricks} bags)`);
  } else {
    scoreChange -= combinedBid * 10;
    logs.push(`Combined bid ${combinedBid} set with ${combinedActual} (-${combinedBid * 10} pts)`);
  }

  return {
    scoreChange,
    bagsChange,
    message: logs.join(", ")
  };
}
