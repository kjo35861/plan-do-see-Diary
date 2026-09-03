// Supabase 프로젝트 접속 정보
//
// anon(public) 키는 "비밀키"가 아니다 — Supabase 설계상 브라우저에
// 노출되는 것을 전제로 만들어졌고, 실제 방어는 supabase-schema.sql의
// RLS(행 단위 보안) 정책이 담당한다. 그래서 이 파일은 Git에 커밋해도
// 안전하다.
//
// 반드시 넣지 말아야 하는 것: service_role 키(관리자 키). 그 키는
// RLS를 무시하므로 절대 프런트엔드 코드에 넣지 않는다.

export const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
