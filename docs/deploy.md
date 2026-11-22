# 배포 방법 (Vercel 한 곳에 게임 + Gemini 중계 서버)

게임(정적 파일)과 중계 서버(`api/gemini.js`)를 Vercel 프로젝트 하나로 올린다. 같은 주소라 출처 확인이 간단하고, GitHub에 푸시할 때마다 자동으로 다시 배포된다.

## 개발 모드 / 배포 모드 (`js/env.js`)

| 어디서 열었나 | 모드 | 보이는 것 | AI 호출 |
|---|---|---|---|
| 내 컴퓨터(`localhost`) | 개발 | 테스트 모드·영역 가이드·설정·프로토타입 컨트롤, 주소 옵션(`?ai=off` 등) | ⚙ 설정의 내 키로 직접 |
| 배포된 사이트 | 배포 | 게임 화면만 | `/api/gemini`(중계 서버) |
| 배포된 사이트 + `?dev` | 개발 | 개발 화면 | 중계 서버(설정에 키를 넣으면 그 키) |
| 내 컴퓨터 + `?release` | 배포 미리보기 | 게임 화면만 | ⚠ 저장된 내 키로 직접 부른다(API 비용 발생) |

## 직접 해야 하는 단계

1. **배포 전용 Gemini API 키 만들기**
   - Google AI Studio(aistudio.google.com) → API 키 만들기. 개발용 키와 따로 만든다
   - **결제 계정을 연결하지 않은 프로젝트**에서 만들면 무료 등급 한도에서만 동작해 요금이 나올 수 없다(가장 안전). 유료로 쓸 때는 Google Cloud 결제 예산 알림·한도를 함께 건다
2. **Vercel 가입**: vercel.com → GitHub 계정으로 가입
3. **프로젝트 가져오기**: Add New → Project → GitHub 저장소 `wrong-way-streamer` 선택
   - Framework Preset: `Other` · Build Command: 비움 · Output Directory: 비움(저장소 최상위를 그대로 올림)
4. **환경 변수에 키 넣기**: 프로젝트 Settings → Environment Variables
   - `GEMINI_API_KEY` = 1번에서 만든 키 (Production 체크)
   - 선택(안 넣으면 기본값으로 동작하므로 보통은 필요 없다): 같은 화면에서 `GEMINI_API_KEY`를 넣을 때처럼 이름(Key)과 값(Value)을 직접 적어 추가한다
     `RATE_PER_MIN`(IP마다 분당 요청 수, 기본 40) · `GEMINI_MODEL`(기본 gemini-3.1-flash-lite) · `ALLOWED_ORIGINS`(vercel.app 말고 따로 산 도메인을 연결했을 때만)
   - 키를 넣거나 바꾼 뒤에는 Deployments → 최신 배포 → Redeploy
5. **확인**: 배포된 주소(예: `https://wrong-way-streamer.vercel.app`)를 열고 채팅을 보내 한별이 대답하는지 본다

## 중계 서버가 막는 것

- 다른 사이트에서 온 요청(출처 확인)
- 모델 바꿔치기(서버가 모델을 정함), 너무 긴 요청, 출력 토큰 400 초과
- IP마다 분당 요청 수(서버 메모리에 세는 대략적인 방어). 진짜 상한은 Google 쪽 무료 한도·예산

## 참고

- 키는 Vercel 환경 변수에만 있다. 코드·저장소·브라우저 어디에도 없다
- 테스트 모드·소품 편집기는 배포된 사이트에서도 `?dev`로 열리지만, 파일 저장(`/__decor`)과 표정 변환 저장(`/__sprite`)은 개발 서버(`python tools/serve.py`)에서만 된다
