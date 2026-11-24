/* 소리(Web Audio)
   - 녹음 소리: assets/sfx/*.ogg (Kenney RPG Audio · Impact Sounds · Interface Sounds · Music Jingles, CC0)
   - 코드로 만든 소리: 바위·통 굴러오는 소리, 자갈 떨어지는 소리, 불붙는 소리, 쇠사슬, 한별 웅얼거림 등(노이즈·짧은 톤)
   - 분류 3가지: sfx(효과음) · amb(환경음: 굴러옴·무너짐) · voice(한별 목소리). 음량은 🔊 패널에서 정하고 이 브라우저에 저장한다
   - 브라우저는 사용자가 한 번 누르기 전에는 소리를 막는다 → 첫 클릭·키 입력 때 켠다
   쓰는 법: play('door.open'), play('step', { surface: 'grass' }), setRoll('rock', 0~1), setAmbience('collapse' | null)
   소리 목록은 SOUNDS(어느 녹음 파일·합성 소리를 쓰는지). 바꿀 때는 여기만 고친다(목록: docs/sfx.md). 테스트 모드의 '소리 듣기'로 하나씩 들어 볼 수 있다 */

/* ── 설정(음량) ── */
const KEY = 'wws.sound';
const vol = { sfx: 1, amb: 1, voice: 1, mute: false };   // 기본은 100%
try { Object.assign(vol, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(vol)); } catch {} };

let ctx = null, master, bus = {};
function init() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  // 소리를 키운 만큼 여러 소리가 겹칠 때 찢어지지 않도록 맨 끝에 리미터(압축기)를 둔다
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -6; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.2;
  master = ctx.createGain(); master.connect(lim).connect(ctx.destination);
  for (const k of ['sfx', 'amb', 'voice']) { bus[k] = ctx.createGain(); bus[k].connect(master); }
  applyVolume();
}
function applyVolume() {
  if (!ctx) return;
  master.gain.value = vol.mute ? 0 : 1;
  for (const k of ['sfx', 'amb', 'voice']) bus[k].gain.value = vol[k];
}
export const getVolume = () => ({ ...vol });
export function setVolume(patch) { Object.assign(vol, patch); save(); applyVolume(); }
// 첫 사용자 입력에서 켠다(인트로 버튼이 생기면 그 클릭이 된다)
export function unlock() { init(); if (ctx?.state === 'suspended') ctx.resume(); }
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, unlock, { capture: true });
const ready = () => ctx && ctx.state === 'running';

/* ── 녹음 소리 ── */
const bufs = {};
function buffer(name) {
  if (!bufs[name]) bufs[name] = fetch(`assets/sfx/${name}.ogg`).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).catch(() => null);
  return bufs[name];
}
// 소리 하나 재생: 파일 이름, { cat, gain, rate, delay }
// dur(초)를 주면 그 길이에서 짧게 줄여 끝낸다(끝부분은 부드럽게 줄임)
function file(name, { cat = 'sfx', gain = 1, rate = 1, delay = 0, dur = 0 } = {}) {
  if (!ctx) return;
  buffer(name).then(b => {
    if (!b) return;
    const s = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime + delay;
    s.buffer = b; s.playbackRate.value = rate; g.gain.setValueAtTime(gain, t);
    s.connect(g).connect(bus[cat]); s.start(t);
    if (dur) { g.gain.setValueAtTime(gain, t + dur * 0.6); g.gain.linearRampToValueAtTime(0.0001, t + dur); s.stop(t + dur + 0.02); }   // stop은 start 뒤에
  });
}
const pick = n => Math.floor(Math.random() * n);
const jitter = (v, r = 0.08) => v * (1 - r + Math.random() * r * 2);

/* ── 코드로 만드는 소리 ── */
let noiseBuf = null;
function noise() {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let b = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = w * 0.6 + b * 3; }   // 흰 소음 + 낮은 웅웅(갈색)
  return noiseBuf;
}
// 노이즈 한 번: 길이, 필터(종류·주파수), 세기 곡선
function burst({ dur = 0.3, type = 'lowpass', freq = 800, q = 0.7, gain = 0.5, attack = 0.01, cat = 'sfx', delay = 0, sweepTo = null }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise(); s.loop = true; s.playbackRate.value = jitter(1, 0.2);
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(bus[cat]); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
// 짧은 톤(웅얼거림·쓰러짐 등): 주파수가 from→to로 미끄러진다
function tone({ from, to = from, dur = 0.12, type = 'sine', gain = 0.2, cat = 'sfx', delay = 0, lp = 3000 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
  f.type = 'lowpass'; f.frequency.value = lp;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(bus[cat]); o.start(t); o.stop(t + dur + 0.05);
}
// 고무 오리 "삑": 위로 꺾였다 내려오는 쥐어짜는 소리(배음이 많은 톤 + 좁은 공명)
function squeak(delay = 0, gain = 0.25, pitch = 1) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(900 * pitch, t); o.frequency.linearRampToValueAtTime(1500 * pitch, t + 0.06); o.frequency.linearRampToValueAtTime(1100 * pitch, t + 0.22);
  f.type = 'bandpass'; f.frequency.value = 1800 * pitch; f.Q.value = 2.5;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  o.connect(f).connect(g).connect(bus.sfx); o.start(t); o.stop(t + 0.3);
}
// 용수철 "보잉~": 낮은 음이 빠르게 떨리며 잦아든다
function boing() {
  if (!ctx) return;
  const t = ctx.currentTime, o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(320, t + 0.5);
  lfo.frequency.value = 22; lg.gain.setValueAtTime(60, t); lg.gain.exponentialRampToValueAtTime(5, t + 0.6);
  lfo.connect(lg).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  o.connect(g).connect(bus.sfx); o.start(t); lfo.start(t); o.stop(t + 0.75); lfo.stop(t + 0.75);
}
// 불붙는 "화륵": 높은 쪽이 쓸려 올라가는 바람 + 타닥 소리
function flame(gain = 0.5) {
  burst({ dur: 0.55, type: 'bandpass', freq: 500, sweepTo: 2400, q: 0.9, gain, attack: 0.04 });
  for (let i = 0; i < 4; i++) burst({ dur: 0.03, type: 'highpass', freq: 3000, gain: 0.25, delay: 0.1 + Math.random() * 0.4 });
}

// 한별 목소리 세기(톤 하나). 100%에서도 작다는 피드백으로 0.18 → 0.5
const VOICE = 0.5;
// 맑은 종소리 한 음: 사인파가 톡 울리고 잦아든다
function ping(freq, delay = 0, gain = 0.3, dur = 0.35) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus.sfx); o.start(t); o.stop(t + dur + 0.05);
}
// 메신저 수신음 느낌: 물방울처럼 위로 톡 튀는 소리 + 맑은 종소리(배음 포함)
function popDing() {
  if (!ctx) return;
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(500, t); o.frequency.exponentialRampToValueAtTime(1100, t + 0.05);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(g).connect(bus.sfx); o.start(t); o.stop(t + 0.12);
  ping(1318, 0.05, 0.28, 0.4); ping(1976, 0.05, 0.12, 0.3); ping(2637, 0.05, 0.05, 0.2);
}
// 바람이 "후웅~" 불고 낮게 가라앉는 소리(김빠짐): 바람 소리(노이즈)의 울림이 아래로 내려가며 잦아든다. 전체가 저음
function deflate() {
  if (!ctx) return;
  const t = ctx.currentTime, d = 1.0, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise(); s.loop = true;
  f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(520, t); f.frequency.exponentialRampToValueAtTime(110, t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.18); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f).connect(g).connect(bus.sfx); s.start(t, Math.random()); s.stop(t + d + 0.05);
  tone({ from: 190, to: 85, dur: d * 0.9, type: 'sine', gain: 0.09, lp: 400, delay: 0.05 });   // 밑에 깔리는 낮은 "웅"
}
// 무거운 철문이 긁히며 올라가는 소리: 철컥(걸쇠 풀림) → 쇠끼리 긁히는 끼이이익(뚝뚝 끊기며) + 낮은 그르릉 → 쿵 철컹(멈춤)
function ironGate() {
  if (!ctx) return;
  const t = ctx.currentTime, d = 2.2, t0 = t + 0.2;
  file('metal0', { rate: 0.55, gain: 0.9 }); file('lever_latch', { rate: 0.7, gain: 0.6 });
  // 긁힘: 좁은 울림의 노이즈. 울림 높이를 조금씩 흔들고 세기를 뚝뚝 끊어(걸렸다 미끄러졌다) 쇠 긁는 느낌을 낸다
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise(); s.loop = true;
  f.type = 'bandpass'; f.Q.value = 9; f2.type = 'bandpass'; f2.Q.value = 6;
  const n = 40, amp = new Float32Array(n), fr = new Float32Array(n), fr2 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / 4) * Math.min(1, (n - i) / 6);
    amp[i] = env * (0.25 + Math.random() * 0.45);
    fr[i] = 620 + Math.sin(i * 0.7) * 80 + Math.random() * 120;
    fr2[i] = fr[i] * 1.9;
  }
  amp[n - 1] = 0.0001;
  g.gain.setValueCurveAtTime(amp, t0, d); f.frequency.setValueCurveAtTime(fr, t0, d); f2.frequency.setValueCurveAtTime(fr2, t0, d);
  s.connect(f).connect(g); s.connect(f2).connect(g); g.connect(bus.sfx); s.start(t0, Math.random()); s.stop(t0 + d + 0.05);
  file('creak_low', { rate: 0.55, gain: 0.7, delay: 0.3 }); file('creak_low', { rate: 0.5, gain: 0.6, delay: 1.2 });
  burst({ dur: d + 0.2, freq: 140, gain: 0.45, attack: 0.3, delay: 0.15 });                  // 무게감: 낮은 그르릉
  file('metal1', { rate: 0.5, gain: 1, delay: t0 - t + d }); file('stone_hit', { rate: 0.75, gain: 0.7, delay: t0 - t + d + 0.02 });   // 다 올라가 멈춤
}
// 클리어 팡파르(B안, 2026-11-24 결정): 실제 현을 튕긴 녹음(pluck)을 음높이만 바꿔 연주한다
// 빰-빰-빰-빠암! (솔 세 번 → 도 장조 화음) 뒤 높은 화음을 여러 번 긁어 밝게 끝낸다. 숫자 = 반음(0 = 녹음 원래 음)
const semi = n => 2 ** (n / 12);
function pl(n, delay, gain = 1) { file('pluck', { rate: semi(n), delay, gain }); file('pluck', { rate: semi(n + 12), delay: delay + 0.005, gain: gain * 0.35 }); }
function strum(notes, delay, gain = 1, gap = 0.025) { notes.forEach((n, i) => pl(n, delay + i * gap, gain)); }
function sparkle(delay, n = 8) { for (let i = 0; i < n; i++) ping(jitter(3000 + pick(5) * 400, 0.03), delay + i * 0.06 + Math.random() * 0.03, 0.07, 0.5); }
function fanfare() {
  [0, 1, 2].forEach(i => strum([-5, 7], i * 0.14));
  strum([0, 4, 7, 12, 16], 0.5, 1.1);
  for (let i = 0; i < 7; i++) strum([12, 16, 19], 0.65 + i * 0.1, 0.8 - i * 0.1, 0.012);
  sparkle(0.55, 10);
}

/* ── 소리 목록(id → 재생) ── */
const SOUNDS = {
  // 방송·채팅
  'chat.send': () => file('chat_send', { gain: 0.8 }),
  'chat.read': () => popDing(),
  'chat.missed': () => deflate(),
  'dona.mine': () => file('dona_mine'),
  'dona.troll': () => file('dona_troll', { gain: 0.8 }),
  'reward': () => {   // 동전이 와르르 + 짤랑짤랑 반짝이는 소리. 길이는 전의 절반(약 0.6초)
    file('coins1', { dur: 0.6 }); file('coins2', { delay: 0.11, dur: 0.5 }); file('coins1', { rate: 1.25, gain: 0.7, delay: 0.21, dur: 0.4 }); file('coins2', { rate: 1.4, gain: 0.6, delay: 0.3, dur: 0.3 });
    for (let i = 0; i < 7; i++) ping(jitter(2600 + pick(4) * 500, 0.04), 0.05 + i * 0.05 + Math.random() * 0.03, 0.11, 0.25);
  },
  // 한별 목소리
  'voice.blip': ({ emo = 'normal' } = {}) => {
    const base = { normal: 300, happy: 360, shout: 420, angry: 260, sad: 220 }[emo] || 300, f = jitter(base, 0.12);
    tone({ from: f, to: f * jitter(1.05, 0.05), dur: 0.08, type: 'triangle', gain: VOICE, cat: 'voice', lp: 2200 });
  },
  'voice.ask': () => { tone({ from: 280, to: 300, dur: 0.12, type: 'triangle', gain: VOICE, cat: 'voice', lp: 2200 }); tone({ from: 300, to: 470, dur: 0.22, type: 'triangle', gain: VOICE, cat: 'voice', lp: 2200, delay: 0.13 }); },
  // 몸·물건
  'step': ({ surface = 'stone' } = {}) => file(`step_${surface}${pick(5)}`, { gain: surface === 'grass' ? 0.3 : 0.4, rate: jitter(1, 0.06) }),
  'poke': () => file('poke', { gain: 0.7, rate: jitter(1) }),
  'door.open': () => file('door_open'),
  'door.locked': () => { file('door_rattle', { gain: 0.7 }); file('door_rattle', { gain: 0.55, rate: 1.12, delay: 0.16 }); },
  'button': () => file('button'),
  'lever': () => { file('creak', { gain: 0.6 }); file('lever_latch', { delay: 0.28 }); },
  'gate': () => ironGate(),   // 레버로 철창문이 올라갈 때(스테이지 3·4)
  'pickup': () => file('poke', { gain: 0.8, rate: jitter(1) }),
  'use': () => file('use_item'),
  'chest.open': () => { file('creak_low', { gain: 0.8 }); file('wood3', { delay: 0.32 }); },
  // 스테이지별
  'duck': () => { squeak(0, 1); squeak(0.3, 0.6, 0.85); },   // 고무 오리를 꾹 눌렀다(삑) 놓음(삑)
  'pop': () => { boing(); squeak(0.22); },
  'scrub': () => [1, 2, 3, 4, 2].forEach((n, i) => file(`cloth${n}`, { gain: 0.8, rate: jitter(1.1), delay: i * 0.16 })),
  'wrong': () => [1.5, 1.19, 0.94].forEach((r, i) => file('pluck', { rate: r * 0.8, delay: i * 0.13 })),
  'rockgate': () => { burst({ dur: 1.8, freq: 140, gain: 0.8, attack: 0.15 }); file('stone_hit', { rate: 0.7, delay: 0.1 }); file('stone_hit2', { rate: 0.6, delay: 0.9, gain: 0.7 }); },
  'candle.on': () => flame(0.45),
  'candle.puff': () => { flame(0.35); burst({ dur: 0.35, type: 'bandpass', freq: 900, sweepTo: 200, gain: 0.5, delay: 0.45 }); },
  'guard': () => { for (let i = 0; i < 6; i++) file(`wood${1 + (i % 2)}`, { gain: 0.5, rate: jitter(1.6, 0.2), delay: i * 0.06 }); file('sword', { delay: 0.55 }); },
  'death': () => { tone({ from: 420, to: 110, dur: 0.8, type: 'triangle', gain: 0.18, lp: 900 }); file('thud', { delay: 0.65 }); },
  'clear': () => fanfare(),
  'stone.thump': () => file(`stone_hit${Math.random() < 0.5 ? '' : '2'}`, { cat: 'amb', gain: 0.5, rate: jitter(0.6, 0.15) }),
};
export function play(id, opt) { if (ready()) SOUNDS[id]?.(opt); }
export const soundIds = () => Object.keys(SOUNDS);

/* ── 굴러오는 소리(환경음): 거리에 따라 커지는 저음 굴림. 통은 나무가 덜컹거리는 소리가 섞인다 ── */
let roll = null;
export function setRoll(kind, level) {
  if (!ready()) return;
  if (!roll && level <= 0) return;
  if (!roll) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise(); s.loop = true; f.type = 'lowpass'; f.frequency.value = kind === 'barrel' ? 380 : 200; g.gain.value = 0;
    s.connect(f).connect(g).connect(bus.amb); s.start();
    roll = { s, g, kind, nextKnock: 0 };
  }
  const t = ctx.currentTime;
  roll.g.gain.setTargetAtTime(level * (roll.kind === 'barrel' ? 0.7 : 1.1), t, 0.08);
  if (roll.kind === 'barrel' && level > 0.05 && t > roll.nextKnock) {   // 덜컹덜컹: 나무 부딪는 소리
    file(`wood${1 + pick(3)}`, { cat: 'amb', gain: 0.25 + level * 0.6, rate: jitter(0.75, 0.15) });
    roll.nextKnock = t + 0.09 + Math.random() * 0.1;
  }
  if (level <= 0) { const r = roll; roll = null; r.g.gain.setTargetAtTime(0, t, 0.1); setTimeout(() => r.s.stop(), 600); }
}
// 경고(⚠): 멀리서 커지는 쿠르르릉
export function warnRumble(kind) {
  if (!ready()) return;
  burst({ dur: 2.2, freq: kind === 'barrel' ? 320 : 160, gain: 0.5, attack: 1.4, cat: 'amb' });
}

/* ── 구역 환경음: 무너지는 탈출로 = 자갈·돌가루가 드드드 떨어지고 가끔 쿵 ── */
let amb = null;
export function setAmbience(name) {
  if (amb) { clearInterval(amb.timer); amb.g?.gain.setTargetAtTime(0, ctx.currentTime, 0.2); const s = amb.s; setTimeout(() => s?.stop(), 800); amb = null; }
  if (!name || !ctx) return;
  if (name === 'collapse') {
    // 낮게 드드드 떨리는 바탕(노이즈를 빠르게 떨리게)
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    s.buffer = noise(); s.loop = true; f.type = 'lowpass'; f.frequency.value = 260; g.gain.value = 0.12;
    lfo.frequency.value = 13; lg.gain.value = 0.08; lfo.connect(lg).connect(g.gain);
    s.connect(f).connect(g).connect(bus.amb); s.start(); lfo.start();
    amb = { s, g, timer: setInterval(() => {
      if (!ready()) return;
      // 자갈이 후드득
      for (let i = 0; i < 2 + pick(4); i++) burst({ dur: 0.04, type: 'bandpass', freq: 1800 + Math.random() * 2500, q: 2, gain: 0.12, cat: 'amb', delay: Math.random() * 0.5 });
      if (Math.random() < 0.08) play('stone.thump');
    }, 500) };
  }
}

/* ── 🔊 소리 설정 패널 ── */
export function initPanel() {
  const btn = document.getElementById('soundBtn'), panel = document.getElementById('soundPanel');
  if (!btn || !panel) return;
  const sync = () => {
    for (const k of ['sfx', 'amb', 'voice']) panel.querySelector(`[data-k="${k}"]`).value = Math.round(vol[k] * 100);
    panel.querySelector('[data-k="mute"]').checked = vol.mute;
    btn.textContent = vol.mute ? '🔇' : '🔊';
  };
  btn.onclick = e => { e.stopPropagation(); unlock(); panel.hidden = !panel.hidden; sync(); };
  panel.addEventListener('click', e => e.stopPropagation());
  addEventListener('click', () => { panel.hidden = true; });
  panel.querySelectorAll('input[type=range]').forEach(r => r.oninput = () => { setVolume({ [r.dataset.k]: r.value / 100 }); if (r.dataset.k === 'voice') play('voice.blip'); else if (r.dataset.k === 'sfx') play('button'); });
  panel.querySelector('[data-k="mute"]').onchange = e => { setVolume({ mute: e.target.checked }); sync(); };
  sync();
}
