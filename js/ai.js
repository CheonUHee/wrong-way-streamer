/* AI 스트리머 두뇌: 설정(API 키 · 모델), 프롬프트, Gemini 호출, 키가 없을 때의 더미 응답 */
import { $, addLine, pick } from './ui.js';
import { context, visibleObjects, state } from './stage.js';

let onConfigChange = () => {};
export const setOnConfigChange = fn => { onConfigChange = fn; };

/* ── 설정(API 키 · 모델 · 프록시) ── */
export const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
export const cfg = { key: '', model: DEFAULT_MODEL, proxy: '' };
try { Object.assign(cfg, JSON.parse(localStorage.getItem('wws.cfg') || '{}')); } catch {}
if (!cfg.model || cfg.model === 'gemini-3.5-flash-lite') cfg.model = DEFAULT_MODEL;   // 이전 기본값으로 저장된 설정을 새 기본값으로 교체
// 주소 뒤에 ?ai=off 를 붙이면 키가 저장돼 있어도 더미 응답으로 동작한다(개발·테스트용, 비용 없음)
const FORCE_OFF = new URLSearchParams(location.search).get('ai') === 'off';
export const aiOn = () => !FORCE_OFF && !!(cfg.key || cfg.proxy);
function refreshChip() {
  $('aiChip').textContent = aiOn() ? `AI 켜짐 · ${cfg.model}` : 'AI 꺼짐 (더미 응답)';
  $('aiChip').classList.toggle('on', aiOn());
}
$('settingsBtn').onclick = () => {
  $('cfgKey').value = cfg.key; $('cfgModel').value = cfg.model; $('cfgProxy').value = cfg.proxy;
  $('settings').showModal();
};
$('cfgCancel').onclick = () => $('settings').close();
$('cfgSave').onclick = () => {
  cfg.key = $('cfgKey').value.trim(); cfg.model = $('cfgModel').value.trim() || DEFAULT_MODEL; cfg.proxy = $('cfgProxy').value.trim();
  try { localStorage.setItem('wws.cfg', JSON.stringify(cfg)); } catch {}
  $('settings').close(); refreshChip(); onConfigChange();
  addLine(aiOn() ? 'AI 스트리머가 연결되었습니다.' : 'AI가 꺼져 더미 응답으로 동작합니다.', 'sys');
};
refreshChip();

export const EMOS = ['normal', 'happy', 'shout', 'angry', 'sad'];
export const SYSTEM = `너는 인터넷 방송 플랫폼 '지지직(Zizizik)'에서 3D 퍼즐 게임을 생방송 중인 스트리머 '한별'이다.

[성격] 중학생 나이대. 호기심이 주체할 수 없을 정도로 강하고 덤벙거리는 4차원 성격이다. 길고양이나 강아지처럼, 새로운 물체나 반짝이는 것, 움직이는 것이 눈에 들어오면 하던 퍼즐을 까먹고 본능적으로 다가가 확인해야 직성이 풀린다. 아직 가까이서 안 본 물체일수록 끌리고, 한 번 확인한 물건에는 흥미가 금방 식는다.
[말투]
- 활기차고 털털한 반말. 귀여움과 보이시함이 섞인 중성적인 말투로, 자신을 '나'라고 부른다. 애교 섞인 어미(~용, ~당, ~쪄)는 쓰지 않는다.
- 기본은 한국어로만 말한다. 대부분의 대사에는 영어가 전혀 없다.
- 가끔, 감정이 크게 고조되거나 호기심이 발동한 순간에만 엉뚱한 영어 단어나 짧은 구문을 한글 표기로 하나 터뜨린다. 예: 왓츠 댓?!, 레츠 고!, 오케이, 오케이!, 노 프로블럼!, 헬프 미!, 체크 잇 아웃!, 웨잇 어 미닛!
- 영어 추임새를 쓸지는 매 턴 [말투 지시]를 따른다. 금지된 턴에는 한글로 표기한 영어 표현을 한 단어도 쓰지 않는다. 직전 대사에 쓴 표현은 다시 쓰지 않는다.
- 시청자를 '채팅창' 또는 '너희들'이라고 부르며 친근하게 주고받는다.
- 대사는 생방송 리액션처럼 짧고 속도감 있게. 40자 이내, 한두 문장.
[상황] 너는 이 게임의 정답을 모른다. 화면에 보이는 것, 직전 행동의 결과, 시청자의 말만이 단서다. 스스로 퍼즐을 척척 풀지 않는다.
[시청자] 일반 채팅은 흘려 읽기도 한다. 후원 메시지는 반드시 읽고 반응한다. 구체적인 지시나 힌트를 받으면 투덜거리거나 감탄하면서도 대체로 따르지만, 모호한 지시는 엉뚱하게 해석한다. 시청자 말이 없으면 호기심이 끌리는 대로 행동한다.
[행동] 매 턴 하나만 고른다.
- move: target 앞으로 간다
- interact: target을 만지거나 열거나 당긴다
- pickup: target을 줍는다
- use: 인벤토리의 item을 target에 사용한다
- idle: 제자리에서 말만 한다
target은 '보이는 오브젝트'의 id 중 하나, item은 인벤토리에 있는 아이템 이름이어야 한다.
아치·통로·문처럼 다른 곳으로 이어지는 오브젝트로 move나 interact를 하면 그곳으로 넘어간다. 보이는 오브젝트는 지금 있는 구역의 것만이다.
[죽음] 이 게임에서는 위험한 곳에 가면 쓰러지고, 마지막으로 들어온 구역 입구에서 다시 시작한다. [죽은 기록]에 적힌 일은 기억하고 있어서 대사로 무서워하거나 억울해하지만, 호기심이 이기면 또 가 보고 싶어 하기도 한다. 시청자가 말리면 대체로 듣는다.
[출력] 아래 형식의 JSON 하나만 출력한다.
{"line": "스트리머 대사", "emotion": "normal|happy|shout|angry|sad", "action": {"type": "move|interact|pickup|use|idle", "target": "오브젝트 id 또는 null", "item": "아이템 이름 또는 null"}, "viewers": ["방금 장면에 대한 다른 시청자의 짧은 채팅 1~2개"]}`;

const ENGLISH_RATE = 0.3;           // 영어 추임새를 허용하는 턴의 비율(0~1). 낮출수록 드물게 나온다
export function buildPrompt(msgs) {
  const c = context();
  const chat = msgs.length ? msgs.map(m => `- (${m.kind === 'dona' ? '후원' : '채팅'}) ${m.text}`).join('\n') : '없음';
  return `[목표] ${c.goal}
[현재 위치] ${c.location}
[보이는 오브젝트]
${c.objects}
[인벤토리] ${c.inventory}
[직전 행동 결과] ${c.last}
[죽은 기록]
${c.deaths}
[최근 기록]
${c.history}
[방금 들어온 시청자 메시지]
${chat}
[말투 지시] ${Math.random() < ENGLISH_RATE ? '이번 대사에는 영어 추임새를 하나 써도 된다(어울리지 않으면 안 써도 된다).' : '이번 대사는 영어 추임새 없이 한국어로만 말한다.'}`;
}

export async function callGemini(system, user) {
  const url = cfg.proxy || `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const t0 = performance.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cfg.proxy ? {} : { 'x-goog-api-key': cfg.key }) },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 1, maxOutputTokens: 400 },
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    let msg = ''; try { msg = (await res.json()).error?.message || ''; } catch {}
    throw new Error(`${res.status} ${msg}`);
  }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  const u = data.usageMetadata || {};
  $('apiStat').textContent = `최근 호출: 입력 ${u.promptTokenCount ?? '?'} / 출력 ${u.candidatesTokenCount ?? '?'} 토큰 · ${((performance.now() - t0) / 1000).toFixed(1)}초`;
  return JSON.parse(text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
}

// API 키가 없을 때 쓰는 더미 두뇌: 대사와 행동을 무작위로 고른다.
const REPLIES = [
  ['오케이, 오케이! 레츠 고!', 'happy'], ['왓츠 댓?! 저거 뭐야?!', 'shout'], ['아 알았다니까! 가고 있잖아!', 'angry'],
  ['헬프 미... 뭘 해야 하는 거야...', 'sad'], ['음~ 이건가? 체크 잇 아웃!', 'normal'],
];
export function mockBrain() {
  const [line, emotion] = pick(REPLIES), objs = visibleObjects(), inv = state().inv;
  const o = pick(objs);
  const action = inv.length && Math.random() < 0.4
    ? { type: 'use', target: pick(objs).id, item: pick(inv) }
    : { type: pick(['move', 'interact', 'interact', 'pickup']), target: o?.id, item: null };
  return new Promise(ok => setTimeout(() => ok({ line, emotion, action, viewers: [] }), 700));
}
