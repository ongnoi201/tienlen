import { SUITS, RANKS, RANK_LABELS } from './config.js';

export function createDeck(){
    const d=[];
    for(const s of SUITS)
        for(const r of RANKS)
            d.push({suit:s,rank:r});
    return d;
}

export function sortHand(h){
    h.sort((a,b)=>a.rank-b.rank || SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit));
}

export function cardToString(c){
    return (RANK_LABELS[c.rank]||c.rank)+c.suit;
}

export const clone = o => JSON.parse(JSON.stringify(o));

export function highestSuitOfMaxRank(cs){
    const maxRank = Math.max(...cs.map(c => c.rank));
    return Math.max(
        ...cs.filter(c => c.rank === maxRank).map(c => SUITS.indexOf(c.suit))
    );
}