#!/usr/bin/env bash
# SIMJI OS 배포 리허설 — 운영 환경과 동일하게 로컬 점검
set -u
cd "$(dirname "$0")"

PORT="${PORT:-8080}"
ADMIN_USER="${ADMIN_USER:-jd}"
ADMIN_PASS="${ADMIN_PASS:-simji0620}"
BASE="http://localhost:${PORT}"
PASS=0; FAIL=0
ck(){ if [ "$1" = "$2" ]; then echo "  ✅ $3 (기대 $1)"; PASS=$((PASS+1)); else echo "  ❌ $3 (기대 $1, 실제 $2)"; FAIL=$((FAIL+1)); fi; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " SIMJI OS 배포 리허설"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "① 깨끗한 설치 (npm install)…"
rm -rf node_modules
npm install --no-audit --no-fund >/tmp/rehearse_install.log 2>&1
if [ $? -ne 0 ]; then echo "  ❌ npm install 실패 (/tmp/rehearse_install.log 확인)"; exit 1; fi
echo "  ✅ 설치 완료"

echo "② 운영용 환경변수로 기동…"
PORT="$PORT" ADMIN_USER="$ADMIN_USER" ADMIN_PASS="$ADMIN_PASS" \
  TOSS_SECRET_KEY="${TOSS_SECRET_KEY:-test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6}" \
  node server.js >/tmp/rehearse_server.log 2>&1 &
SRV=$!
sleep 2

echo "③ 엔드포인트 점검…"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/")
ck 200 "$code" "GET /  (앱 로딩)"

code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/confirm" -H "Content-Type: application/json" -d '{}')
ck 400 "$code" "POST /confirm  (빈 요청 방어)"

ok=$(curl -s -X POST "$BASE/feedback" -H "Content-Type: application/json" \
  -d '{"event":"rehearsal","child":"리허설","pay":"네, 돈 내고 쓸래요","price":"월 1만원","liked":"부모 리포트"}' | grep -c '"ok":true')
ck 1 "$ok" "POST /feedback  (응답 저장)"

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/admin/feedback")
ck 401 "$code" "GET /admin/feedback  (인증 없음 → 차단)"

code=$(curl -s -o /dev/null -w "%{http_code}" -u "$ADMIN_USER:$ADMIN_PASS" "$BASE/admin/feedback")
ck 200 "$code" "GET /admin/feedback  (인증 있음 → 허용)"

kill $SRV 2>/dev/null
rm -f feedback.jsonl

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " 결과: 통과 $PASS · 실패 $FAIL"
[ "$FAIL" -eq 0 ] && echo " 🎉 배포 준비 완료" || echo " ⚠ 실패 항목을 확인하세요"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
exit $FAIL
