// 인증 전담 모듈.
// 카드1(가입/로그인/로그아웃), 카드3(세션·만료·로그아웃 뒤 거절)를 담당한다.
//
// 무엇으로 붙였나: Supabase Auth (이메일+비밀번호 방식)
//   - 비밀번호 해시(bcrypt 계열)와 JWT 세션 발급/검증을 Supabase가 대신 처리한다.
//   - 직접 bcrypt/세션 저장소를 구현하는 대신 이미 감사받은 인증 서비스를 골랐다.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // localStorage에 세션(액세스 토큰 + 리프레시 토큰)을 저장.
    // 주소창(URL)에는 실리지 않는다 — PKCE 플로우 + POST 기반 토큰 교환.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/** 가입. 성공 시 세션을 반환(이메일 확인을 켜둔 프로젝트라면 null일 수 있음). */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/** 로그인. 아이디는 맞고 비밀번호만 틀린 경우와 계정 자체가 없는 경우
 *  Supabase는 둘 다 "Invalid login credentials"로 동일하게 응답한다
 *  (계정 존재 여부를 안내 문구로 유추할 수 없게 함 — T07-C99). */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** 로그아웃. 서버 쪽 리프레시 토큰도 함께 무효화된다(local 범위가 아닌 global 범위 권장). */
export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) throw error;
}

/** 현재 세션(없으면 null). 만료 시각(expires_at, unix seconds)을 포함한다. */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/** 세션 상태가 바뀔 때마다 콜백 실행 (로그인/로그아웃/토큰 갱신 등). */
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

/** 계정 자체 삭제. anon 키로는 자기 자신 삭제 RPC가 없으므로,
 *  Supabase 프로젝트에 아래와 같은 SECURITY DEFINER 함수를 하나 추가해 rpc로 호출한다:
 *
 *  create or replace function public.delete_my_account()
 *  returns void language plpgsql security definer as $$
 *  begin
 *    delete from auth.users where id = auth.uid();
 *  end; $$;
 *
 *  records 테이블은 user_id에 ON DELETE CASCADE가 걸려 있어 함께 삭제된다.
 */
export async function deleteMyAccount() {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
}
