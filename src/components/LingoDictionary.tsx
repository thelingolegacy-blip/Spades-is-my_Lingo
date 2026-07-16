/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BookOpen, Search, Info, Award, HelpCircle, AlertCircle } from 'lucide-react';
import { LingoTerm } from '../types';

const LINGO_GLOSSARY: LingoTerm[] = [
  {
    term: "Sandbagging (Bags)",
    definition: "Taking more tricks than you actually bid. Every overtrick counts as 1 'bag'. Accumulating 10 bags results in a devastating 100-point penalty!",
    example: "You bid 4 tricks but won 6 tricks. You get 42 points for the round, but you also receive 2 sandbags.",
    category: "scoring"
  },
  {
    term: "Nil Bid",
    definition: "Bidding that you will win exactly zero tricks in a round. If successful, your team gains a massive +100 point bonus. If you win even a single trick, you are 'set' and penalized -100 points.",
    example: "Bidding Nil with a hand of low clubs and diamonds, successfully avoiding taking any tricks.",
    category: "bidding"
  },
  {
    term: "Blind Nil",
    definition: "A high-risk, high-reward bid of Nil made before looking at your cards. Usually declared when a team is trailing by a huge margin. It is worth +200 points if successful, and -200 points if failed.",
    example: "Declaring 'Blind Nil' when trailing 410 to 180 to trigger a dramatic comeback.",
    category: "bidding"
  },
  {
    term: "Getting Set (Set)",
    definition: "Failing to win at least the number of tricks you and your partner bid combined. This results in a heavy penalty of losing 10 times your bid.",
    example: "Your team bids 7 tricks combined but only wins 6. Instead of +70, you lose 70 points (-70).",
    category: "scoring"
  },
  {
    term: "Spades Broken",
    definition: "Spades are trump cards but cannot be led (played first in a trick) until a spade has been played 'defensively' on a previous trick when a player could not follow suit, or if the leader only has spades left in their hand.",
    example: "Hearts are led, you are out of hearts, so you play a 4 of Spades. Spades are now 'broken' and can be led by anyone.",
    category: "gameplay"
  },
  {
    term: "Sluffing (Discarding / Painting)",
    definition: "Playing a low, non-spade card of a different suit when you cannot follow suit. This is a tactical move to shed unwanted high cards or avoid taking accidental tricks (crucial when your partner is playing Nil).",
    example: "Opponent leads Diamonds, you have no Diamonds, so you play a 2 of Clubs instead of trumping. This is a sluff.",
    category: "gameplay"
  },
  {
    term: "Trump Card",
    definition: "In Spades, the Spade suit is ALWAYS the trump suit. Any spade card beats any card of any other suit, regardless of rank.",
    example: "An Ace of Hearts is led, but another player plays a 2 of Spades. The 2 of Spades wins because Spades are trump.",
    category: "gameplay"
  },
  {
    term: "Boston (Shooting the Moon)",
    definition: "An elite, legendary achievement where a single team wins all 13 tricks in a single round. Often wins the entire game instantly in casual play or yields massive bragging rights.",
    example: "Your partnership wins every single book (trick) in the round, leaving the opponents with zero.",
    category: "slang"
  },
  {
    term: "Reneging (Revoking)",
    definition: "An illegal play where a player fails to follow suit when they actually have a card of that suit in their hand. If caught, the team is heavily penalized (usually losing 3 tricks to the opponents).",
    example: "Playing a Club when Diamonds were led, even though you still have the 5 of Diamonds in your hand.",
    category: "gameplay"
  },
  {
    term: "Board (Bidding)",
    definition: "The minimum combined bid required in some variations, or simply the table's collective bidding landscape. Usually refers to the aggregate total of all bids.",
    example: "A total table bid of 11 tricks makes the game highly tight and competitive.",
    category: "bidding"
  },
  {
    term: "Underbidding",
    definition: "Deliberately bidding fewer tricks than your hand is capable of winning. Done to guarantee you won't get set, though it risks accumulating bags.",
    example: "Holding 5 solid winners but bidding 3 to play it safe.",
    category: "bidding"
  },
  {
    term: "Cutting",
    definition: "Using a spade (the trump suit) to win a trick when you are out of the suit that was led.",
    example: "Playing a spade on a Hearts trick because you have no Hearts, cut-throat style.",
    category: "gameplay"
  }
];

export default function LingoDictionary() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredGlossary = LINGO_GLOSSARY.filter(item => {
    const matchesSearch = item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.definition.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryIcons: Record<string, React.ReactNode> = {
    all: <BookOpen className="w-4 h-4" />,
    bidding: <HelpCircle className="w-4 h-4" />,
    scoring: <Award className="w-4 h-4" />,
    gameplay: <Info className="w-4 h-4" />,
    slang: <AlertCircle className="w-4 h-4" />
  };

  return (
    <div className="glass p-6 max-w-4xl mx-auto" id="lingo-dictionary-container">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-400" />
            Spades Is My Lingo™ Glossary
          </h2>
          <p className="text-sm text-slate-300 mt-1 opacity-95">
            Master the absolute essentials, slang, and tactics of Spades like a pro.
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search lingo terms, definitions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            id="glossary-search-input"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'bidding', 'scoring', 'gameplay', 'slang'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize flex items-center gap-1.5 transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-indigo-500 text-slate-950 font-black shadow-sm'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
              id={`cat-btn-${cat}`}
            >
              {categoryIcons[cat]}
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Term Grid */}
      {filteredGlossary.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGlossary.map((item, idx) => (
            <div
              key={idx}
              className="glass-card flex flex-col justify-between"
              id={`lingo-card-${idx}`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg text-white">
                    {item.term}
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                    item.category === 'scoring' ? 'bg-amber-500/20 text-amber-300' :
                    item.category === 'bidding' ? 'bg-indigo-500/20 text-indigo-300' :
                    item.category === 'gameplay' ? 'bg-emerald-500/20 text-emerald-300' :
                    'bg-pink-500/20 text-pink-300'
                  }`}>
                    {item.category}
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">
                  {item.definition}
                </p>
              </div>
              <div className="p-3 bg-white/5 border-l-4 border-indigo-400 rounded-r-lg text-xs text-slate-300">
                <span className="font-semibold text-indigo-300">Example: </span>
                {item.example}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-xl" id="glossary-empty-state">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No lingo matches your search.</p>
          <button
            onClick={() => { setSearchTerm(''); setActiveCategory('all'); }}
            className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold mt-1 cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Pro Tip */}
      <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-indigo-300">Lingo Pro Tip: "Spades is a game of partnership"</h4>
          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
            Unlike many trick-taking card games, your bid and your partner's bid are merged to form a single combined team target. Always pay close attention to your partner's plays—especially if they bid Nil, as your primary mission is to protect their Nil and cover any tricks opponents try to slide to them!
          </p>
        </div>
      </div>
    </div>
  );
}
