#!/usr/bin/env bash
# ============================================================
# Plan Do See Diary — T07 검증용 curl 스크립트 (템플릿)
#
# 변수 이름을 "A/B" 대신 역할로 바꿨다 (예전 A/B 이름표가 실제
# 계정과 반대로 매핑되어 있어서 (2-1)/(5)가 빈 배열로 나왔던
# 문제가 있었음 — 2026-09-04에 확인).
#
#   TOKEN_OWNER — 기록 5건을 실제로 가진 계정
#   TOKEN_OTHER — 기록이 없는(또는 다른) 계정. 다른 사람 자료를
#                 몰래 읽으려는 "공격자" 역할로 쓰인다.
#
# 사용법:
#   1. 아래 변수들을 실제 값으로 채운다 (SUPABASE_URL, ANON_KEY는
#      config.js와 동일한 값 — anon key는 비밀값이 아니라 공개해도 됨).
#   2. 브라우저에서 기록이 있는 계정으로 로그인 → 개발자 도구
#      Network 탭에서 Authorization: Bearer 뒤의 토큰을 복사해
#      TOKEN_OWNER에 붙여넣는다. 다른(또는 빈) 계정으로 로그인해
#      같은 방식으로 TOKEN_OTHER를 채운다.
#   3. Supabase 대시보드 → Table Editor → records 에서 OWNER 소유
#      기록 하나의 id를 복사해 RECORD_ID_OWNER에 넣는다.
#   4. bash verify.sh 로 실행하고, 출력 전체를
#      docs/07_인증구현설명서.md ④의 각 자리에 옮겨 적는다.
#   5. 문서에 옮겨 적을 때 토큰은 앞 10글자만 남기고 "…생략"으로 가린다.
# ============================================================

set -euo pipefail

SUPABASE_URL="https://eteunidypthhlwvenyos.supabase.co"
ANON_KEY="sb_publishable_bNq1d7KIzzXqi8zGlDvqsw_ZxtmZoM4"

# 기록이 있는 계정 (지금 확인된 이메일: kku22u1044@gmail.com) — 매번 새로 로그인해서 채울 것
TOKEN_OWNER="여기에_OWNER_토큰_붙여넣기"
OWNER_UUID="88940751-d3ae-4a19-b143-3e0770180b00"

# 기록이 없는(또는 다른) 계정 (지금 확인된 이메일: kkuu1044@gmail.com) — 매번 새로 로그인해서 채울 것
TOKEN_OTHER="여기에_OTHER_토큰_붙여넣기"

# OWNER 소유 기록 중 하나의 id — Supabase Table Editor에서 직접 복사해 채울 것
# (예전에 쓰던 3563d85e-... 는 지금 존재하는 기록과 일치하지 않아 제거함)
RECORD_ID_OWNER="여기에_OWNER의_기록_id_붙여넣기"

sep() { echo; echo "===================================================="; echo "$1"; echo "===================================================="; }

sep "(1) 로그인하지 않고 자료 직접 요청 — 거절 확인"
curl -sS -i "$SUPABASE_URL/rest/v1/records" \
  -H "apikey: $ANON_KEY"
# Authorization 헤더를 아예 안 보냄 = 비로그인 상태

sep "(2-1) 로그인 상태 성공 응답 — OWNER로 조회 (기록 5건이 나와야 정상)"
curl -sS -i "$SUPABASE_URL/rest/v1/records" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_OWNER"

sep "(5) 목록 응답에 남의 자료가 없는지 — OWNER로 로그인해 전체 목록 조회 (로그아웃 전에 먼저 확인)"
curl -sS -i "$SUPABASE_URL/rest/v1/records" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_OWNER"
echo
echo "위 응답의 모든 행에서 user_id가 전부 OWNER 자신의 UUID와 같은지 눈으로 확인."

sep "여기서 잠깐 멈춥니다"
echo "지금 브라우저에서 OWNER 계정(기록 있는 쪽)으로 실제 '로그아웃' 버튼을 누르세요."
echo "(TOKEN_OWNER 값 자체는 그대로 두고, 브라우저에서만 로그아웃합니다)"
read -p "로그아웃을 마쳤으면 Enter를 눌러 계속... " _

sep "(2-2) 로그아웃 후 같은 토큰으로 재요청"
curl -sS -i "$SUPABASE_URL/rest/v1/records" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_OWNER"

sep "(3-1) OTHER로 로그인해 OWNER의 기록 읽기 시도"
curl -sS -i "$SUPABASE_URL/rest/v1/records?id=eq.$RECORD_ID_OWNER" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_OTHER"

sep "(3-2) OTHER로 로그인해 OWNER의 기록 수정 시도 (영향받은 행을 그대로 돌려받아 0건인지 확인)"
curl -sS -i -X PATCH "$SUPABASE_URL/rest/v1/records?id=eq.$RECORD_ID_OWNER" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_OTHER" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"value": 999}'

sep "(3-3) OTHER로 로그인해 OWNER의 기록 삭제 시도 (영향받은 행을 그대로 돌려받아 0건인지 확인)"
curl -sS -i -X DELETE "$SUPABASE_URL/rest/v1/records?id=eq.$RECORD_ID_OWNER" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_OTHER" \
  -H "Prefer: return=representation"

sep "(4) 주소에 다른 계정 UUID를 넣어 조회해도 내 자료만 옴 — OTHER로 로그인해 OWNER의 user_id로 필터"
echo "user_id 필터를 다른 계정 UUID로 걸어도, RLS가 결과를 다시 auth.uid()로 거른다:"
curl -sS -i "$SUPABASE_URL/rest/v1/records?user_id=eq.$OWNER_UUID" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_OTHER"

sep "완료 — 위 출력 전체를 docs/07_인증구현설명서.md ④에 옮겨 적고 토큰은 가릴 것"
