import { SUITS } from './config.js';
import { clone, highestSuitOfMaxRank } from './utils.js';

export function isStraight(cs){
    if(cs.length<3) return false;
    const s=clone(cs).sort((a,b)=>a.rank-b.rank);
    for(let i=1;i<s.length;i++)
        if(s[i].rank!==s[i-1].rank+1 || s[i].rank>14) return false;   // không chứa 2
    return true;
}

export function isFour(cs){
    return cs.length===4 && cs.every(c=>c.rank===cs[0].rank);
}

export function isDoubleSeq(cs){
    if(cs.length<6 || cs.length%2) return false;
    const s=clone(cs).sort((a,b)=>a.rank-b.rank);
    for(let i=0;i<s.length;i+=2)
        if(s[i].rank!==s[i+1].rank) return false;
    for(let i=2;i<s.length;i+=2)
        if(s[i].rank!==s[i-2].rank+1 || s[i].rank>14) return false;   // không chứa 2
    return true;
}

export function getHandType(cs){
    if(cs.length===1) return {type:'single',value:cs[0].rank};
    if(cs.length===2 && cs[0].rank===cs[1].rank) return {type:'pair',value:cs[0].rank};
    if(cs.length===3 && cs.every(c=>c.rank===cs[0].rank)) return {type:'triple',value:cs[0].rank};
    if(isStraight(cs))   return {type:'straight',value:cs[cs.length-1].rank,len:cs.length};
    if(isFour(cs))       return {type:'four',value:cs[0].rank};
    if(isDoubleSeq(cs))  return {type:'dseq',value:cs[cs.length-2].rank,len:cs.length/2};
    return {type:'invalid'};
}

export function canBeat(prev,next){
    if(!prev || !prev.length) return true;
    const a=getHandType(prev), b=getHandType(next);
    if(b.type==='invalid') return false;

    /* --- Chặt 2 (single hoặc đôi 2) --- */
    if(a.type==='single' && prev[0].rank===15){
        if(b.type==='four') return 'chop2';
        if(b.type==='dseq' && next.length===6) return 'chop3seq';  // 3 đôi thông
        if(b.type==='single' && next[0].rank===15){
            return SUITS.indexOf(next[0].suit) > SUITS.indexOf(prev[0].suit);
        }
        return false;
    }
    if(a.type==='pair' && prev[0].rank===15){
        if(b.type==='four') return 'chop2';
        if(b.type==='dseq' && next.length>=8) return 'chop3seq';   // 4 đôi thông
        if(b.type==='pair' && next[0].rank===15){
            const sPrev=Math.max(SUITS.indexOf(prev[0].suit),SUITS.indexOf(prev[1].suit));
            const sNext=Math.max(SUITS.indexOf(next[0].suit),SUITS.indexOf(next[1].suit));
            if(sNext>sPrev) return 'chop2pair';
            return false;
        }
        return false;
    }

    /* --- So sánh khi CÙNG LOẠI & CÙNG SỐ LÁ --- */
    if(a.type===b.type && prev.length===next.length){
        /* khác rank -> rank lớn hơn thắng */
        if(b.value>a.value) return true;

        /* cùng rank -> so sánh chất (theo từng loại) */
        if(b.value===a.value){
            switch(b.type){
                case 'single':
                    return SUITS.indexOf(next[0].suit) > SUITS.indexOf(prev[0].suit);
                case 'pair': {
                    const sPrev=Math.max(SUITS.indexOf(prev[0].suit),SUITS.indexOf(prev[1].suit));
                    const sNext=Math.max(SUITS.indexOf(next[0].suit),SUITS.indexOf(next[1].suit));
                    return sNext>sPrev;
                }
                case 'triple': {
                    const sPrev=Math.max(...prev.map(c=>SUITS.indexOf(c.suit)));
                    const sNext=Math.max(...next.map(c=>SUITS.indexOf(c.suit)));
                    return sNext>sPrev;
                }
                case 'straight': {
                    const sPrev=highestSuitOfMaxRank(prev);
                    const sNext=highestSuitOfMaxRank(next);
                    return sNext>sPrev;
                }
                case 'dseq': {   // đôi thông
                    const sPrev=highestSuitOfMaxRank(prev);
                    const sNext=highestSuitOfMaxRank(next);
                    return sNext>sPrev;
                }
                case 'four': {
                    const sPrev=Math.max(...prev.map(c=>SUITS.indexOf(c.suit)));
                    const sNext=Math.max(...next.map(c=>SUITS.indexOf(c.suit)));
                    return sNext>sPrev;
                }
            }
        }
    }
    return false;
}
