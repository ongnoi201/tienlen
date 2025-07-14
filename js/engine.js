import { SUITS, RANK_LABELS } from './config.js';
import { createDeck, sortHand, cardToString, clone, highestSuitOfMaxRank } from './utils.js';
import { getHandType, canBeat, isStraight, isDoubleSeq } from './rules.js';
import { settings, loadSettings, saveSettings, applySettings, populateSettingsModal } from './settings.js';

/* ======= ÂM THANH ======= */
const SOUND_PATH = './audio/';
const audio = {
    deal: [
        new Audio(`${SOUND_PATH}chia.mp3`),
    ],
    play: [new Audio(`${SOUND_PATH}danh.mp3`)],
    chop: [
        new Audio(`${SOUND_PATH}may-ha-buoi.mp3`),
        new Audio(`${SOUND_PATH}ngu-ne.mp3`)
    ],
    win: [
        new Audio(`${SOUND_PATH}thua-di-cung.mp3`),
        new Audio(`${SOUND_PATH}may-con-ga.mp3`),
        new Audio(`${SOUND_PATH}hehe.mp3`),
    ],
    click: [
        new Audio(`${SOUND_PATH}click.mp3`),
    ]
};

// Cài đặt chung cho *tất cả* audio
Object.values(audio)
    .flat()
    .forEach(a => {
        a.preload = 'auto';
        a.volume = 0.6;
    });

function playSound(name) {
    const bank = audio[name];
    if (!bank) return;
    const clip = Array.isArray(bank)
        ? bank[Math.floor(Math.random() * bank.length)]
        : bank;
    clip.currentTime = 0;
    clip.play().catch(() => { });
}


/* Danh sách mặc định (không hand) */
const BASE_PLAYERS = [
    { name: 'Bạn', hand: [], bot: false, image: 'https://jbagy.me/wp-content/uploads/2025/03/hinh-anh-cute-avatar-vo-tri-2.jpg' },
    { name: 'Bot 1', hand: [], bot: true, image: 'https://jbagy.me/wp-content/uploads/2025/03/hinh-anh-cute-avatar-vo-tri-3.jpg' },
    { name: 'Bot 2', hand: [], bot: true, image: 'https://jbagy.me/wp-content/uploads/2025/03/hinh-anh-cute-avatar-vo-tri-4.jpg' },
    { name: 'Bot 3', hand: [], bot: true, image: 'https://jbagy.me/wp-content/uploads/2025/03/hinh-anh-cute-avatar-vo-tri-1.jpg' },
]


/* === TRẠNG THÁI GAME & SCORE === */
export const SCORE_KEY = 'tienlen_scores';
function loadScores() {
    let s = localStorage.getItem(SCORE_KEY);
    if (!s) return [0, 0, 0, 0];
    try { return JSON.parse(s); } catch { return [0, 0, 0, 0]; }
}

function saveScores(scores) {
    localStorage.setItem(SCORE_KEY, JSON.stringify(scores));
}

let scores = loadScores();
export const state = {
    players: BASE_PLAYERS.map((base, i) => ({
        ...base,
        ...settings.players[i],
        hand: []
    })),
    current: 0,
    lastPlayed: [],
    lastPlayer: null,
    selected: [],
    winner: null,
    passCount: 0,
    skipped: [false, false, false, false],
    ranks: [],
    nextStarter: null,
    chopStack: 0
};

/* === UI HELPERS === */
function updateScoreboard() {
    const ul = document.getElementById('score-list');
    if (!ul) return;
    ul.innerHTML = '';
    [...Array(state.players.length).keys()]
        .sort((a, b) => scores[b] - scores[a])
        .forEach(i => {
            const p = state.players[i];
            const li = document.createElement('li');
            li.innerHTML = `<span>${p.name}</span><span>${scores[i]} 🌕</span>`;
            ul.appendChild(li);
        });
}

function deal() {
    const deck = createDeck();
    deck.sort(() => Math.random() - 0.5);
    for (let i = 0; i < 52; i++) state.players[i % 4].hand.push(deck[i]);
    state.players.forEach(p => sortHand(p.hand));

    // XÁC ĐỊNH NGƯỜI ĐÁNH TRƯỚC
    if (state.nextStarter === null || state.nextStarter === undefined) {
        // Lần đầu: ai giữ 3♠ thì đi trước
        for (let i = 0; i < 4; i++) {
            if (state.players[i].hand.some(c => c.rank === 3 && c.suit === '\u2660')) {
                state.current = i;
                break;
            }
        }
    } else {
        state.current = state.nextStarter; // người thắng ván trước đi trước
    }

    if (state.players[state.current].bot) {
        setTimeout(botPlay, settings && settings.botDelay ? settings.botDelay : 1000);
    }
}

applySettings(settings);


function render() {
    // Bot
    const bots = document.getElementById('bot-hands');
    bots.innerHTML = `
        <div class="bot-top">
            <img class="avatar bot-avatar${state.current === 2 ? ' active' : ''}" src='${state.players[2].image}' alt="Bot 1">
            ${Array(state.players[2].hand.length).fill(0).map((_, i) =>
        `<span class="card-back ${settings.cardBack && settings.cardBack === 'red' ? 'card-red' : 'card-blue'}" style="left:${i * 18}px"></span>`
    ).join('')}
        </div>
        <div class="bot-left">
            <img class="avatar bot-avatar${state.current === 1 ? ' active' : ''}" src='${state.players[1].image}' alt="Bot 2">
            ${Array(state.players[1].hand.length).fill(0).map((_, i) =>
        `<span class="card-back ${settings.cardBack && settings.cardBack === 'red' ? 'card-red' : 'card-blue'}" style="top:${i * 18}px"></span>`
    ).join('')}
        </div>
        <div class="bot-right">
            ${Array(state.players[3].hand.length).fill(0).map((_, i) =>
        `<span class="card-back ${settings.cardBack && settings.cardBack === 'red' ? 'card-red' : 'card-blue'}" style="top:${i * 18}px"></span>`
    ).join('')}
            <img class="avatar bot-avatar${state.current === 3 ? ' active' : ''}" src='${state.players[3].image}' alt="Bot 3">
        </div>
        <div class="player-avatar-wrap">
            <img class="avatar player-avatar${state.current === 0 ? ' active' : ''}" src='${state.players[0].image}' alt="Bạn">
        </div>
    `;

    // Bàn
    const table = document.getElementById('table');
    table.innerHTML = state.lastPlayed.map(c =>
        `<span class="card${c.suit === '♥' || c.suit === '♦' ? ' red' : ''} ${settings.cardStyle && settings.cardStyle === 'classic' ? 'classic' : 'modern'}">${cardToString(c)}</span>`
    ).join('');

    // Tay người
    const hand = document.getElementById('player-hand');
    hand.innerHTML = '';
    state.players[0].hand.forEach((c, idx) => {
        const sel = state.selected.includes(idx) ? 'selected' : '';
        const red = (c.suit === '♥' || c.suit === '♦') ? 'red' : '';
        hand.innerHTML += `<span class="card ${settings.cardStyle && settings.cardStyle === 'classic' ? 'classic' : 'modern'} ${sel}${red ? ' ' + red : ''}" data-idx="${idx}">${cardToString(c)}</span>`;
    });

    // Ẩn/hiện nút đánh và bỏ lượt
    const controls = document.getElementById('player-controls');
    if (controls) {
        // Ẩn nếu đã về đích
        controls.style.display = (state.current === 0 && !state.winner && !state.ranks.includes(0)) ? 'flex' : 'none';
    }

    // Thông báo xếp hạng và úp dách
    let msg = '';
    if (state.ranks.length >= 4) {
        msg = 'Xếp hạng: ' + state.ranks.map((idx, i) =>
            `${i + 1}. ${state.players[idx].name}`
        ).join(' | ');
        // Kiểm tra úp dách
        let upDach = [];
        for (let i = 0; i < 4; ++i) {
            if (state.ranks[0] !== undefined && state.ranks[0] !== i && state.players[i].hand.length === 13) {
                upDach.push(state.players[i].name);
            }
        }
        if (upDach.length) {
            msg += ' | Úp dách: ' + upDach.join(', ');
        }
        // Tính điểm theo thứ hạng
        let add = [10, 5, 1, 0];
        state.ranks.forEach((idx, rank) => {
            scores[idx] += add[rank];
        });
        saveScores(scores);
        updateScoreboard();

        /* --- GHI NHỚ NGƯỜI THẮNG ĐỂ VÁN SAU ĐI TRƯỚC --- */
        state.nextStarter = state.ranks[0];

        // Hiện lại bộ bài và nút chia bài sau khi kết thúc ván
        setTimeout(() => {
            document.getElementById('deck-center').style.display = '';
            document.getElementById('deal-btn').style.display = '';
            document.getElementById('bot-hands').style.display = 'none';
            document.getElementById('table').style.display = 'none';
            document.getElementById('player-hand').style.display = 'none';
            document.getElementById('player-controls').style.display = 'none';
            document.getElementById('message').style.display = 'none';
            document.getElementById('namegame').style.display = '';
            document.getElementById('settings-btn').style.display = '';
            // Reset state cho ván mới
            state.players.forEach(p => p.hand = []);
            state.current = 0; // sẽ được đặt lại trong deal()
            state.lastPlayed = [];
            state.lastPlayer = null;
            state.selected = [];
            state.winner = null;
            state.passCount = 0;
            state.skipped = [false, false, false, false];
            state.ranks = [];
        }, 2000);
    } else if (state.ranks.length > 0) {
        msg = state.ranks.map((idx, i) =>
            `<li>${i + 1}. ${state.players[idx].name}</li>`
        )
    }
    document.getElementById('message-win').innerHTML =
        msg || (state.winner ? `Người thắng: ${state.winner}` : `Lượt: ${state.players[state.current].name}`);
    updateScoreboard();
}

/* ======= ĐIỀU KHIỂN LƯỢT ======= */
function nextTurn() {
    // Nếu đã có 3 người về đích thì kết thúc game
    if (state.ranks.length >= 3) {
        if (!state.winner) {
            // Người còn lại là bét
            const lastIdx = state.players.findIndex((p, i) => !state.ranks.includes(i));
            if (lastIdx !== -1) state.ranks.push(lastIdx);
            state.winner = state.players[state.ranks[0]].name;
        }
        render();
        return;
    }

    // Đảo chiều: ngược kim đồng hồ
    let next = (state.current + 3) % 4;
    // Bỏ qua tất cả người đã về đích
    while (state.ranks.includes(next)) {
        next = (next + 3) % 4;
    }
    state.current = next;

    // Hết bài => về đích
    if (state.players[state.current].hand.length === 0 && !state.ranks.includes(state.current)) {
        state.ranks.push(state.current);
        nextTurn();
        return;
    }

    // Nếu là người chơi đã về đích thì tự động bỏ qua (đã xử lý ở trên)
    // 3 người pass → bàn trống
    // Nếu chỉ còn 2 người chơi, chỉ cần 1 người pass là bàn phải trống
    let activePlayers = 4 - state.ranks.length;
    let passNeeded = activePlayers - 1;
    if (state.passCount >= passNeeded) {
        state.current = state.lastPlayer;
        // Nếu lastPlayer đã về đích thì tìm người chưa về đích gần nhất (ngược chiều kim đồng hồ)
        while (state.ranks.includes(state.current)) {
            state.current = (state.current + 3) % 4;
        }
        state.lastPlayed = [];
        state.chopStack = 0;
        state.passCount = 0;
        state.skipped = [false, false, false, false];
        render();
        if (state.players[state.current].bot && !state.ranks.includes(state.current)) setTimeout(botPlay, settings && settings.botDelay ? settings.botDelay : 1500);
        return;
    }

    // Bị skip trong ván → tự động pass
    if (state.skipped[state.current] && state.lastPlayed.length) {
        state.passCount++;
        nextTurn();
        return;
    }

    // Bot
    if (state.players[state.current].bot && !state.ranks.includes(state.current)) setTimeout(botPlay, settings && settings.botDelay ? settings.botDelay : 1500);
    render();
}

/* ======= NGƯỜI CHƠI ======= */
function playerPlay() {
    if (state.current !== 0 || state.winner || state.ranks.includes(0)) return;
    const cards = state.selected.map(i => state.players[0].hand[i]);
    if (!cards.length) return;
    let beat = canBeat(state.lastPlayed, cards);
    if (!beat) {
        document.getElementById('message-win').innerHTML = 'Không hợp lệ!';
        return;
    }
    // Xử lý điểm chặt đặc biệt
    if (typeof beat === 'string') {
        // Chặt 2 đỏ
        if (beat === 'chop2') {
            // Phân biệt chặt đôi 2 hay 2 đơn
            if (state.lastPlayed.length === 2) {
                handleSpecialScore('chop2double', 0, state.lastPlayer);   // ±20
            } else if (state.lastPlayed[0].suit === '♥' || state.lastPlayed[0].suit === '♦') {
                handleSpecialScore('chop2red', 0, state.lastPlayer);      // ±10
            } else {
                handleSpecialScore('chop2', 0, state.lastPlayer);         // ±5
            }
        } else if (beat === 'chop3seq') {
            handleSpecialScore('chop3seq', 0, state.lastPlayer);          // ±10 (hoặc 20 nếu chồng)
        } else if (beat === 'chop2pair') {
            handleSpecialScore('chop2double', 0, state.lastPlayer);       // dự phòng
        }
    }

    // Đánh
    playSound('play');
    state.players[0].hand = state.players[0].hand.filter((_, i) => !state.selected.includes(i));
    state.lastPlayed = cards;
    state.lastPlayer = 0;
    state.selected = [];
    state.passCount = 0;
    render();

    if (!state.players[0].hand.length && !state.ranks.includes(0)) {
        playSound('win');
        state.ranks.push(0);
        // Nếu chưa đủ 3 người về đích thì tiếp tục
        nextTurn();
        return;
    }
    nextTurn();
}

function playerPass() {
    playSound('click');
    if (state.current !== 0 || state.winner || state.ranks.includes(0)) return;
    if (!state.lastPlayed.length || state.lastPlayer === 0) return; // Không được pass lượt đầu
    state.selected = [];
    state.passCount++;
    state.skipped[0] = true;
    nextTurn();
    render();
}

/* ======= BOT ======= */
function botPlay() {
    const idx = state.current,
        bot = state.players[idx],
        hand = bot.hand;
    if (state.ranks.includes(idx)) {
        nextTurn();
        return;
    }
    let move = null, moves = [];
    let specialBeat = null, specialTarget = null;

    // Single
    for (let i = 0; i < hand.length; i++) {
        if (canBeat(state.lastPlayed, [hand[i]])) moves.push({ cards: [i], type: 'single', rank: hand[i].rank });
    }
    // Pair
    for (let i = 0; i < hand.length - 1; i++) {
        if (hand[i].rank === hand[i + 1].rank && canBeat(state.lastPlayed, [hand[i], hand[i + 1]]))
            moves.push({ cards: [i, i + 1], type: 'pair', rank: hand[i].rank });
    }
    // Triple
    for (let i = 0; i < hand.length - 2; i++) {
        if (hand[i].rank === hand[i + 1].rank && hand[i].rank === hand[i + 2].rank &&
            canBeat(state.lastPlayed, [hand[i], hand[i + 1], hand[i + 2]]))
            moves.push({ cards: [i, i + 1, i + 2], type: 'triple', rank: hand[i].rank });
    }
    // Straight
    for (let len = 3; len <= hand.length; len++) {
        for (let i = 0; i <= hand.length - len; i++) {
            const slice = hand.slice(i, i + len);
            if (isStraight(slice) && canBeat(state.lastPlayed, slice))
                moves.push({ cards: [...Array(len).keys()].map(j => i + j), type: 'straight', rank: slice[slice.length - 1].rank, len });
        }
    }
    // Four
    for (let i = 0; i < hand.length - 3; i++) {
        if (hand[i].rank === hand[i + 1].rank && hand[i].rank === hand[i + 2].rank && hand[i].rank === hand[i + 3].rank &&
            canBeat(state.lastPlayed, [hand[i], hand[i + 1], hand[i + 2], hand[i + 3]]))
            moves.push({ cards: [i, i + 1, i + 2, i + 3], type: 'four', rank: hand[i].rank });
    }
    // Double sequence
    for (let len = 6; len <= hand.length; len += 2) {
        for (let i = 0; i <= hand.length - len; i++) {
            const slice = hand.slice(i, i + len);
            if (isDoubleSeq(slice) && canBeat(state.lastPlayed, slice))
                moves.push({ cards: [...Array(len).keys()].map(j => i + j), type: 'dseq', rank: slice[slice.length - 2].rank, len });
        }
    }

    // --- AI cải tiến ---
    // Ưu tiên: chặt 2 > tứ quý > đôi thông > sảnh dài > bộ ba > đôi > rác nhỏ nhất
    // Nếu trên bàn là 2, ưu tiên chặt nếu có
    // Nếu trên bàn là sảnh, ưu tiên sảnh dài hơn
    // Nếu trên bàn là đôi/triple, ưu tiên đánh đôi/triple lớn hơn
    // Nếu trên bàn là rác, ưu tiên đánh rác nhỏ nhất, nhưng nếu còn ít bài thì ưu tiên đánh bộ

    if (moves.length) {
        const prevType = getHandType(state.lastPlayed);

        // Nếu trên bàn là 2, ưu tiên chặt
        if (prevType.type === 'single' && state.lastPlayed[0]?.rank === 15) {
            // Ưu tiên tứ quý, sau đó đôi thông
            let chop = moves.filter(m => m.type === 'four' || (m.type === 'dseq' && m.cards.length >= 8));
            if (chop.length) {
                chop.sort((a, b) => a.cards.length - b.cards.length || a.rank - b.rank);
                move = chop[0].cards;
                // Xử lý điểm chặt 2
                if (state.lastPlayed[0].suit === '♥' || state.lastPlayed[0].suit === '♦')
                    specialBeat = 'chop2red';
                else
                    specialBeat = 'chop2';
                specialTarget = state.lastPlayer;
            }
        }
        // Nếu trên bàn là đôi 2, ưu tiên chặt đôi thông
        else if (prevType.type === 'pair' && state.lastPlayed[0]?.rank === 15) {
            let chop = moves.filter(m => (m.type === 'four') || (m.type === 'dseq' && m.cards.length >= 8));
            if (chop.length) {
                chop.sort((a, b) => a.cards.length - b.cards.length || a.rank - b.rank);
                move = chop[0].cards;
                // Xử lý điểm chặt đôi 2
                if (state.lastPlayed[0].suit === '♥' || state.lastPlayed[0].suit === '♦')
                    specialBeat = 'chop2double';
                else
                    specialBeat = 'chop2double';
                specialTarget = state.lastPlayer;
            }
        }
        // Nếu có thể đánh hết bài (ưu tiên đánh hết)
        else {
            let winMove = moves.find(m => m.cards.length === hand.length);
            if (winMove) move = winMove.cards;
        }

        // Nếu trên bàn là sảnh, ưu tiên sảnh dài hơn hoặc lớn hơn
        if (!move && prevType.type === 'straight') {
            let s = moves.filter(m => m.type === 'straight' && m.cards.length === prevType.len && m.rank > prevType.value);
            if (s.length) {
                s.sort((a, b) => a.rank - b.rank);
                move = s[0].cards;
            }
        }
        // Nếu trên bàn là đôi thông, ưu tiên đôi thông lớn hơn
        if (!move && prevType.type === 'dseq') {
            let d = moves.filter(m => m.type === 'dseq' && m.cards.length === state.lastPlayed.length && m.rank > prevType.value);
            if (d.length) {
                d.sort((a, b) => a.rank - b.rank);
                move = d[0].cards;
            }
        }
        // Nếu trên bàn là tứ quý, ưu tiên tứ quý lớn hơn
        if (!move && prevType.type === 'four') {
            let f = moves.filter(m => m.type === 'four' && m.rank > prevType.value);
            if (f.length) {
                f.sort((a, b) => a.rank - b.rank);
                move = f[0].cards;
            }
        }
        // Nếu trên bàn là triple, ưu tiên triple lớn hơn
        if (!move && prevType.type === 'triple') {
            let t = moves.filter(m => m.type === 'triple' && m.rank > prevType.value);
            if (t.length) {
                t.sort((a, b) => a.rank - b.rank);
                move = t[0].cards;
            }
        }
        // Nếu trên bàn là đôi, ưu tiên đôi lớn hơn
        if (!move && prevType.type === 'pair') {
            let p = moves.filter(m => m.type === 'pair' && m.rank > prevType.value);
            if (p.length) {
                p.sort((a, b) => a.rank - b.rank);
                move = p[0].cards;
            }
        }
        // Nếu trên bàn là rác, ưu tiên đánh rác nhỏ nhất
        if (!move && prevType.type === 'single') {
            let s = moves.filter(m => m.type === 'single' && m.rank > prevType.value);
            if (s.length) {
                s.sort((a, b) => a.rank - b.rank);
                move = s[0].cards;
            }
        }
        // Nếu không có gì ưu tiên, đánh bộ nhỏ nhất (ưu tiên sảnh, đôi thông, tứ quý, triple, đôi, rác)
        if (!move) {
            // Ưu tiên sảnh dài nhất, sau đó đôi thông, tứ quý, triple, đôi, rác
            let order = ['straight', 'dseq', 'four', 'triple', 'pair', 'single'];
            for (let type of order) {
                let arr = moves.filter(m => m.type === type);
                if (arr.length) {
                    arr.sort((a, b) => a.cards.length - b.cards.length || a.rank - b.rank);
                    move = arr[0].cards;
                    break;
                }
            }
        }
    }

    if (move) {
        if (specialBeat && specialTarget !== null) handleSpecialScore(specialBeat, idx, specialTarget);
        const cards = move.map(i => hand[i]);
        bot.hand = bot.hand.filter((_, i) => !move.includes(i));
        state.lastPlayed = cards;
        state.lastPlayer = idx;
        state.passCount = 0;
        playSound('play');
    } else {
        if (state.lastPlayer !== idx && state.lastPlayed.length) {
            // Xử lý chặt 3 đôi thông nếu có
            if (getHandType(state.lastPlayed).type === 'dseq' && state.lastPlayed.length >= 8 && state.lastPlayed[0].rank === 15) {
                // Nếu bị chặt đôi 2 bằng 3 đôi thông
                handleSpecialScore('chop3seq', idx, state.lastPlayer);
            }
            state.passCount++;
            state.skipped[idx] = true;
        }
    }

    render();
    if (!bot.hand.length && !state.ranks.includes(idx)) {
        playSound('win');          // <‑‑ thêm
        state.ranks.push(idx);
        // Nếu chưa đủ 3 người về đích thì tiếp tục
        nextTurn();
        return;
    }
    nextTurn();
}

/* ======= SỰ KIỆN ======= */
// Xử lý điểm khi chặt 2, chặt đôi thông, chặt đôi 2
function handleSpecialScore(type, who, target) {
    // type: 'chop2', 'chop2red', 'chop2double', 'chop3seq', 'chop2pair'
    // who: người chặt, target: người bị chặt
    if (type === 'chop2red') {
        playSound('chop');
        const p = stacked ? 20 : 10;
        scores[who] += p; scores[target] -= p;
        showScoreEffect(who, (stacked ? '+20' : '+10'));
        showScoreEffect(target, (stacked ? '-20' : '-10'));
    }
    if (type === 'chop2') {
        playSound('chop');
        const p = stacked ? 20 : 5;
        scores[who] += p; scores[target] -= p;
        showScoreEffect(who, `${p}`);
        showScoreEffect(target, `-${p}`);
    }
    if (type === 'chop2double') {
        playSound('chop');
        scores[who] += 20; scores[target] -= 20;
        showScoreEffect(who, '+20');
        showScoreEffect(target, '-20');
    }
    if (type === 'chop3seq') {
        playSound('chop');
        const p = stacked ? 20 : 10;
        scores[who] += p; scores[target] -= p;
        showScoreEffect(who, `+${p}`);
        showScoreEffect(target, `-${p}`);
    }
    saveScores(scores); updateScoreboard();
    state.chopStack++;
}

// Hiệu ứng điểm trên avatar khi chặt
function showScoreEffect(playerIdx, text) {
    let avatar;
    if (playerIdx === 0) {
        avatar = document.querySelector('.player-avatar');
    } else if (playerIdx === 1) {
        avatar = document.querySelector('.bot-left .avatar');
    } else if (playerIdx === 2) {
        avatar = document.querySelector('.bot-top .avatar');
    } else if (playerIdx === 3) {
        avatar = document.querySelector('.bot-right .avatar');
    }
    if (!avatar) return;
    const eff = document.createElement('span');
    eff.textContent = text;
    eff.style.position = 'absolute';
    eff.style.left = '50%';
    eff.style.top = '0';
    eff.style.transform = 'translate(-50%,-80%)';
    eff.style.fontSize = '22px';
    eff.style.fontWeight = 'bold';
    eff.style.color = text.startsWith('+') ? '#43a047' : '#d32f2f';
    eff.style.textShadow = '1px 1px 4px #222,0 0 8px #fff8';
    eff.style.pointerEvents = 'none';
    eff.style.zIndex = '999';
    avatar.parentElement.appendChild(eff);
    setTimeout(() => {
        eff.style.transition = 'all 0.8s cubic-bezier(.7,1.7,.5,1)';
        eff.style.top = '-40px';
        eff.style.opacity = '0';
    }, 50);
    setTimeout(() => {
        if (eff.parentElement) eff.parentElement.removeChild(eff);
    }, 1200);
}

// Xử lý css setting
let deckstack = document.querySelector('.deck-stack');
let body = document.body;
const area = document.getElementById('game-area');
settings.cardBack && settings.cardBack === 'red' && deckstack.classList.add('card-red');
settings.background && body.style.background == 'linear-gradient(90deg, ' + settings.background + ' 50%, #fff 100%);';


// Hiệu ứng chia bài
function animateDeal(callback) {
    const deckCenter = document.getElementById('deck-center');
    const botHands = document.getElementById('bot-hands');
    const playerHand = document.getElementById('player-hand');
    // Tính vị trí đến của 4 người chơi (center của avatar)
    const getTarget = idx => {
        const el = [
            document.querySelector('.player-avatar'), // player
            botHands.querySelector('.bot-left .avatar'),
            botHands.querySelector('.bot-top .avatar'),
            botHands.querySelector('.bot-right .avatar')
        ][idx];
        if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const rect = el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };
    // Vị trí bộ bài trung tâm
    const deckRect = deckCenter.getBoundingClientRect();
    const deckX = deckRect.left + deckRect.width / 2;
    const deckY = deckRect.top + deckRect.height / 2;
    // Chia 52 lá, mỗi lá đến 1 vị trí
    let i = 0;
    function dealOne() {
        if (i >= 52) {
            setTimeout(() => {
                deckCenter.style.display = 'none';
                document.getElementById('deal-btn').style.display = 'none';
                document.getElementById('bot-hands').style.display = '';
                document.getElementById('table').style.display = '';
                document.getElementById('player-hand').style.display = '';
                document.getElementById('player-controls').style.display = '';
                document.getElementById('message').style.display = '';
                if (callback) callback();
            }, 1000);
            return;
        }
        const who = i % 4;
        const target = getTarget(who);
        const card = document.createElement('div');
        card.className = `deal-card ${settings.cardBack && settings.cardBack === 'red' ? 'card-red' : 'card-blue'}`;
        card.style.left = '0px';
        card.style.top = '0px';
        card.style.opacity = '1';
        deckCenter.appendChild(card);
        // Tính dịch chuyển
        const dx = target.x - deckX;
        const dy = target.y - deckY;
        setTimeout(() => {
            card.style.transform = `translate(${dx}px,${dy}px) scale(0.5)`;
            card.style.opacity = '0.2';
        }, 10);

        setTimeout(() => {
            card.remove();
        }, 500);
        i++;
        setTimeout(dealOne, 30);
    }
    playSound('deal');
    dealOne();
}

document.addEventListener('DOMContentLoaded', () => {
    updateScoreboard();
    // Ẩn các phần chơi, chỉ hiện bộ bài và nút chia bài
    document.getElementById('bot-hands').style.display = 'none';
    document.getElementById('table').style.display = 'none';
    document.getElementById('player-hand').style.display = 'none';
    document.getElementById('player-controls').style.display = 'none';
    document.getElementById('message').style.display = 'none';
    document.getElementById('namegame').style.display = '';
    document.getElementById('deck-center').style.display = '';
    document.getElementById('deal-btn').style.display = '';
    document.getElementById('settings-btn').style.display = '';

    // Khi nhấn nút chia bài
    document.getElementById('deal-btn').addEventListener('click', () => {
        document.getElementById('deal-btn').style.display = 'none';
        document.getElementById('settings-btn').style.display = 'none';
        document.getElementById('namegame').style.display = 'none';
        // Hiện avatar bot để lấy vị trí chia bài
        document.getElementById('bot-hands').style.display = '';
        render(); // render avatar để lấy vị trí
        // Chia bài hiệu ứng
        animateDeal(() => {
            deal();
            render();
        });
    });

    document.getElementById('player-hand').addEventListener('click', e => {
        if (e.target.classList.contains('card')) {
            const idx = +e.target.dataset.idx;
            playSound('click');
            if (state.selected.includes(idx))
                state.selected = state.selected.filter(i => i !== idx);
            else
                state.selected.push(idx);
            render();
        }
    });

    document.getElementById('play-btn').addEventListener('click', playerPlay);
    document.getElementById('pass-btn').addEventListener('click', playerPass);
});


const btnOpenSettings = document.getElementById('settings-btn');
const modalSettings = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('close-settings');
const btnSaveSettings = document.getElementById('save-settings');   // ← đổi tên biến

// mở/đóng
btnOpenSettings.onclick = () => { playSound('click'); populateSettingsModal(loadSettings()); modalSettings.style.visibility = 'visible'; };
btnCloseSettings.onclick = () => { playSound('click'); modalSettings.style.visibility = 'hidden'; };

// LƯU
alertify.set('notifier', 'position', 'top-left');
btnSaveSettings.onclick = () => {
    /* 1) Gom dữ liệu settings như cũ */
    playSound('click');
    const updated = {
        background: document.getElementById('bg-color').value,
        tableBackground: document.getElementById('table-color').value,
        botDelay: +document.getElementById('bot-delay').value || 1500,
        cardStyle: document.getElementById('card-style').value,
        cardBack: document.getElementById('card-back').value,
        players: []
    };
    document.querySelectorAll('.player-name').forEach((inp, i) => {
        updated.players[i] = {
            name: inp.value.trim() || `Người ${i + 1}`,
            image: document.querySelectorAll('.player-image')[i].value.trim()
        };
    });

    /* 2) Lưu & áp dụng giao diện */
    if (scores[0] >= 20) {
        saveSettings(updated);
        applySettings(updated);
        scores[0] = (scores[0] ?? 0) - 20;   // bảo toàn mảng scores đã load sẵn
        saveScores(scores);                  // ghi lại localStorage
        updateScoreboard();
        modalSettings.style.display = 'none';
        location.reload();
    } else {
        alertify.error('Cần 20 điểm cho 1 lần cài đặt');
    }
};