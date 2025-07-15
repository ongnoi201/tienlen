// utils/gameHelpers.js
import { SUITS } from './config.js';
import { SCORE_KEY } from './config.js';


/* ===== ÂM THANH ===== */
const SOUND_PATH = './audio/';
export const audio = {
    deal: [new Audio(`${SOUND_PATH}chia.mp3`)],
    play: [new Audio(`${SOUND_PATH}danh.mp3`)],
    chop: [new Audio(`${SOUND_PATH}may-ha-buoi.mp3`), new Audio(`${SOUND_PATH}ngu-ne.mp3`)],
    win: [new Audio(`${SOUND_PATH}thua-di-cung.mp3`), new Audio(`${SOUND_PATH}may-con-ga.mp3`), new Audio(`${SOUND_PATH}hehe.mp3`)],
    click: [new Audio(`${SOUND_PATH}click.mp3`)]
};

// cấu hình mặc định cho mọi clip
Object.values(audio).flat().forEach(a => {
    a.preload = 'auto';
    a.volume = 0.6;
});

export function playSound(name) {
    const bank = audio[name];
    if (!bank) return;
    const clip = Array.isArray(bank)
        ? bank[Math.floor(Math.random() * bank.length)]
        : bank;
    clip.currentTime = 0;
    clip.play().catch(() => { });
}

/* ===== Hiệu ứng lá bài bay ===== */
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

// utils/gameHelpers.js
export function flyCard(startRect, tableEl, html, landingOffset = 0) {
    return new Promise(resolve => {
        const tableRect = tableEl.getBoundingClientRect();

        // Tạo lá bài bay
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
            /* Bảo đảm luôn có transition, phòng khi CSS chưa tải */
            transition: 'transform .55s ease, opacity .55s ease',
        });

        document.body.appendChild(card);

        /* ---- QUAN TRỌNG: ép trình duyệt “đọc” layout một lần ---- */
        card.getBoundingClientRect();      // Force reflow

        const dx = tableRect.left + tableRect.width / 2 + landingOffset
            - (startRect.left + startRect.width / 2);
        const dy = tableRect.top + tableRect.height / 2
            - (startRect.top + startRect.height / 2);

        // Bắt đầu bay
        card.style.transform = `translate(${dx}px,${dy}px) scale(1)`;
        card.style.opacity = '0.85';

        // Khi bay xong thì dọn dẹp
        card.addEventListener('transitionend', () => {
            card.remove();
            resolve();
        }, { once: true });
    });
}


/* ===== Helper hiển thị điểm ===== */
export function showScoreEffect(avatarEl, text) {
    if (!avatarEl) return;
    const eff = document.createElement('span');
    eff.textContent = text;
    Object.assign(eff.style, {
        position: 'absolute',
        left: '50%',
        top: '0',
        transform: 'translate(-50%,-80%)',
        fontSize: '22px',
        fontWeight: 'bold',
        color: text.startsWith('+') ? '#43a047' : '#d32f2f',
        textShadow: '1px 1px 4px #222,0 0 8px #fff8',
        pointerEvents: 'none',
        zIndex: 999
    });
    avatarEl.parentElement.appendChild(eff);
    setTimeout(() => {
        eff.style.transition = 'all .8s cubic-bezier(.7,1.7,.5,1)';
        eff.style.top = '-40px';
        eff.style.opacity = '0';
    }, 50);
    setTimeout(() => eff.remove(), 1200);
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