// ============================================================
//  DREDGE BRAWL — 16-Bit Arcade Beat-Em-Up
// ============================================================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 800, H = 500, PX = 3;

// ── STATE ──
let gameState = 'title'; // title|charSelect|playing|gameover|enterInitials|waveIntro
let score = 0, wave = 0, waveTimer = 0;
let turtlesRemaining = 0, turtlesToSpawn = 0, spawnTimer = 0, spawnInterval = 140;
let bloodPools = [], enemies = [], projectiles = [], powerups = [], particles = [];
let shakeTimer = 0, shakeIntensity = 0, flashTimer = 0, hitStopTimer = 0;
let groundY = H - 70;
let comboCount = 0, comboTimer = 0;
let selectedChar = 0; // 0=hopper 1=pipeline 2=clamshell
let charNames = ['HOPPER DREDGE', 'PIPELINE DREDGE', 'CLAMSHELL DREDGE'];
let charDescs = ['TRAILING SUCTION ARMS', 'ROTATING CUTTER HEAD', 'SWINGING BUCKET CRANE'];

// ── SCOREBOARD ──
let highScores = JSON.parse(localStorage.getItem('dredgeBrawlScores') || '[]');
let initialsInput = '', initialsCursor = 0;
const MAX_SCORES = 8;
function saveScores() { localStorage.setItem('dredgeBrawlScores', JSON.stringify(highScores)); }

// ── AUDIO ──
let audioCtx = null, muted = false, bgmGain = null, bgmPlaying = false, bgmOscillators = [], bgmTimeout = null;
function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    bgmGain = audioCtx.createGain(); bgmGain.gain.value = 0.15; bgmGain.connect(audioCtx.destination);
}
function playSFX(type) {
    if (!audioCtx || muted) return;
    const now = audioCtx.currentTime;
    const g = audioCtx.createGain(); g.connect(audioCtx.destination);
    if (type === 'punch') {
        const noise = audioCtx.createBufferSource();
        const nBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.15, audioCtx.sampleRate);
        const nData = nBuf.getChannelData(0);
        for (let i = 0; i < nData.length; i++) nData[i] = (Math.random() * 2 - 1) * 0.6;
        noise.buffer = nBuf;
        const nGain = audioCtx.createGain();
        nGain.gain.setValueAtTime(0.5, now); nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        noise.connect(nGain); nGain.connect(audioCtx.destination); noise.start(now); noise.stop(now + 0.15);
        const osc = audioCtx.createOscillator(); osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
        g.gain.setValueAtTime(0.3, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(g); osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'hit') {
        const osc = audioCtx.createOscillator(); osc.type = 'square';
        osc.frequency.setValueAtTime(200, now); osc.frequency.setValueAtTime(150, now + 0.05); osc.frequency.setValueAtTime(100, now + 0.1);
        g.gain.setValueAtTime(0.25, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(g); osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'wrench') {
        [0, 0.08, 0.16].forEach((t, i) => {
            const osc = audioCtx.createOscillator(); osc.type = 'square'; osc.frequency.value = [523, 659, 784][i];
            const og = audioCtx.createGain();
            og.gain.setValueAtTime(0, now + t); og.gain.linearRampToValueAtTime(0.2, now + t + 0.02); og.gain.exponentialRampToValueAtTime(0.01, now + t + 0.12);
            osc.connect(og); og.connect(audioCtx.destination); osc.start(now + t); osc.stop(now + t + 0.14);
        });
    } else if (type === 'waveComplete') {
        [0, 0.1, 0.2, 0.35].forEach((t, i) => {
            const osc = audioCtx.createOscillator(); osc.type = 'square'; osc.frequency.value = [392, 523, 659, 784][i];
            const og = audioCtx.createGain();
            og.gain.setValueAtTime(0.2, now + t); og.gain.exponentialRampToValueAtTime(0.01, now + t + (i === 3 ? 0.4 : 0.15));
            osc.connect(og); og.connect(audioCtx.destination); osc.start(now + t); osc.stop(now + t + (i === 3 ? 0.5 : 0.18));
        });
    } else if (type === 'select') {
        const osc = audioCtx.createOscillator(); osc.type = 'square'; osc.frequency.value = 440;
        g.gain.setValueAtTime(0.15, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.connect(g); osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'confirm') {
        [0, 0.06, 0.12].forEach((t, i) => {
            const osc = audioCtx.createOscillator(); osc.type = 'square'; osc.frequency.value = [523, 659, 784][i];
            const og = audioCtx.createGain();
            og.gain.setValueAtTime(0.2, now + t); og.gain.exponentialRampToValueAtTime(0.01, now + t + 0.1);
            osc.connect(og); og.connect(audioCtx.destination); osc.start(now + t); osc.stop(now + t + 0.12);
        });
    }
}
function startBGM() {
    if (!audioCtx || bgmPlaying) return; bgmPlaying = true;
    const melody = [262, 330, 392, 523, 392, 330, 262, 294, 330, 392, 440, 523, 440, 392, 330, 262, 294, 349, 440, 523, 587, 523, 440, 349, 262, 330, 392, 523, 440, 392, 330, 294];
    const bass = [131, 131, 165, 165, 196, 196, 131, 131, 165, 165, 196, 196, 220, 220, 165, 165, 147, 147, 175, 175, 220, 220, 175, 175, 131, 131, 165, 165, 196, 196, 147, 147];
    const noteLen = 0.18, loopLen = melody.length * noteLen;
    function scheduleLoop() {
        if (!bgmPlaying || muted) return;
        const now = audioCtx.currentTime;
        melody.forEach((freq, i) => {
            const osc = audioCtx.createOscillator(); osc.type = 'square'; osc.frequency.value = freq;
            const g = audioCtx.createGain(); g.gain.setValueAtTime(0.08, now + i * noteLen); g.gain.setValueAtTime(0.0001, now + i * noteLen + noteLen * 0.85);
            osc.connect(g); g.connect(bgmGain); osc.start(now + i * noteLen); osc.stop(now + i * noteLen + noteLen * 0.9); bgmOscillators.push(osc);
            const b = audioCtx.createOscillator(); b.type = 'triangle'; b.frequency.value = bass[i];
            const bg = audioCtx.createGain(); bg.gain.setValueAtTime(0.12, now + i * noteLen); bg.gain.setValueAtTime(0.0001, now + i * noteLen + noteLen * 0.85);
            b.connect(bg); bg.connect(bgmGain); b.start(now + i * noteLen); b.stop(now + i * noteLen + noteLen * 0.9); bgmOscillators.push(b);
        });
        bgmTimeout = setTimeout(scheduleLoop, loopLen * 1000 - 50);
    }
    scheduleLoop();
}
function stopBGM() { bgmPlaying = false; if (bgmTimeout) clearTimeout(bgmTimeout); bgmOscillators.forEach(o => { try { o.stop(); } catch (e) { } }); bgmOscillators = []; }
document.getElementById('mute-btn').addEventListener('click', () => {
    muted = !muted; document.getElementById('mute-btn').textContent = muted ? '🔇 MUTED' : '🔊 SOUND';
    if (muted) stopBGM(); else if (gameState === 'playing') startBGM();
});

// ── DRAWING HELPERS ──
function dpr(x, y, w, h, color) { ctx.fillStyle = color; for (let py = 0; py < h; py += PX) for (let px = 0; px < w; px += PX) ctx.fillRect(Math.round(x + px), Math.round(y + py), PX, PX); }

// ── PLAYER ──
const player = {
    x: 80, y: 0, w: 90, h: 48, speed: 3.8, lives: 3, invincible: 0,
    portPunch: 0, stbdPunch: 0, punchDuration: 16,
    portArm: { x: 0, y: 0, w: 0, h: 0 }, stbdArm: { x: 0, y: 0, w: 0, h: 0 }, walkFrame: 0
};
player.y = groundY - player.h;

// ── DRAW HOPPER DREDGE ──
function drawHopper(p) {
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.invincible > 0 && Math.floor(p.invincible / 3) % 2) return;
    const bob = Math.sin(p.walkFrame * 0.15) * 1.5;
    // Hull
    dpr(x + 6, y + 18 + bob, 78, 21, '#7a8899'); dpr(x + 84, y + 21 + bob, 6, 15, '#6a7a8a'); dpr(x + 87, y + 24 + bob, 3, 9, '#5a6a7a');
    dpr(x + 3, y + 21 + bob, 6, 15, '#6a7a8a'); dpr(x + 6, y + 33 + bob, 78, 6, '#993333'); dpr(x + 6, y + 18 + bob, 78, 3, '#8a9aaa');
    dpr(x + 18, y + 27 + bob, 3, 3, '#5a6a7a'); dpr(x + 36, y + 27 + bob, 3, 3, '#5a6a7a'); dpr(x + 54, y + 27 + bob, 3, 3, '#5a6a7a'); dpr(x + 72, y + 27 + bob, 3, 3, '#5a6a7a');
    // Hopper
    dpr(x + 24, y + 12 + bob, 36, 9, '#5a4a3a'); dpr(x + 27, y + 12 + bob, 30, 6, '#8B6914'); dpr(x + 30, y + 12 + bob, 12, 3, '#a07a1a');
    // Pilothouse
    dpr(x + 12, y + 3 + bob, 18, 15, '#6a7a8a'); dpr(x + 9, y + 3 + bob, 24, 3, '#5a6a7a'); dpr(x + 15, y + 6 + bob, 12, 6, '#aaddff'); dpr(x + 20, y + 6 + bob, 3, 6, '#6a7a8a');
    dpr(x + 16, y + 8 + bob, 3, 3, '#111'); dpr(x + 17, y + 9 + bob, 1, 1, '#fff');
    // Stack
    dpr(x + 18, y - 6 + bob, 6, 9, '#4a4a5a'); dpr(x + 16, y - 8 + bob, 10, 3, '#3a3a4a'); dpr(x + 18, y - 5 + bob, 6, 2, '#cc4444');
    if (Math.random() > 0.7) particles.push({ x: x + 21, y: y - 10 + bob, vx: (Math.random() - 0.5) * 0.5, vy: -0.8 - Math.random() * 0.5, life: 25 + Math.random() * 15, color: '#888', size: 4 + Math.random() * 4, type: 'smoke' });
    // Gantries
    dpr(x + 15, y + 9 + bob, 3, 9, '#555'); dpr(x + 66, y + 9 + bob, 3, 9, '#555');
    // Arms
    const eP = p.portPunch > 0 ? (1 - Math.abs(p.portPunch - p.punchDuration / 2) / (p.punchDuration / 2)) * 32 : 0;
    const eS = p.stbdPunch > 0 ? (1 - Math.abs(p.stbdPunch - p.punchDuration / 2) / (p.punchDuration / 2)) * 32 : 0;
    // Port
    const pL = 18 + eP, pX = x - 3 - eP, pY = y + 24 + bob;
    dpr(pX + 6, pY + 3, pL, 6, '#6a6a5a'); dpr(pX + 6, pY + 2, pL, 2, '#7a7a6a');
    dpr(pX, pY, 9, 12, '#8a6a5a'); dpr(pX, pY + 9, 9, 3, '#aa5533'); dpr(pX + 2, pY + 9, 2, 3, '#cc7744'); dpr(pX + 5, pY + 9, 2, 3, '#cc7744');
    p.portArm = { x: pX - 2, y: pY - 2, w: 14, h: 18 };
    // Stbd
    const sL = 18 + eS, sX = x + 72, sY = y + 24 + bob;
    dpr(sX, sY + 3, sL, 6, '#6a6a5a'); dpr(sX, sY + 2, sL, 2, '#7a7a6a');
    const dX = sX + sL; dpr(dX, sY, 9, 12, '#8a6a5a'); dpr(dX, sY + 9, 9, 3, '#aa5533'); dpr(dX + 2, sY + 9, 2, 3, '#cc7744'); dpr(dX + 5, sY + 9, 2, 3, '#cc7744');
    p.stbdArm = { x: dX - 2, y: sY - 2, w: 14, h: 18 };
    // Wash
    if (Math.abs(p.walkFrame) > 0.5) { const wf = Date.now() * 0.01; ctx.fillStyle = 'rgba(150,200,255,0.3)'; ctx.fillRect(x - 2 + Math.sin(wf) * 2, y + 36 + bob, 6, 3); }
}

// ── DRAW PIPELINE DREDGE ──
function drawPipeline(p) {
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.invincible > 0 && Math.floor(p.invincible / 3) % 2) return;
    const bob = Math.sin(p.walkFrame * 0.15) * 1.5;
    // Hull (barge-style, wider)
    dpr(x + 6, y + 20 + bob, 78, 18, '#6a7a6a'); dpr(x + 84, y + 23 + bob, 6, 12, '#5a6a5a'); dpr(x + 3, y + 23 + bob, 6, 12, '#5a6a5a');
    dpr(x + 6, y + 32 + bob, 78, 6, '#884422'); dpr(x + 6, y + 20 + bob, 78, 3, '#7a8a7a');
    // Portholes
    dpr(x + 20, y + 26 + bob, 3, 3, '#4a5a4a'); dpr(x + 40, y + 26 + bob, 3, 3, '#4a5a4a'); dpr(x + 60, y + 26 + bob, 3, 3, '#4a5a4a');
    // Pilothouse (stern)
    dpr(x + 6, y + 5 + bob, 15, 15, '#5a6a5a'); dpr(x + 3, y + 5 + bob, 21, 3, '#4a5a4a'); dpr(x + 9, y + 8 + bob, 9, 6, '#aaddff');
    dpr(x + 10, y + 10 + bob, 3, 3, '#111'); dpr(x + 11, y + 11 + bob, 1, 1, '#fff');
    // Stack
    dpr(x + 12, y - 4 + bob, 6, 9, '#4a4a5a'); dpr(x + 10, y - 6 + bob, 10, 3, '#3a3a4a');
    if (Math.random() > 0.7) particles.push({ x: x + 15, y: y - 8 + bob, vx: (Math.random() - 0.5) * 0.5, vy: -0.8 - Math.random() * 0.5, life: 20 + Math.random() * 10, color: '#888', size: 3 + Math.random() * 3, type: 'smoke' });
    // Ladder boom (diagonal toward bow/right)
    dpr(x + 30, y + 10 + bob, 45, 3, '#777'); dpr(x + 28, y + 8 + bob, 6, 6, '#666'); // boom base
    dpr(x + 48, y + 6 + bob, 3, 9, '#666'); // A-frame
    // Pipeline on deck
    dpr(x + 18, y + 17 + bob, 50, 3, '#998877');
    // Cutter head - extends on BOTH Q and W
    const ext = Math.max(
        p.portPunch > 0 ? (1 - Math.abs(p.portPunch - p.punchDuration / 2) / (p.punchDuration / 2)) * 36 : 0,
        p.stbdPunch > 0 ? (1 - Math.abs(p.stbdPunch - p.punchDuration / 2) / (p.punchDuration / 2)) * 36 : 0
    );
    const cX = x + 75 + ext, cY = y + 12 + bob;
    // Cutter arm
    dpr(x + 72, cY + 3, ext + 6, 6, '#887766');
    // Cutter head (spinning disc)
    const spin = Date.now() * 0.015;
    ctx.save(); ctx.translate(cX + 6, cY + 6); ctx.rotate(spin);
    ctx.fillStyle = '#cc6633'; ctx.fillRect(-9, -9, 18, 18);
    ctx.fillStyle = '#dd8844'; ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = '#aa4422'; ctx.fillRect(-3, -12, 6, 3); ctx.fillRect(-3, 9, 6, 3); ctx.fillRect(-12, -3, 3, 6); ctx.fillRect(9, -3, 3, 6);
    ctx.restore();
    // Hitbox: both arms point to cutter
    p.portArm = { x: cX - 4, y: cY - 6, w: 22, h: 24 };
    p.stbdArm = { x: cX - 4, y: cY - 6, w: 22, h: 24 };
}

// ── DRAW CLAMSHELL DREDGE ──
function drawClamshell(p) {
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.invincible > 0 && Math.floor(p.invincible / 3) % 2) return;
    const bob = Math.sin(p.walkFrame * 0.15) * 1.5;
    // Hull (barge)
    dpr(x + 12, y + 22 + bob, 66, 16, '#7a7a6a'); dpr(x + 78, y + 25 + bob, 6, 10, '#6a6a5a'); dpr(x + 9, y + 25 + bob, 6, 10, '#6a6a5a');
    dpr(x + 12, y + 33 + bob, 66, 5, '#884433'); dpr(x + 12, y + 22 + bob, 66, 3, '#8a8a7a');
    // Portholes
    dpr(x + 24, y + 28 + bob, 3, 3, '#5a5a4a'); dpr(x + 45, y + 28 + bob, 3, 3, '#5a5a4a'); dpr(x + 66, y + 28 + bob, 3, 3, '#5a5a4a');
    // Crane house (center)
    dpr(x + 33, y + 10 + bob, 24, 12, '#6a6a5a'); dpr(x + 30, y + 10 + bob, 30, 3, '#5a5a4a');
    dpr(x + 36, y + 13 + bob, 9, 6, '#aaddff'); dpr(x + 40, y + 13 + bob, 3, 6, '#6a6a5a');
    dpr(x + 37, y + 15 + bob, 3, 3, '#111'); dpr(x + 38, y + 16 + bob, 1, 1, '#fff');
    // Crane boom (vertical mast + horizontal jib)
    dpr(x + 43, y - 10 + bob, 4, 22, '#666'); dpr(x + 35, y - 10 + bob, 20, 3, '#777');
    // Stack
    dpr(x + 48, y + 2 + bob, 6, 8, '#4a4a5a'); dpr(x + 46, y + 0 + bob, 10, 3, '#3a3a4a');
    if (Math.random() > 0.7) particles.push({ x: x + 51, y: y - 2 + bob, vx: (Math.random() - 0.5) * 0.5, vy: -0.8 - Math.random() * 0.5, life: 20 + Math.random() * 10, color: '#888', size: 3 + Math.random() * 3, type: 'smoke' });
    // Cable from jib
    const swingQ = p.portPunch > 0 ? (1 - Math.abs(p.portPunch - p.punchDuration / 2) / (p.punchDuration / 2)) : 0;
    const swingW = p.stbdPunch > 0 ? (1 - Math.abs(p.stbdPunch - p.punchDuration / 2) / (p.punchDuration / 2)) : 0;
    let bucketAngle = 0;
    if (swingQ > 0) bucketAngle = -swingQ * 1.2; // swing left
    else if (swingW > 0) bucketAngle = swingW * 1.2; // swing right
    // Draw cable + bucket
    const cableOriginX = x + 45, cableOriginY = y - 8 + bob;
    const cableLen = 38;
    const bucketX = cableOriginX + Math.sin(bucketAngle) * cableLen;
    const bucketY = cableOriginY + Math.cos(bucketAngle) * cableLen;
    ctx.strokeStyle = '#999'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cableOriginX, cableOriginY); ctx.lineTo(bucketX, bucketY); ctx.stroke();
    // Clamshell bucket
    ctx.save(); ctx.translate(bucketX, bucketY); ctx.rotate(bucketAngle * 0.5);
    const openAmt = (swingQ > 0 || swingW > 0) ? 4 : 0;
    ctx.fillStyle = '#887766'; ctx.fillRect(-6, -3 - openAmt, 12, 3); ctx.fillRect(-6, openAmt, 12, 3); // jaws
    ctx.fillStyle = '#aa8866'; ctx.fillRect(-8, -6 - openAmt, 4, 6 + openAmt); ctx.fillRect(4, -6 - openAmt, 4, 6 + openAmt); // sides
    ctx.fillStyle = '#776655'; ctx.fillRect(-8, openAmt, 4, 6); ctx.fillRect(4, openAmt, 4, 6);
    ctx.restore();
    // Hitboxes
    if (swingQ > 0) p.portArm = { x: bucketX - 14, y: bucketY - 10, w: 20, h: 22 };
    else p.portArm = { x: -100, y: -100, w: 0, h: 0 };
    if (swingW > 0) p.stbdArm = { x: bucketX - 6, y: bucketY - 10, w: 20, h: 22 };
    else p.stbdArm = { x: -100, y: -100, w: 0, h: 0 };
}

// Character draw dispatch
function drawDredge(p) { [drawHopper, drawPipeline, drawClamshell][selectedChar](p); }

// ── TURTLE ──
function spawnTurtle() {
    enemies.push({
        x: W + 20 + Math.random() * 100, y: groundY - 36 + Math.random() * 10, w: 40, h: 36,
        speed: 0.25 + wave * 0.04 + Math.random() * 0.2, hp: 1,
        attackType: Math.random() > 0.85 ? 'shell' : 'bite', attackCooldown: 180 + Math.random() * 100,
        attackTimer: 0, biting: 0, walkFrame: 0, dead: false
    });
}
function drawTurtle(t) {
    const x = Math.round(t.x), y = Math.round(t.y), b = Math.sin(t.walkFrame * 0.15) * 2;
    dpr(x + 6, y + 6 + b, 27, 21, '#2a7a2a'); dpr(x + 9, y + 3 + b, 21, 6, '#3a9a3a');
    dpr(x + 12, y + 9 + b, 6, 12, '#1a5a1a'); dpr(x + 21, y + 9 + b, 6, 12, '#1a5a1a'); dpr(x + 12, y + 15 + b, 15, 3, '#1a5a1a');
    dpr(x - 3, y + 9 + b, 12, 12, '#5a9a3a'); dpr(x, y + 12 + b, 4, 4, '#111'); dpr(x + 1, y + 13 + b, 2, 2, '#fff');
    if (t.biting > 0) { dpr(x - 3, y + 18 + b, 9, 6, '#aa3333'); dpr(x - 1, y + 18 + b, 3, 3, '#fff'); } else { dpr(x - 1, y + 19 + b, 6, 2, '#3a6a2a'); }
    dpr(x + 9, y + 27 + b, 6, 9, '#5a9a3a'); dpr(x + 6, y + 33 + b, 9, 3, '#3a7a2a');
    dpr(x + 24, y + 27 + b, 6, 9, '#5a9a3a'); dpr(x + 21, y + 33 + b, 9, 3, '#3a7a2a');
    dpr(x + 33, y + 18 + b, 9, 5, '#5a9a3a'); dpr(x + 39, y + 16 + b, 4, 4, '#4a8a2a');
}
function drawSkeletonTurtle(x, y, s) {
    s = s || 1; ctx.fillStyle = '#ddd'; ctx.fillRect(x, y + 2 * s, 8 * s, 8 * s);
    ctx.fillStyle = '#111'; ctx.fillRect(x + 1 * s, y + 4 * s, 2 * s, 2 * s); ctx.fillRect(x + 5 * s, y + 4 * s, 2 * s, 2 * s); ctx.fillRect(x + 2 * s, y + 7 * s, 4 * s, 1 * s);
    ctx.fillStyle = '#bbb'; ctx.fillRect(x + 8 * s, y, 16 * s, 2 * s); ctx.fillRect(x + 6 * s, y + 2 * s, 2 * s, 10 * s); ctx.fillRect(x + 22 * s, y + 2 * s, 2 * s, 10 * s); ctx.fillRect(x + 8 * s, y + 12 * s, 16 * s, 2 * s);
    ctx.fillRect(x + 10 * s, y + 4 * s, 10 * s, 1 * s); ctx.fillRect(x + 10 * s, y + 7 * s, 10 * s, 1 * s); ctx.fillRect(x + 10 * s, y + 10 * s, 10 * s, 1 * s);
    ctx.fillRect(x + 9 * s, y + 14 * s, 2 * s, 5 * s); ctx.fillRect(x + 19 * s, y + 14 * s, 2 * s, 5 * s);
}
function drawShellProjectile(p) {
    const x = Math.round(p.x), y = Math.round(p.y), spin = Math.floor(p.spin / 4) % 4;
    ctx.save(); ctx.translate(x + 8, y + 8); ctx.rotate(spin * Math.PI / 2);
    ctx.fillStyle = '#2a7a2a'; ctx.fillRect(-8, -6, 16, 12); ctx.fillStyle = '#1a5a1a'; ctx.fillRect(-5, -3, 4, 6); ctx.fillRect(2, -3, 4, 6);
    ctx.restore();
}
function drawWrench(p) {
    const x = Math.round(p.x), y = Math.round(p.y), b = Math.sin(Date.now() * 0.005) * 4;
    ctx.fillStyle = '#888'; ctx.fillRect(x + 6, y + 6 + b, 6, 24);
    ctx.fillStyle = '#aaa'; ctx.fillRect(x, y + b, 18, 9);
    ctx.fillStyle = '#666'; ctx.fillRect(x + 3, y + 2 + b, 4, 5); ctx.fillRect(x + 11, y + 2 + b, 4, 5);
    if (Math.random() > 0.85) particles.push({ x: x + 9 + (Math.random() - 0.5) * 12, y: y + b + Math.random() * 10, vx: (Math.random() - 0.5), vy: -1 - Math.random(), life: 15, color: '#ff0', size: 3, type: 'sparkle' });
}
function drawHardhat(x, y, filled) {
    ctx.fillStyle = filled ? '#ddaa22' : '#444'; ctx.fillRect(x + 2, y + 4, 20, 10); ctx.fillRect(x + 4, y, 16, 6);
    ctx.fillStyle = filled ? '#bb8811' : '#333'; ctx.fillRect(x, y + 14, 24, 4);
    if (filled) { ctx.fillStyle = '#e33'; ctx.fillRect(x + 6, y + 2, 4, 4); ctx.fillRect(x + 13, y + 2, 4, 4); ctx.fillRect(x + 5, y + 4, 14, 4); ctx.fillRect(x + 7, y + 8, 10, 2); ctx.fillRect(x + 9, y + 10, 6, 2); }
}
function drawBloodPool(bp) {
    ctx.globalAlpha = Math.min(1, bp.life / 30); ctx.fillStyle = '#8b0000';
    ctx.beginPath(); ctx.ellipse(bp.x, bp.y, bp.size * 1.5, bp.size * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#aa1111'; ctx.beginPath(); ctx.ellipse(bp.x + 3, bp.y - 1, bp.size * 0.8, bp.size * 0.3, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
}

// ── INPUT ──
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (gameState === 'enterInitials') {
        e.preventDefault();
        if (e.key === 'Backspace') initialsInput = initialsInput.slice(0, -1);
        else if (e.key === 'Enter' && initialsInput.length > 0) {
            highScores.push({ name: initialsInput.toUpperCase(), score, wave }); highScores.sort((a, b) => b.score - a.score);
            if (highScores.length > MAX_SCORES) highScores = highScores.slice(0, MAX_SCORES); saveScores(); gameState = 'gameover';
        } else if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key) && initialsInput.length < 3) initialsInput += e.key.toUpperCase();
        return;
    }
    if (gameState === 'charSelect') {
        e.preventDefault();
        if (e.key === 'ArrowLeft') { selectedChar = (selectedChar + 2) % 3; playSFX('select'); }
        else if (e.key === 'ArrowRight') { selectedChar = (selectedChar + 1) % 3; playSFX('select'); }
        else if (e.key === 'Enter') { playSFX('confirm'); startGame(); }
        return;
    }
    if (e.key === 'Enter') {
        if (gameState === 'title') { initAudio(); gameState = 'charSelect'; }
        else if (gameState === 'gameover') startGame();
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'q', 'w', 'Q', 'W'].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

// ── GAME INIT ──
function startGame() {
    gameState = 'playing'; score = 0; wave = 0; comboCount = 0; comboTimer = 0;
    player.x = 80; player.y = groundY - player.h; player.lives = 3; player.invincible = 0;
    player.portPunch = 0; player.stbdPunch = 0;
    enemies = []; projectiles = []; powerups = []; bloodPools = []; particles = [];
    nextWave(); if (!muted) startBGM();
}
function nextWave() {
    wave++; turtlesToSpawn = 1 + wave * 2; turtlesRemaining = turtlesToSpawn;
    spawnInterval = Math.max(50, 140 - wave * 6); spawnTimer = 60; gameState = 'waveIntro'; waveTimer = 90;
    playSFX('waveComplete');
    if (wave > 1 && Math.random() > 0.35) setTimeout(() => { powerups.push({ x: W + 20, y: groundY - 50 - Math.random() * 80, w: 18, h: 30, speed: 1.2 + Math.random() }); }, 2000 + Math.random() * 3000);
}
function rectsOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function playerDamage() {
    if (player.invincible > 0) return;
    player.lives--; player.invincible = 90; shakeTimer = 15; shakeIntensity = 8; playSFX('hit');
    for (let i = 0; i < 12; i++) particles.push({ x: player.x + player.w / 2, y: player.y + player.h / 2, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 15, color: '#ff4', size: 5, type: 'hit' });
    if (player.lives <= 0) { gameState = 'enterInitials'; initialsInput = ''; stopBGM(); }
}
function killTurtle(e) {
    if (e.dead) return; e.dead = true; turtlesRemaining--; score++; playSFX('punch');
    shakeTimer = 8; shakeIntensity = 5; flashTimer = 4; hitStopTimer = 4;
    comboCount++; comboTimer = 120;
    bloodPools.push({ x: e.x + e.w / 2, y: groundY, size: 12 + Math.random() * 8, life: 400 + Math.random() * 200 });
    const colors = ['#c00', '#e22', '#2a7a2a', '#ff4', '#f80'];
    for (let i = 0; i < 14; i++) particles.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: (Math.random() - 0.5) * 8, vy: -2 - Math.random() * 5, life: 20 + Math.random() * 15, color: colors[Math.floor(Math.random() * colors.length)], size: 3 + Math.random() * 5, type: 'gore' });
}

// ── UPDATE ──
function update() {
    if (gameState === 'waveIntro') { waveTimer--; if (waveTimer <= 0) gameState = 'playing'; return; }
    if (gameState !== 'playing') return;
    if (hitStopTimer > 0) { hitStopTimer--; return; } // hit-stop freeze
    // Movement
    let mx = 0, my = 0;
    if (keys['ArrowLeft']) mx -= 1; if (keys['ArrowRight']) mx += 1;
    if (keys['ArrowUp']) my -= 1; if (keys['ArrowDown']) my += 1;
    if (mx !== 0 && my !== 0) { mx *= 0.707; my *= 0.707; }
    player.x += mx * player.speed; player.y += my * player.speed;
    player.x = Math.max(10, Math.min(W - player.w - 10, player.x));
    player.y = Math.max(10, Math.min(groundY - player.h, player.y));
    if (mx !== 0 || my !== 0) player.walkFrame += 0.4; else player.walkFrame *= 0.9;
    // Punch
    if ((keys['q'] || keys['Q']) && player.portPunch === 0) player.portPunch = player.punchDuration;
    if ((keys['w'] || keys['W']) && player.stbdPunch === 0) player.stbdPunch = player.punchDuration;
    if (player.portPunch > 0) player.portPunch--; if (player.stbdPunch > 0) player.stbdPunch--;
    if (player.invincible > 0) player.invincible--;
    // Combo timer
    if (comboTimer > 0) comboTimer--; else comboCount = 0;
    // Spawn
    if (turtlesToSpawn > 0) { spawnTimer--; if (spawnTimer <= 0) { spawnTurtle(); turtlesToSpawn--; spawnTimer = spawnInterval + Math.random() * 40; } }
    // Enemies
    enemies.forEach(e => {
        if (e.dead) return; e.walkFrame++;
        const dx = player.x - e.x, dy = player.y + player.h - e.y - e.h;
        if (e.attackType === 'shell' && Math.abs(dx) < 250 && Math.abs(dx) > 180) {
            e.attackTimer++; if (e.attackTimer >= e.attackCooldown) {
                projectiles.push({ x: e.x - 5, y: e.y + 10, vx: -1.2, vy: 0, w: 16, h: 16, spin: 0 });
                e.attackTimer = 0; e.attackCooldown = 180 + Math.random() * 80;
            }
        } else if (e.attackType === 'bite' && Math.abs(dx) < 55 && Math.abs(dy) < 20) {
            e.biting++; if (e.biting === 15) playerDamage(); if (e.biting > 25) e.biting = 0;
        } else { e.biting = 0; e.x -= e.speed; if (dy > 5) e.y += e.speed * 0.3; else if (dy < -5) e.y -= e.speed * 0.3; }
        const pP = player.portPunch > player.punchDuration * 0.3 && player.portPunch < player.punchDuration * 0.8;
        const pS = player.stbdPunch > player.punchDuration * 0.3 && player.stbdPunch < player.punchDuration * 0.8;
        const eR = { x: e.x, y: e.y, w: e.w, h: e.h };
        if (pP && rectsOverlap(player.portArm, eR)) killTurtle(e);
        if (pS && rectsOverlap(player.stbdArm, eR)) killTurtle(e);
        if (e.x < -60) { e.dead = true; turtlesRemaining--; }
    });
    // Projectiles
    projectiles.forEach(p => {
        p.x += p.vx; p.spin++;
        if (player.invincible <= 0 && rectsOverlap({ x: player.x + 8, y: player.y + 8, w: player.w - 16, h: player.h - 8 }, { x: p.x, y: p.y, w: p.w, h: p.h })) { playerDamage(); p.x = -100; }
    });
    projectiles = projectiles.filter(p => p.x > -50 && p.x < W + 50);
    // Powerups
    powerups.forEach(pw => {
        pw.x -= pw.speed;
        if (rectsOverlap({ x: player.x, y: player.y, w: player.w, h: player.h }, { x: pw.x, y: pw.y, w: pw.w, h: pw.h })) {
            if (player.lives < 3) player.lives++; else score += 50; playSFX('wrench'); pw.x = -200;
            for (let i = 0; i < 12; i++) particles.push({ x: pw.x + 9, y: pw.y + 15, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 20 + Math.random() * 10, color: '#ff0', size: 4, type: 'sparkle' });
        }
    });
    powerups = powerups.filter(pw => pw.x > -100);
    enemies = enemies.filter(e => !e.dead);
    if (turtlesRemaining <= 0 && enemies.length === 0 && turtlesToSpawn <= 0) nextWave();
    bloodPools.forEach(b => { b.life--; }); bloodPools = bloodPools.filter(b => b.life > 0);
    particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; if (p.type === 'smoke') { p.size *= 1.02; p.vy -= 0.01; } if (p.type === 'gore') p.vy += 0.2; });
    particles = particles.filter(p => p.life > 0);
    if (shakeTimer > 0) shakeTimer--; if (flashTimer > 0) flashTimer--;
}

// ── DRAW GAMEPLAY ──
function draw() {
    ctx.save();
    if (shakeTimer > 0) { ctx.translate((Math.random() - 0.5) * shakeIntensity, (Math.random() - 0.5) * shakeIntensity); }
    // Background
    const sg = ctx.createLinearGradient(0, 0, 0, groundY); sg.addColorStop(0, '#1a1a3f'); sg.addColorStop(0.5, '#2a2a5f'); sg.addColorStop(1, '#3a4a7f');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, groundY);
    ctx.fillStyle = '#2a4a8f'; ctx.fillRect(0, groundY - 30, W, 30);
    for (let wx = 0; wx < W; wx += 20) { const wy = Math.sin((wx + Date.now() * 0.002) * 0.1) * 3; ctx.fillStyle = '#3a5a9f'; ctx.fillRect(wx, groundY - 25 + wy, 14, 3); }
    ctx.fillStyle = '#5a4a3a'; ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = '#6a5a4a'; for (let gx = 0; gx < W; gx += 40) { ctx.fillRect(gx, groundY, 38, 3); ctx.fillRect(gx + 5, groundY + 15, 30, 2); }
    ctx.fillStyle = '#4a3a2a'; for (let gx = 0; gx < W; gx += 40) ctx.fillRect(gx + 39, groundY, 2, H - groundY);
    ctx.fillStyle = '#1a1a3a'; ctx.fillRect(650, groundY - 120, 8, 120); ctx.fillRect(630, groundY - 120, 48, 6); ctx.fillRect(710, groundY - 90, 6, 90); ctx.fillRect(690, groundY - 90, 36, 5);
    bloodPools.forEach(bp => drawBloodPool(bp));
    particles.forEach(p => { if (p.type === 'smoke') { ctx.globalAlpha = p.life / 40; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); ctx.globalAlpha = 1; } });
    powerups.forEach(pw => drawWrench(pw));
    enemies.forEach(e => { if (!e.dead) drawTurtle(e); });
    projectiles.forEach(p => drawShellProjectile(p));
    drawDredge(player);
    particles.forEach(p => { if (p.type !== 'smoke') { ctx.globalAlpha = p.life / 30; ctx.fillStyle = p.color; if (p.type === 'sparkle') { ctx.fillRect(p.x - 1, p.y, 3, 1); ctx.fillRect(p.x, p.y - 1, 1, 3); } else { ctx.fillRect(p.x, p.y, p.size, p.size); } ctx.globalAlpha = 1; } });
    // Flash
    if (flashTimer > 0) { ctx.globalAlpha = flashTimer * 0.15; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    // HUD
    for (let i = 0; i < 3; i++) drawHardhat(12 + i * 32, 12, i < player.lives);
    drawSkeletonTurtle(W - 110, 10, 1.3); ctx.fillStyle = '#fff'; ctx.font = '16px "Press Start 2P",monospace'; ctx.textAlign = 'left'; ctx.fillText('× ' + score, W - 68, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '10px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.fillText('WAVE ' + wave, W / 2, 22);
    // Combo
    if (comboCount > 1) { ctx.fillStyle = '#ff0'; ctx.font = (12 + comboCount) + 'px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.globalAlpha = Math.min(1, comboTimer / 30); ctx.fillText('×' + comboCount + ' COMBO!', W / 2, 70); ctx.globalAlpha = 1; }
    // GO arrow
    if (enemies.length === 0 && turtlesToSpawn > 0) { const ga = Math.sin(Date.now() * 0.005) * 0.3 + 0.7; ctx.globalAlpha = ga; ctx.fillStyle = '#ff0'; ctx.font = '14px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.fillText('GO →', W - 60, H / 2); ctx.globalAlpha = 1; }
    // Wave intro
    if (gameState === 'waveIntro') { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#ff0'; ctx.font = '28px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.fillText('WAVE ' + wave, W / 2, H / 2 - 10); ctx.fillStyle = '#fff'; ctx.font = '12px "Press Start 2P",monospace'; ctx.fillText((1 + wave * 2) + ' turtles incoming!', W / 2, H / 2 + 25); }
    // Controls hint
    if (wave === 1 && gameState === 'playing') { ctx.globalAlpha = Math.max(0, 1 - score * 0.15); ctx.fillStyle = '#aaa'; ctx.font = '8px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.fillText('← → ↑ ↓ MOVE    Q/W = ATTACK', W / 2, H - 15); ctx.globalAlpha = 1; }
    ctx.restore();
}

// ── CHARACTER SELECT SCREEN ──
function drawCharSelect() {
    const sg = ctx.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, '#0a0a2f'); sg.addColorStop(1, '#1a2a5f');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff6600'; ctx.font = '24px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.fillText('SELECT YOUR DREDGE', W / 2, 60);
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
        const cx = 130 + i * 220, cy = 180;
        const isSel = i === selectedChar;
        // Selection box
        if (isSel) {
            ctx.strokeStyle = '#ff0'; ctx.lineWidth = 3; ctx.strokeRect(cx - 55, cy - 40, 140, 190);
            ctx.fillStyle = 'rgba(255,255,0,0.06)'; ctx.fillRect(cx - 55, cy - 40, 140, 190);
        }
        // Draw character preview
        const tempP = { x: cx - 45, y: cy + 20, w: 90, h: 48, invincible: 0, walkFrame: now * 0.002, portPunch: 0, stbdPunch: 0, punchDuration: 16, portArm: { x: 0, y: 0, w: 0, h: 0 }, stbdArm: { x: 0, y: 0, w: 0, h: 0 } };
        if (isSel && Math.floor(now / 800) % 3 === 0) tempP.stbdPunch = 8; // attack demo
        const prevSel = selectedChar; selectedChar = i; drawDredge(tempP); selectedChar = prevSel;
        // Name
        ctx.fillStyle = isSel ? '#ff0' : '#aaa'; ctx.font = '8px "Press Start 2P",monospace'; ctx.textAlign = 'center';
        ctx.fillText(charNames[i], cx + 15, cy + 100);
        ctx.fillStyle = isSel ? '#6af' : '#667'; ctx.font = '7px "Press Start 2P",monospace';
        ctx.fillText(charDescs[i], cx + 15, cy + 118);
    }
    // Instructions
    if (Math.floor(now / 500) % 2) { ctx.fillStyle = '#fff'; ctx.font = '11px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.fillText('← → SELECT    ENTER TO START', W / 2, H - 40); }
    // Selector arrows
    const ax = 130 + selectedChar * 220 + 15;
    ctx.fillStyle = '#ff0'; ctx.font = '16px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.fillText('▼', ax, 130);
}

// ── TITLE SCREEN ──
function drawTitle() {
    const sg = ctx.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, '#0a0a2f'); sg.addColorStop(1, '#1a2a5f');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    const now = Date.now();
    for (let i = 0; i < 40; i++) { const sx = (i * 97 + Math.sin(now * 0.001 + i) * 3) % W, sy = (i * 53) % (H - 100); ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(now * 0.003 + i * 47) * 0.3})`; ctx.fillRect(sx, sy, 2, 2); }
    ctx.fillStyle = '#1a3a7a'; ctx.fillRect(0, H - 130, W, 130);
    for (let wx = 0; wx < W; wx += 25) { const wy = Math.sin((wx + now * 0.002) * 0.08) * 4; ctx.fillStyle = '#2a4a9a'; ctx.fillRect(wx, H - 130 + wy, 18, 3); }
    ctx.fillStyle = '#ff6600'; ctx.font = '36px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.fillText('DREDGE', W / 2, 120);
    ctx.fillStyle = '#ffaa00'; ctx.font = '20px "Press Start 2P",monospace'; ctx.fillText('BRAWL', W / 2, 155);
    ctx.fillStyle = '#88aacc'; ctx.font = '9px "Press Start 2P",monospace'; ctx.fillText('DREDGES vs TURTLES', W / 2, 185);
    // Three mini dredge previews
    for (let i = 0; i < 3; i++) {
        const dx = W / 2 - 180 + i * 160, dy = 230;
        const tp = { x: dx, y: dy, w: 90, h: 48, invincible: 0, walkFrame: now * 0.002, portPunch: 0, stbdPunch: 0, punchDuration: 16, portArm: { x: 0, y: 0, w: 0, h: 0 }, stbdArm: { x: 0, y: 0, w: 0, h: 0 } };
        const ps = selectedChar; selectedChar = i; drawDredge(tp); selectedChar = ps;
    }
    ctx.fillStyle = '#ff4444'; ctx.font = '14px "Press Start 2P",monospace'; ctx.fillText('VS', W / 2, 330);
    const tx = W / 2 - 20, ty = 340; dpr(tx + 6, ty + 6, 27, 21, '#2a7a2a'); dpr(tx + 9, ty + 3, 21, 6, '#3a9a3a'); dpr(tx - 3, ty + 9, 12, 12, '#5a9a3a'); dpr(tx, ty + 12, 4, 4, '#111'); dpr(tx + 9, ty + 27, 6, 6, '#5a9a3a'); dpr(tx + 24, ty + 27, 6, 6, '#5a9a3a');
    if (Math.floor(now / 500) % 2) { ctx.fillStyle = '#fff'; ctx.font = '12px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.fillText('PRESS ENTER', W / 2, 430); }
    ctx.fillStyle = '#667'; ctx.font = '8px "Press Start 2P",monospace'; ctx.fillText('ARROWS: MOVE   Q/W: ATTACK', W / 2, 470);
}

// ── GAME OVER ──
function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
    if (gameState === 'enterInitials') {
        ctx.fillStyle = '#ff2222'; ctx.font = '28px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.fillText('GAME OVER', W / 2, 80);
        ctx.fillStyle = '#fff'; ctx.font = '12px "Press Start 2P",monospace'; ctx.fillText('SCORE: ' + score + '   WAVE: ' + wave, W / 2, 120);
        ctx.fillStyle = '#ff0'; ctx.font = '14px "Press Start 2P",monospace'; ctx.fillText('ENTER YOUR INITIALS', W / 2, 180);
        for (let i = 0; i < 3; i++) {
            const bx = W / 2 - 60 + i * 44; ctx.fillStyle = '#1a1a3a'; ctx.fillRect(bx, 200, 36, 44); ctx.strokeStyle = i < initialsInput.length ? '#6af' : (i === initialsInput.length ? '#ff0' : '#444'); ctx.lineWidth = 2; ctx.strokeRect(bx, 200, 36, 44);
            if (i < initialsInput.length) { ctx.fillStyle = '#fff'; ctx.font = '22px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.fillText(initialsInput[i], bx + 18, 232); }
            else if (i === initialsInput.length && Math.floor(Date.now() / 400) % 2) { ctx.fillStyle = '#ff0'; ctx.fillRect(bx + 10, 235, 16, 3); }
        }
        ctx.fillStyle = '#888'; ctx.font = '9px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.fillText('PRESS ENTER TO SUBMIT', W / 2, 270);
        if (highScores.length > 0) {
            ctx.fillStyle = '#6af'; ctx.font = '10px "Press Start 2P",monospace'; ctx.fillText('─── HIGH SCORES ───', W / 2, 310);
            highScores.slice(0, 5).forEach((hs, i) => { ctx.fillStyle = '#ccc'; ctx.font = '9px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.fillText((i + 1) + '. ' + hs.name + '  ' + hs.score + ' KILLS  W' + hs.wave, W / 2, 335 + i * 22); });
        }
    } else {
        ctx.fillStyle = '#ff2222'; ctx.font = '32px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.fillText('GAME OVER', W / 2, 70);
        ctx.fillStyle = '#fff'; ctx.font = '12px "Press Start 2P",monospace'; ctx.fillText('SCORE: ' + score + '   WAVE: ' + wave, W / 2, 105);
        ctx.fillStyle = '#6af'; ctx.font = '12px "Press Start 2P",monospace'; ctx.fillText('═══ HIGH SCORES ═══', W / 2, 150);
        if (highScores.length === 0) { ctx.fillStyle = '#666'; ctx.font = '9px "Press Start 2P",monospace'; ctx.fillText('NO SCORES YET', W / 2, 185); }
        else highScores.slice(0, MAX_SCORES).forEach((hs, i) => { ctx.fillStyle = i === 0 ? '#ff0' : (i < 3 ? '#ffa' : '#aaa'); ctx.font = '10px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.fillText((i + 1) + '. ' + hs.name + '    ' + String(hs.score).padStart(4, ' ') + ' KILLS   W' + hs.wave, W / 2, 180 + i * 26); });
        if (Math.floor(Date.now() / 500) % 2) { ctx.fillStyle = '#ff0'; ctx.font = '11px "Press Start 2P",monospace'; ctx.fillText('PRESS ENTER TO PLAY AGAIN', W / 2, H - 40); }
    }
}

// ── GAME LOOP ──
function gameLoop() {
    if (gameState === 'title') drawTitle();
    else if (gameState === 'charSelect') drawCharSelect();
    else { update(); draw(); if (gameState === 'gameover' || gameState === 'enterInitials') drawGameOver(); }
    requestAnimationFrame(gameLoop);
}
gameLoop();
