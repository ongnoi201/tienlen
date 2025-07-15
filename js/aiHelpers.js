// utils/aiHelpers.js
import { isDoubleSeq } from './rules.js';

/* Trọng số mặc định – càng CAO càng ngại đánh sớm */
export const BASE_WEIGHT = {
    single: 4,
    pair: 3,
    triple: 2,
    straight: 2,
    dseq: 2,
    four: 1,   // bom – nên giữ
};

/* Đếm lá 2 trong một mảng lá bài */
export const countTwos = cards => cards.filter(c => c.rank === 15).length;

/* “Bom” có khả năng chặt */
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
    let s = BASE_WEIGHT[type];

    /* Giữ bom & lá 2 ở early/mid */
    if (isBomb(type, cards.map(i => hand[i]))) s += 6;
    const twos = countTwos(cards.map(i => hand[i]));
    if (twos) s += (stage !== 'late' ? 5 * twos : -twos);

    /* Ít bài → thích nước đánh hết hơn */
    if (cards.length === hand.length) s -= 8;

    /* Ưu tiên xả bài dài (đặc biệt giai đoạn late) */
    if (stage === 'late') s -= cards.length * 1.5;
    else s -= cards.length * 0.5;

    /* Tránh ném quân to quá sớm */
    if (rank > 11 && stage === 'early') s += 2;

    return s;
}

