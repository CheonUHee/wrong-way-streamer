/* 스테이지 규칙 엔진(순수 로직: 화면·DOM을 쓰지 않는다).
   브라우저(stage.js)와 node 검증 도구(tools/validate.mjs)가 함께 쓴다.

   상태(state)는 스테이지 데이터와 분리된 평범한 객체라 복제·비교가 쉽다.
   perform()은 규칙을 즉시 판정하고, 화면이 재생할 effects 목록을 돌려준다. */

export const ACTION_TYPES = ['move', 'interact', 'pickup', 'use', 'idle'];

/* ── 상태 ── */
export function createState(stage) {
  const s = {
    stageId: stage.id, area: stage.start.area, entry: stage.start.entry,
    flags: { ...(stage.flags || {}) }, inv: [], at: null, seen: [],
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
  Object.assign(s, { area: c.area, entry: c.entry, flags: { ...c.flags }, inv: [...c.inv], at: null, dead: false });
  s.last = `쓰러졌다가 ${areaName(stage, s.area)} 입구에서 다시 일어났다`;
}

/* ── 조건 ──
   'flag' / '!flag'          : 플래그가 켜져 있다 / 꺼져 있다
   'has:아이템' / '!has:아이템' : 인벤토리에 있다 / 없다
   'at:오브젝트id'             : 지금 그 오브젝트 앞에 있다 */
export function cond(s, c) {
  const neg = c.startsWith('!'), k = neg ? c.slice(1) : c;
  let v;
  if (k.startsWith('has:')) v = s.inv.includes(k.slice(4));
  else if (k.startsWith('at:')) v = s.at === k.slice(3);
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
const josa = (word, a, b) => { const c = word.charCodeAt(word.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? a : b; };

/* ── 행동 처리 ──
   규칙(rule) 형식: { target, on, item, if, do, say }
   on  : 'interact'(기본) | 'move' | 'pickup' | 'use' | 'any' 또는 배열
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
function matches(r, a, o, s) {
  if ([].concat(r.target).indexOf(o.id) < 0) return false;
  const on = [].concat(r.on || 'interact');
  if (!on.includes('any') && !on.includes(a.type)) return false;
  if (r.item && a.item !== r.item) return false;
  return all(s, r.if);
}

export function perform(stage, s, a) {
  const effects = [];
  if (s.cleared || s.dead) return { result: '지금은 움직일 수 없다', effects };
  const o = objectsIn(stage, s).find(v => v.id === a.target);
  if (a.type === 'idle' || !o) return { result: '제자리에 서 있다', effects };

  effects.push({ type: 'moveTo', obj: o.id });
  s.at = o.id; if (!s.seen.includes(o.id)) s.seen.push(o.id);

  if (a.type === 'use' && (!a.item || !s.inv.includes(a.item))) return { result: '그런 아이템은 갖고 있지 않다', effects };

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
  for (const d of [].concat(r.do || [])) {
    const [cmd, arg = ''] = d.split(/:(.*)/s);
    if (cmd === 'set') s.flags[arg] = true;
    else if (cmd === 'unset') s.flags[arg] = false;
    else if (cmd === 'give') { const it = stage.items[arg]; s.inv.push(it.name); effects.push({ type: 'gain', item: arg }); }
    else if (cmd === 'take') { const i = s.inv.indexOf(arg); if (i >= 0) s.inv.splice(i, 1); effects.push({ type: 'lose', item: arg }); }
    else if (cmd === 'goto') {
      const [area, entry = 'start'] = arg.split('@');
      s.area = area; s.entry = entry; s.at = null;
      if (stage.areas[area]?.checkpoint !== false) saveCheckpoint(s);   // 위험 구역은 체크포인트로 삼지 않는다
      effects.push({ type: 'goto', area, entry });
    }
    else if (cmd === 'enemy') effects.push({ type: 'enemy', enemy: arg, obj: o.id });
    else if (cmd === 'die') { s.dead = true; s.deaths.push({ area: s.area, obj: o.name, reason: arg }); effects.push({ type: 'die', reason: arg }); }
    else if (cmd === 'clear') { s.cleared = true; effects.push({ type: 'clear' }); }
  }
  effects.push({ type: 'render' });
  return { result: r.say || `${o.name}에 무언가 했다`, effects };
}

/* ── AI에게 줄 상황 정보 ── */
export function promptContext(stage, s) {
  const objs = objectsIn(stage, s).map(o => `- ${o.id}: ${describe(s, o)}${s.seen.includes(o.id) ? '' : ' (아직 가까이서 안 봄)'}`);
  const at = s.at ? objectById(stage, s.at)?.name + ' 앞' : '입구 근처';
  return {
    goal: stage.goal,
    location: `${areaName(stage, s.area)} · ${at}`,
    objects: objs.join('\n'),
    inventory: s.inv.join(', ') || '비어 있음',
    last: s.last,
    history: s.history.join('\n') || '없음',
    deaths: s.deaths.length
      ? s.deaths.map((d, i) => `- ${i + 1}번째: ${areaName(stage, d.area)}의 ${d.obj} 쪽에서 ${d.reason}`).join('\n')
      : '없음',
  };
}
