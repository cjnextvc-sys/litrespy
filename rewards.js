/* ================================================================
   Litrespy Rewards Engine — rewards.js
   All phases: Coins, Spin Wheel, Streaks, Packs, XP/Ranks, Missions
   ================================================================ */
(function () {
  'use strict';

  // ── localStorage helpers ─────────────────────────────────────
  const LS = {
    get: (k, def) => {
      try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; }
    },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  const todayStr = () => new Date().toISOString().slice(0, 10);

  // ── Constants ────────────────────────────────────────────────
  const RANKS = [
    { name: '⛽ Rookie',   xp: 0 },
    { name: '🔧 Mechanic', xp: 200 },
    { name: '🚗 Driver',   xp: 500 },
    { name: '🏎️ Racer',    xp: 1000 },
    { name: '⚡ Turbo',    xp: 2000 },
    { name: '🌟 Elite',    xp: 4000 },
    { name: '👑 Legend',   xp: 8000 },
  ];

  const SPIN_TOTAL_WEIGHT = 100;
  const SPIN_SEGMENTS = [
    { label: '🪙 50',       coins: 50,   xp: 0,   pack: false, legendary: false, color: '#475569', weight: 30 },
    { label: '🪙 100',      coins: 100,  xp: 0,   pack: false, legendary: false, color: '#059669', weight: 25 },
    { label: '🪙 200',      coins: 200,  xp: 0,   pack: false, legendary: false, color: '#2563EB', weight: 15 },
    { label: '⚡ 2x XP',   coins: 0,    xp: 200, pack: false, legendary: false, color: '#7C3AED', weight: 10 },
    { label: '🪙 500',      coins: 500,  xp: 0,   pack: false, legendary: false, color: '#D97706', weight: 8 },
    { label: '📦 Pack',     coins: 0,    xp: 0,   pack: true,  legendary: false, color: '#DC2626', weight: 7 },
    { label: '🪙 1000',     coins: 1000, xp: 0,   pack: false, legendary: false, color: '#F59E0B', weight: 4 },
    { label: '👑 Legendary',coins: 2000, xp: 500, pack: true,  legendary: true,  color: '#EC4899', weight: 1 },
  ];

  const MISSION_POOL = [
    { id: 'm_suburbs', name: 'Search 3 suburbs',        target: 3, reward: 150, xp: 50, trigger: 'search'   },
    { id: 'm_early',   name: 'Open before 9am',          target: 1, reward: 75,  xp: 25, trigger: 'time'     },
    { id: 'm_nearme',  name: 'Use Near Me',              target: 1, reward: 100, xp: 30, trigger: 'nearme'   },
    { id: 'm_pack',    name: 'Open a pack',              target: 1, reward: 100, xp: 40, trigger: 'pack'     },
    { id: 'm_map5',    name: '5 mins on Fuel Map',       target: 1, reward: 80,  xp: 20, trigger: 'map_idle' },
    { id: 'm_search1', name: 'Search for fuel prices',   target: 1, reward: 60,  xp: 15, trigger: 'search'   },
    { id: 'm_nearme2', name: 'Use Near Me twice',        target: 2, reward: 180, xp: 50, trigger: 'nearme'   },
  ];

  const PACK_RARITIES = [
    { name: 'COMMON',    color: '#64748B', emoji: '⚪', coins: 100,  xp: 20,  weight: 60 },
    { name: 'RARE',      color: '#059669', emoji: '🟢', coins: 250,  xp: 50,  weight: 25 },
    { name: 'EPIC',      color: '#7C3AED', emoji: '🟣', coins: 500,  xp: 100, weight: 12 },
    { name: 'LEGENDARY', color: '#F59E0B', emoji: '🌟', coins: 2000, xp: 300, weight: 3  },
  ];

  // ── State ───────────────────────────────────────────────────
  let coins    = LS.get('litrespy_coins', 0);
  let xp       = LS.get('litrespy_xp', 0);
  let streak   = LS.get('litrespy_streak', 0);
  let packs    = LS.get('litrespy_packs', 0);
  let missions = [];
  let xpMult   = 1;
  let xpMultEnd = 0;

  // ── Audio ───────────────────────────────────────────────────
  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    return audioCtx;
  }

  function playTone(freq, dur, vol = 0.15, type = 'sine') {
    try {
      const ctx = getAudio(); if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = type;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch (e) {}
  }

  function playCoin() { playTone(1046, 0.12, 0.18); }

  function playWin(big) {
    const freqs = big ? [523, 659, 784, 1047, 1318] : [523, 659, 784];
    try {
      const ctx = getAudio(); if (!ctx) return;
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = f;
        const t = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t); osc.stop(t + 0.35);
      });
    } catch (e) {}
  }

  function playStreakBreak() {
    try {
      const ctx = getAudio(); if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.7);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc.start(); osc.stop(ctx.currentTime + 0.7);
    } catch (e) {}
  }

  // ── Confetti ─────────────────────────────────────────────────
  function getConfettiCanvas() {
    let c = document.getElementById('rw-confetti');
    if (!c) {
      c = document.createElement('canvas');
      c.id = 'rw-confetti';
      c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:8500;display:none';
      document.body.appendChild(c);
    }
    return c;
  }

  function confettiBurst(big = false) {
    const canvas = getConfettiCanvas();
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';
    const colors = ['#F59E0B', '#34D399', '#60A5FA', '#F472B6', '#A78BFA', '#FCD34D', '#FB923C'];
    const count = big ? 280 : 110;
    const particles = Array.from({ length: count }, () => ({
      x:    Math.random() * canvas.width,
      y:    -10 - Math.random() * 100,
      vx:   (Math.random() - 0.5) * (big ? 9 : 5),
      vy:   Math.random() * (big ? 6 : 3.5) + 1.5,
      rot:  Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.22,
      w:    Math.random() * 11 + 5,
      h:    Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    let frame = 0;
    const maxF = big ? 190 : 115;
    (function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.13; p.rot += p.rotV;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - frame / maxF);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      frame++;
      if (frame < maxF) requestAnimationFrame(animate);
      else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.style.display = 'none'; }
    })();
  }

  // ── Floating coin animation ──────────────────────────────────
  function floatAnim(amount, el) {
    const div = document.createElement('div');
    div.className = 'rw-float';
    div.textContent = '+' + amount + ' 🪙';
    let x = window.innerWidth / 2, y = 100;
    if (el) {
      const r = el.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top + r.height / 2;
    } else {
      const coinsEl = document.getElementById('rw-coins-num');
      if (coinsEl) { const r = coinsEl.getBoundingClientRect(); x = r.left + r.width / 2; y = r.bottom; }
    }
    div.style.left = x + 'px';
    div.style.top  = y + 'px';
    document.body.appendChild(div);
    playCoin();
    setTimeout(() => div.remove(), 1600);
  }

  // ── Bar update ───────────────────────────────────────────────
  function updateBar() {
    const coinsEl  = document.getElementById('rw-coins-num');
    const streakEl = document.getElementById('rw-streak-num');
    const rankEl   = document.getElementById('rw-rank-badge');
    const fillEl   = document.getElementById('rw-xp-fill');
    const labelEl  = document.getElementById('rw-xp-label');
    const packDot  = document.getElementById('rw-pack-dot');
    if (coinsEl)  coinsEl.textContent  = coins.toLocaleString();
    if (streakEl) streakEl.textContent = streak;
    const ri = getRankInfo();
    if (rankEl)  rankEl.textContent   = RANKS[ri.idx].name;
    if (fillEl)  fillEl.style.width   = ri.pct + '%';
    if (labelEl) labelEl.textContent  = xp + ' / ' + ri.nextXp + ' XP';
    if (packDot) packDot.style.display = packs > 0 ? 'inline-flex' : 'none';
  }

  function getRankInfo() {
    let idx = 0;
    for (let i = RANKS.length - 1; i >= 0; i--) { if (xp >= RANKS[i].xp) { idx = i; break; } }
    const cur     = xp - RANKS[idx].xp;
    const nextXp  = idx < RANKS.length - 1 ? RANKS[idx + 1].xp : xp;
    const span    = idx < RANKS.length - 1 ? RANKS[idx + 1].xp - RANKS[idx].xp : 1;
    return { idx, pct: Math.min(100, Math.round((cur / span) * 100)), nextXp };
  }

  // ── Phase 1: Coins & XP ──────────────────────────────────────
  function earnCoins(amount, el) {
    coins += amount;
    LS.set('litrespy_coins', coins);
    floatAnim(amount, el);
    updateBar();
    checkPackThreshold();
  }

  function earnXP(amount) {
    const mult = (xpMult > 1 && Date.now() < xpMultEnd) ? xpMult : 1;
    const prevIdx = getRankInfo().idx;
    xp += Math.round(amount * mult);
    LS.set('litrespy_xp', xp);
    const newIdx = getRankInfo().idx;
    if (newIdx > prevIdx) setTimeout(() => showRankUp(newIdx), 500);
    updateBar();
  }

  function checkPackThreshold() {
    const earned = LS.get('litrespy_packs_earned', 0);
    const milestones = Math.floor(coins / 500);
    if (milestones > earned) {
      packs += milestones - earned;
      LS.set('litrespy_packs', packs);
      LS.set('litrespy_packs_earned', milestones);
      updateBar();
    }
  }

  // ── Phase 3: Streak ──────────────────────────────────────────
  function checkStreak() {
    const last  = LS.get('litrespy_last_open', null);
    const today = todayStr();
    if (last === today) return;

    if (last) {
      const diff = Math.round((new Date(today) - new Date(last)) / 86400000);
      if (diff === 1) {
        streak += 1;
      } else if (diff > 1) {
        if (streak > 1) {
          setTimeout(() => {
            const el = document.getElementById('rw-streak-display');
            if (el) { el.classList.add('rw-streak-breaking'); playStreakBreak(); }
            setTimeout(() => el && el.classList.remove('rw-streak-breaking'), 900);
          }, 1200);
        }
        streak = 1;
      }
    } else {
      streak = 1;
    }
    LS.set('litrespy_streak', streak);
    LS.set('litrespy_last_open', today);

    const milestones = { 3: [50, false], 7: [200, true], 30: [1000, true], 100: [3000, true] };
    if (milestones[streak]) {
      const [bonus, bigPack] = milestones[streak];
      setTimeout(() => {
        earnCoins(bonus, null);
        confettiBurst(streak >= 7);
        if (bigPack) { packs += 1; LS.set('litrespy_packs', packs); updateBar(); }
        if (streak >= 7) showStreakMilestone(streak);
      }, 1800);
    }
  }

  function showStreakMilestone(days) {
    const el = createFullOverlay(`
      <div class="rw-rankup-box">
        <div class="rw-rankup-label">STREAK MILESTONE</div>
        <div class="rw-rankup-emoji">${days >= 100 ? '🏆' : days >= 30 ? '👑' : '🔥'}</div>
        <div class="rw-rankup-name">${days} DAY STREAK!</div>
        <div class="rw-rankup-bonus">${days >= 100 ? '🏆 HALL OF FAME DRIVER' : days >= 30 ? '👑 LEGENDARY STREAK' : '🔥 ON FIRE!'}</div>
        <button class="rw-rankup-close" onclick="this.closest('.rw-rankup-overlay').remove()">CLAIM REWARD</button>
      </div>`);
    el.className = 'rw-rankup-overlay';
    confettiBurst(days >= 30);
    setTimeout(() => el.remove(), 7000);
  }

  // ── Phase 5: Rank Up ─────────────────────────────────────────
  function showRankUp(idx) {
    const r = RANKS[idx];
    earnCoins(500, null);
    playWin(true);
    const el = createFullOverlay(`
      <div class="rw-rankup-box">
        <div class="rw-rankup-label">RANK UP!</div>
        <div class="rw-rankup-emoji">${r.name.split(' ')[0]}</div>
        <div class="rw-rankup-name">${r.name.replace(/^\S+\s/, '')}</div>
        <div class="rw-rankup-bonus">+500 🪙 BONUS COINS</div>
        <button class="rw-rankup-close" onclick="this.closest('.rw-rankup-overlay').remove()">AWESOME!</button>
      </div>`);
    el.className = 'rw-rankup-overlay';
    confettiBurst(false);
    setTimeout(() => el.remove(), 5000);
  }

  function createFullOverlay(html) {
    const el = document.createElement('div');
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
  }

  // ── Phase 2: Daily Spin Wheel ─────────────────────────────────
  function buildSpinWheel() {
    if (document.getElementById('rw-spin-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'rw-spin-overlay';
    overlay.innerHTML = `
      <div class="rw-spin-title">DAILY SPIN</div>
      <div class="rw-spin-subtitle">Spin for your daily reward — free every 24 hours!</div>
      <div class="rw-wheel-wrap">
        <div class="rw-wheel-pointer">▼</div>
        <canvas id="rw-spin-canvas" width="300" height="300"></canvas>
      </div>
      <button class="rw-spin-btn" id="rw-spin-btn">SPIN!</button>
      <div class="rw-win-text" id="rw-win-text"></div>`;
    document.body.appendChild(overlay);

    const canvas = document.getElementById('rw-spin-canvas');
    const ctx    = canvas.getContext('2d');
    const cx = 150, cy = 150, r = 143;

    function drawWheel(rotation) {
      ctx.clearRect(0, 0, 300, 300);
      let angle = rotation;
      SPIN_SEGMENTS.forEach(seg => {
        const slice = (seg.weight / SPIN_TOTAL_WEIGHT) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, angle, angle + slice);
        ctx.closePath();
        ctx.fillStyle = seg.color; ctx.fill();
        ctx.strokeStyle = '#0F172A'; ctx.lineWidth = 2; ctx.stroke();
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle + slice / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Inter,Arial,sans-serif';
        ctx.fillText(seg.label, r - 6, 4);
        ctx.restore();
        angle += slice;
      });
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fillStyle = '#0F172A'; ctx.fill();
      ctx.strokeStyle = '#F59E0B'; ctx.lineWidth = 2.5; ctx.stroke();
    }

    let currentAngle = 0;
    drawWheel(currentAngle);

    // Build weighted result pool
    const pool = [];
    SPIN_SEGMENTS.forEach((s, i) => { for (let j = 0; j < s.weight; j++) pool.push(i); });

    let spinning = false;
    let lastTickSeg = -1;

    document.getElementById('rw-spin-btn').onclick = () => {
      if (spinning) return;
      spinning = true;
      document.getElementById('rw-spin-btn').disabled = true;
      getAudio(); // unlock audio on click

      const resultIdx = pool[Math.floor(Math.random() * pool.length)];
      const seg = SPIN_SEGMENTS[resultIdx];

      // Calculate how much of the wheel arc is before the midpoint of resultIdx
      let segMid = 0;
      for (let i = 0; i < resultIdx; i++) segMid += (SPIN_SEGMENTS[i].weight / SPIN_TOTAL_WEIGHT) * Math.PI * 2;
      segMid += (seg.weight / SPIN_TOTAL_WEIGHT) * Math.PI * 2 / 2;

      // Pointer is at top = 3*PI/2. Spin forward (clockwise = increasing angle).
      const totalSpins = 8 + Math.floor(Math.random() * 4);
      const targetAngle = 3 * Math.PI / 2 - segMid + totalSpins * Math.PI * 2;

      const duration = 4200;
      const t0 = performance.now();

      function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

      function frame(now) {
        const t = Math.min((now - t0) / duration, 1);
        currentAngle = easeOut(t) * targetAngle;
        drawWheel(currentAngle);

        // Tick sound on segment boundary crossings
        const rel = ((-Math.PI / 2 - currentAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        let cumSeg = 0, curSeg = SPIN_SEGMENTS.length - 1;
        for (let i = 0; i < SPIN_SEGMENTS.length; i++) {
          cumSeg += (SPIN_SEGMENTS[i].weight / SPIN_TOTAL_WEIGHT) * Math.PI * 2;
          if (rel < cumSeg) { curSeg = i; break; }
        }
        if (curSeg !== lastTickSeg && t < 0.92) {
          playTone(700 + t * 500, 0.025, 0.12);
          lastTickSeg = curSeg;
        }

        if (t < 1) { requestAnimationFrame(frame); return; }

        // Spin complete
        const isBig = seg.coins >= 1000 || seg.legendary;
        const winEl = document.getElementById('rw-win-text');
        winEl.textContent = isBig ? (seg.legendary ? '👑 LEGENDARY!' : '💰 JACKPOT!!!') : seg.label + ' — Nice!';
        winEl.style.display = 'block';

        if (isBig) {
          const flash = document.createElement('div');
          flash.style.cssText = 'position:fixed;inset:0;background:#F59E0B;z-index:9999;opacity:0;pointer-events:none;transition:opacity 0.08s';
          document.body.appendChild(flash);
          requestAnimationFrame(() => { flash.style.opacity = '0.5'; setTimeout(() => flash.remove(), 200); });

          const jack = document.createElement('div');
          jack.style.cssText = 'position:fixed;top:28%;left:50%;transform:translateX(-50%);font-size:64px;font-weight:900;color:#F59E0B;z-index:9998;text-shadow:0 0 40px #F59E0B;white-space:nowrap;font-family:Inter,Arial,sans-serif;animation:rw-win-pulse 0.4s ease infinite alternate';
          jack.textContent = seg.legendary ? '👑 LEGENDARY!' : '💰 JACKPOT!!!';
          document.body.appendChild(jack);
          setTimeout(() => jack.remove(), 3500);
        }

        playWin(isBig);
        confettiBurst(isBig);

        if (seg.coins > 0) earnCoins(seg.coins, null);
        if (seg.xp > 0) { xpMult = 2; xpMultEnd = Date.now() + 3600000; earnXP(seg.xp); }
        if (seg.pack)  { packs++; LS.set('litrespy_packs', packs); updateBar(); }

        setTimeout(() => overlay.remove(), isBig ? 4500 : 2800);
      }
      requestAnimationFrame(frame);
    };
  }

  function checkDailySpin() {
    if (LS.get('litrespy_last_spin', null) === todayStr()) return;
    LS.set('litrespy_last_spin', todayStr());
    setTimeout(buildSpinWheel, 900);
  }

  // ── Missions ─────────────────────────────────────────────────
  function initMissions() {
    const mDate = LS.get('litrespy_mission_date', null);
    if (mDate !== todayStr()) {
      const pool = [...MISSION_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
      missions = pool.map(m => ({ ...m, progress: 0, done: false }));
      LS.set('litrespy_missions', missions);
      LS.set('litrespy_mission_date', todayStr());
    } else {
      missions = LS.get('litrespy_missions', []);
    }
    if (new Date().getHours() < 9) advanceMission('time');
  }

  function advanceMission(trigger) {
    let changed = false;
    missions.forEach(m => {
      if (m.trigger === trigger && !m.done) {
        m.progress = Math.min(m.progress + 1, m.target);
        if (m.progress >= m.target) { m.done = true; changed = true; setTimeout(() => completeMission(m), 300); }
      }
    });
    if (changed) LS.set('litrespy_missions', missions);
  }

  function completeMission(m) {
    earnCoins(m.reward, null);
    earnXP(m.xp);
    confettiBurst(false);
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#059669;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;z-index:9200;font-family:Inter,Arial,sans-serif;box-shadow:0 4px 20px rgba(5,150,105,0.4);white-space:nowrap';
    toast.textContent = '✅ MISSION DONE: ' + m.name + '  +' + m.reward + ' 🪙';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  function openMissions() {
    if (document.querySelector('.rw-panel-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'rw-panel-overlay';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

    const packBtn = packs > 0
      ? `<button onclick="window.RW.openPack();this.closest('.rw-panel-overlay').remove()"
           style="width:100%;background:linear-gradient(135deg,#F59E0B,#D97706);border:none;color:#0F172A;font-weight:900;font-size:15px;padding:14px;border-radius:10px;cursor:pointer;font-family:Inter,Arial,sans-serif;margin-top:16px;letter-spacing:0.3px">
           📦 OPEN PACK (${packs} available)
         </button>`
      : '';

    const msHTML = missions.map(m => `
      <div class="rw-mission ${m.done ? 'rw-done' : ''}">
        <div class="rw-mission-top">
          <span class="rw-mission-name">${m.done ? '✅ ' : ''}${m.name}</span>
          <span class="rw-mission-reward">+${m.reward} 🪙</span>
        </div>
        <div class="rw-mission-progress-wrap">
          <div class="rw-mission-progress-fill" style="width:${Math.min(100, Math.round(m.progress / m.target * 100))}%"></div>
        </div>
        <div class="rw-mission-sub">${m.progress} / ${m.target}${m.done ? ' — Complete!' : ''}</div>
      </div>`).join('');

    overlay.innerHTML = `
      <div class="rw-panel">
        <div class="rw-panel-header">
          <span class="rw-panel-title">🎯 Daily Missions</span>
          <button class="rw-panel-close" onclick="this.closest('.rw-panel-overlay').remove()">✕</button>
        </div>
        <div class="rw-streak-card">
          <div class="rw-streak-big">🔥</div>
          <div>
            <div class="rw-streak-info-name">${streak} Day Streak</div>
            <div class="rw-streak-info-sub">Check in daily to keep your streak alive!</div>
          </div>
        </div>
        ${msHTML}
        ${packBtn}
      </div>`;
    document.body.appendChild(overlay);
  }

  // ── Phase 4: Pack Opening ─────────────────────────────────────
  function openPack() {
    if (packs <= 0) return;
    packs--; LS.set('litrespy_packs', packs);
    advanceMission('pack');
    updateBar();
    getAudio();

    const total = PACK_RARITIES.reduce((a, r) => a + r.weight, 0);
    let roll = Math.floor(Math.random() * total);
    let rarity = PACK_RARITIES[0];
    for (const r of PACK_RARITIES) { if (roll < r.weight) { rarity = r; break; } roll -= r.weight; }

    const isEpicPlus = rarity.name === 'EPIC' || rarity.name === 'LEGENDARY';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9500;display:flex;align-items:center;justify-content:center;flex-direction:column;animation:rw-fade-in 0.3s ease;font-family:Inter,Arial,sans-serif';

    overlay.innerHTML = `
      <div style="font-size:12px;font-weight:800;color:#64748B;letter-spacing:4px;text-transform:uppercase;margin-bottom:20px">TAP TO OPEN</div>
      <div id="_rwPackIcon" style="cursor:pointer;font-size:96px;line-height:1;filter:drop-shadow(0 0 30px ${rarity.color});animation:rw-win-pulse 0.9s ease infinite alternate;transition:transform 0.2s">📦</div>
      <div id="_rwPackReveal" style="display:none;text-align:center">
        <div style="font-size:13px;font-weight:800;color:${rarity.color};letter-spacing:5px;margin-bottom:14px;text-shadow:0 0 20px ${rarity.color}">${rarity.emoji} ${rarity.name}</div>
        <div style="font-size:64px;line-height:1;margin-bottom:14px;animation:rw-rankup-pop 0.6s cubic-bezier(0.34,1.56,0.64,1)">🃏</div>
        <div style="font-size:30px;font-weight:900;color:#F59E0B">+${rarity.coins} 🪙</div>
        <div style="font-size:13px;color:#64748B;margin-top:6px;font-weight:600">+${rarity.xp} XP</div>
        <button onclick="this.closest('[style*=fixed]').remove()" style="margin-top:28px;background:#1E293B;border:1px solid #334155;color:#94A3B8;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;cursor:pointer;font-family:Inter,Arial,sans-serif;transition:all 0.15s">COLLECT</button>
      </div>`;

    document.body.appendChild(overlay);

    document.getElementById('_rwPackIcon').onclick = () => {
      document.getElementById('_rwPackIcon').style.display = 'none';
      document.getElementById('_rwPackReveal').style.display = 'block';
      earnCoins(rarity.coins, null);
      earnXP(rarity.xp);
      playWin(rarity.name === 'LEGENDARY');
      if (isEpicPlus) confettiBurst(rarity.name === 'LEGENDARY');
    };
  }

  // ── Page triggers (called from HTML onclick) ─────────────────
  function triggerSearch(el) {
    earnCoins(15, el || null);
    earnXP(15);
    advanceMission('search');
  }

  function triggerNearMe(el) {
    earnCoins(20, el || null);
    earnXP(20);
    advanceMission('nearme');
  }

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    checkStreak();
    initMissions();
    earnCoins(10, null);
    earnXP(10);

    const firstAction = LS.get('litrespy_first_action_date', null);
    if (firstAction !== todayStr()) {
      LS.set('litrespy_first_action_date', todayStr());
      setTimeout(() => earnCoins(25, null), 900);
    }

    updateBar();
    checkDailySpin();

    // 5-min idle coins on Fuel Map
    if (document.getElementById('map')) {
      setInterval(() => {
        earnCoins(5, null);
        advanceMission('map_idle');
      }, 5 * 60 * 1000);
    }
  }

  // ── Public API ───────────────────────────────────────────────
  window.RW = { earnCoins, earnXP, openMissions, openSpinWheel: buildSpinWheel, openPack, triggerSearch, triggerNearMe };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
