/* 스테이지 자동 검증 도구
   실행:  node tools/validate.mjs            (모든 스테이지)
          node tools/validate.mjs stage1     (특정 스테이지)
          node tools/validate.mjs --write    (결과를 docs/validation/<id>.md 로도 저장)

   검사 항목
   1. 구조   : 참조하는 구역·입구·오브젝트·아이템·적·모델 파일이 실제로 있는가, 켜지지 않는 플래그를 조건으로 쓰는가
   2. 배치   : 오브젝트·설 자리·입구가 구역 안에 있는가, 설 자리가 다른 물건과 겹치지 않는가
   3. 시나리오: 정답 경로(solution)로 클리어되는가, tests의 기대 결과가 맞는가
   4. 전수 탐색: 가능한 모든 행동을 따라가며 클리어 가능 여부, 막다른 상태(클리어 불가), 함정(사망) 수를 센다 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const core = await imp('js/core.js');
const { PACK, modelUrl } = await imp('js/packs.js');
const { STAGES, EXTRA } = await imp('js/stages/index.js');

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const only = args.filter(a => !a.startsWith('--'));
const targets = [...STAGES, ...EXTRA].filter(s => !only.length || only.includes(s.id));
if (!targets.length) { console.error('해당 id의 스테이지가 없습니다:', only.join(', ')); process.exit(2); }

const fileExists = (pack, name) => !!PACK[pack] && fs.existsSync(path.join(ROOT, modelUrl(pack, name)));
const fmt = a => `${a.type}${a.target ? ' ' + a.target : ''}${a.item ? ` [${a.item}]` : ''}`;

let failed = false;
for (const stage of targets) {
  const err = [], warn = [], info = [];
  const E = m => err.push(m), W = m => warn.push(m), I = m => info.push(m);
  const areas = stage.areas || {}, objs = stage.objects || [], items = stage.items || {};
  const itemNames = new Set(Object.values(items).map(i => i.name));

  /* ── 1. 구조 ── */
  const areaEntry = (spec, where) => {
    const [a, e] = spec.split('@');
    if (!areas[a]) return E(`${where}: 없는 구역 '${a}'`);
    if (e && !areas[a].entries?.[e]) E(`${where}: 구역 '${a}'에 입구 '${e}'가 없음`);
  };
  areaEntry(`${stage.start?.area}@${stage.start?.entry}`, 'start');
  for (const [id, a] of Object.entries(areas)) {
    if (!a.env) E(`구역 ${id}: env 없음`);
    if (!a.entries || !Object.keys(a.entries).length) E(`구역 ${id}: 입구(entries) 없음`);
    if (a.env?.floor && !fileExists(a.env.floor.pack, a.env.floor.name)) E(`구역 ${id}: 바닥 모델 없음 ${a.env.floor.pack}/${a.env.floor.name}`);
    for (const [p, n] of a.decor || []) if (!fileExists(p, n)) E(`구역 ${id}: 장식 모델 없음 ${p}/${n}`);
  }
  const ids = new Set();
  for (const o of objs) {
    const w = `오브젝트 ${o.id}`;
    if (ids.has(o.id)) E(`${w}: id 중복`); ids.add(o.id);
    if (!areas[o.area]) E(`${w}: 없는 구역 '${o.area}'`);
    for (const k of ['name', 'desc']) if (!o[k]) E(`${w}: ${k} 없음`);
    if (o.pos?.length !== 3 || o.stand?.length !== 2 || o.look?.length !== 3) E(`${w}: pos(3)·stand(2)·look(3) 좌표 확인`);
    if (o.model?.name && !fileExists(o.model.pack, o.model.name)) E(`${w}: 모델 파일 없음 ${o.model.pack}/${o.model.name}`);
    if (!o.model?.name && !['lever', 'sign'].includes(o.kind)) E(`${w}: model이 없고 코드로 만드는 kind(lever·sign)도 아님`);
    if (o.exit) areaEntry(o.exit, `${w}.exit`);
  }
  for (const [id, en] of Object.entries(stage.enemies || {})) if (!fileExists(en.model.pack, en.model.name)) E(`적 ${id}: 모델 파일 없음`);

  const setFlags = new Set(Object.keys(stage.flags || {}));
  for (const r of stage.rules || []) for (const d of [].concat(r.do || [])) if (d.startsWith('set:')) setFlags.add(d.slice(4));
  const checkConds = (list, where) => {
    for (const c of [].concat(list || [])) {
      const k = c.replace(/^!/, '');
      if (k.startsWith('has:')) { if (!itemNames.has(k.slice(4))) E(`${where}: 조건 '${c}'의 아이템이 items에 없음`); }
      else if (k.startsWith('at:')) { if (!ids.has(k.slice(3))) E(`${where}: 조건 '${c}'의 오브젝트가 없음`); }
      else if (k.startsWith('area:')) { if (!stage.areas[k.slice(5)]) E(`${where}: 조건 '${c}'의 구역이 없음`); }
      else if (k.startsWith('dead:')) { if (!(Number(k.slice(5)) >= 1)) E(`${where}: 조건 '${c}'의 횟수가 숫자가 아님`); }
      else if (!setFlags.has(k) && !c.startsWith('!')) W(`${where}: 플래그 '${k}'를 켜는 규칙이 없어 이 조건은 항상 거짓`);
    }
  };
  for (const o of objs) { checkConds(o.showIf, `오브젝트 ${o.id}.showIf`); checkConds(o.exitIf, `오브젝트 ${o.id}.exitIf`); }
  (stage.viewers?.script || []).forEach((v, i) => {
    const w = `시청자 대본 #${i + 1}`;
    if (!['troll', 'helper', 'crowd'].includes(v.role)) E(`${w}: role은 troll·helper·crowd 중 하나`);
    if (!v.text) E(`${w}: text 없음`);
    checkConds(v.when, w);
  });
  (stage.rules || []).forEach((r, i) => {
    const w = `규칙 #${i + 1}(${[].concat(r.target).join(',')})`;
    for (const t of [].concat(r.target)) if (!ids.has(t)) E(`${w}: 없는 오브젝트 '${t}'`);
    if (r.item && !itemNames.has(r.item)) E(`${w}: 아이템 '${r.item}'이 items에 없음`);
    checkConds(r.if, w);
    for (const d of [].concat(r.do || [])) {
      const [cmd, arg = ''] = d.split(/:(.*)/s);
      if (cmd === 'give' && !items[arg]) E(`${w}: give '${arg}' — items에 없는 키`);
      if (cmd === 'take' && !itemNames.has(arg)) E(`${w}: take '${arg}' — items에 없는 이름`);
      if (cmd === 'goto') areaEntry(arg, w);
      if (cmd === 'enemy' && !stage.enemies?.[arg]) E(`${w}: 없는 적 '${arg}'`);
      if (!['set', 'unset', 'give', 'take', 'goto', 'enemy', 'die', 'clear'].includes(cmd)) E(`${w}: 모르는 명령 '${d}'`);
    }
    if (!r.say) W(`${w}: say(결과 문장) 없음 — AI가 무슨 일이 일어났는지 알 수 없다`);
  });

  /* ── 2. 배치 ── */
  for (const [aid, a] of Object.entries(areas)) {
    const hw = (a.env?.w || 0) / 2, hd = (a.env?.d || 0) / 2;
    const inside = (x, z, m = 0) => Math.abs(x) <= hw - m && Math.abs(z) <= hd - m;
    for (const [eid, en] of Object.entries(a.entries || {})) if (!inside(en.pos[0], en.pos[1], 0.3)) W(`구역 ${aid} 입구 ${eid}: 구역 밖`);
    const here = objs.filter(o => o.area === aid);
    for (const o of here) {
      if (!inside(o.pos[0], o.pos[2], -0.05)) W(`오브젝트 ${o.id}: 위치가 구역 밖`);
      if (!inside(o.stand[0], o.stand[1], 0.3)) W(`오브젝트 ${o.id}: 설 자리가 구역 밖(또는 벽에 너무 붙음)`);
      for (const p of here) {
        if (p === o || p.solid === false || p.pos[1] > 0.5) continue;
        const d = Math.hypot(o.stand[0] - p.pos[0], o.stand[1] - p.pos[2]);
        if (d < 0.6) W(`오브젝트 ${o.id}: 설 자리가 ${p.id}와 겹침(${d.toFixed(2)}m)`);
      }
      for (const [, n, pos] of a.decor || []) {
        const d = Math.hypot(o.stand[0] - pos[0], o.stand[1] - pos[2]);
        if (d < 0.7) W(`오브젝트 ${o.id}: 설 자리가 장식 ${n}와 겹침(${d.toFixed(2)}m)`);
      }
    }
  }

  /* ── 3. 시나리오 ── */
  const run = actions => {
    const s = core.createState(stage), log = [];
    for (const a of actions) {
      const { result } = core.perform(stage, s, a);
      log.push(`${fmt(a)} → ${result}`);
      if (s.dead) { s.wasDead = true; core.respawn(stage, s); }
    }
    return { s, log };
  };
  if (!stage.solution?.length) W('solution(정답 경로)이 없어 정답 검증을 건너뜀');
  else {
    const { s, log } = run(stage.solution);
    if (!s.cleared) { E('정답 경로로 클리어되지 않음'); log.forEach(l => I('  ' + l)); }
    else if (s.deaths.length) E('정답 경로 중에 죽음');
    else I(`정답 경로 ${stage.solution.length}수로 클리어 ✔`);
  }
  for (const t of stage.tests || []) {
    const { s, log } = run(t.actions), x = t.expect || {}, bad = [];
    if ('cleared' in x && s.cleared !== x.cleared) bad.push(`cleared=${s.cleared}`);
    if ('dead' in x && !!s.wasDead !== x.dead) bad.push(`dead=${!!s.wasDead}`);
    if (x.area && s.area !== x.area) bad.push(`area=${s.area}`);
    for (const c of [].concat(x.flag || [])) if (!core.cond(s, c)) bad.push(`조건 ${c} 불만족`);
    if (bad.length) { E(`테스트 실패: ${t.name} (${bad.join(', ')})`); log.forEach(l => I('  ' + l)); }
    else I(`테스트 통과 ✔ ${t.name}`);
  }

  /* ── 4. 전수 탐색 ── */
  const usesAt = JSON.stringify(stage).includes('"at:') || JSON.stringify(stage).includes("'at:")
    || stage.objects.some(o => core.isTrap(stage, o));   // 함정은 "앞에 있는가"에 따라 결과가 달라진다
  const key = s => [s.area, s.cleared ? 'C' : '', Object.keys(s.flags).filter(k => s.flags[k]).sort().join(','), [...s.inv].sort().join(','), usesAt ? s.at : ''].join('|');
  const start = core.createState(stage);
  const nodes = new Map([[key(start), { s: start, from: null, act: null, next: [] }]]);
  const queue = [key(start)]; let deathEdges = 0; const deathSpots = new Set(); let truncated = false;
  while (queue.length) {
    if (nodes.size > 20000) { truncated = true; break; }
    const k = queue.shift(), node = nodes.get(k);
    if (node.s.cleared) continue;
    const acts = [];
    for (const o of core.objectsIn(stage, node.s)) {
      for (const type of ['move', 'interact', 'pickup']) acts.push({ type, target: o.id });
      for (const it of new Set(node.s.inv)) acts.push({ type: 'use', target: o.id, item: it });
    }
    for (const a of acts) {
      const s2 = structuredClone(node.s); s2.history = []; s2.deaths = []; s2.seen = [];
      core.perform(stage, s2, a);
      if (s2.dead) { deathEdges++; deathSpots.add(`${core.areaName(stage, node.s.area)} · ${fmt(a)}`); core.respawn(stage, s2); }
      const k2 = key(s2);
      node.next.push(k2);
      if (!nodes.has(k2)) { nodes.set(k2, { s: s2, from: k, act: a, next: [] }); queue.push(k2); }
    }
  }
  const pathTo = k => { const p = []; for (let n = nodes.get(k); n?.act; n = nodes.get(n.from)) p.unshift(fmt(n.act)); return p; };
  const clears = [...nodes.entries()].filter(([, n]) => n.s.cleared).map(([k]) => k);
  if (truncated) W('상태가 너무 많아 전수 탐색을 2만 개에서 멈춤');
  if (!clears.length) E('어떤 행동 순서로도 클리어할 수 없음');
  else {
    // 거꾸로 따라가며 클리어에 닿을 수 있는 상태를 표시
    const prev = new Map(); for (const [k, n] of nodes) for (const k2 of n.next) (prev.get(k2) || prev.set(k2, []).get(k2)).push(k);
    const good = new Set(clears), st = [...clears];
    while (st.length) for (const p of prev.get(st.pop()) || []) if (!good.has(p)) { good.add(p); st.push(p); }
    const deadEnds = [...nodes.keys()].filter(k => !good.has(k));
    if (deadEnds.length) {
      E(`막다른 상태 ${deadEnds.length}개: 여기 빠지면 다시는 클리어할 수 없음`);
      deadEnds.slice(0, 3).forEach(k => I(`  예: ${pathTo(k).join(' → ') || '(시작)'}`));
    }
    const shortest = Math.min(...clears.map(k => pathTo(k).length));
    I(`도달 가능한 상태 ${nodes.size}개, 최단 클리어 ${shortest}수, 막다른 상태 ${deadEnds.length}개`);
  }
  I(`사망으로 이어지는 행동 ${deathSpots.size}종류${deathSpots.size ? ': ' + [...deathSpots].slice(0, 6).join(' / ') : ''}`);

  /* ── 결과 ── */
  const ok = !err.length;
  if (!ok) failed = true;
  const lines = [
    `## ${ok ? '✅' : '❌'} ${stage.id} — ${stage.title}`,
    ...err.map(m => `- ❌ ${m}`), ...warn.map(m => `- ⚠️ ${m}`), ...info.map(m => `- ${m}`), '',
  ];
  console.log(lines.join('\n'));
  if (WRITE) {
    const dir = path.join(ROOT, 'docs', 'validation'); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${stage.id}.md`), `# 검증 결과: ${stage.title}\n\n${new Date().toISOString().slice(0, 10)} · node tools/validate.mjs ${stage.id}\n\n${lines.slice(1).join('\n')}\n`);
  }
}
process.exit(failed ? 1 : 0);
