/* 스테이지 규칙 엔진(순수 로직: 화면·DOM을 쓰지 않는다).
   브라우저(stage.js)와 node 검증 도구(tools/validate.mjs)가 함께 쓴다.

   상태(state)는 스테이지 데이터와 분리된 평범한 객체라 복제·비교가 쉽다.
   perform()은 규칙을 즉시 판정하고, 화면이 재생할 effects 목록을 돌려준다. */

export const ACTION_TYPES = ['move', 'interact', 'pickup', 'use', 'explore', 'idle'];

/* ── 상태 ── */
export function createState(stage) {
  const s = {
    stageId: stage.id, area: stage.start.area, entry: stage.start.entry,
    flags: { ...(stage.flags || {}) }, inv: [], at: null, near: null, noticed: null, asking: null, seen: [], visited: [stage.start.area],
    cleared: false, dead: false, deaths: [], checkpoint: null,
    last: '방송을 막 시작했다', history: [],
  };
  saveCheckpoint(s);
  return s;
}
function saveCheckpoint(s) { s.checkpoint = { area: s.area, entry: s.entry, flags: { ...s.flags }, inv: [...s.inv] }; }

// 죽은 뒤 체크포인트(마지막으로 들어온 안전한 구역의 입구)로 되돌린다. 죽은 기억(deaths, history)은 남긴다.
export function respawn(stage, s) {
  const c = s.checkpoint;
  Object.assign(s, { area: c.area, entry: c.entry, flags: { ...c.flags }, inv: [...c.inv], at: null, near: null, noticed: null, asking: null, dead: false });
  s.last = `쓰러졌다가 ${areaName(stage, s.area)}에서 다시 일어났다`;
}

/* ── 조건 ──
   'flag' / '!flag'          : 플래그가 켜져 있다 / 꺼져 있다
   'has:아이템' / '!has:아이템' : 인벤토리에 있다 / 없다
   'at:오브젝트id'             : 지금 그 오브젝트 앞에 있다
   'area:구역id'               : 지금 그 구역에 있다
   'dead:N'                   : N번 이상 죽었다 */
export function cond(s, c) {
  const neg = c.startsWith('!'), k = neg ? c.slice(1) : c;
  let v;
  if (k.startsWith('has:')) v = s.inv.includes(k.slice(4));
  else if (k.startsWith('at:')) v = s.at === k.slice(3);
  else if (k.startsWith('area:')) v = s.area === k.slice(5);
  else if (k.startsWith('dead:')) v = s.deaths.length >= Number(k.slice(5));
  else v = !!s.flags[k];
  return neg ? !v : v;
}
export const all = (s, list) => [].concat(list || []).every(c => cond(s, c));

/* ── 조회 ── */
export const areaName = (stage, id) => stage.areas[id]?.name || id;
export const objectById = (stage, id) => stage.objects.find(o => o.id === id);
export const objectsIn = (stage, s, area = s.area) => stage.objects.filter(o => o.area === area && all(s, o.showIf));
// desc: 문자열 또는 [[조건, 문장], ..., 기본 문장]
export function describe(s, o) {
  if (!Array.isArray(o.desc)) return o.desc;
  for (const d of o.desc) { if (typeof d === 'string') return d; if (all(s, d[0])) return d[1]; }
  return '';
}
const josa = (word, a, b) => {
  const c = word.charCodeAt(word.length - 1) - 0xac00, jong = c >= 0 && c < 11172 ? c % 28 : 0;
  if (a === '으로' && jong === 8) return b;          // 받침이 ㄹ이면 '로'(오솔길로, 출구로)
  return jong ? a : b;
};

/* ── 행동 처리 ──
   규칙(rule) 형식: { target, on, item, if, do, say }
   on  : 'interact'(기본. 클리어·구역 이동 규칙은 move도) | 'move' | 'pickup' | 'use' | 'any' 또는 배열
   do  : 'set:플래그' 'unset:플래그' 'give:아이템키' 'take:아이템이름' 'goto:구역[@입구]'
         'enemy:적id' 'die:사유' 'clear'
   오브젝트에 exit: '구역[@입구]' 이 있으면 그 오브젝트로 가거나 만지면 구역을 옮기는 규칙이 자동으로 붙는다. */
function rulesOf(stage) {
  if (!stage._rules) {
    const auto = stage.objects.filter(o => o.exit).map(o => ({
      target: o.id, on: ['move', 'interact'], if: o.exitIf, do: [`goto:${o.exit}`],
      say: o.exitSay || `${o.name}${josa(o.name, '으로', '로')} 들어갔다`,
    }));
    Object.defineProperty(stage, '_rules', { value: [...(stage.rules || []), ...auto], enumerable: false });
  }
  return stage._rules;
}
// on을 생략한 규칙: 클리어나 구역 이동을 일으키면 "그쪽으로 가기"(move)에도 반응한다.
// 열린 문에 "나가"라고 하면 AI는 대개 move를 고르기 때문이다.
const defaultOn = r => [].concat(r.do || []).some(d => d === 'clear' || d.startsWith('goto:')) ? ['interact', 'move'] : 'interact';
function matches(r, a, o, s) {
  if ([].concat(r.target).indexOf(o.id) < 0) return false;
  const on = [].concat(r.on || defaultOn(r));
  if (!on.includes('any') && !on.includes(a.type)) return false;
  if (r.item && a.item !== r.item) return false;
  return all(s, r.if);
}

// 함정: 규칙에 die·enemy가 있는 오브젝트(또는 approach: true). approach: false로 끌 수 있다.
export const isTrap = (stage, o) => o.approach ?? rulesOf(stage).some(r => [].concat(r.target).includes(o.id) && [].concat(r.do || []).some(d => /^(die|enemy)(:|$)/.test(d)));

// 죽음 학습 2단계: 쓰러지게 한 물건과 '비슷한' 물건(같은 kind, 예: chest)을 찾는다. 있으면 그 물건 이름을 돌려준다
export function alikeKiller(stage, s, o) {
  if (!o.kind || o.kind === 'spot') return null;
  for (const d of s.deaths) {
    if (!d.objId || d.objId === o.id) continue;
    const k = objectById(stage, d.objId);
    if (k && k.kind === o.kind) return k.name;
  }
  return null;
}

export function perform(stage, s, a) {
  const effects = [];
  if (s.cleared || s.dead) return { result: '지금은 움직일 수 없다', effects };
  // explore: 정한 대상 없이 구역 안을 돌아다니며 둘러본다(화면에서 배회 지점으로 걷는다)
  // 굴러오는 위험이 있는 구역에서는 둘러보러 나가지 않고 그 자리에서 고개만 돌린다(틈새에서 나와 맞는 일이 있었다)
  if (a.type === 'explore' && stage.areas[s.area]?.hazard) return { result: '무서워서 그 자리에서 고개만 내밀고 주변을 둘러봤다', effects };
  if (a.type === 'explore') { s.at = null; s.near = '구역 안을 돌아다니며 둘러보는 중'; return { result: '주변을 두리번거리며 돌아다녔다', effects: [{ type: 'explore' }] }; }
  const o = objectsIn(stage, s).find(v => v.id === a.target);
  if (a.type === 'idle' || !o) return { result: '제자리에 서 있다', effects };

  // 위험 앞 한 박자: 함정은 멀리서 바로 건드리지 못하고 먼저 다가가기만 한다.
  // 플레이어가 "멈춰!"라고 말릴 수 있는 턴을 하나 보장하기 위해서다.
  const approach = isTrap(stage, o) && s.at !== o.id;
  effects.push({ type: 'moveTo', obj: o.id });
  s.at = o.id; s.near = null;
  // 바로 옆(1.3m 안)에 있는 물건도 함께 가까이서 본 것으로 친다(책상 위 열쇠를 주웠으면 책상도 본 것)
  for (const v of objectsIn(stage, s)) if (!s.seen.includes(v.id) && (v === o || Math.hypot(v.pos[0] - o.pos[0], v.pos[2] - o.pos[2]) < 1.3)) s.seen.push(v.id);
  if (approach) {
    const n = o.name;
    return { result: a.type === 'move' ? `${n} 바로 앞까지 다가갔다` : `${n} 바로 앞까지 다가갔다. 이제 손만 뻗으면 된다`, effects };
  }

  if (a.type === 'use' && (!a.item || !s.inv.includes(a.item))) return { result: '그런 아이템은 갖고 있지 않다', effects };

  // 죽음 학습 2단계: 쓰러지게 한 물건과 비슷한 물건은 처음 손댈 때 멈칫하고 시청자에게 묻는다. 한 번 물은 뒤에는 손댄다
  const alike = a.type !== 'move' && alikeKiller(stage, s, o);
  if (alike && !(s.wary ||= []).includes(o.id)) {
    s.wary.push(o.id);
    const q = `${o.name}${josa(o.name, '이', '가')} 아까 ${alike}${josa(alike, '이랑', '랑')} 비슷하게 생겼어… 이것도 함정 아니야? 만져도 돼?`;
    s.asking = q; effects.push({ type: 'ask', text: q });
    return { result: `${o.name}에 손을 뻗다가 멈칫했다. 아까 쓰러지게 한 ${alike}${josa(alike, '과', '와')} 비슷하게 생겼다`, effects };
  }

  const r = rulesOf(stage).find(r => matches(r, a, o, s));
  if (!r) {
    const n = o.name;
    const result = a.type === 'move' ? `${n} 앞으로 갔다`
      : a.type === 'pickup' ? `${n}${josa(n, '은', '는')} 주울 수 없다`
      : a.type === 'use' ? `${a.item}${josa(a.item, '을', '를')} ${n}에 써 봤지만 아무 일도 일어나지 않았다`
      : (o.poke || `${n}${josa(n, '을', '를')} 만져 봤지만 아무 일도 없다`);
    if (a.type !== 'move') effects.push({ type: 'act', kind: a.type, obj: o.id });
    return { result, effects };
  }

  if (a.type !== 'move') effects.push({ type: 'act', kind: a.type, obj: o.id });
  if (r.sfx) effects.push({ type: 'sfx', ids: [].concat(r.sfx) });   // 규칙에 붙인 소리(예: 'correct:1', 'gate')
  applyDo(stage, s, r.do, effects, o);
  effects.push({ type: 'render' });
  return { result: r.say || `${o.name}에 무언가 했다`, effects };
}

// 규칙의 do 목록을 실행한다(구역에 처음 들어갈 때의 enter.do도 같은 함수를 쓴다)
function applyDo(stage, s, list, effects, o) {
  for (const d of [].concat(list || [])) {
    const [cmd, arg = ''] = d.split(/:(.*)/s);
    if (cmd === 'set') s.flags[arg] = true;
    else if (cmd === 'unset') s.flags[arg] = false;
    else if (cmd === 'give') { const it = stage.items[arg]; s.inv.push(it.name); effects.push({ type: 'gain', item: arg }); }
    else if (cmd === 'take') { const i = s.inv.indexOf(arg); if (i >= 0) s.inv.splice(i, 1); effects.push({ type: 'lose', item: arg }); }
    else if (cmd === 'goto') {
      const [area, entry = 'start'] = arg.split('@');
      s.area = area; s.entry = entry; s.at = null; s.near = null; s.noticed = null;
      if (stage.areas[area]?.checkpoint !== false) saveCheckpoint(s);   // 위험 구역은 체크포인트로 삼지 않는다
      effects.push({ type: 'goto', area, entry });
      if (!s.visited.includes(area)) { s.visited.push(area); applyDo(stage, s, stage.areas[area]?.enter?.do, effects, o); }
    }
    else if (cmd === 'enemy') effects.push({ type: 'enemy', enemy: arg, obj: o?.id });
    else if (cmd === 'die') { s.dead = true; s.deaths.push({ area: s.area, obj: o?.name || '', objId: o?.id, reason: arg }); effects.push({ type: 'die', reason: arg }); }
    else if (cmd === 'clear') { s.cleared = true; effects.push({ type: 'clear' }); }
    // ask: 한별이 시청자에게 묻고, 대답이 올 때까지 스스로 움직이지 않는다
    // checkpoint: 지금까지 한 일(플래그·아이템)을 저장한다. 죽으면 이 구역 입구에서, 이 상태로 다시 시작
    else if (cmd === 'checkpoint') saveCheckpoint(s);
    else if (cmd === 'ask') { s.asking = arg; effects.push({ type: 'ask', text: arg }); }
    // puff: 화면 연출만. 대상(촛대)에 불이 잠깐 붙었다가 꺼진다(오답이어도 '붙긴 붙었다'가 보이게). 규칙 판정에는 영향 없음
    // pop: 화면 연출만. 대상(가짜 문)에서 깜짝 장난감이 튀어나왔다 들어간다
    else if (cmd === 'puff' || cmd === 'pop') effects.push({ type: cmd, obj: o?.id });
    // react:감정:대사1|대사2 — 화면 연출만. 그 순간 한별의 표정과 말풍선(후보 중 하나)이 바로 바뀐다(AI 턴을 기다리지 않는 즉각 반응)
    else if (cmd === 'react') { const i = arg.indexOf(':'); effects.push({ type: 'react', emo: arg.slice(0, i), lines: arg.slice(i + 1).split('|') }); }
  }
}

// 규칙 밖에서 일어난 죽음(굴러온 바위 같은 실시간 위험)
export function kill(stage, s, reason, what = '') {
  s.dead = true; s.at = null; s.deaths.push({ area: s.area, obj: what, reason });
}

/* ── 죽음에서 배운 것 ──
   한별은 쓰러진 이유를 기억하고, 같은 실수는 피하려 한다(퍼즐의 답을 알려 주지는 않는다: "무엇이 위험한가"만 배운다).
   - 오브젝트 때문에 죽었으면: 그 오브젝트 설명 옆에 경고가 붙는다
   - 주기 위험(바위·통)에 맞았으면: 구역의 hazard.lesson(없으면 기본 문장) */
export function lessonOf(stage, d) {
  if (d.objId) return `${d.obj}${josa(d.obj, '은', '는')} 함정이다. 다시는 손대지 않는다`;
  return stage.areas[d.area]?.hazard?.lesson || '굴러오는 소리가 날 때 길 한가운데에 있으면 맞는다. 소리가 나면 틈새에 숨고, 지나간 뒤에 움직인다';
}

/* ── 화면 기준 방향 ──
   오브젝트 설명(desc)의 "왼쪽 앞" 같은 말은 구역에 처음 들어와 섰을 때 기준이다. 다른 입구로 돌아오거나 몸을 돌리면 달라진다
   (스테이지 2: 덤불 길에서 공터로 돌아와 "지금 위치에서 왼쪽 길"이라고 하니, 처음 기준의 왼쪽=나무 길로 갔다).
   그래서 AI를 부를 때마다 지금 화면(카메라)에서 본 방향을 오브젝트마다 붙인다. pose: { x, z, fx, fz }(view3d.pose) */
export function relDir(pose, pos) {
  const dx = pos[0] - pose.x, dz = pos[2] - pose.z, dist = Math.hypot(dx, dz);
  if (dist < 1.6) return '바로 앞';
  const ahead = dx * pose.fx + dz * pose.fz, right = dx * -pose.fz + dz * pose.fx;
  const ang = Math.atan2(right, ahead) * 180 / Math.PI, side = ang > 0 ? '오른쪽' : '왼쪽', a = Math.abs(ang);
  const dir = a < 25 ? '정면' : a < 65 ? `${side} 앞` : a < 115 ? side : a < 155 ? `${side} 뒤` : '뒤';
  return `${dir} ${Math.round(dist)}m`;
}

/* ── AI에게 줄 상황 정보 ── */
export function promptContext(stage, s, pose = null) {
  const killed = new Set(s.deaths.map(d => d.objId).filter(Boolean));
  const alikeTag = o => { const k = !killed.has(o.id) && alikeKiller(stage, s, o); return k ? ` (⚠ 전에 쓰러지게 한 ${k}${josa(k, '과', '와')} 비슷하게 생겼다. 손대기 전에 시청자에게 물어본다)` : ''; };
  // 통로(exit)는 어디로 이어지는지와 그곳에 있는 물건을 붙인다: 곁방에서는 대전당의 철창문이 안 보여 어디로 가야 할지 몰랐다(스테이지 4)
  const leadsTo = o => {
    if (!o.exit) return '';
    // 함정(황금 상자 등)은 적지 않는다: 이 안내가 또 하나의 유혹이 되지 않게
    const area = o.exit.split('@')[0], names = [...new Set(objectsIn(stage, { ...s, area }).filter(v => !v.exit && !isTrap(stage, v)).map(v => v.name))].slice(0, 6);
    return ` → ${areaName(stage, area)}${names.length ? `(${names.join('·')}${josa(names.at(-1), '이', '가')} 있는 곳)` : ''}`;
  };
  const where = o => pose && o.pos ? ` [지금 화면 기준: ${relDir(pose, o.pos)}]` : '';
  const objs = objectsIn(stage, s).map(o => `- ${o.id}: ${describe(s, o)}${where(o)}${leadsTo(o)}${s.seen.includes(o.id) ? '' : ' (아직 가까이서 안 봄)'}${killed.has(o.id) ? ' (⚠ 전에 이걸 건드렸다가 쓰러졌다)' : alikeTag(o)}`);
  const at = s.at ? objectById(stage, s.at)?.name + ' 앞' : (s.near || '입구 근처');
  const n = s.noticed && objectsIn(stage, s).find(o => o.id === s.noticed);
  return {
    goal: stage.goal,
    location: `${areaName(stage, s.area)} · ${at}`,
    note: [stage.aiNote, stage.areas[s.area]?.aiNote].filter(Boolean).join(' '),
    scenery: stage.areas[s.area]?.scenery || '',
    asking: s.asking || '',
    objects: objs.join('\n'),
    inventory: s.inv.join(', ') || '비어 있음',
    last: s.last,
    noticed: n ? `${n.id}: ${describe(s, n)}` : '',
    history: s.history.join('\n') || '없음',
    done: (s.done || []).filter(d => d.set.every(f => s.flags[f]) && d.unset.every(f => !s.flags[f])).slice(-6).map(d => `- ${d.text}`).join('\n'),
    heard: (s.heard || []).filter(h => Date.now() - h.at < 150000).map((h, i, a) => i === a.length - 1 && a.length > 1 ? `${h.text}  ← 가장 최근` : h.text).join('\n'),
    deaths: s.deaths.length
      ? s.deaths.map((d, i) => `- ${i + 1}번째: ${areaName(stage, d.area)}의 ${d.obj} 쪽에서 ${d.reason} → 배운 것: ${lessonOf(stage, d)}`).join('\n')
      : '없음',
  };
}
