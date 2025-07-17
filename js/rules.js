import { SUITS } from './config.js';
import { clone, highestSuitOfMaxRank } from './utils.js';

/* Helper: xác định chất đỏ */
function isRedSuit(suit) {
    return suit === '♥' || suit === '♦';
}

export function isStraight(cs) {
    if (cs.length < 3) return false;
    const s = clone(cs).sort((a, b) => a.rank - b.rank);
    for (let i = 1; i < s.length; i++)
        if (s[i].rank !== s[i - 1].rank + 1 || s[i].rank > 14) return false; // không chứa 2
    return true;
}

export function isFour(cs) {
    return cs.length === 4 && cs.every(c => c.rank === cs[0].rank);
}

export function isDoubleSeq(cs) {
    if (cs.length < 6 || cs.length % 2) return false;
    const s = clone(cs).sort((a, b) => a.rank - b.rank);
    for (let i = 0; i < s.length; i += 2)
        if (s[i].rank !== s[i + 1].rank) return false;
    for (let i = 2; i < s.length; i += 2)
        if (s[i].rank !== s[i - 2].rank + 1 || s[i].rank > 14) return false; // không chứa 2
    return true;
}

export function getHandType(cs) {
    if (cs.length === 1) return { type: 'single', rank: cs[0].rank };

    if (cs.length === 2 && cs[0].rank === cs[1].rank) return {
        type: 'pair',
        rank: cs[0].rank,
    };

    if (cs.length === 3 && cs.every(c => c.rank === cs[0].rank)) return {
        type: 'triple',
        rank: cs[0].rank,
    };

    if (isFour(cs)) return {
        type: 'four',
        rank: cs[0].rank,
        len: 4
    };

    if (isStraight(cs)) {
        const sorted = [...cs].sort((a, b) => a.rank - b.rank);
        return {
            type: 'straight',
            rank: sorted[0].rank,
            len: cs.length
        };
    }

    if (isDoubleSeq(cs)) {
        const ranks = cs.map(c => c.rank).sort((a, b) => a - b);
        const freq = {};
        for (const r of ranks) freq[r] = (freq[r] || 0) + 1;

        const unique = Object.keys(freq).map(Number).sort((a, b) => a - b);
        const isSeq = unique.every((r, i, arr) => i === 0 || r === arr[i - 1] + 1);
        const isAllPairs = Object.values(freq).every(v => v === 2);

        if (isSeq && isAllPairs && unique[unique.length - 1] < 15) {
            return {
                type: 'dseq',
                rank: unique[0],
                len: cs.length,
                pairs: unique.length,
            };
        }
    }

    return { type: 'invalid' };
}


export function canBeat(prev, next) {
    if (!prev || !prev.length) return true;
    const a = getHandType(prev),
        b = getHandType(next);
    if (b.type === 'invalid') return false;

    /* ==== LUẬT CHẶT 2 MỚI ==== */

    // ----- chặt 1 con 2 -----
    if (a.type === 'single' && prev[0].rank === 15) {
        const canChop = b.type === 'four' || (b.type === 'dseq' && next.length >= 6); // tứ quý hoặc ≥3 đôi thông
        if (canChop) {
            return isRedSuit(prev[0].suit) ? 'single2red' : 'single2black';
        }
        // 2 chặt 2 theo chất lớn hơn
        if (b.type === 'single' && next[0].rank === 15) {
            return SUITS.indexOf(next[0].suit) > SUITS.indexOf(prev[0].suit);
        }
        return false;
    }

    // ----- chặt đôi 2 -----
    if (a.type === 'pair' && prev[0].rank === 15) {
        const canChop = b.type === 'four' || (b.type === 'dseq' && next.length >= 8); // tứ quý hoặc 4 đôi thông
        if (canChop) {
            return 'double2';
        }
        // đôi 2 chặt đôi 2 theo chất cao
        if (b.type === 'pair' && next[0].rank === 15) {
            const sPrev = Math.max(
                SUITS.indexOf(prev[0].suit),
                SUITS.indexOf(prev[1].suit)
            );
            const sNext = Math.max(
                SUITS.indexOf(next[0].suit),
                SUITS.indexOf(next[1].suit)
            );
            return sNext > sPrev;
        }
        return false;
    }

    /* ==== SO SÁNH CÙNG KIỂU / CÙNG ĐỘ DÀI ==== */
    if (a.type === b.type && prev.length === next.length) {
        if (b.rank > a.rank) return true;
        if (b.rank === a.rank) {
            switch (b.type) {
                case 'single':
                    return SUITS.indexOf(next[0].suit) > SUITS.indexOf(prev[0].suit);
                case 'pair': {
                    const sPrev = Math.max(
                        SUITS.indexOf(prev[0].suit),
                        SUITS.indexOf(prev[1].suit)
                    );
                    const sNext = Math.max(
                        SUITS.indexOf(next[0].suit),
                        SUITS.indexOf(next[1].suit)
                    );
                    return sNext > sPrev;
                }
                case 'triple': {
                    const sPrev = Math.max(
                        ...prev.map(c => SUITS.indexOf(c.suit))
                    );
                    const sNext = Math.max(
                        ...next.map(c => SUITS.indexOf(c.suit))
                    );
                    return sNext > sPrev;
                }
                case 'straight':
                case 'dseq': {
                    const sPrev = highestSuitOfMaxRank(prev);
                    const sNext = highestSuitOfMaxRank(next);
                    return sNext > sPrev;
                }
                case 'four': {
                    const sPrev = Math.max(
                        ...prev.map(c => SUITS.indexOf(c.suit))
                    );
                    const sNext = Math.max(
                        ...next.map(c => SUITS.indexOf(c.suit))
                    );
                    return sNext > sPrev;
                }
            }
        }
    }
    return false;
}
