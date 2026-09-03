#!/usr/bin/env bash
# ============================================================
# Plan Do See Diary — T07 검증용 curl 스크립트 (템플릿)
#
# 사용법:
#   1. 아래 변수들을 실제 값으로 채운다 (SUPABASE_URL, ANON_KEY는
#      config.js와 동일한 값 — anon key는 비밀값이 아니라 공개해도 됨).
#   2. 브라우저에서 계정 A/B로 각각 로그인한 뒤 개발자 도구 Network
#      탭에서 Authorization: Bearer 뒤의 토큰을 복사해 TOKEN_A / TOKEN_B에 붙여넣는다.
#   3. bash verify.sh 로 실행하고, 출력 전체를
#      docs/07_인증구현설명서.md ④의 각 자리에 옮겨 적는다.
#   4. 문서에 옮겨 적을 때 토큰은 앞 10글자만 남기고 "…생략"으로 가린다.
# ============================================================

set -euo pipefail

SUPABASE_URL="https://YOUR-PROJECT-REF.supabase.co"
ANON_KEY="YOUR-ANON-PUBLIC-KEY"
TOKEN_A="EMAIL_A로 로그인 후 발급받은 access_token"
TOKEN_B="EMAIL_B로 로그인 후 발급받은 access_token"
RECORD_ID_B="B 계정 소유의 기록 id 하나 (B로 로그인해 목록에서 확인)"

sep() { echo; echo "===================================================="; echo "$1"; echo "===================================================="; }

sep "(1) 로그인하지 않고 자료 직접 요청 — 거절 확인"
curl -sS -i "$SUPABASE_URL/rest/v1/records" \
  -H "apikey: $ANON_KEY"
# Authorization 헤더를 아예 안 보냄 = 비로그인 상태

sep "(2-1) 로그인 상태 성공 응답"
curl -sS -i "$SUPABASE_URL/rest/v1/records" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_A"

sep "(2-2) 로그아웃 후 같은 토큰으로 재요청 — 위에서 로그아웃한 뒤 실행할 것"
curl -sS -i "$SUPABASE_URL/rest/v1/records" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_A"

sep "(3-1) A로 로그인해 B의 기록 읽기 시도"
curl -sS -i "$SUPABASE_URL/rest/v1/records?id=eq.$RECORD_ID_B" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_A"

sep "(3-2) A로 로그인해 B의 기록 수정 시도"
curl -sS -i -X PATCH "$SUPABASE_URL/rest/v1/records?id=eq.$RECORD_ID_B" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"value": 999}'

sep "(3-3) A로 로그인해 B의 기록 삭제 시도"
curl -sS -i -X DELETE "$SUPABASE_URL/rest/v1/records?id=eq.$RECORD_ID_B" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_A"

sep "(4) 주소에 다른 계정 UUID를 넣어 조회해도 내 자료만 옴"
echo "user_id 필터를 다른 계정 UUID로 걸어도, RLS가 결과를 다시 auth.uid()로 거른다:"
curl -sS -i "$SUPABASE_URL/rest/v1/records?user_id=eq.<B의 UUID>" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_A"

sep "(5) 목록 응답에 남의 자료가 없는지 — A로 로그인해 전체 목록 조회"
curl -sS -i "$SUPABASE_URL/rest/v1/records" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_A"
echo
echo "위 응답의 모든 행에서 user_id가 전부 A 자신의 UUID와 같은지 눈으로 확인."

sep "완료 — 위 출력 전체를 docs/07_인증구현설명서.md ④에 옮겨 적고 토큰은 가릴 것"
