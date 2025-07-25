// ======= CẤU HÌNH SETTINGS =======
const DEFAULT_SETTINGS = {
    background: '#2e7d32',
    tableBackground: '#388e3c',
    botDelay: 1500,
    cardStyle: 'classic',
    cardBack: 'red',
    champion: 0,
    music: 1,
    sound: 1,
    players: [
        { name: 'Bạn', hand: [], bot: false, image: 'https://jbagy.me/wp-content/uploads/2025/03/hinh-anh-cute-avatar-vo-tri-2.jpg' },
        { name: 'Bot 1', hand: [], bot: true, image: 'https://jbagy.me/wp-content/uploads/2025/03/hinh-anh-cute-avatar-vo-tri-3.jpg' },
        { name: 'Bot 2', hand: [], bot: true, image: 'https://jbagy.me/wp-content/uploads/2025/03/hinh-anh-cute-avatar-vo-tri-4.jpg' },
        { name: 'Bot 3', hand: [], bot: true, image: 'https://jbagy.me/wp-content/uploads/2025/03/hinh-anh-cute-avatar-vo-tri-1.jpg' },
    ]
};

const SETTINGS_KEY = 'tienlen_settings';

/* ===== LẤY SETTINGS ===== */
export function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
        const players = DEFAULT_SETTINGS.players.map((def, i) => ({
            ...def,
            ...(saved.players?.[i] ?? {})
        }));
        return { ...DEFAULT_SETTINGS, ...saved, players, champion: saved.champion ?? DEFAULT_SETTINGS.champion, };
    } catch {
        return structuredClone(DEFAULT_SETTINGS);
    }
}

/* ===== LƯU SETTINGS ===== */
export function saveSettings(newSettings) {
    const sanitized = {
        ...newSettings,
        players: newSettings.players.map((p, i) => ({
            name: p.name,
            image: p.image,
            bot: DEFAULT_SETTINGS.players[i].bot
        })),
        champion: newSettings.champion ? 1 : 0,
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitized));
}

export function applySettings(settings) {
    document.body.style.setProperty('--bg', settings.background);
    const table = document.getElementById('table');
    const area = document.getElementById('game-area');
    if (table) table.style.background = settings.tableBackground;

    const backs = document.querySelectorAll('.card-back');
    backs.forEach(card => {
        card.classList.remove('red', 'blue', 'green');
        card.classList.add(settings.cardBack);
    });

    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.classList.remove('classic', 'modern');
        card.classList.add(settings.cardStyle);
    });

    const avatars = document.querySelectorAll('.avatar');
    avatars.forEach((img, idx) => {
        if (settings.players[idx]) {
            img.src = settings.players[idx].image;
        }
    });


    window.SOUND_ENABLED = !!settings.sound;  
    window.MUSIC_ENABLED = !!settings.music;  

    const scoreboard = document.querySelectorAll('#score-list li span:first-child');
    scoreboard.forEach((span, idx) => {
        if (settings.players[idx]) {
            span.textContent = settings.players[idx].name;
        }
    });
}

export let settings = loadSettings();
export let BOT_DELAY = settings.botDelay;
export let CHAMPION_MODE = !!settings.champion;

export function playBotLater() {
    setTimeout(botPlay, BOT_DELAY);
}

export function populateSettingsModal(settings) {
    document.getElementById('bg-color').value = settings.background;
    document.getElementById('table-color').value = settings.tableBackground;
    document.getElementById('bot-delay').value = settings.botDelay;
    document.getElementById('card-style').value = settings.cardStyle;
    document.getElementById('card-back').value = settings.cardBack;
    const championBox = document.getElementById('champion-mode');
    const musicBox = document.getElementById('background-music');
    const soundBox = document.getElementById('game-sound');
    if (championBox) championBox.checked = !!settings.champion;
    if (musicBox) musicBox.checked = !!settings.music;
    if (soundBox) soundBox.checked = !!settings.sound;

    const container = document.getElementById('players-settings');
    container.innerHTML = '';
    settings.players.forEach((p, i) => {
        const div = document.createElement('div');
        div.innerHTML = `<div class="setting-content">
            <label>${(i + 1) === 1 ? 'Người' : 'Máy ' + (i)}: </label>
            <input type="text" class="player-name" data-index="${i}" value="${p.name}">
            <label>Ảnh: </label>
            <input style="width:200px" type="text" class="player-image" data-index="${i}" value="${p.image}" size="30">
        </div>`;

        container.appendChild(div);
    });
}

export function collectSettingsFromModal() {
    return {
        background: document.getElementById('bg-color').value,
        tableBackground: document.getElementById('table-color').value,
        botDelay: +document.getElementById('bot-delay').value || 1500,
        cardStyle: document.getElementById('card-style').value,
        cardBack: document.getElementById('card-back').value,
        champion: document.getElementById('champion-mode').checked ? 1 : 0,
        music: document.getElementById('background-music').checked ? 1 : 0,
        sound: document.getElementById('game-sound').checked ? 1 : 0,
        players: Array.from(document.querySelectorAll('.player-name')).map((inp, i) => ({
            name: inp.value.trim() || `Người ${i + 1}`,
            image: document.querySelectorAll('.player-image')[i].value.trim(),
        })),
    };
}
