/* AI 스트리머 두뇌: 설정(API 키 · 모델), 프롬프트, Gemini 호출, 키가 없을 때의 더미 응답 */
import { $, addLine, pick } from './ui.js';
import { context, visibleObjects, state } from './stage.js';
import { flag, RELAY } from './env.js';

let onConfigChange = () => {};
export const setOnConfigChange = fn => { onConfigChange = fn; };

/* ── 설정(API 키 · 모델 · 프록시) ── */
export const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
export const cfg = { key: '', model: DEFAULT_MODEL, proxy: '' };
try { Object.assign(cfg, JSON.parse(localStorage.getItem('wws.cfg') || '{}')); } catch {}
if (!cfg.model || cfg.model === 'gemini-3.5-flash-lite') cfg.model = DEFAULT_MODEL;   // 이전 기본값으로 저장된 설정을 새 기본값으로 교체
// 주소 뒤에 ?ai=off 를 붙이면 키가 저장돼 있어도 더미 응답으로 동작한다(개발·테스트용, 비용 없음)
const FORCE_OFF = flag('ai') === 'off';
// 중계 서버: 설정에 적은 프록시 > (키가 없을 때) 배포된 사이트의 /api/gemini. 내 컴퓨터에서는 RELAY가 비어 있어 키로 직접 부른다
const relay = () => cfg.proxy || (cfg.key ? '' : RELAY);
export const aiOn = () => !FORCE_OFF && !!(cfg.key || relay());
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
[시청자] 시청자는 여러 명이고 서로 다른 말을 한다. 진심으로 돕는 사람도, 일부러 엉뚱한 데로 보내는 장난꾼도 있지만 너는 누가 누군지 모른다.
- 후원 지시는 무조건 따른다. 투덜거리거나 딴 데 관심을 보이는 대사는 해도 되지만, action은 반드시 그 후원이 시킨 행동이어야 한다. 후원끼리 부딪치면 가장 나중에 온 후원을 따른다(금액은 상관없다).
- 채팅은 따를 수도 있고 호기심에 져서 무시할 수도 있다. 더 구체적이거나, 여러 명이 같은 말을 하거나, 호기심을 자극하는 쪽에 끌린다.
- "위험해", "멈춰", "거기 가지 마" 같은 경고 채팅을 받으면 겁을 먹고 대개 그 행동을 멈춘다. [죽은 기록]과 관련된 경고는 특히 잘 듣는다.
- 메시지가 여럿이면 그중 하나를 골라 따르고, 따르지 않은 의견은 대사로 짧게 언급해도 된다. 모호한 지시는 엉뚱하게 해석한다.
- 시청자 말이 없으면 호기심이 끌리는 대로 행동한다.
[행동] 매 턴 하나만 고른다.
- move: target 앞으로 간다
- interact: target을 만지거나 열거나 당긴다
- pickup: target을 줍는다
- use: 인벤토리의 item을 target에 사용한다
- explore: 정한 대상 없이 주변을 돌아다니며 둘러본다(target은 null). "둘러봐", "다른 데도 봐" 같은 지시나, 딱히 끌리는 게 없을 때
- idle: 제자리에서 말만 한다
target은 '보이는 오브젝트'의 id 중 하나, item은 인벤토리에 있는 아이템 이름이어야 한다. id(n1, btnWest 같은 영문 기호)는 action에만 쓰고, 대사(line)와 viewers에서는 "첫 번째 틈새"처럼 우리말 이름이나 생김새로 말한다.
interact·pickup·use는 멀리 있어도 알아서 걸어가서 한다. 시청자가 "켜", "눌러", "당겨", "열어", "만져"라고 하면 move가 아니라 interact를 고른다. move는 "~로 가", "~에 숨어"처럼 가기만 하라고 할 때 쓴다.
아치·통로·문처럼 다른 곳으로 이어지는 오브젝트로 move나 interact를 하면 그곳으로 넘어간다. 보이는 오브젝트는 지금 있는 구역의 것만이다.
[눈에 띈 것] 돌아다니다 [방금 눈에 띈 것]이 있으면 그쪽에 마음이 확 끌린다. 시청자가 말리지 않으면 대개 그걸 보러 간다.
[단서] 표지판·석판·명판에 쓰인 글씨나 그림은 읽을 수 있다. 하지만 그게 이곳의 어느 물건, 어느 쪽을 말하는지는 잘 모른다. 오브젝트 설명에 "무엇 옆"인지 적혀 있지 않으면 너는 그 짝을 모르는 것이다. 짐작으로 아무거나 누르지 말고, 대사로 채팅창에 "그게 어디 있는 거야?"라고 물어본다(action은 idle). 시청자가 위치를 알려 주면 그대로 따른다.
[주변 풍경] [주변 풍경]은 만질 수 있는 오브젝트가 아니다. 시청자 말이 없고 딱히 끌리는 게 없으면 풍경을 보고 감탄하거나 수다를 떤다(idle 또는 explore). 같은 물건에 계속 집착하지 않는다.
[죽음] 이 게임에서는 위험한 곳에 가면 쓰러지고, 마지막으로 들어온 구역 입구에서 다시 시작한다. [죽은 기록]의 "배운 것"은 확실히 기억한다. 같은 이유로 또 쓰러지지 않으려 한다: ⚠ 표시가 붙은 물건에는 스스로 손대지 않고, 채팅이 그쪽으로 보내면 "거기 아까 죽은 데잖아!" 하고 거절한다. 단, 후원 지시는 투덜대면서도 따른다. 배운 것은 "무엇이 위험한가"뿐이고, 퍼즐의 답을 알게 된 것은 아니다.
[출력] 아래 형식의 JSON 하나만 출력한다.
{"line": "스트리머 대사", "emotion": "normal|happy|shout|angry|sad", "action": {"type": "move|interact|pickup|use|explore|idle", "target": "오브젝트 id 또는 null", "item": "아이템 이름 또는 null"}, "viewers": ["방금 장면에 대한 다른 시청자의 짧은 채팅 1~2개"]}
viewers는 구경만 하는 시청자의 리액션이다(웃음, 감탄, 놀림, 응원). 어디로 가라·무엇을 하라는 지시나 힌트, 경고, 앞으로 일어날 일에 대한 예측은 절대 쓰지 않는다. 예: "ㅋㅋㅋ 또 딴 데 봄", "오리 귀엽다", "헐 방금 소리 뭐임"`;

const ENGLISH_RATE = 0.3;           // 영어 추임새를 허용하는 턴의 비율(0~1). 낮출수록 드물게 나온다
export function buildPrompt(msgs) {
  const c = context();
  const chat = msgs.length ? msgs.map(m => `- [${m.kind === 'dona' ? '후원' : '채팅'}] ${m.nick || '시청자'}: ${m.text}`).join('\n') : '없음';
  // 후원이 있으면 이번 턴에 따라야 할 후원을 코드에서 못 박는다(모델이 호기심을 핑계로 후원을 무시하는 일이 있어서)
  const lastDona = msgs.filter(m => m.kind === 'dona').at(-1);
  // "그 후원 무시해"처럼 앞선 후원을 막는 후원도 있다(스테이지 4 플레이테스트: 막는 후원을 받고도 앞선 방해꾼 후원대로 황금 상자를 열었다)
  const must = lastDona ? `\n[이번 턴 필수] ${lastDona.nick}의 후원 "${lastDona.text}"이 시킨 행동을 action으로 한다. 앞선 후원을 무시하라거나 하지 말라는 내용이면, 앞선 후원이 시킨 행동은 하지 않고 그 자리에서 기다리거나(idle) 이 후원이 말한 다른 행동을 한다.` : '';
  return `[목표] ${c.goal}
[현재 위치] ${c.location}
${c.note ? `[이곳의 특징] ${c.note}
` : ''}${c.scenery ? `[주변 풍경] ${c.scenery}
` : ''}[보이는 오브젝트]
${c.objects}
[인벤토리] ${c.inventory}${c.hazard === 'warn' || c.hazard === 'roll' ? `
[소리] 쿠르르릉! 위에서 무언가 굴러 내려오고 있다. 지금 길 위로 나가면 맞는다(틈새 안이면 그대로 있는 게 안전하다)` : ''}
[직전 행동 결과] ${c.last}
${c.noticed ? `[방금 눈에 띈 것] ${c.noticed}\n` : ''}[죽은 기록]
${c.deaths}
[최근 기록]
${c.history}
${c.done ? `[지금까지 해낸 일] (오래된 것부터. 이미 된 일은 다시 하러 가지 않는다. 시청자 말 중 이미 끝난 단계는 건너뛰고 다음 단계를 한다)
${c.done}
` : ''}${c.heard ? `[기억해 둔 시청자 말] (오래된 것부터. 길 안내·단서의 짝처럼 지금도 쓸 만한 말. 서로 다르면 나중 말을 믿는다. 여러 단계 지시는 아직 안 끝난 단계를 이어서 한다)
${c.heard}
` : ''}${c.asking ? `[질문 중] 너는 방금 시청자들에게 "${c.asking}"라고 물었다. 시청자의 대답을 듣고 그대로 정한다(대답이 갈리면 위의 시청자 규칙대로 고른다).
` : ''}[방금 들어온 시청자 메시지] (온 순서대로)
${chat}${must}
[말투 지시] ${Math.random() < ENGLISH_RATE ? '이번 대사에는 영어 추임새를 하나 써도 된다(어울리지 않으면 안 써도 된다).' : '이번 대사는 영어 추임새 없이 한국어로만 말한다.'}`;
}

export async function callGemini(system, user) {
  const url = relay() || `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const t0 = performance.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(relay() ? {} : { 'x-goog-api-key': cfg.key }) },
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
  const noticed = objs.find(v => v.id === state().noticed);
  const o = noticed && Math.random() < 0.7 ? noticed : pick(objs);
  const action = inv.length && Math.random() < 0.4
    ? { type: 'use', target: pick(objs).id, item: pick(inv) }
    : Math.random() < 0.15 ? { type: 'explore', target: null, item: null }
    : { type: pick(['move', 'interact', 'interact', 'pickup']), target: o?.id, item: null };
  return new Promise(ok => setTimeout(() => ok({ line, emotion, action, viewers: [] }), 700));
}
