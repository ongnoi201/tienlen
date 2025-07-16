export const BASE_WEIGHT = {
    single: 2.5,
    pair: 3,
    triple: 2,
    straight: 2,
    dseq: 2,
    four: 1,
};


export const countTwos = cards => cards.filter(c => c.rank === 15).length;

export const isBomb = (type, cards) =>
    type === 'four' ||
    (type === 'dseq' && cards.length >= 6 && cards[0].rank >= 11);

export function getGameStage(botHand) {
    const n = botHand.length;
    if (n > 10) return 'early';
    if (n > 3) return 'mid';
    return 'late';
}


export function scoreMove(move, hand, stage) {
    const { type, cards, rank } = move;
    let score = BASE_WEIGHT[type];
    const played = cards.map(i => hand[i]);

    if (isBomb(type, played)) {
        score += stage === 'early' ? 8 : 6;
    }

    const twos = countTwos(played);
    if (twos) {
        const isLastTurn = played.length === hand.length;
        if (stage === 'late' || isLastTurn) {
            score -= twos; 
        } else {
            score += 5 * twos;
        }
    }

    if (played.length === hand.length) {
        score -= 10;
    }

    const lenPenalty = stage === 'late' ? 1.5 : stage === 'mid' ? 1 : 0.5;
    score -= played.length * lenPenalty;

    if (rank > 11) {
        score += stage === 'early' ? 2 : stage === 'mid' ? 1 : 0;
    }

    return score;
}
