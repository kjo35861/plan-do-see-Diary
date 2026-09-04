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

SUPABASE_URL="https://eteunidypthhlwvenyos.supabase.co"
ANON_KEY="sb_publishable_bNq1d7KIzzXqi8zGlDvqsw_ZxtmZoM4"
TOKEN_A="eyJhbGciOiJFUzI1NiIsImtpZCI6IjYzODdhNTcwLWEzNjAtNDE5ZS04ZDA0LWI2ZDU0NGYyMGMyNiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2V0ZXVuaWR5cHRoaGx3dmVueW9zLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJlNGY1NmY2Yi1iNTA5LTQyY2MtOWY2My04NWE2MGI3OTU3ODEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzg4NDI0MDU0LCJpYXQiOjE3ODg0MjA0NTQsImVtYWlsIjoia2t1dTEwNDRAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbCI6ImtrdXUxMDQ0QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6ImU0ZjU2ZjZiLWI1MDktNDJjYy05ZjYzLTg1YTYwYjc5NTc4MSJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzg4NDIwNDU0fV0sInNlc3Npb25faWQiOiJmYzNhZjI2Mi1mNTkwLTRiODktYWU3MC0yYTdjMjRjMjI5YWEiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.iCfOp5Gm-hmFagWY14WP5z2OP2c0hjocX0ak715yhILfPsZSZV7auuWO7ItkIZcNlBd9TDDPH18dfhj1AnDaYw"

TOKEN_B="eyJhbGciOiJFUzI1NiIsImtpZCI6IjYzODdhNTcwLWEzNjAtNDE5ZS04ZDA0LWI2ZDU0NGYyMGMyNiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2V0ZXVuaWR5cHRoaGx3dmVueW9zLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4ODk0MDc1MS1kM2FlLTRhMTktYjE0My0zZTA3NzAxODBiMDAiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzg4NDI0MTMxLCJpYXQiOjE3ODg0MjA1MzEsImVtYWlsIjoia2t1MjJ1MTA0NEBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoia2t1MjJ1MTA0NEBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiI4ODk0MDc1MS1kM2FlLTRhMTktYjE0My0zZTA3NzAxODBiMDAifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc4ODQyMDUzMX1dLCJzZXNzaW9uX2lkIjoiYzQ0MGUzMzYtNzI2Ny00MTNkLWI0M2ItYzIwMDEzZjIwYWVlIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.zerViTl2kmA_Tm_K1HLoDfr2RMjE9N5iKFEUyKG3jpPDmDsjM05bUU9KA11NV80i5lLeV9ibrWgGp9rmEZVn_Q"

RECORD_ID_B="3563d85e-801b-4ca9-a2c6-76b94723bb73"

sep() { echo; echo "===================================================="; echo "$1"; echo "===================================================="; }
 
sep "(1) 로그인하지 않고 자료 직접 요청 — 거절 확인"
curl -sS -i "$SUPABASE_URL/rest/v1/records" \
  -H "apikey: $ANON_KEY"
# Authorization 헤더를 아예 안 보냄 = 비로그인 상태
 
sep "(2-1) 로그인 상태 성공 응답"
curl -sS -i "$SUPABASE_URL/rest/v1/records" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_A"
 
sep "여기서 잠깐 멈춥니다"
echo "지금 브라우저에서 A 계정으로 실제 '로그아웃' 버튼을 누르세요."
echo "(TOKEN_A 값 자체는 그대로 두고, 브라우저에서만 로그아웃합니다)"
read -p "로그아웃을 마쳤으면 Enter를 눌러 계속... " _
 
sep "(2-2) 로그아웃 후 같은 토큰으로 재요청"
curl -sS -i "$SUPABASE_URL/rest/v1/records" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_A"
 
sep "(3-1) A로 로그인해 B의 기록 읽기 시도"
curl -sS -i "$SUPABASE_URL/rest/v1/records?id=eq.$RECORD_ID_B" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_A"
 
sep "(3-2) A로 로그인해 B의 기록 수정 시도 (영향받은 행을 그대로 돌려받아 0건인지 확인)"
curl -sS -i -X PATCH "$SUPABASE_URL/rest/v1/records?id=eq.$RECORD_ID_B" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"value": 999}'
 
sep "(3-3) A로 로그인해 B의 기록 삭제 시도 (영향받은 행을 그대로 돌려받아 0건인지 확인)"
curl -sS -i -X DELETE "$SUPABASE_URL/rest/v1/records?id=eq.$RECORD_ID_B" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Prefer: return=representation"
 
sep "(4) 주소에 다른 계정 UUID를 넣어 조회해도 내 자료만 옴"
echo "user_id 필터를 다른 계정 UUID로 걸어도, RLS가 결과를 다시 auth.uid()로 거른다:"
curl -sS -i "$SUPABASE_URL/rest/v1/records?user_id=eq.88940751-d3ae-4a19-b143-3e0770180b00" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_A"
 
sep "(5) 목록 응답에 남의 자료가 없는지 — A로 로그인해 전체 목록 조회"
curl -sS -i "$SUPABASE_URL/rest/v1/records" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_A"
echo
echo "위 응답의 모든 행에서 user_id가 전부 A 자신의 UUID와 같은지 눈으로 확인."
 
sep "완료 — 위 출력 전체를 docs/T07_인증구현설명서.md ④에 옮겨 적고 토큰은 가릴 것"


