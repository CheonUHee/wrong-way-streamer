/* 첫 플레이어 Gemini 플레이테스트 (개발 전용, 브라우저에서 import해서 쓴다)
   - 플레이어 역할 Gemini가 사람이 보는 것만 본다: 3D 화면 그림, 목표, 말풍선, 채팅창, 가방, 지갑, 읽은 플레이 가이드 카드.
   - 정답 루트·스테이지 데이터는 모른다. 채팅·후원 지시만 할 수 있다.
   - 사람 시간 흉내: 플레이 가이드 카드는 글자 수만큼 읽고(초당 약 11자) 넘기고, 채팅은 초당 약 3자로 친다.
   - 시간은 실제 경과 시간(벽시계)으로 잰다. 결과는 window.__pt 에 쌓인다.
   사용: await import('/tools/playtest_agent.js?' + Date.now()); window.__ptStart({ model: 'gemini-3.5-flash' }) */
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SYSTEM = `너는 인터넷 방송을 보는 시청자 게임 "스트리머님, 거기 아닌데요!"를 오늘 처음 해 보는 평범한 플레이어다.
게임에 대해 미리 아는 것은 없다. 아는 것은 지금 화면에 보이는 것, 채팅창, 그리고 지금까지 읽은 플레이 가이드 카드뿐이다.
화면 속 스트리머(한별)는 AI라서 혼자 돌아다니고, 채팅이나 후원으로 지시하면 대개 따른다(채팅은 놓칠 수 있고 후원은 반드시 읽는다).
처음 하는 사람답게 행동한다:
- 처음에는 한별이 뭘 하는지 지켜보다가, 엉뚱한 데로 가거나 막혀 보이면 그때 채팅으로 말한다.
- 화면에 보이는 단서(표지판, 그림, 글씨)는 네가 직접 보고 판단한다. 확실하지 않으면 짐작으로 말해도 된다. 틀릴 수도 있다.
- 한별이 채팅창에 물어보면 대답한다.
- 다른 시청자가 후원으로 엉뚱한 지시를 하면 막고 싶을 수 있다. 후원은 100⚡씩 든다.
- 같은 말을 몇 초마다 계속 반복하지 않는다. 방금 말했으면 한별이 반응할 시간을 준다.
- 채팅은 짧게, 실제 사람이 치듯이 쓴다(예: "빨간 버튼 눌러", "왼쪽 문으로 가").
출력은 JSON 하나만:
{"thought": "지금 상황을 어떻게 보는지 한두 문장", "action": "wait|chat|donate", "text": "보낼 말(wait이면 빈 문자열)"}`;

function grab() {
  return new Promise(ok => {
    const to = setTimeout(() => ok(null), 3000);
    requestAnimationFrame(() => {
      clearTimeout(to);
      try {
        const src = document.querySelector('#scene canvas');
        const c = document.createElement('canvas'); c.width = 640; c.height = 360;
        c.getContext('2d').drawImage(src, 0, 0, 640, 360);
        ok(c.toDataURL('image/jpeg', 0.7).split(',')[1]);
      } catch { ok(null); }
    });
  });
}

const vis = el => el && el.classList.contains('show');
const chatLines = n => [...$('log').children].slice(-n).map(p => {
  const t = p.innerText.replace(/\s+/g, ' ').trim();
  if (p.classList.contains('me')) return `(나) ${t.replace(/^나\s*/, '')}${p.classList.contains('missed') ? ' [한별이 놓침]' : ''}`;
  if (p.classList.contains('sys')) return `[알림] ${t}`;
  return t;
}).filter(Boolean);

export async function start(opt = {}) {
  const KEY = JSON.parse(localStorage.getItem('wws.cfg') || '{}').key;
  const stageMod = await import('/js/stage.js');   // 소리(위험 상태)만 읽는다. 사람은 쿠르르릉을 귀로 듣는다
  // resume: 이미 돌던 기록(시작 시각·카드·결정)을 이어서 쓴다
  const PT = window.__pt = opt.resume && window.__pt ? Object.assign(window.__pt, { stop: false }) : {
    model: opt.model || 'gemini-3.5-flash', t0: performance.now(), marks: [], decisions: [], cards: [],
    calls: 0, errors: 0, sent: 0, donated: 0, done: false, stop: false,
  };
  if (opt.cards) PT.cards.push(...opt.cards);   // 앞 스테이지에서 읽은 플레이 가이드(스테이지를 건너뛰어 시작할 때)
  let phase = null, lastPass = null;
  const now = () => +((performance.now() - PT.t0) / 1000).toFixed(1);
  const mark = (ev, x = {}) => PT.marks.push({ t: now(), ev, timer: $('timer')?.textContent, ...x });
  const capMin = opt.capMin || 40;

  async function ask(img, text) {
    const parts = [{ text }];
    if (img) parts.unshift({ inlineData: { mimeType: 'image/jpeg', data: img } });
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${PT.model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.8, maxOutputTokens: 1500, thinkingConfig: { thinkingBudget: 0 } },
      }), signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(res.status + ' ' + (await res.text()).slice(0, 120));
    const d = await res.json(); PT.calls++;
    const t = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    return JSON.parse(t.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
  }

  function observe() {
    const inv = [...$('inv').children].map(e => e.querySelector('.name')?.textContent.trim()).filter(Boolean).join(', ') || '비어 있음';
    const dona = vis($('dona')) ? `${$('donaHead').innerText} ${$('donaMsg').innerText}` : '';
    const mine = PT.decisions.slice(-6).map(d => `${d.t}s ${d.action}${d.text ? `: ${d.text}` : ''}`).join('\n') || '없음';
    const warn = vis($('warn')) ? $('warn').textContent : '';
    const snd = phase === 'warn' ? '쿠르르릉… 멀리서 무언가 굴러오는 소리가 커지고 있다'
      : phase === 'roll' ? '쿠르르릉!! 무언가 바로 근처를 굴러 내려가는 소리'
      : phase === 'calm' ? `조용하다${lastPass != null ? ` (마지막으로 굴러가는 소리가 끝난 지 ${(now() - lastPass).toFixed(0)}초)` : ''}` : '';
    // 사람이 기억하는 것: 이번 스테이지에서 몇 번 쓰러졌고, 쓰러지기 직전에 내가 뭐라고 했는지
    const lbl = $('stageLabel').textContent;
    const deaths = PT.marks.filter(m => m.ev === 'death' && m.label === lbl);
    const memo = deaths.slice(-4).map(m => {
      const before = PT.decisions.filter(d => d.sentAt && d.sentAt <= m.t && d.sentAt > m.t - 15).map(d => `"${d.text}"`).join(', ') || '(말 안 함)';
      return `- ${m.t}초: ${m.reason} / 직전 15초 안에 내가 보낸 말: ${before}`;
    }).join('\n');
    const deathNote = deaths.length ? `[이번 스테이지에서 한별이 쓰러진 횟수] ${deaths.length}번
[최근 쓰러진 기록]
${memo}
` : '';
    return `${deathNote}[게임 진행 ${now()}초] ${$('stageLabel').textContent}
${warn ? `[화면 경고] ${warn}
` : ''}${snd ? `[들리는 소리] ${snd}
` : ''}
[화면 위 목표] ${$('goal').textContent}
[한별 말풍선] ${vis($('bubble')) ? $('bubbleText').textContent : '(없음)'}
${dona ? `[화면 후원 알림] ${dona}\n` : ''}[한별 가방] ${inv}
[내 지갑] ${$('wallet').textContent}⚡
[읽은 플레이 가이드]
${PT.cards.map(c => `- ${c}`).join('\n') || '없음'}
[채팅창 최근]
${chatLines(16).join('\n')}
[내가 최근 한 행동]
${mine}`;
  }

  async function send(kind, text) {
    $(kind === 'donate' ? 'modeDona' : 'modeChat').click();
    $('input').value = text; $('send').click();
    if (kind === 'donate') PT.donated++; else PT.sent++;
    $('modeChat').click();
  }

  let stageSeen = '';
  async function watchStage() {   // 스테이지 시작·클리어·사망 시점을 기록
    let cleared = false, deadOn = false;
    while (!PT.stop && !PT.done) {
      const lbl = $('stageLabel').textContent;
      if (lbl !== stageSeen) { stageSeen = lbl; cleared = false; mark('stage', { label: lbl }); }
      const c = vis($('clear'));
      if (c && !cleared) { cleared = true; mark('clear', { label: lbl, text: $('clearText').textContent }); if (/ALL CLEAR/.test($('clearText').textContent)) { PT.done = true; mark('done'); } }
      const d = vis($('dead'));
      if (d && !deadOn) mark('death', { label: lbl, reason: $('deadReason').textContent });
      deadOn = d;
      const ph = stageMod.hazardNow();
      if (phase === 'roll' && ph !== 'roll') lastPass = now();
      phase = ph;
      if (now() > capMin * 60) { PT.stop = true; mark('cap'); }
      await sleep(250);
    }
  }

  async function loop() {
    // 인트로: 로고를 보고 "게임 시작"
    if (!opt.resume && $('intro') && !$('intro').classList.contains('hide')) { mark('intro'); await sleep(4000); $('introStart').click(); mark('start'); }
    while (!PT.stop && !PT.done) {
      if (vis($('tut'))) {   // 플레이 가이드 카드: 글자 수만큼 읽고 넘긴다
        const title = $('tutTitle').textContent, body = $('tutText').innerText.replace(/\s+/g, ' ');
        const ms = 2500 + (title.length + body.length) * 90;
        mark('card', { title, ms });
        await sleep(ms);
        PT.cards.push(`${title}: ${body}`);
        $('tutNext').click(); await sleep(600); continue;
      }
      if (vis($('clear')) || vis($('dead')) || document.body.classList.contains('paused')) { await sleep(500); continue; }
      let out;
      try { out = await ask(await grab(), observe()); }
      catch (e) { PT.errors++; mark('err', { msg: String(e.message).slice(0, 100) }); await sleep(4000); continue; }
      const act = ['chat', 'donate'].includes(out.action) && out.text ? out.action : 'wait';
      const d = { t: now(), stage: $('stageLabel').textContent, action: act, text: act === 'wait' ? '' : String(out.text).slice(0, 60), thought: out.thought };
      PT.decisions.push(d);
      if (act !== 'wait') {
        if (act === 'donate' && parseInt($('wallet').textContent.replace(/,/g, ''), 10) < 100) { d.action = 'chat'; }
        await sleep(800 + d.text.length * 330);           // 치는 시간
        if (vis($('tut'))) continue;                       // 치는 사이에 카드가 뜨면 카드부터
        await send(d.action, d.text); d.sentAt = now();
        await sleep(2500);
      } else await sleep(2000);
    }
    mark('end');
  }
  if (opt.resume) { stageSeen = $('stageLabel').textContent; mark('resume'); }
  watchStage(); loop();
  return PT;
}

window.__ptStart = start;
