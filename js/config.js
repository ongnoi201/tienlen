export const SUITS = ['\u2660', '\u2663', '\u2666', '\u2665'];
export const RANKS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
export const RANK_LABELS = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2' };
export const SCORE_KEY = 'tienlen_scores';
export const CHOP_SCORE = {
    single2black: 5,
    single2red: 10,
    double2: 20,
    chop3seq: 30, 
    chop3seqBy3seq: 20, 
    chop4By4: 20,
    chop4seqBy4seq: 30,
};