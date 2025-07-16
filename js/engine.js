import { createDeck, sortHand, cardToString, clone, highestSuitOfMaxRank } from './utils.js';
import { getHandType, canBeat, isStraight, isDoubleSeq } from './rules.js';
import { settings, loadSettings, saveSettings, applySettings, populateSettingsModal, collectSettingsFromModal } from './settings.js';
import { playSound, getStartRect, flyCard, loadScores, saveScores } from './gameHelpers.js';
import { BASE_WEIGHT, countTwos, isBomb, getGameStage, scoreMove } from './aiHelpers.js';
import { CHOP_SCORE } from './config.js';

/* Danh sách mặc định cho người chơi */
const BASE_PLAYERS = [
    { name: 'Bạn', hand: [], bot: false, image: 'https://jbagy.me/wp-content/uploads/2025/03/hinh-anh-cute-avatar-vo-tri-2.jpg' },
    { name: 'Bot 1', hand: [], bot: true, image: 'https://jbagy.me/wp-content/uploads/2025/03/hinh-anh-cute-avatar-vo-tri-3.jpg' },
    { name: 'Bot 2', hand: [], bot: true, image: 'https://jbagy.me/wp-content/uploads/2025/03/hinh-anh-cute-avatar-vo-tri-4.jpg' },
    { name: 'Bot 3', hand: [], bot: true, image: 'https://jbagy.me/wp-content/uploads/2025/03/hinh-anh-cute-avatar-vo-tri-1.jpg' },
]

/* ==== TẢI CẤU HÌNH VÀ ĐIỂM SỐ ===== */
alertify.set('notifier', 'position', 'top-left');
alertify.set('notifier', 'delay', 3);

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
let costSettings = 0;
let changedInputs = new Set();

applySettings(settings);



/*==== KHỞI TẠO CẤU HÌNH GAME =====*/
export const state = {
    players: BASE_PLAYERS.map((base, i) => ({
        ...base,
        ...((settings.players?.[i]) ?? {}),
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


function takeCards(deck, rank, count, bucket) {
    for (let i = deck.length - 1; i >= 0 && count > 0; i--) {
        if (deck[i].rank === rank) {
            bucket.push(deck[i]);
            deck.splice(i, 1);
            count--;
        }
    }
}

function pickChampionSpecial(deck) {
    const result = [];
    const scenario = Math.floor(Math.random() * 3);

    switch (scenario) {
        case 0:
            takeCards(deck, 13, 2, result);  // K
            takeCards(deck, 14, 2, result);  // A
            takeCards(deck, 15, 2, result);  // 2
            break;

        case 1:
            takeCards(deck, 14, 2, result);  // A A
            const fourRank = 11 + Math.floor(Math.random() * 3); // J / Q / K
            takeCards(deck, fourRank, 4, result);
            break;

        default:
            takeCards(deck, 14, 4, result);  // A A A A
            takeCards(deck, 15, 2, result);  // 2 2
    }
    return result;
}

/* === CHIA BÀI VÀ XÁC ĐỊNH NGƯỜI ĐI TRƯỚC === */
function deal() {
    state.players.forEach(p => p.hand = []);
    const deck = createDeck();

    if (settings.champion && settings.champion == 1) {
        const special = pickChampionSpecial(deck);
        state.players[0].hand.push(...special);
    }

    deck.sort(() => Math.random() - 0.5);
    const need = [
        13 - state.players[0].hand.length,
        13,
        13,
        13,
    ];

    let idx = 0;
    for (const card of deck) {
        while (need[idx] === 0) idx = (idx + 1) % 4;
        state.players[idx].hand.push(card);
        need[idx]--;
    }

    state.players.forEach(p => sortHand(p.hand));
    if (state.nextStarter === null || state.nextStarter === undefined) {
        for (let i = 0; i < 4; i++) {
            if (state.players[i].hand.some(c => c.rank === 3 && c.suit === '\u2660')) {
                state.current = i;
                break;
            }
        }
    } else {
        state.current = state.nextStarter;
    }
    if (state.players[state.current].bot) {
        setTimeout(botPlay, settings && settings.botDelay ? settings.botDelay : 1000);
    }
}



/* ====== BẮT ĐẦU GAME ====== */
function render() {
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

    const table = document.getElementById('table');
    table.innerHTML = state.lastPlayed.map(c =>
        `<span class="card${c.suit === '♥' || c.suit === '♦' ? ' red' : ''} ${settings.cardStyle && settings.cardStyle === 'classic' ? 'classic' : 'modern'}">${cardToString(c)}</span>`
    ).join('');

    const hand = document.getElementById('player-hand');
    hand.innerHTML = '';
    state.players[0].hand.forEach((c, idx) => {
        const sel = state.selected.includes(idx) ? 'selected' : '';
        const red = (c.suit === '♥' || c.suit === '♦') ? 'red' : '';
        hand.innerHTML += `<span class="card ${settings.cardStyle && settings.cardStyle === 'classic' ? 'classic' : 'modern'} ${sel}${red ? ' ' + red : ''}" data-idx="${idx}">${cardToString(c)}</span>`;
    });

    const controls = document.getElementById('player-controls');
    if (controls) {
        controls.style.display =
            (state.current === 0 && !state.winner &&
                !state.ranks.includes(0)) ? 'flex' : 'none';
    }

    let msg = '';
    if (state.ranks.length >= 4) {
        msg = state.ranks.map((idx, i) => {
            return `<li>${i + 1}. ${state.players[idx].name}</li>`;
        }).join('');

        let add = [10, 5, 1, 0];
        state.ranks.forEach((idx, rank) => {
            scores[idx] += add[rank];
        });
        saveScores(scores);
        updateScoreboard();

        state.nextStarter = state.ranks[0];
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
        }, 3000);
    } else if (state.ranks.length > 0) {
        msg = state.ranks.map((idx, i) =>
            `<li>${i + 1}. ${state.players[idx].name}</li>`
        ).join('');
    }
    document.getElementById('message-win').innerHTML =
        msg || `Lượt: ${state.players[state.current].name}`;
    updateScoreboard();
}

/* ======= ĐIỀU KHIỂN LƯỢT ======= */
function nextTurn() {
    if (state.ranks.length >= 3) {
        if (!state.winner) {
            const lastIdx = state.players.findIndex((p, i) => !state.ranks.includes(i));
            if (lastIdx !== -1) state.ranks.push(lastIdx);
            state.winner = state.players[state.ranks[0]].name;
        }
        render();
        return;
    }

    let next = (state.current + 3) % 4;
    while (state.ranks.includes(next)) {
        next = (next + 3) % 4;
    }
    state.current = next;

    if (state.players[state.current].hand.length === 0 && !state.ranks.includes(state.current)) {
        state.ranks.push(state.current);
        nextTurn();
        return;
    }

    let activePlayers = 4 - state.ranks.length;
    let passNeeded = Math.max(activePlayers - 1, 1);
    if (state.passCount >= passNeeded) {
        state.current = state.lastPlayer;
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

    if (state.skipped[state.current] && state.lastPlayed.length) {
        state.passCount++;
        nextTurn();
        return;
    }

    if (state.players[state.current].bot && !state.ranks.includes(state.current)) setTimeout(botPlay, settings && settings.botDelay ? settings.botDelay : 1500);
    render();
}


/* ======= KIỂM TRA NƯỚC ĐI ======= */
function isValidPlay(cards, lastPlayed) {
    if (!cards.length) return false;
    const info = getHandType(cards);
    if (!info || info.type === 'invalid') return false;
    if (!lastPlayed.length || lastPlayed === undefined) return true;
    return canBeat(lastPlayed, cards);
}


/* ======= NGƯỜI CHƠI ======= */
async function playerPlay() {
    if (state.current !== 0 || state.winner || state.ranks.includes(0)) return;
    const cards = state.selected.map(i => state.players[0].hand[i]);
    if (!cards.length) return;
    if (!isValidPlay(cards, state.lastPlayed) || !canBeat(state.lastPlayed, cards)) {
        alertify.error('Bài không hợp lệ');
        return;
    }

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

    playSound('play');
    await Promise.all(flyJobs);

    state.players[0].hand = state.players[0].hand.filter((_, i) => !state.selected.includes(i));
    if (state.lastPlayed.length) {
        const prev = getHandType(state.lastPlayed);
        const now = getHandType(cards);

        // Chặt 1 con 2
        if (prev.type === 'single' && state.lastPlayed[0].rank === 15 &&
            (now.type === 'four' || (now.type === 'dseq' && cards.length >= 6))) {
            const beatType = state.lastPlayed[0].suit === '♥' || state.lastPlayed[0].suit === '♦'
                ? 'single2red' : 'single2black';
            handleSpecialScore(beatType, 0, state.lastPlayer);
        }

        // Chặt đôi 2
        if (prev.type === 'pair' && state.lastPlayed[0].rank === 15 &&
            (now.type === 'four' || (now.type === 'dseq' && cards.length >= 8))) {
            handleSpecialScore('double2', 0, state.lastPlayer);
        }
    }
    state.lastPlayed = cards;
    sortHand(state.lastPlayed);
    state.played[0] = true;
    state.lastPlayer = 0;
    state.selected = [];
    state.passCount = 0;

    render();
    if (!state.players[0].hand.length && !state.ranks.includes(0)) {
        playSound('win');
        state.ranks.push(0);
    }
    nextTurn();
}


function playerPass() {
    playSound('pass');
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

    for (let i = 0; i < hand.length; i++) {
        if (canBeat(state.lastPlayed, [hand[i]]))
            moves.push({ cards: [i], type: 'single', rank: hand[i].rank });
    }

    for (let i = 0; i < hand.length - 1; i++) {
        if (hand[i].rank === hand[i + 1].rank && canBeat(state.lastPlayed, [hand[i], hand[i + 1]]))
            moves.push({ cards: [i, i + 1], type: 'pair', rank: hand[i].rank });
    }

    for (let i = 0; i < hand.length - 2; i++) {
        if (hand[i].rank === hand[i + 1].rank && hand[i].rank === hand[i + 2].rank &&
            canBeat(state.lastPlayed, [hand[i], hand[i + 1], hand[i + 2]]))
            moves.push({ cards: [i, i + 1, i + 2], type: 'triple', rank: hand[i].rank });
    }

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

    for (let i = 0; i < hand.length - 3; i++) {
        if (hand[i].rank === hand[i + 1].rank &&
            hand[i].rank === hand[i + 2].rank &&
            hand[i].rank === hand[i + 3].rank &&
            canBeat(state.lastPlayed, [hand[i], hand[i + 1], hand[i + 2], hand[i + 3]]))
            moves.push({ cards: [i, i + 1, i + 2, i + 3], type: 'four', rank: hand[i].rank });
    }

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

    if (moves.length) {
        const prevType = getHandType(state.lastPlayed);

        if (prevType.type === 'single' && state.lastPlayed[0]?.rank === 15) {
            let chop = moves.filter(m => m.type === 'four' || (m.type === 'dseq' && m.cards.length >= 6));
            if (chop.length) {
                chop.sort((a, b) => a.cards.length - b.cards.length || a.rank - b.rank);
                move = chop[0].cards;
                specialBeat = state.lastPlayed[0].suit === '♥' || state.lastPlayed[0].suit === '♦'
                    ? 'single2red' : 'single2black';
                specialTarget = state.lastPlayer;
            }
        } else if (prevType.type === 'pair' && state.lastPlayed[0]?.rank === 15) {
            let chop = moves.filter(m => m.type === 'four' || (m.type === 'dseq' && m.cards.length >= 8));
            if (chop.length) {
                chop.sort((a, b) => a.cards.length - b.cards.length || a.rank - b.rank);
                move = chop[0].cards;
                specialBeat = 'double2'
                specialTarget = state.lastPlayer;
            }
        } else {
            let winMove = moves.find(m => m.cards.length === hand.length);
            if (winMove) move = winMove.cards;
        }

        const stage = getGameStage(hand);
        const rankedMoves = moves.map(m => ({
            ...m,
            score: scoreMove(m, hand, stage)
        }));

        if (!move) {
            rankedMoves.sort((a, b) => a.score - b.score || a.rank - b.rank);
            move = rankedMoves[0]?.cards;
        }

    }

    if (move) {
        const cards = move.map(i => hand[i]);
        const table = document.getElementById('table');
        const botArea =
            idx === 1 ? document.querySelector('.bot-left')
                : idx === 2 ? document.querySelector('.bot-top')
                    : idx === 3 && document.querySelector('.bot-right');
        const backs = botArea.querySelectorAll('.card-back');
        const fallbackRect = getStartRect(botArea);
        const flyJobs = [];
        cards.forEach((c, k) => {
            const backIdx = backs.length - 1 - k;
            const srcRect = backIdx >= 0 ? backs[backIdx].getBoundingClientRect()
                : fallbackRect;

            const html = `<span class="card${(c.suit === '♥' || c.suit === '♦') ? ' red' : ''} ${settings.cardStyle === 'classic' ? 'classic' : 'modern'}">
                  ${cardToString(c)}
                </span>`;
            const offset = (k - (cards.length - 1) / 2) * 28;
            flyJobs.push(flyCard(srcRect, table, html, offset));
        });

        playSound('play');
        await Promise.all(flyJobs);

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

        if (specialBeat && specialTarget != null) {
            handleSpecialScore(specialBeat, idx, specialTarget);
        }

        if (!bot.hand.length && !state.ranks.includes(idx)) {
            playSound('win');
            state.ranks.push(idx);
            nextTurn();
            return;
        }
    } else {
        playSound('pass');
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
function handleSpecialScore(type, who, target) {
    const delta = {
        single2black: CHOP_SCORE.single2black,
        single2red: CHOP_SCORE.single2red,
        double2: CHOP_SCORE.double2
    }[type] || 0;
    if (!delta) return;

    playSound('chop');
    scores[who] += delta;
    scores[target] -= delta;
    saveScores(scores);
    updateScoreboard();

    state.chopStack++;
}


/*=== SETTINGS CSS ===*/
let deckstack = document.querySelector('.deck-stack');
settings.cardBack && settings.cardBack === 'red' && deckstack.classList.add('card-red');


/*=== HIỆU ỨNG CHIA BÀI ===*/
function animateDeal(callback) {
    const deckCenter = document.getElementById('deck-center');
    const botHands = document.getElementById('bot-hands');
    const playerHand = document.getElementById('player-hand');
    const getTarget = idx => {
        const el = [
            document.querySelector('.player-avatar'),
            botHands.querySelector('.bot-left .avatar'),
            botHands.querySelector('.bot-top .avatar'),
            botHands.querySelector('.bot-right .avatar')
        ][idx];
        if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const rect = el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };
    const deckRect = deckCenter.getBoundingClientRect();
    const deckX = deckRect.left + deckRect.width / 2;
    const deckY = deckRect.top + deckRect.height / 2;
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
            }, 300);
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
        const dx = target.x - deckX;
        const dy = target.y - deckY;
        setTimeout(() => {
            card.style.transform = `translate(${dx}px,${dy}px) scale(0.5)`;
            card.style.opacity = '0.5';
        }, 10);

        setTimeout(() => {
            card.remove();
        }, 300);
        i++;
        setTimeout(dealOne, 30);
    }
    playSound('deal');
    dealOne();
}

document.addEventListener('DOMContentLoaded', () => {
    updateScoreboard();
    playSound('background');
    document.getElementById('bot-hands').style.display = 'none';
    document.getElementById('table').style.display = 'none';
    document.getElementById('player-hand').style.display = 'none';
    document.getElementById('player-controls').style.display = 'none';
    document.getElementById('message').style.display = 'none';
    document.getElementById('namegame').style.display = '';
    document.getElementById('deck-center').style.display = '';
    document.getElementById('deal-btn').style.display = '';
    document.getElementById('settings-btn').style.display = '';

    document.getElementById('deal-btn').addEventListener('click', () => {
        document.getElementById('deal-btn').style.display = 'none';
        document.getElementById('settings-btn').style.display = 'none';
        document.getElementById('namegame').style.display = 'none';
        document.getElementById('bot-hands').style.display = '';
        render();
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
const btnSaveSettings = document.getElementById('save-settings');

btnOpenSettings.onclick = () => {
    playSound('click');
    costSettings = 0;
    document.getElementById('changeInputCost').textContent = 'Tổng 0 🌕';
    populateSettingsModal(loadSettings());
    const allInputs = modalSettings.querySelectorAll('input, select');
    allInputs.forEach(el => {
        const key = el.id || el.className;
        el.addEventListener('change', () => {
            if (changedInputs.has(key)) return;
            changedInputs.add(key);
            
            if (key === 'champion-mode') {
                if (!el.checked) return;
                costSettings += 500;
            } else if (key === 'player-name' || key === 'player-image') {
                costSettings += 50;
            } else if (key === 'backgound-music' || key === 'game-sound') {
                costSettings += 5;
            } else {
                costSettings += 20;
            }
            document.getElementById('changeInputCost').textContent = `Tổng ${costSettings} 🌕`;
        });
    });
    modalSettings.style.visibility = 'visible';

};

btnCloseSettings.onclick = () => { playSound('click'); modalSettings.style.visibility = 'hidden'; };


/*=== SAVE SETTINGS ===*/
btnSaveSettings.onclick = () => {
    playSound('click');
    const updated = collectSettingsFromModal();
    if ((scores[0] ?? 0) > costSettings) {
        saveSettings(updated);
        applySettings(updated);
        scores[0] -= costSettings;
        saveScores(scores);
        updateScoreboard();
        costSettings = 0;
        changedInputs.clear();
        modalSettings.style.visibility = 'visible';
        location.reload();
    } else {
        alertify.error(`Cần ${costSettings} điểm`);
        return;
    }
};
