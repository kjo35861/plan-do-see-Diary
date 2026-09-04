-- ============================================================
-- Plan-Do-See Diary — Supabase 스키마 (T07 카드 4 핵심)
-- Supabase 대시보드 → SQL Editor에 처음부터 끝까지 그대로 붙여넣어
-- 실행한다. 이미 한 번 실행한 프로젝트에 다시 실행해도 안전하다
-- (테이블은 if not exists, 정책은 drop policy if exists 후 재생성).
-- ============================================================

-- 1) 기록 테이블
-- user_id 기본값을 auth.uid()로 걸어두면, 클라이언트가 다른 사람의
-- user_id를 조작해서 보내더라도 INSERT 시 실제 로그인한 사용자의
-- ID로 강제된다 (RLS의 WITH CHECK와 이중으로 방어).
create table if not exists public.records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  tz text not null default 'Asia/Seoul',
  item text not null,
  value numeric not null,
  unit text not null,
  tag text default '',
  memo text default '',
  created_at timestamptz not null default now()
);

create index if not exists records_user_id_idx on public.records(user_id);
create index if not exists records_user_date_idx on public.records(user_id, date);

-- 2) RLS 활성화 — 이게 빠지면 테이블은 기본적으로 아무나 못 읽지만,
--    아래 정책들이 없으면 로그인한 사용자도 아무것도 못 읽는다.
alter table public.records enable row level security;

-- 2.5) 세션 유효성 검사 함수 (T07-C114 대응)
-- ------------------------------------------------------------
-- 문제: signOut()은 리프레시 토큰만 서버에서 무효화하고, 이미 발급된
-- 액세스 토큰(JWT) 자체는 서명이 유효한 한 자연 만료 시각(기본 1시간)
-- 까지는 그대로 통과된다 — RLS가 auth.uid()만 검사하면 로그아웃 뒤에도
-- 같은 토큰으로 자료를 계속 읽을 수 있다는 뜻이다 (verify_output.txt
-- (2-2)에서 실측 확인됨).
--
-- 해결: 액세스 토큰의 session_id 클레임이 auth.sessions 테이블에
-- 아직 살아있는지를 RLS 정책에서 함께 검사한다. signOut()이 세션을
-- 지우거나(global scope) updateUser로 비밀번호를 바꾼 뒤 signOut
-- ({scope:'others'})를 호출하면 그 세션 행이 사라지므로, 같은 JWT를
-- 들고 있어도 다음 요청부터 즉시 거절된다(자연 만료를 기다릴 필요 없음).
--
-- auth.sessions는 기본적으로 supabase_auth_admin만 읽을 수 있어
-- SECURITY DEFINER 함수로 감싸 authenticated 역할에만 실행 권한을 준다.
-- (create or replace이므로 재실행해도 안전)
create or replace function public.session_is_valid()
returns boolean
language sql
stable
security definer
set search_path = auth, pg_temp
as $$
  select exists (
    select 1 from auth.sessions s
    where s.id = (auth.jwt() ->> 'session_id')::uuid
  );
$$;

revoke all on function public.session_is_valid() from public;
grant execute on function public.session_is_valid() to authenticated;

-- 3) 소유자만 읽기 (목록 조회에도 동일하게 적용됨 — 카드4의 핵심 요구사항)
--    + session_is_valid(): 로그아웃(또는 비밀번호 변경으로 인한 다른 세션 강제
--    로그아웃)된 뒤에는 액세스 토큰이 자연 만료 전이라도 즉시 거절되게 한다.
drop policy if exists "select own records" on public.records;
create policy "select own records"
  on public.records for select
  using (auth.uid() = user_id and public.session_is_valid());

-- 4) 소유자로만 생성 가능 (user_id를 다른 사람 것으로 보내도 거절됨)
drop policy if exists "insert own records" on public.records;
create policy "insert own records"
  on public.records for insert
  with check (auth.uid() = user_id and public.session_is_valid());

-- 5) 소유자만 수정 가능 (다른 사람 행을 대상으로 한 UPDATE는 영향 0건)
drop policy if exists "update own records" on public.records;
create policy "update own records"
  on public.records for update
  using (auth.uid() = user_id and public.session_is_valid())
  with check (auth.uid() = user_id and public.session_is_valid());

-- 6) 소유자만 삭제 가능 (다른 사람 행을 대상으로 한 DELETE는 영향 0건)
drop policy if exists "delete own records" on public.records;
create policy "delete own records"
  on public.records for delete
  using (auth.uid() = user_id and public.session_is_valid());

-- ============================================================
-- 참고: PostgREST(Supabase가 자동 생성하는 REST API)는 RLS로 걸러진
-- 요청에 대해 "403 거부"가 아니라 "그 행이 존재하지 않는 것처럼
-- 0건"으로 응답한다. 과제 요구사항의 "403 또는 존재를 감추는 404"
-- 중 후자(존재 자체를 감추는 방식)에 해당한다.
-- 예: 다른 사람 소유의 id로 UPDATE를 보내면 200 OK + 빈 배열이 오고,
--     실제로는 아무 행도 바뀌지 않는다. 프런트엔드(script.js)에서는
--     이걸 "영향받은 행이 0건이면 권한 없음으로 취급"해서 사용자에게
--     안내한다.
-- ============================================================

-- 7) 계정 삭제 시 자료도 함께 삭제됨을 보장
--    (auth.users 삭제는 Supabase Auth 관리 화면/API에서 수행하며,
--     위 records.user_id의 ON DELETE CASCADE로 자료가 함께 삭제된다.)


-- ============================================================
-- 8) 계획 규칙 변경 로그 (카드5 — 2일차 뒤·3일차 앞에 규칙을 바꾼 기록)
-- ============================================================
create table if not exists public.rule_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  changed_at timestamptz not null default now(),
  content text not null,
  reason text not null
);

alter table public.rule_changes enable row level security;

drop policy if exists "select own rule changes" on public.rule_changes;
create policy "select own rule changes"
  on public.rule_changes for select
  using (auth.uid() = user_id and public.session_is_valid());

drop policy if exists "insert own rule changes" on public.rule_changes;
create policy "insert own rule changes"
  on public.rule_changes for insert
  with check (auth.uid() = user_id and public.session_is_valid());


-- ============================================================
-- 9) 계정 자체 삭제용 RPC (anon 키로는 auth.users를 직접 지울 수 없어
--    SECURITY DEFINER 함수로 우회 — 반드시 auth.uid()로만 자기 자신을 지움)
-- ============================================================
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ============================================================
-- 확인: 이 파일 실행 후 verify.sh (2)를 다시 돌리면, 로그아웃 뒤
-- 같은 토큰으로 재요청했을 때 기존 자료가 그대로 오던 것이
-- 200 OK + 빈 배열([])로 바뀐다 — RLS가 세션이 이미 끊어졌다고
-- 판단해 행을 하나도 못 찾은 것처럼 응답하는 것(T07-C121과 동일한
-- "존재를 감추는" 방식). 이 변화가 T07-C114의 실제 근거가 된다.
-- ============================================================
