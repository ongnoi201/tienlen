import { createDeck, sortHand, cardToString, clone, highestSuitOfMaxRank } from './utils.js';
import { getHandType, canBeat, isStraight, isDoubleSeq } from './rules.js';
import { settings, loadSettings, saveSettings, applySettings, populateSettingsModal } from './settings.js';
import { playSound, getStartRect, flyCard, showScoreEffect, loadScores, saveScores } from './gameHelpers.js';
import { BASE_WEIGHT, countTwos, isBomb, getGameStage, scoreMove } from './aiHelpers.js';

/* Danh sách mặc định cho người chơi */
const BASE_PLAYERS = [
    { name: 'Bạn', hand: [], bot: false, image: 'https://jbagy.me/wp-content/uploads/2025/03/hinh-anh-cute-avatar-vo-tri-2.jpg' },
    { name: 'Bot 1', hand: [], bot: true, image: 'https://jbagy.me/wp-content/uploads/2025/03/hinh-anh-cute-avatar-vo-tri-3.jpg' },
    { name: 'Bot 2', hand: [], bot: true, image: 'https://jbagy.me/wp-content/uploads/2025/03/hinh-anh-cute-avatar-vo-tri-4.jpg' },
    { name: 'Bot 3', hand: [], bot: true, image: 'https://jbagy.me/wp-content/uploads/2025/03/hinh-anh-cute-avatar-vo-tri-1.jpg' },
]

/* ==== TẢI CẤU HÌNH VÀ ĐIỂM SỐ ===== */
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
let scores = loadScores();
applySettings(settings);



/*==== KHỞI TẠO CẤU HÌNH GAME =====*/
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
    chopStack: 0,
    played: [false, false, false, false],
};



/* === CHIA BÀI VÀ XÁC ĐỊNH NGƯỜI ĐI TRƯỚC === */
function deal() {
    const deck = createDeck();
    deck.sort(() => Math.random() - 0.5);
    for (let i = 0; i < 52; i++) state.players[i % 4].hand.push(deck[i]);
    state.players.forEach(p => sortHand(p.hand));

    // Xác định người đi trước
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



/* ====== BẮT ĐẦU GAME ====== */
function render() {
    // Tạo giao diện bot
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
            <img class="avatar bot-avatar${state.current === 3 ? ' active' : ''}" src='${state.players[3].image}' alt="Bot 3">
            ${Array(state.players[3].hand.length).fill(0).map((_, i) =>
        `<span class="card-back ${settings.cardBack && settings.cardBack === 'red' ? 'card-red' : 'card-blue'}" style="top:${i * 18}px"></span>`
    ).join('')}
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
        controls.style.display =
            (state.current === 0 && !state.winner &&
                !state.ranks.includes(0)) ? 'flex' : 'none';
    }

    // Thông báo xếp hạng và úp dách
    let msg = '';

    if (state.ranks.length >= 4) {
        msg = state.ranks.map((idx, i) => {
            return `<li>${i + 1}. ${state.players[idx].name}</li>`;
        }).join('');


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
            state.current = 0;
            state.lastPlayed = [];
            state.lastPlayer = null;
            state.selected = [];
            state.winner = null;
            state.passCount = 0;
            state.skipped = [false, false, false, false];
            state.played = [false, false, false, false];
            state.ranks = [];
        }, 5000);
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
        next = (next + 3) % 4;           // ngược kim đồng hồ
    }
    state.current = next;

    // Hết bài => về đích
    if (state.players[state.current].hand.length === 0 && !state.ranks.includes(state.current)) {
        state.ranks.push(state.current);
        // Nếu vừa có người thắng đầu tiên -> kiểm tra úp dách
        if (state.ranks.length === 1) {
            state.players.forEach((p, i) => {
                if (!state.played[i] && p.hand.length === 13 && !state.ranks.includes(i)) {
                    // Bị úp dách
                    state.ranks.push(i);             // xếp bét
                    scores[i] -= 5;                  // trừ điểm
                    state.skipped[i] = true;         // không được chơi nữa
                }
            });
            saveScores(scores);
            updateScoreboard();
        }

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
async function playerPlay() {
    if (state.current !== 0 || state.winner || state.ranks.includes(0)) return;

    const cards = state.selected.map(i => state.players[0].hand[i]);
    if (!cards.length) return;
    if (!canBeat(state.lastPlayed, cards)) {
        document.getElementById('message-win').textContent = 'Không hợp lệ!';
        return;
    }

    // Animation
    const flyJobs = [];
    state.selected.forEach((i, k) => {
        const el = document.querySelector(`.card[data-idx="${i}"]`);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const html = `<span class="card${el.classList.contains('red') ? ' red' : ''}
                    ${settings.cardStyle === 'classic' ? 'classic' : 'modern'}">
                    ${el.textContent}
                  </span>`;
        flyJobs.push(flyCard(rect, document.getElementById('table'), html, (k - (cards.length - 1) / 2) * 28));
    });

    playSound('play');                    // phát ngay khi rời tay
    await Promise.all(flyJobs);           // đợi bay xong

    /* --- Cập nhật state sau animation --- */
    state.players[0].hand = state.players[0].hand.filter((_, i) => !state.selected.includes(i));
    state.lastPlayed = cards;
    sortHand(state.lastPlayed);
    state.played[0] = true;
    state.lastPlayer = 0;
    state.selected = [];
    state.passCount = 0;

    render();                             // giờ mới vẽ bài lên bàn


    if (!state.players[0].hand.length && !state.ranks.includes(0)) {
        playSound('win');
        state.ranks.push(0);
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
async function botPlay() {
    const idx = state.current;
    const bot = state.players[idx];
    const hand = bot.hand;
    if (state.ranks.includes(idx)) {
        nextTurn();
        return;
    }

    let move = null, moves = [];
    let specialBeat = null, specialTarget = null;

    // ====== Tìm tất cả nước hợp lệ ======
    // Single
    for (let i = 0; i < hand.length; i++) {
        if (canBeat(state.lastPlayed, [hand[i]]))
            moves.push({ cards: [i], type: 'single', rank: hand[i].rank });
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
                moves.push({
                    cards: [...Array(len).keys()].map(j => i + j),
                    type: 'straight',
                    rank: slice[slice.length - 1].rank,
                    len
                });
        }
    }

    // Four of a kind
    for (let i = 0; i < hand.length - 3; i++) {
        if (hand[i].rank === hand[i + 1].rank &&
            hand[i].rank === hand[i + 2].rank &&
            hand[i].rank === hand[i + 3].rank &&
            canBeat(state.lastPlayed, [hand[i], hand[i + 1], hand[i + 2], hand[i + 3]]))
            moves.push({ cards: [i, i + 1, i + 2, i + 3], type: 'four', rank: hand[i].rank });
    }

    // Double sequence
    for (let len = 6; len <= hand.length; len += 2) {
        for (let i = 0; i <= hand.length - len; i++) {
            const slice = hand.slice(i, i + len);
            if (isDoubleSeq(slice) && canBeat(state.lastPlayed, slice))
                moves.push({
                    cards: [...Array(len).keys()].map(j => i + j),
                    type: 'dseq',
                    rank: slice[slice.length - 2].rank,
                    len
                });
        }
    }

    // ====== AI chọn nước đi ======
    if (moves.length) {
        const prevType = getHandType(state.lastPlayed);

        // Chặt 2
        if (prevType.type === 'single' && state.lastPlayed[0]?.rank === 15) {
            let chop = moves.filter(m => m.type === 'four' || (m.type === 'dseq' && m.cards.length >= 8));
            if (chop.length) {
                chop.sort((a, b) => a.cards.length - b.cards.length || a.rank - b.rank);
                move = chop[0].cards;
                specialBeat = state.lastPlayed[0].suit === '♥' || state.lastPlayed[0].suit === '♦' ? 'chop2red' : 'chop2';
                specialTarget = state.lastPlayer;
            }
        }
        // Chặt đôi 2
        else if (prevType.type === 'pair' && state.lastPlayed[0]?.rank === 15) {
            let chop = moves.filter(m => m.type === 'four' || (m.type === 'dseq' && m.cards.length >= 8));
            if (chop.length) {
                chop.sort((a, b) => a.cards.length - b.cards.length || a.rank - b.rank);
                move = chop[0].cards;
                specialBeat = 'chop2double';
                specialTarget = state.lastPlayer;
            }
        }
        // Có thể đánh hết bài
        else {
            let winMove = moves.find(m => m.cards.length === hand.length);
            if (winMove) move = winMove.cards;
        }

        // Ưu tiên theo loại bài trên bàn
        // ====== AI chọn nước đi ======
        const stage = getGameStage(hand);          // early | mid | late
        const rankedMoves = moves.map(m => ({
            ...m,
            score: scoreMove(m, hand, stage)         // tính điểm
        }));

        // Chỉ chấm điểm khi chặt 2 không kích hoạt
        if (!move) {
            rankedMoves.sort((a, b) => a.score - b.score || a.rank - b.rank);
            move = rankedMoves[0]?.cards;            // move tốt nhất
        }

    }

    // ====== Đánh bài ======
    if (move) {
        const cards = move.map(i => hand[i]);
        const table = document.getElementById('table');
        const botArea =
            idx === 1 ? document.querySelector('.bot-left')
                : idx === 2 ? document.querySelector('.bot-top')
                    : idx === 3 && document.querySelector('.bot-right');
        const backs = botArea.querySelectorAll('.card-back');
        const fallbackRect = getStartRect(botArea);      // hàm bạn đã có
        const flyJobs = [];
        cards.forEach((c, k) => {
            // Lá ở cuối bộ bài tương ứng backs.length-1, rồi -2, -3...
            const backIdx = backs.length - 1 - k;
            const srcRect = backIdx >= 0 ? backs[backIdx].getBoundingClientRect()
                : fallbackRect;

            const html = `<span class="card${(c.suit === '♥' || c.suit === '♦') ? ' red' : ''} ${settings.cardStyle === 'classic' ? 'classic' : 'modern'}">
                  ${cardToString(c)}
                </span>`;
            const offset = (k - (cards.length - 1) / 2) * 28;
            flyJobs.push(flyCard(srcRect, table, html, offset));
        });

        playSound('play');                       // phát tiếng ngay khi rời tay
        await Promise.all(flyJobs);

        // Cập nhật bài (xóa bài đúng theo giá trị)
        for (let card of cards) {
            const index = bot.hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
            if (index !== -1) bot.hand.splice(index, 1);
        }

        state.lastPlayed = cards;
        sortHand(state.lastPlayed);
        state.played[idx] = true;
        state.lastPlayer = idx;
        state.passCount = 0;
        state.skipped[idx] = false;

        // Xử lý điểm đặc biệt
        if (specialBeat && specialTarget != null) {
            handleSpecialScore(specialBeat, specialTarget, idx);
        }

        // Kiểm tra bot hết bài
        if (!bot.hand.length && !state.ranks.includes(idx)) {
            playSound('win');
            state.ranks.push(idx);
            nextTurn();
            return;
        }
    } else {
        // Không đánh được → Bỏ lượt
        if (state.lastPlayer !== idx && state.lastPlayed.length) {
            const prev = getHandType(state.lastPlayed);
            if (prev.type === 'dseq' && state.lastPlayed.length >= 8 && state.lastPlayed[0].rank === 15) {
                handleSpecialScore('chop3seq', idx, state.lastPlayer);
            }
            state.passCount++;
            state.skipped[idx] = true;
        }
    }

    render();
    nextTurn();
}


/* ======= SỰ KIỆN ======= */
// Xử lý điểm khi chặt 2, chặt đôi thông, chặt đôi 2
function handleSpecialScore(type, who, target) {
    // stacked = đã có chặt trước đó trên cùng bàn
    const stacked = state.chopStack > 0;
    const delta = {
        chop2: stacked ? 20 : 5,
        chop2red: stacked ? 20 : 10,
        chop2double: 20,
        chop3seq: stacked ? 20 : 10
    }[type] || 0;
    if (!delta) return;

    playSound('chop');
    scores[who] += delta;
    scores[target] -= delta;
    showScoreEffect(who, `+${delta}`);
    showScoreEffect(target, `-${delta}`);
    saveScores(scores);
    updateScoreboard();

    state.chopStack++; // đánh dấu đã có chặt
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
            }, 500);
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
