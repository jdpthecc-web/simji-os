# SIMJI OS · 토스페이먼츠 실결제 연동

이 폴더는 SIMJI OS 앱을 **실제 결제**가 되도록 만드는 최소 구성입니다.
결제는 100% 브라우저만으로는 안 됩니다 — 시크릿 키로 결제를 **승인(capture)** 하는
서버가 반드시 필요합니다(키 노출 방지). 그 서버가 `server.js` 입니다.

```
simji-payment-server/
├─ server.js           ← 앱 서빙 + 결제 승인(/confirm)
├─ package.json
├─ .env.example
└─ SIMJI_OS_v36.html   ← 이 파일을 같은 폴더에 두세요
```

## 1. 준비
- Node.js 18 이상 (`node -v` 로 확인)
- `SIMJI_OS_v36.html` 을 이 폴더(server.js 옆)에 복사

## 2. 실행 (테스트 모드 — 바로 됩니다)
```bash
npm install
npm start
```
브라우저에서 **http://localhost:3000** 접속 →
로그인 화면 → "개인 구독으로 시작하기" → 요금제 선택 → 결제.

결제 단계에서 **토스페이먼츠 결제위젯**(카드·카카오페이·계좌이체 등)이 실제로 뜹니다.
테스트 모드라 실제 청구는 없고, 토스 개발자센터 > 결제내역에서 확인됩니다.
승인까지 끝나면 "결제가 완료되었습니다 🎉" 결과 화면이 뜹니다.

> 파일을 그냥 더블클릭(file://)으로 열면 토스 SDK가 동작하지 않아
> 자동으로 **모의 결제**로 폴백합니다. 실결제 흐름을 보려면 위처럼 서버로 띄우세요.

## 3. 동작 원리
1. 앱(브라우저)에서 결제위젯으로 결제수단 **인증** → `successUrl` 로
   `paymentKey`, `orderId`, `amount` 가 돌아옴
2. 앱이 그 값을 `POST /confirm` 으로 서버에 전달
3. 서버가 **시크릿 키**로 토스 `/v1/payments/confirm` 호출 → 결제 **최종 승인(DONE)**
4. 앱은 승인 결과를 받아 구독을 활성화

## 4. 라이브 전환 (실제 매출 발생)
1. 토스페이먼츠 **전자결제(PG) 신청** — 사업자등록 필요
   (고객센터 1544-7772 / support@tosspayments.com)
2. 발급된 **결제위젯 연동 키**로 교체:
   - 클라이언트 키(`live_gck_...`) → `SIMJI_OS_v36.html` 의 `TOSS_CLIENT_KEY`
   - 시크릿 키(`live_gsk_...`) → 환경변수 `TOSS_SECRET_KEY` (코드에 적지 말 것)
   ```bash
   TOSS_SECRET_KEY=live_gsk_xxxxx npm start
   ```
3. 서버를 공개 도메인에 배포(예: Render, Railway, Fly.io, 또는 자체 서버).
   배포 도메인이 `successUrl`/`failUrl` 의 origin이 됩니다.
4. 본인 카드로 소액(예: 월 10,000원) 한 건 결제 → **실제 매출 1건 확보.**

## 5. 운영 시 반드시
- 시크릿 키는 클라이언트/깃에 **절대** 노출 금지 (환경변수만 사용)
- `orderId`별 결제예정금액을 서버에 저장해두고, `/confirm` 에서 `amount` 일치 검증
  (금액 위변조 방지) — `server.js` 주석 참고
- 웹훅으로 결제상태 변화 수신 권장

## 6. XPRIZE 메모
Build with Gemini XPRIZE는 90일 내 **실제 매출·실제 사용자**를 봅니다.
위 4단계까지 마치면 "결제 가능한 실서비스"가 됩니다. 데모 영상엔
① 실제 결제 1건 승인 화면 ② AI 운영 콘솔(자동화) ③ 학생/교사 사용 흐름을 담으세요.

## 7. 배포 (Render / Railway) — ⓑ
서버를 공개 도메인에 올리면, 앱이 `location.origin`을 자동으로 successUrl/failUrl로 쓰기
때문에 **결제 리다이렉트가 배포 주소에서 그대로 동작**합니다(코드 수정 불필요).

준비: 이 폴더(server.js, package.json, SIMJI_OS_v36.html 등)를 GitHub 저장소에 올리세요.
(`node_modules`, `.env`는 .gitignore로 제외됨)

### Render (render.yaml 포함 — 가장 간단)
1. render.com → New → Blueprint → GitHub 저장소 연결
2. 동봉한 `render.yaml`을 자동 인식 → Apply
3. 서비스의 Environment에서 `TOSS_SECRET_KEY` 입력
   - 테스트: 비워두면 기본 테스트 키로 동작
   - 라이브: 발급받은 `live_gsk_...`
4. 배포 완료 → `https://simji-os.onrender.com` 같은 주소 발급

### Railway
1. railway.app → New Project → Deploy from GitHub repo
2. 빌드/실행은 `package.json`의 `start` 스크립트로 자동 인식(Procfile도 포함)
3. Variables에 `TOSS_SECRET_KEY` 추가
4. Settings → Generate Domain 으로 공개 주소 발급

### 라이브 전환 시 체크
- HTML의 `TOSS_CLIENT_KEY`를 본인 **라이브 결제위젯 클라이언트 키**(`live_gck_...`)로 교체
- 시크릿 키는 **환경변수로만** (코드/깃 금지)
- 토스 전자결제 계약 시 등록한 **사이트 도메인 = 배포 도메인**이어야 합니다

## 8. 체험 행사 (6/20 에버랜드 이큐브스쿨) — 측정 + 지불의향 테스트
가족 50명 브레인레이싱 체험에서 "측정 → 부모 리포트 → 돈 낼지" 검증용입니다.

가족 동선 (모두 앱 안):
1. 로그인 화면 → **에버랜드 브레인레이싱 체험** 카드 → 아이 이름 입력
2. **1분 측정 시작** → 오늘 지수(점수)·연속·추세가 실제로 쌓이고, 부모 리포트가 생성·전송됨
3. 결과 카드의 **체험 설문(30초)** → "돈 내고 쓸까/적정가/마음에 든 점/한마디"

운영자(JD)용:
- 응답은 서버 `POST /feedback` 로 모여 `feedback.jsonl` 에 누적됩니다.
- 현장 집계는 브라우저에서 **`/admin/feedback`** (예: `https://내도메인/admin/feedback`) — 지불의향 %, 가격 분포, 코멘트를 실시간으로 봅니다.
- 측정 데이터(연속·추세)는 기기별로 저장되므로, 가족이 각자 폰으로 **배포된 주소**에 접속해야 설문이 한곳에 모입니다(서버 배포 권장).

주의:
- `/admin/feedback` 는 데모라 인증이 없습니다 → 운영 시 접근 제한을 거세요.
- 무료 호스팅은 재배포 시 파일이 초기화될 수 있으니, **행사 후 feedback.jsonl 을 꼭 내려받아 보관**하세요.

## 9. 관리자 대시보드 보호 (/admin/feedback)
`/admin/feedback` 는 HTTP Basic 인증으로 보호됩니다(브라우저가 ID/PW를 묻습니다).
- 기본값: **ID `jd` / PW `simji0620`**
- 배포 시 반드시 환경변수로 변경하세요:
  - `ADMIN_USER` = 원하는 아이디
  - `ADMIN_PASS` = 강한 비밀번호
- `POST /feedback`(가족 응답 제출)은 인증 없이 열려 있습니다(정상).

## 10. 배포 리허설 (행사 전 점검)
실제 배포 전, 로컬에서 운영 환경과 동일하게 점검합니다.

한 줄 실행:
```
bash rehearse.sh
```
이 스크립트는 ① 깨끗한 설치(npm install) ② 운영용 환경변수로 기동 ③ 핵심 엔드포인트를 자동 점검합니다:
- `GET /` (앱 로딩, 200)
- `POST /confirm` (빈 요청 → 400, 방어 동작)
- `POST /feedback` (응답 저장, ok)
- `GET /admin/feedback` (인증 없음 → 401, 인증 있음 → 200)

실제 배포(Render 예시):
1. 이 폴더를 GitHub 저장소로 push
2. Render → New → Web Service → 저장소 선택
3. Build `npm install` / Start `npm start` (render.yaml 에 이미 설정됨)
4. Environment 에 `TOSS_SECRET_KEY`, `ADMIN_USER`, `ADMIN_PASS` 추가
5. 배포 후 주소를 가족들에게 공유 → 설문이 한곳에 모임
6. 행사 종료 후 `/admin/feedback` 확인 + 데이터 백업

> 결제 successUrl/failUrl 은 접속 주소(location.origin)를 자동으로 사용하므로, 배포 도메인이 바뀌어도 코드 수정이 필요 없습니다.

## 11. README → Word 문서 자동 생성
이 README가 바뀌면 워드 파일도 함께 갱신합니다.
```
npm install docx       # 최초 1회 (문서 생성용 도구)
node gen_readme_docx.js README.md SIMJI_OS_README.docx
```

## 12. 헤드셋 연결 (MindWave Mobile 2)
- 구형 MindWave Mobile(1세대)은 Bluetooth Classic 전용이라 웹앱(Web Bluetooth=BLE)으로 연결되지 않습니다. 실측하려면 **MindWave Mobile 2**(BLE 듀얼모드)를 사용하세요.
- 측정 기기는 **아이폰/아이패드 + Bluefy 브라우저**(무료, App Store)를 권장합니다. Mobile 2는 PC·안드로이드에선 Classic으로 동작해 웹앱 연결이 불확실하고, iOS는 BLE로 동작합니다.
- **Bluefy는 HTTPS에서만 동작**하므로 반드시 Render 배포 주소(https)로 여세요.
- 연결: EEG 화면 → "헤드셋 연결" → 헤드셋 전원 ON(자동 페어링) → 기기 선택. 연결되면 진단줄에 "✓ 실측 수신 중 · 패킷 N개"가 표시됩니다. 숫자가 늘지 않으면 시뮬 상태입니다.
- 앱은 표준 UUID(FFE0/FFE1) → 자동 탐색 순으로 시도합니다. 데이터 특성을 못 찾으면 진단줄에 발견된 서비스 UUID가 표시됩니다. 데스크톱 크롬의 `chrome://bluetooth-internals`로 실제 UUID를 확인해 알려주면 코드에 고정할 수 있습니다.
- 실측이 안 잡혀도 시뮬레이션으로 전체 체험·설문은 그대로 진행됩니다.
- 측정 화면 상단의 **착용 상태 표시줄**: 🟢 착용·실측 / 🟠 신호 약함 / 🔴 벗음·끊김 / ⚪ 시뮬·대기 로 한눈에 구분됩니다. 그래프는 좌→우로 진행하며, 측정이 끝나면 집중·이완의 **최고·평균·최저(0~100)** 요약이 표시됩니다.

## 13. AI 활성화 & 라이브 결제 전환 (환경변수만)
**행사용 — 뇌·심·지·동 AI 에이전트 라이브로 보여주기**
- Render 환경변수에 `ANTHROPIC_API_KEY`(Claude 키)를 넣으면, 앱이 자동 감지해 **모든 AI 호출을 서버로 라우팅**합니다. 각 가족 기기 브라우저에 키를 넣을 필요가 없고, 키가 노출되지 않습니다.
- 미설정 시에도 앱은 템플릿/데모로 정상 동작합니다(AI만 비활성).
- 동작 확인: `/ai/status` → `{"enabled":true}` 이면 라이브.

**결제 — 행사는 테스트, XPRIZE는 라이브**
- 기본은 테스트 키라 **실제 청구가 없습니다**(행사에서 결제 화면을 "보여주기"용으로 사용).
- 라이브 전환은 **환경변수만** 바꾸면 됩니다(코드 수정 불필요):
  - `TOSS_SECRET_KEY` = 라이브 시크릿 키 (서버 승인용)
  - `TOSS_CLIENT_KEY` = 라이브 클라이언트 키 (앱이 `/config`에서 자동 주입)
- 단, 라이브 결제는 **사업자등록 + Toss Payments(PG) 계약·심사**가 선행돼야 합니다. 월 구독(정기결제)은 **빌링(자동결제) 계약**이 별도이고 심사 리드타임이 길어, XPRIZE 일정(90일 실매출)을 감안해 **일찍 신청**하세요.
- 의료 효능 표방은 피하세요(식약처 이슈).

## 14. 자동결제(빌링) — 월 구독
**개념**: 빌링은 일반결제와 별도 계약·별도 키(빌링 MID)가 필요합니다. 라이브 시 빌링 전용 시크릿을 `TOSS_BILLING_SECRET_KEY` 환경변수로 넣으세요(미설정 시 `TOSS_SECRET_KEY` 사용).

**흐름**
1. (앱) 결제수단 등록창 `requestBillingAuth({ method:'CARD', customerKey, successUrl, failUrl })` → 성공 시 `successUrl?authKey=...&customerKey=...` 로 리다이렉트.
2. (서버) `POST /billing/issue {authKey, customerKey}` → 토스 `/v1/billing/authorizations/issue` 호출로 빌링키 발급 → `billing-keys.jsonl`에 저장(빌링키는 클라이언트로 반환하지 않음).
3. (서버) 매 결제주기 `POST /billing/charge {customerKey, amount, orderId, orderName}`(관리자 인증) → 토스 `/v1/billing/{billingKey}` 호출로 자동 청구.
4. `GET /billing/subscribers`(관리자 인증) → 구독자 목록(카드사·끝 4자리·발급일, 빌링키 비노출).

**환경변수**: `TOSS_BILLING_SECRET_KEY`(빌링 전용 시크릿). `customerKey`는 UUID 등 추측 불가능한 값으로 생성하세요.

**스케줄링(정기 청구)**: 무료 Render 웹서비스는 상시 cron이 어렵습니다. 외부 cron(GitHub Actions, cron-job.org 등)이 매월 각 구독자에 대해 관리자 인증으로 `/billing/charge`를 호출하도록 구성하세요. 결제 실패(한도·잔액·만료) 시 재시도·알림 로직을 권장합니다.

**주의**: 빌링키 조회 API는 없으니 발급 즉시 안전 저장(운영은 암호화/DB 권장). 자동결제는 정기 구독형에만 허용되며, 일반결제 키로 빌링 연동 시 NOT_SUPPORTED_METHOD 오류가 납니다.

## 15. 성과지표(KPI) 적재·집계
- 앱은 측정 1건마다 `POST /metrics/event {type:'measurement', childId(익명), date, score, f, r}`를 자동 적재합니다(키 없음). childId는 기기별 익명 식별자(localStorage `simji_cid_v1`).
- 빌링키 발급 시 서버가 `{type:'subscription', childId:customerKey, status:'active', mrr}`를 적재합니다.
- `GET /metrics`(공개·개인정보 없음): 집계 KPI 반환 — totalChildren, totalMeasurements, wau, habit4(4주 습관지속률), retentionW4, cohort(꾸준 vs 비꾸준 지수변화), subscribers, mrr. 데이터 부족 시 해당 값은 null.
- 운영 콘솔 KPI 패널이 `/metrics`를 불러 실데이터로 채우고, 부족하면 샘플로 표시합니다. '내 측정'은 이 기기 실데이터.
- 저장: `metrics.jsonl`(.gitignore). 운영은 DB 권장이며, 무료 호스팅은 재배포 시 파일이 소실될 수 있으니 주기적으로 백업하세요.

## 16. 페이지 라우트 (SimjiOs.com 통합)
- `/`       → 홈(랜딩) `SimjiOs_home.html`
- `/app`    → 앱 `SIMJI_OS_v36.html`
- `/terms`  → 이용약관 · `/privacy` → 개인정보처리방침 · `/youth` → 청소년보호정책
- API(`/config`, `/ai`, `/confirm`, `/feedback`, `/metrics`, `/billing/*`)는 그대로 동작합니다.
- 도메인: Render 커스텀 도메인(`simjios.com`)에 연결하면 무료 SSL이 자동 적용됩니다. DNS는 Render가 안내하는 CNAME/A 레코드로 설정하세요.
- 약관 페이지·홈 푸터의 사업자 정보 `[대괄호]`를 실제 값으로 채우세요. 라이브 결제(PG) 심사에는 서비스 URL·약관 3종·사업자정보가 필요합니다.
- 참고: 앱이 `/app`에서 서빙되므로, 라이브 결제 successUrl/failUrl이 `/app` 경로를 포함하도록 go-live 시 점검하세요.

## 17. 취침 전 감사·마음 코너 (心)
- 입구: 心(체크인) 탭 최상단 카드 + 홈(腦 EEG) 카드 + 우하단 🌙 버튼(학생·학부모). 카드에 **🔥 감사 연속 N일** 배지 노출(습관화 강화).
- 입력: 감사 3가지 + 마음 한 문장 + 기분 → '부모님께 보내기'. 저장: localStorage `simji_gratitude_v1`. 제출 시 `/metrics/event {type:'gratitude'}` 적재.
- AI: 제출하면 부모용 '대화 시작 한마디'를 생성(서버 AI 키 있으면 라이브, 없으면 템플릿).
- 부모 알림: 학부모 화면(🌙)에서 오늘 아이의 감사·마음 + **🔔 밤 알림(카톡/푸시) 초안** 확인 및 '초안 복사'. 실제 발송은 카카오 알림톡 채널 연동 후 자동화(현재는 초안 생성·복사까지).

## 18. 역할 스코핑 (학부모/교사 분리)
- 학부모는 교사와 일부 화면(腦 분석·리포트)을 공유하지만, 교사 전용 요소는 학부모 로그인 시 자동 숨김됩니다: '교사 AI 코칭 대시보드' 헤더, 여러 학생 선택, 상담 타이밍/개입 매뉴얼 탭, '학급 리포트' 탭.
- 학부모는 자녀 1명 기준으로만 표시되며(데모 자녀: 김민수), 진입 시 자동 선택됩니다. 데이터 연동 시 실제 자녀로 대체하세요.
- AI 키: 학생·보호자·교사 구분 없이 서버 키 1개(`ANTHROPIC_API_KEY`)를 공유합니다(사용자별 키 불필요). 키는 서버 `/ai` 프록시에만 존재하고 클라이언트에 노출되지 않습니다.

## 19. 카카오 알림톡 연동 (Solapi)
- 발송 경로: 앱(취침 전 제출) → 서버 `/notify/gratitude` → Solapi `messages/v4/send`(HMAC-SHA256 인증, `type:ATA`) → 알림톡 발송(실패 시 SMS 대체). 미설정이면 발송하지 않고 앱 내 초안/복사로 동작합니다.
- 사전 준비: (1) 카카오 비즈니스 채널 개설·인증, (2) Solapi 가입·발신번호 등록·채널 연동(pfId), (3) 알림톡 템플릿 등록·심사 승인(templateId), (4) Solapi API Key/Secret 발급.
- 템플릿 예(정보성): `🌙 #{자녀명} 오늘의 마음 — #{자녀명}(이)가 오늘 감사와 마음 한 줄을 남겼어요. #{대화제안} 자기 전이나 아침에 1분 함께 이야기해 보세요. — 심지OS` (변수: `#{자녀명}`, `#{대화제안}`). 알림톡은 정보성만 허용(광고성 문구 금지).
- 환경변수: `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `KAKAO_PF_ID`, `KAKAO_TEMPLATE_ID`, `NOTIFY_FROM`(등록 발신번호), `NOTIFY_TEST_TO`(테스트 수신번호).
- 엔드포인트: `GET /notify/status`(설정 여부), `POST /notify/gratitude`(공개·서버 수신번호로 발송), `POST /notify/kakao`(adminAuth · `{to,variables}` 범용).
- 운영: 실제 발송은 부모 휴대폰을 구독정보와 연결해 서버에서 트리거하세요(현재 데모는 `NOTIFY_TEST_TO` 단일 수신).

## 20. 학부모 자녀 홈 (sc-phome)
- 학부모 로그인 시 자녀 전용 홈으로 진입(첫 탭 '자녀 홈'). 자녀 1명 기준 오늘 지수·측정 연속일·이번주 측정, 오늘의 감사·마음(연속일·대화 제안), 주간·월간 리포트/뇌 성장 분석 바로가기를 제공합니다.
- 교사 전용 화면(여러 학생 선택·학급 리포트 등)은 학부모에게 노출되지 않습니다(18장 스코핑).

## 21. AI 제공자 — Gemini 전환 (XPRIZE 요건)
- 서버 `/ai` 프록시가 Gemini(generativeLanguage `gemini-3.5-flash`)를 기본 제공자로 호출하고, 앱은 기존 Anthropic 형식 그대로 호출 → 서버가 요청/응답을 변환합니다(앱 코드 변경 없음). Claude는 폴백.
- 환경변수: `GEMINI_API_KEY`(설정 시 자동으로 Gemini 우선), `GEMINI_MODEL`(기본 gemini-3.5-flash), `AI_PROVIDER`(gemini|anthropic 강제 지정), 기존 `ANTHROPIC_API_KEY`(폴백).
- `GET /ai/status` → `{enabled, provider}`. 키 없으면 `/ai` 503.
- Google Cloud 요건: Vertex AI(Gemini)로 호출하거나 Cloud Run에 배포하면 충족. 권장: Cloud Run 배포 + Gemini API.

## 22. AI 에이전트 러너 + 실행 로그 (XPRIZE 증빙)
- `POST /agents/run`(adminAuth): 5개 에이전트(onboarding·weekly_report·anomaly·retention·content)를 1회 실행. `POST /agents/run/:name`으로 개별 실행.
- 트리거 소스는 `/metrics`(측정·구독 이벤트). 각 실행은 Gemini(`/ai`, 키 없으면 템플릿 폴백)로 메시지를 생성하고 `agent_log.jsonl`에 적재.
- `GET /admin/agent-logs`(adminAuth): 실행 로그 JSON(또는 `?html=1` 표). XPRIZE "playbooks 상시 가동" 증빙으로 제출.
- 상시 가동: 외부 cron(예: cron-job.org)이 Basic 인증으로 `POST /agents/run`을 주기 호출. 카카오 알림톡 미승인 구간은 'queued'로 로그(생성·결정은 AI가 수행).
- 저장: `agent_log.jsonl`, `agent_state.json`(.gitignore). 무료 호스팅은 재배포 시 유실 → 백업.

## 23. 데모 / 시뮬레이션 모드 (심사자용)
- 진입: 로그인 화면 '데모로 둘러보기(밴드 없이)' 버튼 또는 URL `?demo=1`. 학생으로 자동 로그인 + 7일 측정·감사 샘플을 로컬에 시드 → 화면이 채워진 상태로 체험.
- 밴드 불필요: 측정은 시뮬레이션. 상단 'DEMO' 알약 배지 표시, '종료' 시 시드 데이터·플래그 정리.
- 무결성: 데모 중 `/metrics/event` 적재와 `/notify/gratitude` 발송을 차단(fetch·sendBeacon 래핑) → 실데이터(매출·사용자 증빙)·실발송 오염 방지.

## 24. Vertex AI (Google Cloud) 경로 — XPRIZE "Google Cloud 제품" 요건
- `/ai` 프록시·에이전트가 `AI_PROVIDER=vertex`이면 Gemini 호출을 **Vertex AI**(Google Cloud)로 보냅니다. 요청/응답 형식은 Gemini와 동일, 인증만 다릅니다(서비스 계정 토큰).
- 환경변수: `AI_PROVIDER=vertex`, `GCP_PROJECT_ID`, `GCP_LOCATION`(예: us-central1 또는 global), `GCP_SA_KEY`(서비스 계정 JSON 문자열 전체).
- 토큰: 서버가 SA JSON으로 RS256 JWT를 만들어 oauth2 토큰으로 교환(캐시) 후 `Authorization: Bearer`로 호출. 외부 라이브러리 불필요(crypto 사용).
- GCP 준비: ① 프로젝트에서 Vertex AI API 사용 설정 ② 서비스 계정 생성 + 역할 `roles/aiplatform.user` ③ 키(JSON) 발급 → `GCP_SA_KEY`에 통째로 입력.
- 선택지: ⒜ 이 Vertex 경로(호스팅은 Render 유지) 또는 ⒝ 호스팅을 Cloud Run으로. 둘 중 하나면 'Google Cloud 제품' 요건 충족. Gemini API 키 경로(`GEMINI_API_KEY`)·Claude 폴백은 그대로.

## 25. 오케스트레이터 (교육OS 커널) — AI 네이티브 운영
- 엔드포인트: `POST /agents/orchestrate` (adminAuth). cron은 기존 `/agents/run` 대신 **이것**을 호출 권장.
- 동작: 메트릭(이벤트)으로 아이별 상태를 만들고, 후보 행동을 생성해 **하나(또는 없음)**만 선택.
  - 우선순위: 안전 > 부모연결(감사) > 이상 > 복귀 > 주간 리포트 > 온보딩. (측정 코치는 앱 실시간이라 제외)
  - 과알림 방지: 하루 알림 상한(기본 2), 조용한 시간(기본 22~7시), 중복 방지(하루 1회/에이전트), 하루 한 가지 집중.
  - **안전 최우선**: 안전 신호는 조용한 시간·상한을 무시하고 항상 채택, 나머지 일상 알림은 보류.
- 증빙: 모든 결정을 `agent_log.jsonl`에 `agent:'orchestrator'`로 — **채택 + 보류(사유 포함)**까지. `/admin/agent-logs?html=1`에서 확인.
- 상태: `agent_state.json`의 `orch`에 아이별 당일 알림 수·실행 에이전트·주간 주기 저장(자정 리셋).
- TODO(실서비스): 앱 `logEvent`에 `childId` 포함(현재 미지정 시 'demo'로 묶임). 조용한 시간은 서버 TZ 주의.
- growth_report 에이전트: 앱의 변화 감지(growth_moment/milestone)를 받아 부모에게 확인 메시지(우선순위 3, 안전·감사 다음).
- GET /admin/dashboard (adminAuth): 운영 대시보드 — 아동 수·오늘 활동·안전 신호 강조·7일 이벤트·아동별 현황·오케스트레이터 최근 결정.
