/* Gemini 중계 서버(Vercel 서버리스 함수): 배포된 게임이 POST /api/gemini 로 부른다.
   API 키는 Vercel 프로젝트의 환경 변수 GEMINI_API_KEY 에만 둔다(코드·저장소·브라우저에는 없다).

   남용을 막는 장치
   - 이 사이트(같은 주소)와 ALLOWED_ORIGINS 에 적은 주소에서 온 요청만 받는다
   - 모델은 서버가 정한다(GEMINI_MODEL, 기본 gemini-3.1-flash-lite). 브라우저가 보낸 모델 이름은 쓰지 않는다
   - 요청 크기 제한, 출력 토큰 상한(400), IP마다 분당 요청 수 제한(RATE_PER_MIN, 기본 20)
     분당 제한은 서버 인스턴스 메모리에 세므로 대략적인 방어다. 진짜 상한은 Google 쪽 무료 등급 한도·예산 설정이 맡는다

   환경 변수(Vercel → Project → Settings → Environment Variables)
   - GEMINI_API_KEY (필수)
   - GEMINI_MODEL, RATE_PER_MIN, ALLOWED_ORIGINS(쉼표로 구분, 예: https://내도메인.com) — 선택 */
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const RATE = Number(process.env.RATE_PER_MIN || 20);
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const MAX_BODY = 24000;              // 시스템 지시 + 프롬프트(보통 6~10KB)
const hits = new Map();              // ip → 최근 1분 요청 시각들

const fail = (res, code, message) => res.status(code).json({ error: { message } });

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'POST만 받습니다');
  if (!process.env.GEMINI_API_KEY) return fail(res, 500, '서버에 GEMINI_API_KEY가 설정되지 않았습니다');

  // 출처 확인: 같은 사이트이거나 허용한 주소
  const origin = req.headers.origin || '';
  const self = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  if (origin !== self && !ALLOWED.includes(origin)) return fail(res, 403, '허용되지 않은 출처입니다');

  // 분당 요청 수 제한(IP마다)
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now(), recent = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (recent.length >= RATE) return fail(res, 429, '요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요');
  recent.push(now); hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();   // 메모리 보호

  // 요청 내용 확인: 게임이 보내는 형태만 통과
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const sys = body.systemInstruction?.parts?.[0]?.text, user = body.contents?.[0]?.parts?.[0]?.text;
  if (typeof sys !== 'string' || typeof user !== 'string') return fail(res, 400, '요청 형식이 올바르지 않습니다');
  if (sys.length + user.length > MAX_BODY) return fail(res, 413, '요청이 너무 깁니다');

  const out = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 1, maxOutputTokens: 400 },
    }),
    signal: AbortSignal.timeout(14000),
  }).catch(e => ({ ok: false, status: 504, json: async () => ({ error: { message: String(e.message || e) } }) }));

  const data = await out.json().catch(() => ({}));
  // Google 쪽 오류 문구에 키가 섞여 나오지 않게, 오류는 상태 코드와 짧은 문구만 돌려준다
  if (!out.ok) return fail(res, out.status, data.error?.status || 'Gemini 호출 실패');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ candidates: data.candidates, usageMetadata: data.usageMetadata });
}
