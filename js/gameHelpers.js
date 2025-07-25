import { SCORE_KEY } from './config.js';


/* ===== ÂM THANH ===== */
const SOUND_PATH = './audio/';
export const audio = {
    deal: [new Audio(`${SOUND_PATH}chia.mp3`)],
    play: [new Audio(`${SOUND_PATH}danh.mp3`)],
    chop: [new Audio(`${SOUND_PATH}may-ha-buoi.mp3`), new Audio(`${SOUND_PATH}ngu-ne.mp3`)],
    win: [new Audio(`${SOUND_PATH}thua-di-cung.mp3`), new Audio(`${SOUND_PATH}may-con-ga.mp3`), new Audio(`${SOUND_PATH}hehe.mp3`)],
    pass: [new Audio(`${SOUND_PATH}boqua.mp3`), new Audio(`${SOUND_PATH}khongco.mp3`)],
    click: [new Audio(`${SOUND_PATH}click.mp3`)],
    background: [new Audio(`${SOUND_PATH}music.m4a`)]
};

Object.values(audio).flat().forEach(a => {
    a.preload = 'auto';
    a.volume = 0.6;
});

export function playSound(name) {
    if (name === 'background') {
        if (!window.MUSIC_ENABLED) return;
    } else {
        if (!window.SOUND_ENABLED) return;
    }
    const bank = audio[name];
    if (!bank) return;
    const clip = Array.isArray(bank)
        ? bank[Math.floor(Math.random() * bank.length)]
        : bank;

    if (name === 'background') {
        clip.loop = true;
        clip.volume = 0.2;
    } else {
        clip.loop = false;
    }
    clip.currentTime = 0;
    clip.play().catch(() => { });
}

/* ===== LẤY VỊ TRÍ LÁ BÀI ===== */
export function getStartRect(botArea) {
    const backs = botArea.querySelectorAll('.card-back');
    let el = backs.length ? backs[backs.length - 1] : botArea.querySelector('.avatar');
    let rect = el.getBoundingClientRect();

    if (rect.width < 5 || rect.height < 5) {
        el = botArea.querySelector('.avatar');
        rect = el.getBoundingClientRect();
    }
    return rect;
}


/*=== LÁ BÀI BAY === */
export function flyCard(startRect, tableEl, html, landingOffset = 0) {
    return new Promise(resolve => {
        const tableRect = tableEl.getBoundingClientRect();
        const wrap = document.createElement('div');
        wrap.innerHTML = html.trim();
        const card = wrap.firstElementChild;

        card.classList.add('card-fly');
        Object.assign(card.style, {
            position: 'fixed',
            left: `${startRect.left}px`,
            top: `${startRect.top}px`,
            width: `${Math.max(startRect.width, 38)}px`,
            height: `${Math.max(startRect.height, 54)}px`,
            opacity: '1',
            transition: 'transform .55s ease, opacity .55s ease',
        });

        document.body.appendChild(card);
        card.getBoundingClientRect();
        const dx = tableRect.left + tableRect.width / 2 + landingOffset
            - (startRect.left + startRect.width / 2);
        const dy = tableRect.top + tableRect.height / 2
            - (startRect.top + startRect.height / 2);
        card.style.transform = `translate(${dx}px,${dy}px) scale(1)`;
        card.style.opacity = '0.85';
        card.addEventListener('transitionend', () => {
            card.remove();
            resolve();
        }, { once: true });
    });
}


/* === TRẠNG THÁI GAME & SCORE === */
export function loadScores() {
    let s = localStorage.getItem(SCORE_KEY);
    if (!s) return [0, 0, 0, 0];
    try { return JSON.parse(s); } catch { return [0, 0, 0, 0]; }
}

export function saveScores(scores) {
    localStorage.setItem(SCORE_KEY, JSON.stringify(scores));
}

