# Plan Do See Diary — 계획한 나와 실제의 나, 이제 나만 봅니다

T06(플랜두씨 다이어리 1)에서 만든 개인 기록기에 Supabase Auth 기반 가입·로그인·로그아웃을 붙여, 각자의 기록을 각자의 계정으로만 볼 수 있게 만든 T07 프로젝트입니다.

- 배포 주소: https://plandosee-noi8.vercel.app/
- 저장소: https://github.com/kjo35861/plan-do-see-Diary
- 검증 방법: [`검증안내서.md`](./검증안내서.md)
- 인증 구현 설명서: [`docs/07_인증구현설명서.md`](./docs/07_인증구현설명서.md)
- 기획/설계: [`docs/01_기획.md`](./docs/01_기획.md)
- 배포 방법(Vercel + Supabase): [`docs/05_배포.md`](./docs/05_배포.md)
- 과제 요구사항 매핑(T06+T07): [`docs/00_과제_요구사항_매핑.md`](./docs/00_과제_요구사항_매핑.md)
- 진행 상황/인수인계: [`작업내역_체크리스트.md`](./작업내역_체크리스트.md)
- 문제 해결 기록: [`트러블슈팅.md`](./트러블슈팅.md)
- AI와 내 판단 3줄: [`AI_3줄.md`](./AI_3줄.md) (T06 당시 기록은 [`docs/archive_T06_AI_3줄.md`](./docs/archive_T06_AI_3줄.md))
- 포트폴리오 소개글: [`포트폴리오_추가용_소개글.md`](./포트폴리오_추가용_소개글.md)
- 인증 검증용 curl 스크립트: [`verify.sh`](./verify.sh)

## 폴더 구조

```
plan-do-see-diary/
├── index.html                        # 로그인/가입 화면 + 기록·요약·데이터관리 3탭 앱 화면
├── style.css                         # 저널/장부 콘셉트 스타일 (+ 로그인 화면)
├── script.js                         # 인증 게이팅, CRUD, 주간 집계, 규칙변경 로그 (Supabase 연동)
├── auth.js                           # Supabase Auth 래퍼 (가입/로그인/로그아웃/세션/계정삭제)
├── config.js                         # Supabase URL·anon key (공개해도 안전, 실제 값으로 교체 필요)
├── supabase-schema.sql               # records/rule_changes 테이블 + RLS 정책 + 계정삭제 RPC
├── verify.sh                         # 카드2~4 증거 수집용 curl 템플릿
├── README.md                         # 이 파일 — 개요 및 문서 색인
├── CLAUDE.md                         # AI 세션 규칙
├── 작업내역_체크리스트.md              # AI 공용 인수인계 파일 (T06+T07)
├── 검증안내서.md                       # T07 4줄 확인 방법
├── 트러블슈팅.md                       # T06+T07 문제 해결 기록
├── AI_3줄.md                          # T07 AI와 내 판단 3줄
├── 포트폴리오_추가용_소개글.md
└── docs/
    ├── 00_과제_요구사항_매핑.md          # T06+T07 통과 기준 매핑
    ├── 01_기획.md                     # T06 기획 + T07 아키텍처 갱신
    ├── 05_배포.md                     # Vercel+Supabase 배포 절차
    ├── 07_인증구현설명서.md              # T07 필수 제출물 — 6항목
    └── archive_T06_AI_3줄.md          # T06 당시 AI 3줄 보관
```

## 기술 구성

- 프런트엔드: 순수 HTML/CSS/JS, 빌드 도구 없음
- 인증/DB: Supabase (Auth: 이메일+비밀번호, DB: Postgres + Row Level Security)
- 배포: Vercel (정적 사이트)
- 데이터 격리: RLS 정책이 `auth.uid() = records.user_id`인 행만 허용 — 서버(DB) 단에서 소유자 검증

자세한 인증 설계 근거와 확인 절차는 [`docs/07_인증구현설명서.md`](./docs/07_인증구현설명서.md)와 [`verify.sh`](./verify.sh) 참고.
