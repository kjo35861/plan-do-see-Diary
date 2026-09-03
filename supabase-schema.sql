-- ============================================================
-- Plan-Do-See Diary — Supabase 스키마 (T07 카드 4 핵심)
-- Supabase 대시보드 → SQL Editor에 그대로 붙여넣어 실행한다.
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

-- 3) 소유자만 읽기 (목록 조회에도 동일하게 적용됨 — 카드4의 핵심 요구사항)
create policy "select own records"
  on public.records for select
  using (auth.uid() = user_id);

-- 4) 소유자로만 생성 가능 (user_id를 다른 사람 것으로 보내도 거절됨)
create policy "insert own records"
  on public.records for insert
  with check (auth.uid() = user_id);

-- 5) 소유자만 수정 가능 (다른 사람 행을 대상으로 한 UPDATE는 영향 0건)
create policy "update own records"
  on public.records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 6) 소유자만 삭제 가능 (다른 사람 행을 대상으로 한 DELETE는 영향 0건)
create policy "delete own records"
  on public.records for delete
  using (auth.uid() = user_id);

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

create policy "select own rule changes"
  on public.rule_changes for select
  using (auth.uid() = user_id);

create policy "insert own rule changes"
  on public.rule_changes for insert
  with check (auth.uid() = user_id);


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
