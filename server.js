/**
 * SIMJI OS 결제 승인 서버
 * - 앱(SIMJI_OS_v36.html)을 서빙하고
 * - 토스페이먼츠 결제를 최종 승인(capture)합니다.
 *
 * 실행:  npm install  →  npm start  →  http://localhost:3000
 * Node 18+ (전역 fetch 사용)
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// 결제는 포트원(PortOne V2)→KPN 경로만 사용합니다. (토스 잔재 제거)
const DATA_DIR = fs.existsSync('/var/data') ? '/var/data' : __dirname; // 영구 디스크
const METRICS_FILE = path.join(DATA_DIR, 'metrics.jsonl');
const PORT = process.env.PORT || 3000;

// 같은 폴더의 앱 파일 서빙
app.use(express.static(__dirname));
// 페이지 라우트 — 홈(랜딩) / 앱 / 약관 3종
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'SimjiOs_home.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'SIMJI_OS_clean_v1.html')));
app.get('/guide', (req, res) => res.sendFile(path.join(__dirname, 'SimjiOs_guide.html')));
app.get('/premium', (req, res) => res.sendFile(path.join(__dirname, 'SIMJI_OS_v36.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));
app.get('/youth', (req, res) => res.sendFile(path.join(__dirname, 'youth.html')));
app.get('/subscribe', (req, res) => res.sendFile(path.join(__dirname, 'subscribe.html')));
app.get('/paytest', (req, res) => res.sendFile(path.join(__dirname, 'paytest.html')));
app.get('/admin', adminAuth, (req, res) => res.sendFile(path.join(__dirname, 'SimjiOs_admin.html')));

/* (구) 토스 결제승인 엔드포인트 제거됨 — 현재 결제는 포트원(PortOne V2)→KPN 경로만 사용 */

/**
 * 체험 피드백(지불의향 설문) 수집 — 6/20 에버랜드 등 현장 테스트용
 * POST /feedback        : 응답 1건 저장(feedback.jsonl 에 한 줄씩 append)
 * GET  /admin/feedback  : 운영자용 집계 대시보드(HTML)
 *   ⚠ 데모용으로 인증이 없습니다. 운영 시 접근 제한을 거세요.
 *   ⚠ 무료 호스팅은 파일이 재배포 시 사라질 수 있으니, 행사 후 데이터를 내려받아 보관하세요.
 */
const FB_FILE = path.join(DATA_DIR, 'feedback.jsonl');

app.post('/feedback', (req, res) => {
  const b = req.body || {};
  const rec = {
    ts: new Date().toISOString(),
    event: b.event || '', child: b.child || '',
    pay: b.pay || '', price: b.price || '', liked: b.liked || '',
    comment: b.comment || '', contact: b.contact || ''
  };
  try { fs.appendFileSync(FB_FILE, JSON.stringify(rec) + '\n'); }
  catch (e) { console.error('feedback write error:', e); }
  console.log('📝 피드백:', rec.pay, '|', rec.price, '|', rec.child);
  res.json({ ok: true });
});

/**
 * 관리자 인증(HTTP Basic). 기본값 jd / simji0620.
 * 배포 시 환경변수 ADMIN_USER, ADMIN_PASS 로 반드시 변경하세요.
 */
function adminAuth(req, res, next) {
  const USER = process.env.ADMIN_USER || 'jd';
  const PASS = process.env.ADMIN_PASS || 'simji0620';
  const hdr = req.headers.authorization || '';
  const [type, creds] = hdr.split(' ');
  if (type === 'Basic' && creds) {
    const [u, p] = Buffer.from(creds, 'base64').toString().split(':');
    if (u === USER && p === PASS) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="SIMJI admin"');
  return res.status(401).send('인증이 필요합니다. (관리자 전용)');
}

app.get('/admin/feedback', adminAuth, (req, res) => {
  let rows = [];
  try {
    const raw = fs.existsSync(FB_FILE) ? fs.readFileSync(FB_FILE, 'utf8') : '';
    rows = raw.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  } catch (e) {}
  const n = rows.length;
  const cnt = (key) => { const m = {}; rows.forEach(r => { const v = r[key] || '(무응답)'; m[v] = (m[v] || 0) + 1; }); return m; };
  const yes = rows.filter(r => r.pay === '네, 돈 내고 쓸래요' || r.pay === '아마도요').length;
  const pct = n ? Math.round(yes / n * 100) : 0;
  const bars = (m) => Object.keys(m).map(k => {
    const w = n ? Math.round(m[k] / n * 100) : 0;
    return `<div style="margin:6px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${k}</span><span>${m[k]}명 (${w}%)</span></div><div style="background:#E2E8F0;border-radius:4px;height:8px"><div style="width:${w}%;height:8px;background:#0F766E;border-radius:4px"></div></div></div>`;
  }).join('');
  const comments = rows.filter(r => r.comment).slice(-50).reverse()
    .map(r => `<li style="margin:6px 0">${(r.comment || '').replace(/</g, '&lt;')} <span style="color:#94A3B8">— ${(r.child || '')} ${(r.contact || '')}</span></li>`).join('');
  res.send(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>체험 피드백 집계</title></head>
<body style="font-family:system-ui,'Malgun Gothic',sans-serif;max-width:680px;margin:24px auto;padding:0 16px;color:#1A2E4A">
<h2 style="margin-bottom:4px">SIMJI OS 체험 피드백</h2>
<div style="color:#64748B;margin-bottom:16px">총 <b>${n}</b>명 응답</div>
<div style="background:linear-gradient(135deg,#1A2E4A,#0F766E);color:#fff;border-radius:14px;padding:20px;margin-bottom:20px">
  <div style="font-size:13px;color:#9FE1CB">지불 의향 (긍정 비율)</div>
  <div style="font-size:40px;font-weight:800">${pct}%</div>
  <div style="font-size:12px;color:#9FE1CB">긍정 ${yes}명 / 전체 ${n}명</div>
</div>
<h3>돈 내고 쓸까?</h3>${bars(cnt('pay')) || '<p>아직 없음</p>'}
<h3>적정 월 구독료</h3>${bars(cnt('price')) || '<p>아직 없음</p>'}
<h3>가장 마음에 든 점</h3>${bars(cnt('liked')) || '<p>아직 없음</p>'}
<h3>코멘트</h3><ul>${comments || '<li>아직 없음</li>'}</ul>
<p style="color:#94A3B8;font-size:12px">새로고침하면 갱신됩니다 · 데이터: feedback.jsonl</p>
</body></html>`);
});

/**
 * 런타임 설정 — 얼리버드 잔여/오픈 여부
 */
app.get('/config', (req, res) => {
  const rem = Math.max(0, EARLY_LIMIT - earlyCount());
  res.json({ earlyRemaining: rem, earlyOpen: rem > 0 });
});

/**
 * AI 프록시 — Claude 키를 서버 env(ANTHROPIC_API_KEY)에만 보관.
 * 앱은 /ai/status 가 enabled면 모든 AI 호출을 /ai 로 보냅니다(브라우저에 키 노출 없음).
 */
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || '';
const GCP_LOCATION = process.env.GCP_LOCATION || 'us-central1';
const GCP_SA_KEY = process.env.GCP_SA_KEY || '';   // 서비스 계정 JSON 문자열
function vertexConfigured() { return !!(GCP_PROJECT_ID && GCP_SA_KEY); }
function aiProvider() {
  const p = (process.env.AI_PROVIDER || '').toLowerCase();
  if (p === 'vertex' && vertexConfigured()) return 'vertex';
  if (p === 'anthropic' && ANTHROPIC_KEY) return 'anthropic';
  if (p === 'gemini' && GEMINI_KEY) return 'gemini';
  if (GEMINI_KEY) return 'gemini';          // 기본: Gemini API 우선
  if (vertexConfigured()) return 'vertex';  // Google Cloud 경로
  if (ANTHROPIC_KEY) return 'anthropic';
  return null;
}
let _vtok = null, _vexp = 0;
async function getVertexToken() {
  try {
    if (_vtok && Date.now() < _vexp - 60000) return _vtok;
    const sa = JSON.parse(GCP_SA_KEY);
    if (!sa.client_email || !sa.private_key) return null;
    const now = Math.floor(Date.now() / 1000);
    const b64 = function (o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); };
    const head = b64({ alg: 'RS256', typ: 'JWT' });
    const claim = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
    const signer = crypto.createSign('RSA-SHA256'); signer.update(head + '.' + claim); signer.end();
    const sig = signer.sign(sa.private_key).toString('base64url');
    const jwt = head + '.' + claim + '.' + sig;
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + encodeURIComponent(jwt) });
    const d = await r.json();
    if (!r.ok || !d.access_token) return null;
    _vtok = d.access_token; _vexp = Date.now() + (d.expires_in || 3600) * 1000;
    return _vtok;
  } catch (e) { return null; }
}
async function callGenAI(geminiBody) {
  const provider = aiProvider();
  if (provider === 'vertex') {
    const token = await getVertexToken();
    if (!token) return { ok: false, status: 500, raw: { error: 'vertex_token_failed' } };
    const host = (GCP_LOCATION === 'global') ? 'aiplatform.googleapis.com' : (GCP_LOCATION + '-aiplatform.googleapis.com');
    const url = 'https://' + host + '/v1/projects/' + GCP_PROJECT_ID + '/locations/' + GCP_LOCATION + '/publishers/google/models/' + GEMINI_MODEL + ':generateContent';
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(geminiBody) });
    const d = await r.json().catch(function () { return {}; });
    if (!r.ok) return { ok: false, status: r.status, raw: d };
    return { ok: true, raw: d };
  }
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY }, body: JSON.stringify(geminiBody) });
  const d = await r.json().catch(function () { return {}; });
  if (!r.ok) return { ok: false, status: r.status, raw: d };
  return { ok: true, raw: d };
}
function extractGenText(d) { const parts = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || []; return parts.map(function (x) { return x.text || ''; }).join(''); }
function toGemini(body) {
  const contents = [];
  let sys = null;
  if (body.system) sys = typeof body.system === 'string' ? body.system : (Array.isArray(body.system) ? body.system.map(b => b.text || '').join('\n') : '');
  (body.messages || []).forEach(m => {
    let text = '';
    if (typeof m.content === 'string') text = m.content;
    else if (Array.isArray(m.content)) text = m.content.map(x => typeof x === 'string' ? x : (x.text || '')).join('\n');
    contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text }] });
  });
  const gen = { contents, generationConfig: { maxOutputTokens: Math.max(body.max_tokens || 1024, 1024) } };
  if (GEMINI_MODEL.includes('flash')) gen.generationConfig.thinkingConfig = { thinkingBudget: 0 }; // 플래시: 내부 추론 비활성 — 토큰 전부를 답변에
  if (sys) gen.systemInstruction = { parts: [{ text: sys }] };
  if (typeof body.temperature === 'number') gen.generationConfig.temperature = body.temperature;
  return gen;
}
app.get('/ai/status', (req, res) => {
  const provider = aiProvider();
  res.json({ enabled: !!provider, provider: provider || null });
});
app.post('/ai', async (req, res) => {
  const provider = aiProvider();
  if (!provider) return res.status(503).json({ error: 'AI not configured (GEMINI/VERTEX/ANTHROPIC 미설정)' });
  if (typeof fetch === 'undefined') return res.status(500).json({ error: 'Node 18+ 필요(fetch 없음)' });
  try {
    if (provider === 'gemini' || provider === 'vertex') {
      const out = await callGenAI(toGemini(req.body || {}));
      if (!out.ok) return res.status(out.status || 500).json({ error: provider, detail: out.raw });
      return res.json({ content: [{ type: 'text', text: extractGenText(out.raw) }], _provider: provider, model: GEMINI_MODEL });
    }
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(req.body || {})
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    console.error('AI proxy error:', e);
    res.status(500).json({ error: String(e) });
  }
});

/**
 * 자동결제(빌링) — 월 구독. 빌링키는 포트원(PortOne V2)→KPN으로 발급·청구합니다.
 * ⚠ 데모 저장(billing-keys.jsonl, 평문). 운영은 암호화 저장/DB 권장.
 */
const BILLING_FILE = path.join(DATA_DIR, 'billing-keys.jsonl');
const billingMap = {}; // customerKey -> { customerKey, billingKey, cardCompany, last4, issuedAt }
function saveBilling(){ try { fs.writeFileSync(BILLING_FILE, Object.keys(billingMap).map(function(k){return JSON.stringify(billingMap[k]);}).join('\n')+'\n'); } catch(e){ console.error('billing save error:', e); } }
const EARLY_LIMIT = 100;
function earlyCount(){ return Object.keys(billingMap).filter(function(k){ var r=billingMap[k]; return r.status==='active' && (r.plan==='early'||r.plan==='early_annual'); }).length; }
try {
  if (fs.existsSync(BILLING_FILE)) {
    fs.readFileSync(BILLING_FILE, 'utf8').split('\n').filter(Boolean).forEach(function (l) {
      try { const r = JSON.parse(l); if (r.customerKey && r.billingKey) billingMap[r.customerKey] = r; } catch (e) {}
    });
  }
} catch (e) {}

/* (구) 토스 tossPost 함수와 /billing/issue 엔드포인트 제거됨 — 빌링키는 포트원 /billing/portone-issue 사용 */


/** ===== 포트원(PortOne V2) 결제 — KPN 채널 ===== */
const PORTONE_SECRET = process.env.PORTONE_API_SECRET || '';
const PORTONE_PRICE = { early: 5500, regular: 9900 };

// ── Supabase(외부 저장소) 연결 — 회원/체험/아이이름을 영구 저장(재배포에도 안 날아감) ──
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/,'');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SB_ON = !!(SUPABASE_URL && SUPABASE_KEY);
const TRIAL_DAYS = 14;
console.log(SB_ON ? '🗄️  Supabase 연결됨' : '⚠️  Supabase 미설정(임시 동작)');
function sbHeaders(extra){
  return Object.assign({ 'apikey': SUPABASE_KEY, 'Authorization':'Bearer '+SUPABASE_KEY, 'Content-Type':'application/json' }, extra||{});
}
async function sbGetMember(email){
  if(!SB_ON) return null;
  try{
    const r = await fetch(SUPABASE_URL + '/rest/v1/members?select=*&email=eq.' + encodeURIComponent(email), { headers: sbHeaders() });
    if(!r.ok) return null;
    const rows = await r.json();
    return (rows && rows[0]) || null;
  }catch(e){ console.error('sbGetMember:', String(e)); return null; }
}
async function sbUpsertMember(obj){
  if(!SB_ON) return null;
  try{
    obj.updated_at = new Date().toISOString();
    const r = await fetch(SUPABASE_URL + '/rest/v1/members', {
      method:'POST', headers: sbHeaders({ 'Prefer':'resolution=merge-duplicates,return=representation' }), body: JSON.stringify(obj)
    });
    if(!r.ok){ console.error('sbUpsertMember http', r.status); return null; }
    const rows = await r.json();
    return (rows && rows[0]) || null;
  }catch(e){ console.error('sbUpsertMember:', String(e)); return null; }
}
function isSubscriberEmail(email){
  email = (email||'').toLowerCase();
  return Object.keys(billingMap).some(function(k){ var r=billingMap[k]; return (r.email||'').toLowerCase()===email && r.status==='active'; });
}
function trialLeft(trialStart){
  if(!trialStart) return 0;
  var days = Math.floor((Date.now() - new Date(trialStart).getTime()) / 86400000);
  return Math.max(0, TRIAL_DAYS - days);
}

async function portoneCharge(rec){
  if (!PORTONE_SECRET) return { ok:false, message:'PORTONE_API_SECRET 미설정(테스트 단계)' };
  const paymentId = 'sub' + rec.customerKey.replace(/[^a-zA-Z0-9]/g,'') + new Date().toISOString().slice(0,7).replace(/-/g,'');
  try {
    const r = await fetch('https://api.portone.io/payments/' + encodeURIComponent(paymentId) + '/billing-key', {
      method:'POST',
      headers:{ 'Authorization':'PortOne ' + PORTONE_SECRET, 'Content-Type':'application/json' },
      body: JSON.stringify({ billingKey: rec.billingKey, orderName:'심지OS 월 구독', amount:{ total: rec.amount }, currency:'KRW' })
    });
    const data = await r.json().catch(function(){ return {}; });
    return { ok: r.ok, status: r.status, data: data };
  } catch(e){ return { ok:false, message:String(e) }; }
}
// 빌키 발급 결과 저장 — 프론트가 requestIssueBillingKey 성공 후 호출(공개)
app.post('/billing/portone-issue', async (req, res) => {
  const b = req.body || {};
  const billingKey = (b.billingKey || '').toString();
  if (!billingKey) return res.json({ ok:false, message:'빌링키가 없습니다.' });
  const plan = (b.plan === 'early') ? 'early' : 'regular';
  if (plan === 'early' && earlyCount() >= EARLY_LIMIT) return res.status(409).json({ ok:false, message:'얼리버드 100가정이 마감되었습니다. 정가로 함께해 주세요.' });
  const amount = PORTONE_PRICE[plan];                 // 서버 정가표 강제(위·변조 방지)
  const email = (b.email || '').toString().slice(0,120);
  const phone = (b.phone || '').toString().replace(/[^0-9]/g,'').slice(0,15);
  const customerKey = 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  const next = new Date(); next.setMonth(next.getMonth() + 1);
  const rec = { customerKey: customerKey, billingKey: billingKey, email: email, phone: phone, plan: plan, amount: amount,
                period:'month', status:'active', pg:'portone', issuedAt: new Date().toISOString(), nextBilling: next.toISOString() };
  billingMap[customerKey] = rec; saveBilling();
  if (email) sbUpsertMember({ email: email.toLowerCase(), status:'active', phone: phone||null }).catch(function(){});
  try { fs.appendFileSync(METRICS_FILE, JSON.stringify({ type:'subscription', childId:customerKey, status:'active', mrr:amount, amount:amount, period:'month', plan:plan, ts:Date.now() })+'\n'); } catch(e){}
  portoneCharge(rec).then(function(c){ if(c.ok){ rec.lastCharge = new Date().toISOString(); saveBilling(); } else { console.log('ℹ️ 첫 청구 보류:', c.message || (c.data && c.data.message)); } }).catch(function(){});
  console.log('🔑 [포트원] 빌키 저장:', customerKey, plan, amount + '원/월');
  return res.json({ ok:true, customerKey: customerKey });
});
// 이메일로 구독 상태 확인(공개) — 앱이 기기 변경·앱 재설치와 무관하게 구독을 인식하도록
app.get('/billing/status', (req, res) => {
  const email = (req.query.email || '').toString().trim().toLowerCase();
  if (!email) return res.json({ active: false });
  const active = Object.keys(billingMap).some(function(k){ var r = billingMap[k]; return (r.email||'').toLowerCase() === email && r.status === 'active'; });
  return res.json({ active: active });
});

// 이메일 로그인 겸 체험 시작/확인 — 앱 시작 화면이 호출(핵심)
app.post('/member/login', async (req, res) => {
  const b = req.body||{};
  const email = (b.email || '').toString().trim().toLowerCase();
  const phone = (b.phone || '').toString().replace(/[^0-9]/g,'').slice(0,15);
  if(!/\S+@\S+\.\S+/.test(email)) return res.json({ ok:false, message:'이메일 형식이 올바르지 않아요.' });
  const subscriber = isSubscriberEmail(email);
  if(!SB_ON){
    return res.json({ ok:true, status: subscriber?'active':'trial', trialDaysLeft: TRIAL_DAYS, childName:null, note:'no-store' });
  }
  let m = await sbGetMember(email);
  if(!m){
    m = await sbUpsertMember({ email: email, phone: phone||null, status: subscriber?'active':'trial', trial_start: new Date().toISOString() });
    return res.json({ ok:true, isNew:true, status: subscriber?'active':'trial', trialDaysLeft: TRIAL_DAYS,
      childName:(m&&m.child_name)||null, childGrade:(m&&m.child_grade)||null, childBand:(m&&m.child_band)||null });
  }
  if(phone && !m.phone){ sbUpsertMember({ email:email, phone:phone }).catch(function(){}); }  // 번호 없던 회원이면 채움
  let status;
  if(subscriber || m.status==='active'){ status='active'; if(m.status!=='active') sbUpsertMember({ email:email, status:'active' }).catch(function(){}); }
  else { status = trialLeft(m.trial_start) > 0 ? 'trial' : 'expired'; }
  return res.json({ ok:true, status: status, trialDaysLeft: trialLeft(m.trial_start),
    childName: m.child_name||null, childGrade: m.child_grade||null, childBand: m.child_band||null });
});

// 아이 프로필 저장(온보딩/부모의 이름변경) — 이메일에 묶어 기기 간 동기화
app.post('/member/profile', async (req, res) => {
  const b = req.body || {};
  const email = (b.email||'').toString().trim().toLowerCase();
  if(!/\S+@\S+\.\S+/.test(email)) return res.json({ ok:false, message:'이메일이 필요해요.' });
  const patch = { email: email };
  if(b.childName!=null)  patch.child_name  = String(b.childName).slice(0,40);
  if(b.childGrade!=null) patch.child_grade = String(b.childGrade).slice(0,20);
  if(b.childBand!=null)  patch.child_band  = String(b.childBand).slice(0,20);
  const m = await sbUpsertMember(patch);
  return res.json({ ok: !!(m || !SB_ON), childName:(m&&m.child_name)|| patch.child_name || null });
});

// 이메일 힌트 마스킹: abcde@gmail.com → ab****@gmail.com
function maskEmail(e){
  e=String(e||''); var at=e.indexOf('@'); if(at<1) return '****';
  return e.slice(0, Math.min(2,at)) + '****' + e.slice(at);
}
// 휴대폰으로 가입 이메일 찾기 — 전체가 아닌 '가린 힌트'로만 반환(공개)
app.post('/member/find-email', async (req, res) => {
  const phone = ((req.body||{}).phone || '').toString().replace(/[^0-9]/g,'').slice(0,15);
  if(phone.length < 10) return res.json({ ok:false, message:'휴대폰 번호를 정확히 입력해 주세요.' });
  if(!SB_ON) return res.json({ ok:false, message:'잠시 후 다시 시도해 주세요.' });
  try{
    const r = await fetch(SUPABASE_URL + '/rest/v1/members?select=email,updated_at&phone=eq.' + encodeURIComponent(phone) + '&order=updated_at.desc', { headers: sbHeaders() });
    const rows = r.ok ? await r.json() : [];
    if(!rows || !rows.length) return res.json({ ok:true, found:false });
    return res.json({ ok:true, found:true, hint: maskEmail(rows[0].email) });
  }catch(e){ console.error('find-email:', String(e)); return res.json({ ok:false, message:'조회 중 오류가 났어요.' }); }
});
// 단건결제 검증(선택) — 프론트가 requestPayment 성공 후 호출
app.post('/payment/portone-verify', async (req, res) => {
  const paymentId = ((req.body||{}).paymentId || '').toString();
  if (!paymentId) return res.json({ ok:false, message:'paymentId 없음' });
  if (!PORTONE_SECRET) return res.json({ ok:true, note:'테스트 단계(시크릿 미설정)' });
  try {
    const r = await fetch('https://api.portone.io/payments/' + encodeURIComponent(paymentId), { headers:{ 'Authorization':'PortOne ' + PORTONE_SECRET } });
    const data = await r.json().catch(function(){ return {}; });
    return res.json({ ok: r.ok, status: data.status, amount: (data.amount && data.amount.total) });
  } catch(e){ return res.json({ ok:false, message:String(e) }); }
});

// 자동 청구 — 운영자/스케줄러가 호출(관리자 인증 보호)
app.post('/billing/charge', adminAuth, async (req, res) => {
  const { customerKey } = req.body || {};
  if (!customerKey) return res.status(400).json({ message: 'customerKey가 필요합니다.' });
  const rec = billingMap[customerKey];
  if (!rec) return res.status(404).json({ message: '해당 customerKey의 빌링키가 없습니다.' });
  // 포트원(PortOne) 빌링키 청구로 통일 — chargeOne 재사용
  const ok = await chargeOne(rec);
  if (!ok) return res.status(502).json({ ok:false, message: '포트원 청구 실패(로그 확인)' });
  return res.json({ ok:true, customerKey: customerKey, amount: rec.amount, lastCharge: rec.lastCharge });
});

// 구독자 목록 (billingKey 비노출) — 관리자 인증
app.get('/billing/subscribers', adminAuth, (req, res) => {
  const list = Object.keys(billingMap).map(function (k) { const r = billingMap[k]; return { customerKey: r.customerKey, email: r.email||'', phone: r.phone||'', plan: r.plan||'', amount: r.amount||0, status: r.status||'active', cardCompany: r.cardCompany, last4: r.last4, issuedAt: r.issuedAt, nextBilling: r.nextBilling||'' }; });
  res.json({ count: list.length, active: list.filter(function(x){return x.status==='active';}).length, subscribers: list });
});
// 해지 — 다음 결제부터 중단(이미 결제한 기간은 만료까지 이용)
app.post('/billing/cancel', (req, res) => {
  const { customerKey } = req.body || {};
  const rec = billingMap[customerKey];
  if (!rec) return res.status(404).json({ message: '구독 정보를 찾을 수 없습니다.' });
  rec.status = 'canceled'; rec.canceledAt = new Date().toISOString(); saveBilling();
  try { fs.appendFileSync(METRICS_FILE, JSON.stringify({ type:'subscription', childId: customerKey, status:'canceled', ts:Date.now() })+'\n'); } catch(e){}
  return res.json({ ok: true });
});
// 월 자동청구 스케줄러
async function chargeOne(rec){
  // 매달 반복 자동청구 — 포트원(PortOne V2) 빌링키 결제. (이전: 토스페이먼츠 → 교체)
  if (!PORTONE_SECRET) { console.error('❌ 자동결제 불가: PORTONE_API_SECRET 미설정'); return false; }
  const ym = new Date().toISOString().slice(0,7).replace('-','');
  const paymentId = 'sub' + rec.customerKey.replace(/[^a-zA-Z0-9]/g,'') + ym;
  try {
    const r = await fetch('https://api.portone.io/payments/' + encodeURIComponent(paymentId) + '/billing-key', {
      method:'POST',
      headers:{ 'Authorization':'PortOne ' + PORTONE_SECRET, 'Content-Type':'application/json' },
      body: JSON.stringify({ billingKey: rec.billingKey, orderName:'심지OS 월 구독', amount:{ total: rec.amount }, currency:'KRW' })
    });
    const data = await r.json().catch(function(){ return {}; });
    if (r.ok) {
      const n = new Date(rec.nextBilling || Date.now()); n.setMonth(n.getMonth()+1); rec.nextBilling = n.toISOString(); rec.lastCharge = new Date().toISOString(); saveBilling();
      try { fs.appendFileSync(METRICS_FILE, JSON.stringify({ type:'charge', childId: rec.customerKey, amount: rec.amount, status:'paid', ts:Date.now() })+'\n'); } catch(e){}
      console.log('💳 자동결제 성공:', rec.customerKey, rec.amount+'원');
      return true;
    }
    console.error('❌ 자동결제 실패:', rec.customerKey, (data && (data.type || data.message)) || ('HTTP '+r.status));
    return false;
  } catch(e){ console.error('❌ 자동결제 오류:', rec.customerKey, String(e)); return false; }
}
async function runBillingCycle(){
  const now = Date.now(); let n=0;
  for (const k of Object.keys(billingMap)) { const rec = billingMap[k];
    if (rec.status==='active' && rec.nextBilling && new Date(rec.nextBilling).getTime() <= now) { await chargeOne(rec); n++; } }
  if (n) console.log('🔁 자동결제 주기 완료:', n+'건');
}
setTimeout(runBillingCycle, 60000); setInterval(runBillingCycle, 24*60*60*1000); // 부팅 1분 후 + 매일

/**
 * 성과지표 — 측정/구독 이벤트 적재 및 집계 (운영 콘솔 KPI 대시보드 소스)
 * POST /metrics/event  : 앱이 측정 이벤트를 적재(공개). {type:'measurement', childId, date, score, f, r}
 * GET  /metrics        : 집계 KPI 반환(개인정보 없음 · 공개). null이면 데이터 부족.
 */
app.post('/metrics/event', (req, res) => {
  const e = req.body || {};
  if (!e.type) return res.status(400).json({ message: 'type required' });
  e.ts = Date.now();
  try { fs.appendFileSync(METRICS_FILE, JSON.stringify(e) + '\n'); }
  catch (err) { return res.status(500).json({ message: 'write error' }); }
  res.json({ ok: true });
});
app.get('/metrics', (req, res) => {
  const DAY = 864e5, now = Date.now();
  let rows = [];
  try { if (fs.existsSync(METRICS_FILE)) rows = fs.readFileSync(METRICS_FILE, 'utf8').split('\n').filter(Boolean).map(function (l){ try { return JSON.parse(l); } catch(e){ return null; } }).filter(Boolean); } catch (e) {}
  const meas = rows.filter(function(r){ return r.type === 'measurement'; });
  const subs = rows.filter(function(r){ return r.type === 'subscription'; });
  const byChild = {};
  meas.forEach(function(r){ const c = byChild[r.childId] || (byChild[r.childId] = { days:{}, scores:[] }); if (r.date) c.days[r.date] = 1; if (typeof r.score === 'number') c.scores.push({ date: r.date, score: r.score }); });
  const ids = Object.keys(byChild);
  function firstDt(c){ const ds = Object.keys(byChild[c].days).sort(); return ds.length ? Date.parse(ds[0] + 'T00:00:00') : null; }
  // WAU
  const wau = {}; meas.forEach(function(r){ if (r.date && (now - Date.parse(r.date + 'T00:00:00')) <= 7*DAY) wau[r.childId] = 1; });
  // 4주 습관 지속률 (첫 28일 내 12일 이상 측정)
  let habN=0, habQ=0;
  ids.forEach(function(c){ const fd = firstDt(c); if (fd===null || now-fd < 28*DAY) return; habN++; let cnt=0; Object.keys(byChild[c].days).forEach(function(d){ const dt=Date.parse(d+'T00:00:00'); if (dt>=fd && dt<fd+28*DAY) cnt++; }); if (cnt>=12) habQ++; });
  const habit4 = habN ? habQ/habN : null;
  // W4 리텐션 (4주차 활동)
  let r4N=0, r4Q=0;
  ids.forEach(function(c){ const fd=firstDt(c); if (fd===null || now-fd < 35*DAY) return; r4N++; let act=false; Object.keys(byChild[c].days).forEach(function(d){ const dt=Date.parse(d+'T00:00:00'); if (dt>=fd+28*DAY && dt<fd+35*DAY) act=true; }); if (act) r4Q++; });
  const retentionW4 = r4N ? r4Q/r4N : null;
  // 코호트: 꾸준(주4+) vs 비꾸준 지수 변화
  const cons=[], spo=[];
  ids.forEach(function(c){ const sc = byChild[c].scores.slice().sort(function(a,b){ return a.date<b.date?-1:1; }); if (sc.length<4) return; const fd=firstDt(c); const span=Math.max(1,(now-fd)/DAY); const perWk = Object.keys(byChild[c].days).length/(span/7); const avg=function(z){ return z.reduce(function(a,b){return a+b;},0)/z.length; }; const base=avg(sc.slice(0,Math.min(7,sc.length)).map(function(x){return x.score;})); const rec=avg(sc.slice(-Math.min(7,sc.length)).map(function(x){return x.score;})); (perWk>=4?cons:spo).push(rec-base); });
  const mean=function(z){ return z.length?Math.round(z.reduce(function(a,b){return a+b;},0)/z.length):null; };
  const cohort = { nConsistent:cons.length, nSporadic:spo.length, consistentDelta:mean(cons), sporadicDelta:mean(spo) };
  // 구독자/MRR
  const subState={}; subs.forEach(function(r){ subState[r.childId]={status:r.status, mrr:r.mrr||10000}; });
  let subscribers=0, mrr=0; Object.keys(subState).forEach(function(k){ if (subState[k].status!=='cancelled'){ subscribers++; mrr+=subState[k].mrr; } });
  res.json({ totalChildren: ids.length, totalMeasurements: meas.length, wau: Object.keys(wau).length, habit4: habit4, retentionW4: retentionW4, cohort: cohort, subscribers: subscribers, mrr: mrr, generatedAt: new Date().toISOString() });
});

/**
 * 카카오 알림톡(Solapi) — 취침 전 감사·마음 → 부모 자동 발송
 * 환경변수: SOLAPI_API_KEY, SOLAPI_API_SECRET, KAKAO_PF_ID, KAKAO_TEMPLATE_ID, NOTIFY_FROM, NOTIFY_TEST_TO
 * 미설정 시 발송하지 않고 {configured:false} 반환 → 앱은 화면 내 초안/복사로 동작.
 */
const SOLAPI_KEY = process.env.SOLAPI_API_KEY || '';
const SOLAPI_SECRET = process.env.SOLAPI_API_SECRET || '';
const KAKAO_PF_ID = process.env.KAKAO_PF_ID || '';
const KAKAO_TEMPLATE_ID = process.env.KAKAO_TEMPLATE_ID || '';
const NOTIFY_FROM = process.env.NOTIFY_FROM || '';
const NOTIFY_TEST_TO = process.env.NOTIFY_TEST_TO || '';
function kakaoConfigured() { return !!(SOLAPI_KEY && SOLAPI_SECRET && KAKAO_PF_ID && KAKAO_TEMPLATE_ID && NOTIFY_FROM); }
async function solapiSendAlimtalk(to, variables) {
  if (!kakaoConfigured()) return { ok: false, configured: false, message: '카카오 알림톡 미설정' };
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString('hex');
  const signature = crypto.createHmac('sha256', SOLAPI_SECRET).update(date + salt).digest('hex');
  const auth = 'HMAC-SHA256 apiKey=' + SOLAPI_KEY + ', date=' + date + ', salt=' + salt + ', signature=' + signature;
  const body = { message: { to: String(to).replace(/[^0-9]/g, ''), from: String(NOTIFY_FROM).replace(/[^0-9]/g, ''), type: 'ATA', kakaoOptions: { pfId: KAKAO_PF_ID, templateId: KAKAO_TEMPLATE_ID, variables: variables || {}, disableSms: false } } };
  try {
    const r = await fetch('https://api.solapi.com/messages/v4/send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': auth }, body: JSON.stringify(body) });
    const d = await r.json().catch(function () { return {}; });
    if (!r.ok) return { ok: false, configured: true, status: r.status, detail: d };
    return { ok: true, configured: true, result: d };
  } catch (e) { return { ok: false, configured: true, error: String(e) }; }
}
app.get('/notify/status', (req, res) => res.json({ configured: kakaoConfigured() }));
// [테스트] 브라우저로 접속 → 미리 등록한 NOTIFY_TEST_TO(본인 번호)로 샘플 알림톡 1건 발송
app.get('/notify/test', async (req, res) => {
  if (!kakaoConfigured()) return res.json({ ok:false, configured:false, message:'카카오 알림톡 미설정 — Render 환경변수(SOLAPI/KAKAO)를 확인하세요' });
  if (!NOTIFY_TEST_TO) return res.json({ ok:false, configured:true, message:'NOTIFY_TEST_TO(테스트 수신번호) 미설정 — Render에 본인 휴대폰 번호를 추가하세요' });
  const variables = { '#{아이이름}': '민준', '#{오늘기록}': '오늘 친구랑 화해해서 마음이 편했어요.' };
  const out = await solapiSendAlimtalk(NOTIFY_TEST_TO, variables);
  res.json(out);
});

// [실제] 아이가 마음 한 줄을 남기면 앱이 호출 → 활성 구독자 보호자에게만 알림톡
app.post('/notify/record', async (req, res) => {
  const b = req.body || {};
  const email = (b.email || '').toString().trim().toLowerCase();
  const record = (b.record || '').toString().replace(/\s+/g, ' ').trim().slice(0, 180);
  if (!kakaoConfigured()) return res.json({ ok:false, configured:false });
  if (!/\S+@\S+\.\S+/.test(email)) return res.json({ ok:false, message:'이메일이 필요해요' });
  const subscriber = isSubscriberEmail(email);
  const m = await sbGetMember(email);
  const active = subscriber || (m && m.status === 'active');
  if (!active) return res.json({ ok:false, message:'구독자 전용 기능입니다' });   // 알림톡은 구독 기능
  const phone = (m && m.phone) || '';
  if (!phone) return res.json({ ok:false, message:'보호자 수신 번호가 없어요' });
  const childName = (b.childName || (m && m.child_name) || '우리 아이');
  const variables = { '#{아이이름}': childName, '#{오늘기록}': record || '오늘의 기록을 남겼어요.' };
  const out = await solapiSendAlimtalk(phone, variables);
  try { agentLog({ agent:'parent_comm', provider: aiProvider(), action: (out&&out.ok)?'sent_alimtalk':'failed', output: String(record).slice(0,200) }); } catch(e){}
  res.json(out);
});

// [관리자] 임의 번호로 알림톡 발송 테스트
app.post('/notify/kakao', adminAuth, async (req, res) => {
  const b = req.body || {};
  if (!b.to) return res.status(400).json({ message: 'to required' });
  const out = await solapiSendAlimtalk(b.to, b.variables || {});
  res.json(out);
});

/** ===== 홈페이지 AI 도우미 (심지OS 안내) ===== */
const SIMJI_FAQ = `
[심지OS란]
심지OS는 아이가 하루 짧은 시간, 뇌(腦)·마음(心)·지혜(智)·실천(動) 네 영역으로 마음과 습관을 키우는 성장 앱입니다. AI 친구와 함께 오늘의 마음을 살피고, 짧은 읽기(리딩마라톤)와 작은 실천을 기록합니다. 주소는 simjios.com 입니다.

[요금]
- 얼리버드(선착 100가정): 월 5,500원
- 정가: 월 9,900원
- 둘째 자녀부터 10% 할인은 고객센터로 문의하시면 적용해 드립니다.
구독은 simjios.com/subscribe 에서 안내합니다. 카드를 한 번 등록하면 매달 자동 결제되고, 언제든 해지할 수 있습니다.

[무료 체험과 구독]
가입하면 2주 동안 모든 기능을 무료로 체험할 수 있어요. 2주 무료 체험이 끝나면 구독으로 이어집니다(2주 안에 구독하지 않으면 이어서 사용할 수 없어요). 아이의 기록은 체험·구독 종료 후에도 한 달간 안전하게 보관되어, 그 안에 구독하시면 그대로 이어집니다. 구독하시면 카카오 알림톡(아이의 오늘 기록 도착)과 월간 성장 리포트 등 부모를 위한 기능도 이용하실 수 있어요. 형제 통합(구독 하나로 여러 자녀·둘째부터 10% 할인)은 곧 제공됩니다.

[환불]
이용권·환불에 대한 자세한 안내는 simjios.com/refund.html 페이지를 참고해 주세요.

[누가 쓰나]
초등학생부터 고등학생까지 사용할 수 있습니다. 만 14세 미만 자녀는 보호자(부모) 명의로 가입해 주세요.

[개인정보]
아이의 기록 원문·이름·연락처는 서버에 저장하지 않습니다. 기록은 아이 기기에 보관되고, 서버에는 익명 통계만 모입니다. 자세한 내용은 simjios.com/privacy 를 참고해 주세요.

[시작 방법]
simjios.com 에서 '앱 시작하기'를 누르고, 홈 화면에 추가하면 앱처럼 사용할 수 있습니다. 아이폰·안드로이드·PC 브라우저에서 모두 됩니다(앱스토어 설치 불필요).

[문의]
카카오 채널 http://pf.kakao.com/_hxaxbnX · 대표전화 1800-8699 · 이메일 hymps@naver.com
운영: 주식회사 제이디글로벌에듀
`;
const assistHits = {};
function assistAllow(ip){ const now=Date.now(); const arr=(assistHits[ip]||[]).filter(function(t){return now-t<300000;}); arr.push(now); assistHits[ip]=arr; return arr.length<=20; }
app.post('/assist', async (req, res) => {
  const q = ((req.body || {}).question || '').toString().slice(0, 400).trim();
  if (!q) return res.json({ answer: '안녕하세요! 심지OS 도우미예요. 요금·무료 시작·환불·시작 방법 등 무엇이든 물어보세요 🌱' });
  if (!assistAllow(req.ip || 'x')) return res.json({ answer: '문의가 잠시 몰렸어요. 잠시 후 다시 시도하시거나, 카카오 채널로 문의해 주세요.' });
  const system = "당신은 '심지OS 도우미'입니다. 아동 마음 성장 앱 심지OS 홈페이지의 안내 도우미예요. 아래 [정보]만 근거로, 부모님께 따뜻하고 간결하게(2~4문장) 한국어로 답하세요. [정보]에 없는 내용은 지어내지 말고 '정확한 안내를 위해 카카오 채널로 문의해 주세요'라고 안내하세요. 의료·법률적 단정은 피하고, 아이의 개인정보를 묻지 마세요.\n\n[정보]\n" + SIMJI_FAQ;
  try {
    const answer = await aiText(q, system, 400);
    res.json({ answer: answer || '죄송해요, 지금 답변을 불러오지 못했어요. 카카오 채널(pf.kakao.com/_hxaxbnX) 또는 1800-8699로 문의해 주세요.' });
  } catch (e) { res.json({ answer: '죄송해요, 잠시 오류가 있었어요. 카카오 채널로 문의해 주세요.' }); }
});

/** ===== AI 에이전트 러너 + 실행 로그 (XPRIZE: AI-Native Operations 증빙) ===== */
const AGENT_LOG = path.join(__dirname, 'agent_log.jsonl');
const AGENT_STATE = path.join(__dirname, 'agent_state.json');
function agentLog(entry) { entry.ts = Date.now(); entry.at = new Date().toISOString(); try { fs.appendFileSync(AGENT_LOG, JSON.stringify(entry) + '\n'); } catch (e) {} return entry; }
function loadAgentState() { try { return JSON.parse(fs.readFileSync(AGENT_STATE, 'utf8')); } catch (e) { return {}; } }
function saveAgentState(s) { try { fs.writeFileSync(AGENT_STATE, JSON.stringify(s)); } catch (e) {} }
function readMetricsRows() { let rows = []; try { if (fs.existsSync(METRICS_FILE)) rows = fs.readFileSync(METRICS_FILE, 'utf8').split('\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); } catch (e) {} return rows; }
function childMap(rows) { const m = {}; rows.filter(function (r) { return r.type === 'measurement'; }).forEach(function (r) { const c = m[r.childId] || (m[r.childId] = { days: {}, scores: [], last: 0 }); if (r.date) c.days[r.date] = 1; if (typeof r.score === 'number') c.scores.push({ date: r.date, score: r.score, ts: r.ts || 0 }); if ((r.ts || 0) > c.last) c.last = r.ts || 0; }); return m; }
async function aiText(prompt, system, maxTokens) {
  const provider = aiProvider();
  if (!provider) return null;
  try {
    if (provider === 'gemini' || provider === 'vertex') {
      const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: Math.max(maxTokens || 300, 512) } };
      if (GEMINI_MODEL.includes('flash')) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
      if (system) body.systemInstruction = { parts: [{ text: system }] };
      const out = await callGenAI(body);
      if (!out.ok) return null;
      return extractGenText(out.raw) || null;
    }
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens || 300, system: system || undefined, messages: [{ role: 'user', content: prompt }] }) });
    if (!r.ok) return null;
    const d = await r.json();
    return (d.content && d.content[0] && d.content[0].text) || null;
  } catch (e) { return null; }
}
async function runOnboarding(state) {
  const rows = readMetricsRows(); const since = state.onboarding || 0;
  const subs = rows.filter(function (r) { return r.type === 'subscription' && (r.ts || 0) > since; });
  let n = 0;
  for (const s of subs) {
    const msg = (await aiText('새로 구독한 가정에 보낼 따뜻한 환영 + 첫 1분 측정 안내를 한국어 2문장으로.', '아동 뇌·마음 습관 서비스의 온보딩 도우미. 비의료, 따뜻하게.', 200)) || '환영합니다! 오늘 1분 측정으로 아이의 하루를 시작해 보세요.';
    agentLog({ agent: 'onboarding', childId: s.childId, provider: aiProvider(), action: kakaoConfigured() ? 'queued_alimtalk' : 'queued', output: msg.slice(0, 300) }); n++;
  }
  state.onboarding = Date.now(); return n;
}
async function runWeeklyReport() {
  const m = childMap(readMetricsRows()); const now = Date.now(); let n = 0;
  for (const cid of Object.keys(m)) {
    const recent = m[cid].scores.filter(function (s) { return now - (s.ts || 0) <= 7 * 864e5; });
    if (!recent.length) continue;
    const avg = Math.round(recent.reduce(function (a, b) { return a + b.score; }, 0) / recent.length);
    const msg = (await aiText('자녀 최근 7일 평균 지수 ' + avg + '점, 측정 ' + recent.length + '회. 부모용 주간 요약과 격려 한마디를 한국어 2문장으로.', '아동 성장 리포트 코치. 비의료, 평가보다 격려.', 220)) || ('이번 주 평균 ' + avg + '점, ' + recent.length + '회 측정했어요. 꾸준함이 가장 큰 힘입니다.');
    agentLog({ agent: 'weekly_report', childId: cid, provider: aiProvider(), metric: { avg: avg, count: recent.length }, action: 'generated', output: msg.slice(0, 300) }); n++;
  }
  return n;
}
async function runAnomaly() {
  const m = childMap(readMetricsRows()); const now = Date.now(); let n = 0;
  for (const cid of Object.keys(m)) {
    const days = Object.keys(m[cid].days).sort();
    const last = days.length ? Date.parse(days[days.length - 1] + 'T00:00:00') : 0;
    const gap = last ? Math.floor((now - last) / 864e5) : 999;
    const sc = m[cid].scores.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    let decline = false;
    if (sc.length >= 6) { const half = Math.floor(sc.length / 2); const avg = function (z) { return z.reduce(function (x, y) { return x + y.score; }, 0) / z.length; }; decline = (avg(sc.slice(-half)) - avg(sc.slice(0, half))) <= -8; }
    if (gap >= 5 || decline) {
      const reason = decline ? '지수 하락 추세' : ('장기 미측정(' + gap + '일)');
      const msg = (await aiText('아동의 ' + reason + ' 상황. 상담교사가 부모와 부드럽게 점검할 에스컬레이션 메모를 한국어 2문장으로. 진단·단정 금지.', '아동 웰빙 모니터링. 비의료, 신중.', 200)) || (reason + ' 감지 — 상담교사 점검 권장.');
      agentLog({ agent: 'anomaly', childId: cid, provider: aiProvider(), signal: reason, action: 'escalated', output: msg.slice(0, 300) }); n++;
    }
  }
  return n;
}
async function runRetention() {
  const m = childMap(readMetricsRows()); const now = Date.now(); let n = 0;
  for (const cid of Object.keys(m)) {
    const days = Object.keys(m[cid].days).sort();
    const last = days.length ? Date.parse(days[days.length - 1] + 'T00:00:00') : 0;
    const gap = last ? Math.floor((now - last) / 864e5) : 999;
    if (gap >= 3 && gap < 999) {
      const msg = (await aiText(gap + '일 측정을 쉰 아이에게 부담 없이 다시 1분 측정을 권하는 따뜻한 재참여 메시지를 한국어 1~2문장으로.', '아동 습관 코치. 죄책감 금지, 가볍게.', 180)) || ('며칠 쉬었네요. 오늘 딱 1분, 다시 가볍게 시작해볼까요?');
      agentLog({ agent: 'retention', childId: cid, provider: aiProvider(), gapDays: gap, action: kakaoConfigured() ? 'queued_alimtalk' : 'queued', output: msg.slice(0, 300) }); n++;
    }
  }
  return n;
}
async function runContent() {
  const msg = (await aiText('초등학생용 짧은 독서 습관 퀴즈 1개(질문+보기 3개)와 한 줄 요약 팁을 한국어로.', '아동 학습 콘텐츠 생성기. 쉽고 긍정적으로.', 300)) || '오늘의 질문: 오늘 읽은 이야기에서 가장 기억에 남는 장면은? (1)시작 (2)중간 (3)끝';
  agentLog({ agent: 'content', provider: aiProvider(), action: 'generated', output: msg.slice(0, 400) }); return 1;
}
async function runAgent(name, state) {
  if (name === 'onboarding') return await runOnboarding(state);
  if (name === 'weekly_report') return await runWeeklyReport();
  if (name === 'anomaly') return await runAnomaly();
  if (name === 'retention') return await runRetention();
  if (name === 'content') return await runContent();
  return null;
}
app.post('/agents/run/:name', adminAuth, async (req, res) => {
  const state = loadAgentState(); const name = req.params.name;
  let r; try { r = await runAgent(name, state); } catch (e) { return res.status(500).json({ message: 'agent error', error: String(e) }); }
  if (r === null) return res.status(400).json({ message: 'unknown agent', name: name });
  state['last_' + name] = Date.now(); saveAgentState(state);
  res.json({ ok: true, agent: name, actions: r, provider: aiProvider() });
});
app.post('/agents/run', adminAuth, async (req, res) => {
  const state = loadAgentState(); const out = {};
  for (const name of ['onboarding', 'weekly_report', 'anomaly', 'retention', 'content']) {
    try { out[name] = await runAgent(name, state); state['last_' + name] = Date.now(); } catch (e) { out[name] = 'error'; }
  }
  saveAgentState(state);
  agentLog({ agent: 'runner', provider: aiProvider(), action: 'batch', output: JSON.stringify(out) });
  res.json({ ok: true, ran: out, provider: aiProvider(), at: new Date().toISOString() });
});
app.get('/admin/agent-logs', adminAuth, (req, res) => {
  let rows = []; try { if (fs.existsSync(AGENT_LOG)) rows = fs.readFileSync(AGENT_LOG, 'utf8').split('\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); } catch (e) {}
  const limit = Math.min(parseInt(req.query.limit || '200', 10) || 200, 1000);
  const recent = rows.slice(-limit).reverse();
  if (req.query.html) {
    const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
    const trs = recent.map(function (r) { return '<tr><td>' + esc(r.at) + '</td><td>' + esc(r.agent) + '</td><td>' + esc(r.action) + '</td><td>' + esc(r.childId || '') + '</td><td>' + esc(r.provider || '') + '</td><td>' + esc((r.output || '').slice(0, 160)) + '</td></tr>'; }).join('');
    return res.send('<!doctype html><meta charset="utf-8"><title>Agent logs</title><style>body{font-family:sans-serif;padding:16px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}th{background:#1A2E4A;color:#fff}</style><h3>SIMJI OS · Agent execution logs (' + rows.length + ')</h3><table><tr><th>time</th><th>agent</th><th>action</th><th>childId</th><th>provider</th><th>output</th></tr>' + trs + '</table>');
  }
  res.json({ total: rows.length, count: recent.length, logs: recent });
});

/* ===================== 오케스트레이터 (교육OS 커널) =====================
   모든 이벤트/상태를 받아 '지금 이 아이에게 무엇을(또는 아무것도 안) 할지' 결정.
   규칙: 안전 최우선 > 부모연결 > (실시간 측정코치) > 이상 > 복귀 > 주간 > 온보딩.
   과알림 방지(하루 상한·조용한 시간), 중복 방지, 모든 결정을 로그(보류 사유 포함). */
const ORCH_QUIET_START = 22, ORCH_QUIET_END = 7;   // 조용한 시간(밤). 운영 시 서버 TZ 주의
const ORCH_DAILY_NOTIFY_CAP = 2;
function orchInQuietHours() { const h = new Date().getHours(); return (h >= ORCH_QUIET_START || h < ORCH_QUIET_END); }
function buildOrchestratorStates() {
  const rows = readMetricsRows(); const today = new Date().toISOString().slice(0, 10); const now = Date.now();
  const byChild = {};
  rows.forEach(function (r) {
    const cid = r.childId || 'demo';
    const c = byChild[cid] || (byChild[cid] = { id: cid, dates: {}, todaySafety: false, todayGratitude: false, scores: [] });
    if (r.date) c.dates[r.date] = 1;
    if (r.date === today) { if (r.type === 'safety_flag') c.todaySafety = true; if (r.type === 'gratitude') c.todayGratitude = true; if (r.type === 'growth_moment') c.todayGrowth = r.kind || true; if (r.type === 'milestone') c.todayGrowth = (r.days || '') + '일 마일스톤'; }
    if (r.type === 'measurement' && typeof r.score === 'number') c.scores.push({ date: r.date, score: r.score });
  });
  Object.keys(byChild).forEach(function (cid) {
    const c = byChild[cid]; const days = Object.keys(c.dates).sort();
    const last = days.length ? Date.parse(days[days.length - 1] + 'T00:00:00') : 0;
    c.gapDays = last ? Math.floor((now - last) / 864e5) : 999; c.activeDays = days.length;
    const sc = c.scores.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }); c.decline = false;
    if (sc.length >= 6) { const h = Math.floor(sc.length / 2); const avg = function (z) { return z.reduce(function (x, y) { return x + y.score; }, 0) / z.length; }; c.decline = (avg(sc.slice(-h)) - avg(sc.slice(0, h))) <= -8; }
  });
  return byChild;
}
function orchCandidates(c) {
  const cand = [];
  if (c.todaySafety) cand.push({ agent: 'safety_escalation', prio: 1, reason: '안전 신호 감지', notify: true });
  if (c.todayGratitude) cand.push({ agent: 'parent_comm', prio: 2, reason: '감사 제출 → 부모 대화', notify: true });
  if (c.todayGrowth) cand.push({ agent: 'growth_report', prio: 3, reason: '변화 감지(' + c.todayGrowth + ') → 부모 확인', notify: true });
  if (c.decline) cand.push({ agent: 'anomaly', prio: 4, reason: '지수 하락 추세', notify: false });
  if (c.gapDays >= 3 && c.gapDays < 999) cand.push({ agent: 'retention', prio: 5, reason: c.gapDays + '일 미접속', notify: true });
  cand.push({ agent: 'weekly_report', prio: 6, reason: '주간 요약', notify: false, weekly: true });
  if (c.activeDays === 0 || c.gapDays === 999) cand.push({ agent: 'onboarding', prio: 7, reason: '신규/첫 활동', notify: true });
  return cand.sort(function (a, b) { return a.prio - b.prio; });
}
async function orchMessage(a, c) {
  if (a.agent === 'safety_escalation') return (await aiText('아동에게 괴로움·위험 신호 감지. 상담교사·보호자가 신중히 다가갈 에스컬레이션 메모를 한국어 2문장으로. 진단·단정 금지, 사람의 돌봄 강조.', '아동 안전 모니터링. 비의료, 매우 신중.', 200)) || '안전 신호 감지 — 보호자·상담교사의 신중한 돌봄이 필요합니다.';
  if (a.agent === 'parent_comm') return (await aiText('아이가 오늘 감사를 남겼어요. 부모가 자기 전 1분 대화를 열 부드러운 질문 한 줄을 한국어로.', '아동-부모 연결 도우미. 따뜻하게.', 160)) || '오늘 아이가 고마워한 일을 함께 이야기해 보세요.';
  if (a.agent === 'growth_report') return (await aiText('아이에게 의미 있는 변화가 감지됨: ' + (c.todayGrowth || '성장의 순간') + '. 부모에게 이 변화를 알리고 오늘 한마디 칭찬으로 확인해 주길 권하는 따뜻한 2문장을 한국어로. 평가·진단 금지.', '아동 성장 알림 도우미.', 180)) || '오늘 아이에게 의미 있는 변화의 순간이 있었어요. 한마디 칭찬으로 그 변화를 확인해 주세요.';
  if (a.agent === 'retention') return (await aiText(c.gapDays + '일 쉰 아이에게 부담 없이 다시 1분을 권하는 따뜻한 복귀 메시지를 한국어 1~2문장으로.', '아동 습관 코치. 죄책감 금지, 복귀 축하.', 160)) || '며칠 쉬었어도 괜찮아요. 돌아와줘서 반가워요 — 오늘 딱 1분!';
  if (a.agent === 'anomaly') return (await aiText('아동 지수 하락 추세. 상담교사 점검용 메모 2문장. 진단 금지.', '아동 웰빙 모니터링. 신중.', 180)) || '최근 지수 하락 추세 — 상담교사 점검 권장.';
  if (a.agent === 'weekly_report') return (await aiText('자녀 주간 활동 요약과 격려 한마디를 한국어 2문장으로.', '아동 성장 리포트. 평가보다 격려.', 200)) || '이번 주도 함께했어요. 꾸준함이 가장 큰 힘입니다.';
  if (a.agent === 'onboarding') return (await aiText('신규 가정 환영 + 첫 1분 안내 2문장.', '온보딩 도우미. 따뜻하게.', 160)) || '환영합니다! 오늘 1분으로 시작해 보세요.';
  return null;
}
async function orchestrateChild(c, state) {
  const today = new Date().toISOString().slice(0, 10);
  const all = state.orch || (state.orch = {});
  const cs = all[c.id] || (all[c.id] = { day: today, notifyCount: 0, doneAgents: {}, lastWeekly: 0 });
  if (cs.day !== today) { cs.day = today; cs.notifyCount = 0; cs.doneAgents = {}; }
  const cands = orchCandidates(c); const decisions = []; let chosen = null;
  for (const a of cands) {
    let suppress = null;
    if (cs.doneAgents[a.agent]) suppress = '오늘 이미 실행';
    else if (a.weekly && (Date.now() - (cs.lastWeekly || 0) < 7 * 864e5)) suppress = '주간 주기 미도달';
    else if (chosen) suppress = (chosen.agent === 'safety_escalation') ? '안전 우선 — 일상 알림 보류' : '하루 한 가지로 집중(우선순위 낮음)';
    else if (a.notify && a.agent !== 'safety_escalation' && cs.notifyCount >= ORCH_DAILY_NOTIFY_CAP) suppress = '하루 알림 상한 초과';
    else if (a.notify && a.agent !== 'safety_escalation' && orchInQuietHours() && a.agent !== 'parent_comm') suppress = '조용한 시간';
    if (suppress) { decisions.push({ agent: a.agent, decision: '보류', reason: suppress }); continue; }
    chosen = a; decisions.push({ agent: a.agent, decision: '채택', reason: a.reason });
  }
  let executed = null;
  if (chosen) {
    const msg = await orchMessage(chosen, c);
    cs.doneAgents[chosen.agent] = 1; if (chosen.weekly) cs.lastWeekly = Date.now(); if (chosen.notify) cs.notifyCount++;
    agentLog({ agent: 'orchestrator', childId: c.id, provider: aiProvider(), action: 'decide', chosen: chosen.agent, decisions: decisions, output: (msg || '').slice(0, 300) });
    executed = { agent: chosen.agent, msg: msg };
  } else {
    agentLog({ agent: 'orchestrator', childId: c.id, provider: aiProvider(), action: 'no_action', decisions: decisions, output: '보낼 것 없음' });
  }
  return { child: c.id, chosen: chosen ? chosen.agent : null, decisions: decisions, executed: executed };
}
/* ===================== 관리자 대시보드 ===================== */
function buildDashboardData() {
  const rows = readMetricsRows();
  const today = new Date().toISOString().slice(0, 10);
  const week = []; for (let i = 6; i >= 0; i--) { week.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)); }
  const kids = {}; let todayEvents = 0, safetyTotal = 0, safetyToday = 0; const typeCount = {};
  rows.forEach(function (r) {
    const cid = r.childId || 'demo';
    const k = kids[cid] || (kids[cid] = { id: cid, days: {}, last: '', todayCnt: 0, safety: 0 });
    if (r.date) { k.days[r.date] = 1; if (r.date > k.last) k.last = r.date; }
    if (r.date === today) { k.todayCnt++; todayEvents++; }
    if (r.type === 'safety_flag') { k.safety++; safetyTotal++; if (r.date === today) safetyToday++; }
    if (week.indexOf(r.date) >= 0 && r.type) { typeCount[r.type] = (typeCount[r.type] || 0) + 1; }
  });
  const kidList = Object.keys(kids).map(function (c) { const k = kids[c]; return { id: k.id, days: Object.keys(k.days).length, last: k.last, todayCnt: k.todayCnt, safety: k.safety }; }).sort(function (a, b) { return b.last > a.last ? 1 : -1; });
  let decisions = [];
  try {
    decisions = fs.readFileSync(AGENT_LOG, 'utf8').trim().split('\n')
      .map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } })
      .filter(function (o) { return o && o.agent === 'orchestrator' && (o.action === 'decide' || o.action === 'no_action'); })
      .slice(-10).reverse()
      .map(function (o) { return { childId: o.childId, chosen: o.chosen, decisions: o.decisions || [] }; });
  } catch (e) { }
  return { today: today, totalKids: kidList.length, todayActive: kidList.filter(function (k) { return k.todayCnt > 0; }).length, todayEvents: todayEvents, safetyToday: safetyToday, safetyTotal: safetyTotal, typeCount: typeCount, kids: kidList, decisions: decisions };
}
app.get('/admin/dashboard.json', adminAuth, (req, res) => res.json(buildDashboardData()));

// 회원 목록(구독·체험) — Supabase members 표에서 조회
app.get('/admin/members.json', adminAuth, async (req, res) => {
  if (!SB_ON) return res.json({ ok:false, configured:false, members:[] });
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/members?select=*&order=created_at.desc', { headers: sbHeaders() });
    const rows = r.ok ? await r.json() : [];
    const list = (rows || []).map(function (m) {
      const sub = isSubscriberEmail(m.email) || m.status === 'active';
      const left = trialLeft(m.trial_start);
      const status = sub ? 'active' : (left > 0 ? 'trial' : 'expired');
      return { email: m.email, childName: m.child_name || '', childGrade: m.child_grade || '', phone: m.phone || '', status: status, trialStart: (m.trial_start || '').slice(0, 10), trialLeft: left };
    });
    const summary = {
      total: list.length,
      active: list.filter(function (x) { return x.status === 'active'; }).length,
      trial: list.filter(function (x) { return x.status === 'trial'; }).length,
      expired: list.filter(function (x) { return x.status === 'expired'; }).length
    };
    return res.json({ ok:true, configured:true, summary: summary, members: list });
  } catch (e) { return res.json({ ok:false, error: String(e), members: [] }); }
});
app.get('/admin/dashboard', adminAuth, (req, res) => res.sendFile(path.join(__dirname, 'SimjiOs_admin.html')));

app.post('/agents/orchestrate', adminAuth, async (req, res) => {
  const state = loadAgentState(); const states = buildOrchestratorStates(); const results = [];
  for (const cid of Object.keys(states)) { try { results.push(await orchestrateChild(states[cid], state)); } catch (e) { results.push({ child: cid, error: String(e) }); } }
  saveAgentState(state);
  agentLog({ agent: 'orchestrator', provider: aiProvider(), action: 'run', output: JSON.stringify(results.map(function (r) { return r.child + ':' + (r.chosen || '-'); })) });
  res.json({ ok: true, children: Object.keys(states).length, results: results, provider: aiProvider(), at: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log('────────────────────────────────────────────');
  console.log(' SIMJI OS 결제 서버 실행 중 (결제: 포트원→KPN)');
  console.log(' 브라우저에서 → http://localhost:' + PORT);
  console.log('────────────────────────────────────────────');
});
