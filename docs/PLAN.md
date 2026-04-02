# Worknest MVP 개발 계획서

**기준 문서**: `docs/specs/FEATURE_SPEC.md` v0.5
**작성일**: 2026-04-01
**최종 수정**: 2026-04-02
**에이전트 팀**: DBA, Backend, Frontend, Design, QA, DevOps, Tech Lead

---

## 진행 상황

| CP | 상태 | 커밋 | 주요 산출물 |
|----|------|------|-----------|
| **CP-1** | **완료** | 6건 (b1cf00b7~7aa49bb3) | 모노레포, 인증, Org/WS CRUD, 설정 UI, 199 테스트, 마이그레이션 |
| CP-2 | 대기 | - | 프로젝트, 이슈, 라벨, Quick Add, 키보드 단축키 |
| CP-3 | 대기 | - | 리스트 뷰, 칸반 보드, 필터, 벌크 작업 |
| CP-4 | 대기 | - | 사이클, 이슈 추가/제거, 이월 |
| CP-5 | 대기 | - | Wiki Space, 페이지 트리, TipTap 에디터, 파일 업로드 |
| CP-6 | 대기 | - | Cmd+K, My Work, 댓글, 알림 |
| CP-7 | 대기 | - | Docker 배포, 온보딩, Empty State, E2E |

### CP-1 완료 상세

- **Wave 1**: 모노레포 (pnpm+Turborepo+Biome), Docker Compose, CI, 디자인 시스템
- **Wave 2**: DB 스키마 (User, Org, WS, Invitation, Better Auth 테이블)
- **Wave 3**: Backend (Fastify, Better Auth, Org/WS API 22파일) + Frontend (Vite, Router, shadcn/ui, 인증/설정 35파일)
- **Wave 4**: Tech Lead 통합 검증 — 14건 수정
- **Wave 5**: QA 테스트 199개
- **추가 수정**: MUST 3건 + SHOULD 5건 + Critical 2건 (마이그레이션, slug→UUID, 트랜잭션, 페이지네이션, 권한, 초대 응답)

---

## 범례

| 기호 | 의미 |
|------|------|
| `[병렬]` | 해당 Phase 내 태스크가 동시 실행 가능 |
| `[순차]` | 이전 Phase 완료 후 실행 |
| `→` | 의존 관계 (선행 태스크) |
| `*` | 핵심 경로 (Critical Path) 태스크 |

> **참고 — DBA/Design 파이프라이닝**: DBA와 Design 에이전트는 현재 CP의 Backend/Frontend가 구현 중일 때 다음 CP의 스키마/스펙 작업을 선행 착수할 수 있습니다. 각 CP 내 Phase 표기는 해당 CP 태스크 간 의존 순서이며, DBA/Design의 실제 착수 시점은 앞당겨질 수 있습니다.

> **참고 — packages/shared 스키마 선행 원칙**: 각 CP에서 Zod 공유 스키마(`packages/shared`)는 API 구현보다 먼저 또는 동시에 생성해야 합니다. BE 태스크에 포함된 Zod 스키마 태스크는 해당 CP의 API 구현 태스크와 병렬 착수하되, API가 스키마를 import하므로 스키마가 먼저 완료되어야 합니다.

---

## CP-1: 프로젝트 셋업

> 모노레포, Biome, CI, Docker Compose, DB 스키마, Better Auth 인증, Org/WS/User CRUD, BullMQ 기초 인프라, Profile API, 초대 관리 UI, Org/WS 설정 페이지

### 실행 순서

1. **[Phase 1 — 병렬]** DevOps: 모노레포 + Docker Compose 구성 | Tech Lead: 아키텍처 구조 확정
2. **[Phase 2 — 병렬]** DBA: 핵심 스키마 (User, Org, WS) | Design: 디자인 시스템 기초 + 인증 화면 스펙 + 설정 페이지 스펙
3. **[Phase 3 — 병렬]** Backend: Better Auth 통합 + Org/WS API + BullMQ 기초 + Profile API | Frontend: 인증 UI + 온보딩 플로우
4. **[Phase 4 — 병렬]** Frontend: 초대 관리 UI + Org/WS 설정 페이지
5. **[Phase 5]** Tech Lead: 통합 검증 + 타입 호환성 확인
6. **[Phase 6]** QA: 테스트 작성

### 상세 태스크

| Task ID    | Agent     | 설명                                                                                                                                                                                                                                                                                                  | 의존성                          | 핵심 산출물                                                                                              |
| ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| CP1-TL-1*  | Tech Lead | 모노레포 구조 확정. `apps/`, `packages/` 디렉토리 규칙, 패키지 간 의존 관계, import alias 정의. `turbo.json` 파이프라인 설정.                                                                                                                                                                                                      | 없음                           | `turbo.json`, `pnpm-workspace.yaml`, `biome.json`                                                   |
| CP1-DO-1*  | DevOps    | pnpm + Turborepo 모노레포 초기화. `apps/server`, `apps/web`, `packages/shared`, `packages/db`, `packages/ui`, `packages/editor` 구조 생성.                                                                                                                                                                     | 없음                           | 모노레포 디렉토리 구조, root `package.json`                                                                   |
| CP1-DO-2   | DevOps    | Docker Compose (개발용): PostgreSQL 16, Redis 7, MinIO, **Mailpit**(개발용 메일 서버). 볼륨, 네트워크, 헬스체크 설정. `.env.example` 작성.                                                                                                                                                                                  | CP1-DO-1                     | `docker-compose.yml`, `.env.example`                                                                |
| CP1-DO-3   | DevOps    | GitHub Actions CI: lint(Biome) → typecheck → test → build. PR 트리거.                                                                                                                                                                                                                                  | CP1-DO-1                     | `.github/workflows/ci.yml`                                                                          |
| CP1-DBA-1* | DBA       | 핵심 테이블 스키마 (Drizzle): `users`, `organizations`, `org_members`, `workspaces`, `workspace_members`, `invitations`. Better Auth 호환 세션 테이블 포함. UUID PK, soft delete, 부분 인덱스. `invitations` CHECK 제약(`exactly one of org_id, workspace_id IS NOT NULL`)은 **raw SQL 마이그레이션 필요** (Drizzle ORM이 CHECK 미지원). | 없음                           | `packages/db/src/schema/users.ts`, `auth.ts`, `organizations.ts`, `workspaces.ts`, `invitations.ts` |
| CP1-DBA-2  | DBA       | 초기 마이그레이션 파일 생성. Drizzle migrator 설정. 서버 시작 시 자동 실행 구성. CHECK 제약 raw SQL 포함.                                                                                                                                                                                                                        | CP1-DBA-1                    | `packages/db/src/migrations/0001_*.sql`, `packages/db/src/migrate.ts`                               |
| CP1-DS-1   | Design    | 디자인 시스템 기초 정의. 색상 토큰(CSS 변수), 타이포그래피(Pretendard + JetBrains Mono), spacing 스케일, 레이아웃 상수(사이드바 240px 등). 다크모드 변수 포함.                                                                                                                                                                                  | 없음                           | `docs/design/design-system.md`, Tailwind CSS 4 설정 값                                                 |
| CP1-DS-2   | Design    | 인증 화면 컴포넌트 스펙: 로그인, 회원가입, 초대 수락, 온보딩(Org 생성 → WS 생성 → Project 생성 가이드). 와이어프레임 + 상태별(로딩/에러/성공) 명세.                                                                                                                                                                                                   | CP1-DS-1                     | `docs/design/auth-screens.md`                                                                       |
| CP1-DS-3   | Design    | 앱 Shell 레이아웃 스펙: 사이드바(240px/48px 축소), 메인 콘텐츠, Side Panel(640px). 반응형 브레이크포인트(1280+, 1024~1279, ~1023).                                                                                                                                                                                              | CP1-DS-1                     | `docs/design/app-shell.md`                                                                          |
| CP1-DS-4   | Design    | Org/WS 설정 페이지 스펙: 일반 설정(이름, 슬러그, 로고), 멤버 목록(역할 뱃지, 초대/제거/역할 변경), 초대 관리(대기 중 초대 목록, 취소/재발송 버튼).                                                                                                                                                                                                      | CP1-DS-1                     | `docs/design/org-ws-settings.md`                                                                    |
| CP1-BE-1*  | Backend   | Fastify 5 서버 초기화. Pino 로거(JSON, `LOG_LEVEL`), CORS, 헬스체크(`/healthz`, `/readyz`), 에러 핸들러(표준 에러 형식), Swagger(`/api/v1/docs`).                                                                                                                                                                         | CP1-DBA-1, CP1-DO-2          | `apps/server/src/index.ts`, `apps/server/src/lib/errors.ts`, `apps/server/src/routes/health.ts`     |
| CP1-BE-2*  | Backend   | Better Auth 통합. 이메일+비밀번호 인증, DB 세션 + httpOnly 쿠키 캐싱, 로그인 시도 제한(5회/5분). 인증 미들웨어.                                                                                                                                                                                                                     | CP1-DBA-1, CP1-BE-1          | `apps/server/src/lib/auth.ts`, `apps/server/src/middleware/auth.ts`                                 |
| CP1-BE-3   | Backend   | Organization API: CRUD, 멤버 관리(owner/admin/member), 초대(토큰 생성/수락/만료). 초대 목록 조회, 취소, 재발송 API. 권한 검증.                                                                                                                                                                                                   | CP1-BE-2                     | `apps/server/src/routes/organizations.ts`, `apps/server/src/services/organization-service.ts`       |
| CP1-BE-4   | Backend   | Workspace API: CRUD, 멤버 관리(admin/member/guest), 초대. WS는 Org 하위. 권한 검증. `member.added` WebSocket 이벤트 브로드캐스트(`workspace:{id}` 채널).                                                                                                                                                                    | CP1-BE-3                     | `apps/server/src/routes/workspaces.ts`, `apps/server/src/services/workspace-service.ts`             |
| CP1-BE-5   | Backend   | Zod 공유 스키마: 인증, Org, WS 요청/응답 스키마. API 응답 표준 형식 (pagination 포함).                                                                                                                                                                                                                                    | CP1-BE-1                     | `packages/shared/src/schemas/auth.ts`, `organizations.ts`, `workspaces.ts`, `common.ts`             |
| CP1-BE-6   | Backend   | WebSocket 서버 기초 설정. Fastify upgrade 핸들러, Better Auth 세션 인증, 채널 subscribe/unsubscribe 구조. Redis Pub/Sub 인터페이스 분리 (MVP 단일 인스턴스). `member.added` 이벤트 포함.                                                                                                                                               | CP1-BE-2                     | `apps/server/src/websocket/handler.ts`, `apps/server/src/websocket/channels.ts`                     |
| CP1-BE-7   | Backend   | Rate limiting 미들웨어. 전체 API(1000/분), 인증(10/15분). Redis 기반.                                                                                                                                                                                                                                           | CP1-BE-1                     | `apps/server/src/middleware/rate-limit.ts`                                                          |
| CP1-BE-8   | Backend   | **BullMQ 기초 인프라 설정**. Queue/Worker 추상화, Redis 연결, job 등록 구조, 공통 retry/error 처리 패턴. 이후 CP들(CP2 Activity, CP3 벌크, CP5 썸네일, CP6 알림, CP7 hard delete)이 이 인프라를 사용.                                                                                                                                       | CP1-BE-1, CP1-DO-2           | `apps/server/src/lib/bullmq.ts`, `apps/server/src/jobs/index.ts`                                    |
| CP1-BE-9   | Backend   | **Profile API**: `GET /my/profile`, `PATCH /my/profile` (이름, 아바타 변경).                                                                                                                                                                                                                               | CP1-BE-2                     | `apps/server/src/routes/my-work.ts`                                                                 |
| CP1-FE-1*  | Frontend  | Vite + React 19 + TanStack Router 프로젝트 초기화. Tailwind CSS 4 설정(디자인 토큰 반영). 라우트 구조: `/login`, `/register`, `/invite/:token`, `/orgs`, `/orgs/new`, `/:orgSlug/:wsSlug/*`.                                                                                                                             | CP1-DS-1, CP1-DO-1           | `apps/web/src/routes/`, `apps/web/tailwind.config.ts`                                               |
| CP1-FE-2   | Frontend  | shadcn/ui 기본 컴포넌트 설치 및 커스터마이징: Button, Input, Dialog, Popover, DropdownMenu, Skeleton, Tooltip, Toast(Sonner). Pretendard 폰트 적용.                                                                                                                                                                    | CP1-FE-1, CP1-DS-1           | `packages/ui/src/components/`                                                                       |
| CP1-FE-3   | Frontend  | 인증 화면 구현: 로그인, 회원가입, 초대 수락 페이지. TanStack Query + Better Auth 클라이언트 훅. 로그인 시도 제한 에러 처리.                                                                                                                                                                                                              | CP1-FE-2, CP1-DS-2, CP1-BE-2 | `apps/web/src/pages/auth/`, `apps/web/src/hooks/use-auth.ts`                                        |
| CP1-FE-4   | Frontend  | 온보딩 플로우 구현: Org 생성 → WS 생성 가이드. 초대 수락 후 자동 WS 추가.                                                                                                                                                                                                                                                   | CP1-FE-3, CP1-BE-3           | `apps/web/src/pages/onboarding/`                                                                    |
| CP1-FE-5   | Frontend  | 앱 Shell 레이아웃: 사이드바(Org/WS 선택, My Work, Projects, Wiki 섹션), 메인 콘텐츠 영역. 반응형(1280+/1024~1279/~1023).                                                                                                                                                                                                   | CP1-FE-2, CP1-DS-3           | `apps/web/src/components/layout/`, `apps/web/src/components/sidebar/`                               |
| CP1-FE-6   | Frontend  | TanStack Query 글로벌 설정: queryClient 기본 옵션, API 클라이언트(fetch wrapper, 에러 핸들링, 쿠키 인증). Zustand 기초 store(activeContext, auth).                                                                                                                                                                           | CP1-FE-1, CP1-BE-5           | `apps/web/src/lib/api-client.ts`, `apps/web/src/stores/`                                            |
| CP1-FE-7   | Frontend  | **초대 관리 UI**: 초대 목록 조회(대기 중/수락됨/만료), 초대 취소, 재발송 버튼. Org/WS 설정 페이지 내 탭 또는 섹션.                                                                                                                                                                                                                        | CP1-DS-4, CP1-BE-3           | `apps/web/src/components/invitations/`                                                              |
| CP1-FE-8   | Frontend  | **Org/WS 설정 페이지**: 일반 설정(이름, 로고 변경), 멤버 목록(역할 뱃지, 역할 변경 드롭다운, 멤버 제거), 초대 관리 탭 연동.                                                                                                                                                                                                                   | CP1-DS-4, CP1-BE-3, CP1-BE-4 | `apps/web/src/pages/settings/`, `apps/web/src/components/settings/`                                 |
| CP1-TL-2   | Tech Lead | 통합 검증: `packages/shared` 타입 호환성, API 계약(요청/응답 스키마) 일치, 모노레포 typecheck 통과, Biome lint 통과. 네이밍 컨벤션 확인.                                                                                                                                                                                                | CP1-BE-5, CP1-FE-6           | 리뷰 코멘트, 수정 PR                                                                                       |
| CP1-QA-1   | QA        | 서버 테스트: Better Auth 인증(로그인/가입/로그아웃), Org CRUD + 권한, WS CRUD + 권한, 초대 토큰 수락/만료/취소/재발송, 헬스체크, Rate limiting, Profile API. Vitest + Testcontainers.                                                                                                                                                    | CP1-TL-2                     | `apps/server/test/auth.test.ts`, `organizations.test.ts`, `workspaces.test.ts`                      |
| CP1-QA-2   | QA        | 프론트엔드 테스트: 인증 컴포넌트 렌더링(로딩/에러/성공), 온보딩 플로우, 사이드바 네비게이션, 설정 페이지 멤버 관리, 초대 관리 UI. @testing-library/react.                                                                                                                                                                                              | CP1-TL-2                     | `apps/web/test/auth/`, `apps/web/test/layout/`, `apps/web/test/settings/`                           |
| CP1-QA-3   | QA        | 공유 스키마 테스트: Zod 스키마 검증(유효/무효 데이터), 에러 코드 매핑 확인.                                                                                                                                                                                                                                                     | CP1-BE-5                     | `packages/shared/test/schemas/`                                                                     |

---

## CP-2: 이슈 핵심

> 프로젝트 CRUD, 이슈 CRUD, 타입/상태(DB 테이블), Label CRUD, Quick Add, 서브이슈, 키보드 단축키, Activity 서비스, 프로젝트 설정 페이지, 라벨 관리 UI

### 실행 순서

1. **[Phase 1]** DBA: 프로젝트, 이슈, Activity 관련 스키마 전체
2. **[Phase 2 — 병렬]** Backend: API 구현 | Design: 이슈 UI 컴포넌트 스펙 + 프로젝트 설정 스펙 | Frontend: 프로젝트 UI (API 준비 전 mock 가능)
3. **[Phase 3 — 병렬]** Frontend: 이슈 UI 구현 (Backend API 사용) | Backend: WebSocket 이벤트 | Frontend: 프로젝트 설정 + 라벨 관리 UI
4. **[Phase 4]** Tech Lead: 통합 검증
5. **[Phase 5]** QA: 테스트 작성

### 상세 태스크

| Task ID | Agent | 설명 | 의존성 | 핵심 산출물 |
|---------|-------|------|--------|------------|
| CP2-DBA-1* | DBA | 프로젝트 스키마: `projects`, `project_members`. `issue_counter` atomic increment 컬럼. prefix UNIQUE 부분 인덱스(`WHERE deleted_at IS NULL`). 삭제된 prefix 재사용 방지 로직. | CP1-DBA-2 | `packages/db/src/schema/projects.ts` |
| CP2-DBA-2* | DBA | 이슈 스키마: `issues`, `issue_statuses`, `issue_types`, `issue_assignees`, `issue_labels`, `labels`. priority enum. `sort_order` text(fractional indexing). `(project_id, sequence_id) UNIQUE`. `search_vector` tsvector + GIN 인덱스. **트리거로 `title` + `description_text` → tsvector 자동 갱신**. `pg_trgm` 확장 활성화. | CP2-DBA-1 | `packages/db/src/schema/issues.ts`, `labels.ts` |
| CP2-DBA-3* | DBA | **Activity + 검색 확장 스키마**: `activities` 테이블(다형적 — issue_id/page_id/project_id, CHECK 제약(raw SQL 마이그레이션 필요), action, field, old_value, new_value, actor_id). 마이그레이션 파일 생성 + 프로젝트 생성 시 기본 IssueStatus(5개)/IssueType(4개) 시드 SQL. | CP2-DBA-2 | `packages/db/src/schema/activities.ts`, `packages/db/src/migrations/0002_*.sql` |
| CP2-DS-1 | Design | 프로젝트 화면 스펙: 프로젝트 리스트 페이지, 프로젝트 생성 모달(이름, prefix 입력 + 실시간 중복 체크, 아이콘 선택), 프로젝트 설정 페이지(일반 설정, 멤버 관리, 라벨 관리). | 없음 | `docs/design/project-screens.md` |
| CP2-DS-2 | Design | 이슈 상세 화면 스펙: Side Panel(640px) + Full Page 레이아웃. 제목 편집, TipTap 설명 에디터, 속성 사이드바(상태/우선순위/타입/담당자/라벨/마감일), 서브이슈 목록. 반응형(1024px 미만 Full Page only). | 없음 | `docs/design/issue-detail.md` |
| CP2-DS-3 | Design | Quick Add 컴포넌트 스펙: 인라인 제목 입력, Enter 즉시 생성, 연속 생성 포커스. 기본값(Task, Backlog, None). 보드 뷰 컬럼별 기본 상태. | 없음 | `docs/design/quick-add.md` |
| CP2-DS-4 | Design | 키보드 단축키 시스템 스펙: `useHotkey` 훅 설계, activeContext 관리 규칙(input/textarea 포커스 시 비활성), 단축키 시트(Cmd+/) 오버레이 디자인. 각 키 동작에 대한 팝오버/드롭다운 UI. | 없음 | `docs/design/keyboard-shortcuts.md` |
| CP2-BE-1* | Backend | Project API: CRUD, 멤버 관리(admin/member/viewer). prefix 중복 체크(`GET check-prefix`). 프로젝트 생성 시 기본 IssueStatus/IssueType 시드 트랜잭션. 사이드바용 프로젝트 목록. `member.added` WebSocket 이벤트(`project:{id}` 채널). | CP2-DBA-3, CP1-BE-2 | `apps/server/src/routes/projects.ts`, `apps/server/src/services/project-service.ts` |
| CP2-BE-2* | Backend | Issue API: 생성(`issue_counter` atomic increment), 조회(단건 + 목록), 수정, 삭제(soft delete, 서브이슈 parent_id=null 승격). 목록 API: 커서 기반 페이지네이션. | CP2-DBA-3, CP1-BE-2 | `apps/server/src/routes/issues.ts`, `apps/server/src/services/issue-service.ts` |
| CP2-BE-3 | Backend | IssueStatus/IssueType API: 목록 조회(프로젝트별), 수정(이름/색상). 삭제는 v1.0 — RESTRICT FK. | CP2-BE-1 | `apps/server/src/routes/issue-statuses.ts`, `issue-types.ts` |
| CP2-BE-4 | Backend | Label API: CRUD(프로젝트별). IssueLabel 연결/해제. `UNIQUE(project_id, name)` 검증. | CP2-BE-1 | `apps/server/src/routes/labels.ts`, `apps/server/src/services/label-service.ts` |
| CP2-BE-5 | Backend | IssueAssignee API: 담당자 추가/제거. 다중 담당자. IssueAssignee join 테이블 관리. | CP2-BE-2 | `apps/server/src/routes/issues.ts`(확장) |
| CP2-BE-6 | Backend | 이슈 Zod 공유 스키마: 이슈 생성/수정 요청, 이슈 응답(assignees/labels 포함), 필터 쿼리 파라미터, 프로젝트 요청/응답, 라벨 요청/응답. | CP2-DBA-2 | `packages/shared/src/schemas/issues.ts`, `projects.ts`, `labels.ts` |
| CP2-BE-7 | Backend | WebSocket 이슈 이벤트: `issue.created`, `issue.updated`, `issue.deleted`. `project:{id}` 채널 브로드캐스트. | CP2-BE-2, CP1-BE-6 | `apps/server/src/websocket/issue-events.ts` |
| CP2-BE-8 | Backend | Activity 서비스: 이슈 상태 변경/담당자 변경/속성 변경 시 `activities` 테이블 자동 기록. `GET /issues/:id/activities` 조회. BullMQ job 활용(CP1-BE-8 인프라 사용). | CP2-DBA-3, CP2-BE-2, CP1-BE-8 | `apps/server/src/services/activity-service.ts`, `apps/server/src/jobs/activity-job.ts` |
| CP2-FE-1 | Frontend | 프로젝트 리스트 페이지 + 생성 모달 구현. prefix 실시간 중복 체크(디바운스 300ms). TanStack Query 캐싱. 사이드바에 프로젝트 목록 연동. | CP2-DS-1, CP2-BE-1, CP1-FE-5 | `apps/web/src/pages/projects/`, `apps/web/src/components/projects/` |
| CP2-FE-2* | Frontend | 이슈 상세 구현: Side Panel(640px) + Full Page. 제목 인라인 편집(클릭/F2). 속성 사이드바(상태/우선순위/타입 → 드롭다운, 담당자/라벨 → Popover 멀티 선택, 마감일 → DatePicker). 낙관적 업데이트. | CP2-DS-2, CP2-BE-2 | `apps/web/src/components/issues/issue-detail/` |
| CP2-FE-3* | Frontend | TipTap 에디터 통합 (이슈 설명용). `packages/editor`에 기본 에디터 구성: Paragraph, Heading(H1~H3), 리스트, 체크리스트, 인용구, 구분선, 코드블록, 테이블, 이미지, Bold/Italic/Underline/Strikethrough, 인라인코드, 링크, 하이라이트. **@멘션 TipTap extension**(사용자 검색 + 삽입). 자동 저장(2초 디바운스). | CP2-FE-2 | `packages/editor/src/`, `packages/editor/src/extensions/mention.ts`, `apps/web/src/components/editor/` |
| CP2-FE-4 | Frontend | Quick Add 컴포넌트: `C` 키 트리거, 인라인 제목 입력, Enter 즉시 생성, 연속 생성 포커스. 기본값 주입. 낙관적 업데이트. | CP2-DS-3, CP2-BE-2 | `apps/web/src/components/issues/quick-add.tsx` |
| CP2-FE-5 | Frontend | 서브이슈 UI: 이슈 상세 내 서브이슈 목록, 서브이슈 추가(Quick Add 재활용), 서브이슈 클릭 → 네비게이션. | CP2-FE-2 | `apps/web/src/components/issues/sub-issues.tsx` |
| CP2-FE-6* | Frontend | 키보드 단축키 시스템: `useHotkey(key, handler, { context })` 훅. Zustand `activeContext` store. C/S/A/L/P/T/X/D/Cmd+K/Cmd+/ /↑↓/JK/Enter/Space/Esc 바인딩. 단축키 시트(Cmd+/) 오버레이. 툴팁에 단축키 힌트. | CP2-DS-4, CP1-FE-5 | `apps/web/src/hooks/use-hotkey.ts`, `apps/web/src/stores/hotkey-store.ts`, `apps/web/src/components/keyboard-shortcuts-sheet.tsx` |
| CP2-FE-7 | Frontend | WebSocket 클라이언트: 연결, 재연결(지수 백오프 1~30초), 채널 subscribe/unsubscribe. 이슈 이벤트 수신 → TanStack Query 캐시 무효화/낙관적 업데이트. | CP2-BE-7, CP1-FE-6 | `apps/web/src/lib/websocket.ts`, `apps/web/src/hooks/use-websocket.ts` |
| CP2-FE-8 | Frontend | **프로젝트 설정 페이지**: 일반 설정(이름, 설명 편집), 멤버 관리(추가/제거/역할 변경), **라벨 CRUD 관리 UI**(라벨 목록, 생성/편집/삭제 모달, 색상 선택). | CP2-DS-1, CP2-BE-1, CP2-BE-4 | `apps/web/src/pages/projects/settings/`, `apps/web/src/components/labels/` |
| CP2-TL-1 | Tech Lead | 통합 검증: 이슈 CRUD 전체 플로우(생성 → 속성 변경 → 서브이슈 → 삭제), API 계약 일치, WebSocket 이벤트 수신 확인, typecheck + lint. | CP2-FE-7, CP2-BE-8 | 리뷰 코멘트 |
| CP2-QA-1 | QA | 서버 테스트: Project CRUD + 권한 + prefix 중복, Issue CRUD + atomic increment + soft delete + 서브이슈 승격, IssueStatus/IssueType 시드 검증, Label CRUD, IssueAssignee 추가/제거, Activity 자동 기록. | CP2-TL-1 | `apps/server/test/projects.test.ts`, `issues.test.ts`, `labels.test.ts` |
| CP2-QA-2 | QA | 프론트엔드 테스트: 이슈 상세 렌더링(로딩/에러/빈 상태), Quick Add 동작, 키보드 단축키(C/S/A/L/P/Esc), 낙관적 업데이트(서버 실패 시 롤백), 프로젝트 설정/라벨 관리 UI. | CP2-TL-1 | `apps/web/test/issues/`, `apps/web/test/keyboard/`, `apps/web/test/projects/` |

---

## CP-3: 이슈 뷰

> 리스트 뷰, 보드 뷰(칸반 DnD), 비주얼 필터 빌더, 저장된 뷰, 벌크 작업, fractional indexing 공유 유틸

### 실행 순서

1. **[Phase 1]** DBA: View 스키마
2. **[Phase 2 — 병렬]** Backend: 필터/정렬 API + View API + 벌크 API | Design: 리스트/보드/필터 UI 스펙
3. **[Phase 3 — 병렬]** Frontend: 리스트 뷰 + 필터 | Frontend: 보드 뷰 + DnD
4. **[Phase 4]** Frontend: 저장된 뷰 + 벌크 작업
5. **[Phase 5]** Tech Lead: 통합 검증
6. **[Phase 6]** QA: 테스트 작성

### 상세 태스크

| Task ID | Agent | 설명 | 의존성 | 핵심 산출물 |
|---------|-------|------|--------|------------|
| CP3-DBA-1 | DBA | View 스키마: `views` 테이블(id, project_id, name, created_by, filters(jsonb), sort(jsonb), group_by, type(list/board)). 마이그레이션. | CP2-DBA-3 | `packages/db/src/schema/views.ts` |
| CP3-DS-1 | Design | 리스트 뷰 스펙: 행 레이아웃(체크박스, 우선순위, 이슈키, 제목, 상태 뱃지, 담당자 아바타, 마감일), 행 높이 40px, hover 배경색, 인라인 속성 변경. 가상 스크롤(TanStack Table). | 없음 | `docs/design/list-view.md` |
| CP3-DS-2 | Design | 보드 뷰(칸반) 스펙: 컬럼(상태별, 헤더 색상 dot + 이름 + 카운트), 카드(이슈키, 제목 2줄, 우선순위, 담당자 아바타 2명, 라벨 dot, 임박 마감일), DnD 피드백(placeholder + 투명도 + 그림자), 컬럼 280px 최소, 수평 스크롤, 컬럼 하단 Quick Add. | 없음 | `docs/design/board-view.md` |
| CP3-DS-3 | Design | 비주얼 필터 빌더 스펙: AND-only 필터 UI(칩 기반), 속성 선택 드롭다운, 연산자 선택, 값 선택(멀티 셀렉트/날짜). URL searchParams 동기화 규칙. 필터 활성 시 결과 카운트. | 없음 | `docs/design/filter-builder.md` |
| CP3-DS-4 | Design | 벌크 작업 UI 스펙: X키 다중 선택, 선택 바(N건 선택됨 + 상태/담당자/라벨 일괄 변경 버튼 + 전체 해제), 최대 50건 제한 표시. | 없음 | `docs/design/bulk-actions.md` |
| CP3-BE-1* | Backend | 이슈 목록 API 고도화: 필터(status, type, priority, assignee, label, due_before/after, title contains, cycle), 정렬(created_at, updated_at, priority, due_date, manual), 커서 기반 페이지네이션. JOIN 최적화. | CP2-BE-2 | `apps/server/src/routes/issues.ts`(확장) |
| CP3-BE-2 | Backend | 이슈 통계 API: `GET /projects/:id/issues/stats` — 상태별 카운트(칸반 헤더용). | CP3-BE-1 | `apps/server/src/routes/issues.ts`(확장) |
| CP3-BE-3 | Backend | 벌크 작업 API: `PATCH /projects/:id/issues/bulk`. All-or-Nothing 트랜잭션. 최대 50건. 상태/담당자/라벨 일괄 변경. Activity/Notification은 BullMQ 비동기(CP1-BE-8 인프라 사용). WebSocket `issue.bulk_updated` 이벤트. | CP3-BE-1, CP1-BE-8 | `apps/server/src/routes/issues.ts`(확장), `apps/server/src/jobs/bulk-activity.ts` |
| CP3-BE-4 | Backend | View API: CRUD. 필터/정렬 jsonb 저장. 프로젝트별 뷰 목록 조회. | CP3-DBA-1 | `apps/server/src/routes/views.ts`, `apps/server/src/services/view-service.ts` |
| CP3-BE-5 | Backend | 이슈 sort_order 업데이트 API: 칸반 DnD 시 `PATCH /issues/:id` body에 `sort_order` + `status_id` 포함. **fractional indexing 유틸은 `packages/shared`에 공유 모듈로 구현** (서버/클라이언트 양쪽에서 사용). | CP2-BE-2 | `packages/shared/src/lib/fractional-index.ts` |
| CP3-BE-6 | Backend | View/벌크 Zod 공유 스키마. 필터 jsonb 구조 타입 정의. | CP3-BE-1 | `packages/shared/src/schemas/views.ts`, `bulk.ts` |
| CP3-FE-1* | Frontend | 리스트 뷰 구현: TanStack Table + 가상 스크롤. 행 레이아웃(체크박스, 우선순위, 이슈키, 제목, 상태, 담당자, 마감일). 인라인 속성 변경(상태/담당자 클릭 → Popover). 행 클릭 → Side Panel, Enter/더블클릭 → Full Page. J/K 네비게이션. | CP3-DS-1, CP3-BE-1 | `apps/web/src/components/issues/list-view/` |
| CP3-FE-2* | Frontend | 보드 뷰(칸반) 구현: dnd-kit 사용. 상태별 컬럼, 카드 DnD(상태 변경), 드래그 피드백. 컬럼 하단 Quick Add. 가로 스크롤. 낙관적 업데이트 + sort_order fractional indexing(`packages/shared` 유틸 사용). | CP3-DS-2, CP3-BE-5 | `apps/web/src/components/issues/board-view/` |
| CP3-FE-3 | Frontend | 비주얼 필터 빌더: 칩 UI, 속성/연산자/값 선택, URL searchParams 동기화(`useSearchParams`). 필터 상태 변경 → TanStack Query 재요청. 필터 초기화 버튼. | CP3-DS-3, CP3-BE-1 | `apps/web/src/components/issues/filter-builder/` |
| CP3-FE-4 | Frontend | 뷰 전환 탭(리스트/보드) + 정렬 드롭다운. URL 경로 기반(`/issues` vs `/board`). | CP3-FE-1, CP3-FE-2 | `apps/web/src/components/issues/view-tabs.tsx` |
| CP3-FE-5 | Frontend | 저장된 뷰: 현재 필터+정렬 → 뷰 저장 모달, 뷰 목록 사이드바 표시, 뷰 클릭 → 필터 적용. CRUD. | CP3-FE-3, CP3-BE-4 | `apps/web/src/components/views/` |
| CP3-FE-6 | Frontend | 벌크 작업: X키 체크박스 토글, 선택 바 UI(선택 카운트 + 액션 버튼), 일괄 변경 API 호출, 결과 toast, 낙관적 업데이트. | CP3-DS-4, CP3-BE-3 | `apps/web/src/components/issues/bulk-actions.tsx` |
| CP3-TL-1 | Tech Lead | 통합 검증: 리스트 뷰 → 필터 → 보드 뷰 전환 → DnD → 벌크 작업 전체 플로우. 필터 URL 공유 동작. 성능(대량 이슈 시 가상 스크롤). | CP3-FE-6 | 리뷰 코멘트 |
| CP3-QA-1 | QA | 서버 테스트: 필터 조합(다중 속성), 정렬(각 필드), 커서 페이지네이션 경계, 벌크 작업(All-or-Nothing, 50건 초과), View CRUD, fractional indexing 정합성. | CP3-TL-1 | `apps/server/test/issue-filters.test.ts`, `bulk.test.ts`, `views.test.ts` |
| CP3-QA-2 | QA | 프론트엔드 테스트: 리스트 뷰 렌더링 + 인라인 편집, 보드 뷰 DnD 상태 변경, 필터 빌더 URL 동기화, 벌크 선택 + 실행, 빈 상태 표시. | CP3-TL-1 | `apps/web/test/issues/list-view.test.tsx`, `board-view.test.tsx`, `filter.test.tsx` |

---

## CP-4: 사이클

> 사이클 CRUD, 이슈 추가/제거, 진행률, 이월
>
> **착수 시점**: CP-3 완료 후 시작 (CP4-FE-4가 CP3-FE-3 필터 컴포넌트에 의존). CP-5와 **시차 병렬** — CP-5는 CP-2 완료 후 바로 착수 가능하므로 CP-4보다 먼저 시작될 수 있음.

### 실행 순서

1. **[Phase 1]** DBA: 사이클 스키마
2. **[Phase 2 — 병렬]** Backend: Cycle API | Design: 사이클 UI 스펙
3. **[Phase 3]** Frontend: 사이클 UI 구현
4. **[Phase 4]** Tech Lead: 통합 검증
5. **[Phase 5]** QA: 테스트 작성

### 상세 태스크

| Task ID | Agent | 설명 | 의존성 | 핵심 산출물 |
|---------|-------|------|--------|------------|
| CP4-DBA-1* | DBA | 사이클 스키마: `cycles`(id, project_id, name, start_date, end_date, status(draft/active/completed), created_by), `cycle_issues`(cycle_id, issue_id, added_at, removed_at, carried_from_id). 활성 사이클 partial unique index `WHERE status = 'active'`. `UNIQUE PARTIAL (cycle_id, issue_id) WHERE removed_at IS NULL`. 마이그레이션. | CP2-DBA-3 | `packages/db/src/schema/cycles.ts` |
| CP4-DS-1 | Design | 사이클 화면 스펙: 사이클 리스트(상태 뱃지, 기간, 진행률 바), 사이클 생성/편집 모달, 사이클 상세(이슈 목록 + 필터 + 진행률 원형 차트), 이슈 추가 Popover(검색+선택), 이월 확인 모달(미완료 이슈 목록, 다음 사이클 선택). | 없음 | `docs/design/cycles.md` |
| CP4-BE-1* | Backend | Cycle API: CRUD. 활성 사이클 1개 제한(409 `ACTIVE_CYCLE_EXISTS`). 날짜 겹침 경고(에러 아닌 응답 필드). | CP4-DBA-1, CP1-BE-2 | `apps/server/src/routes/cycles.ts`, `apps/server/src/services/cycle-service.ts` |
| CP4-BE-2 | Backend | CycleIssue API: 이슈 추가(`POST /cycles/:id/issues`), 제거(`DELETE /cycles/:id/issues/:issueId`). 사이클 내 이슈 목록(`GET /cycles/:id/issues`). | CP4-BE-1 | `apps/server/src/routes/cycles.ts`(확장) |
| CP4-BE-3 | Backend | 사이클 완료 + 이월: "사이클 완료" 시 status='completed'. 미완료 이슈 → 다음 active/draft 사이클로 이동(CycleIssue 이전 `removed_at` + 새 레코드 `carried_from_id`). 다음 사이클 없으면 cycle 소속 해제. 트랜잭션. | CP4-BE-2 | `apps/server/src/services/cycle-service.ts`(확장) |
| CP4-BE-4 | Backend | 사이클 진행률 API: 상태 카테고리별 이슈 수 반환(completed / total). 이슈 필터에 `cycle` 파라미터 추가. WebSocket **`cycle.updated`** 이벤트(`project:{id}` 채널). | CP4-BE-2, CP1-BE-6 | `apps/server/src/routes/cycles.ts`(확장), `apps/server/src/websocket/cycle-events.ts` |
| CP4-BE-5 | Backend | Cycle Zod 공유 스키마. | CP4-DBA-1 | `packages/shared/src/schemas/cycles.ts` |
| CP4-FE-1 | Frontend | 사이클 리스트 페이지: 사이클 목록(상태 뱃지, 기간, 진행률 바), 생성/편집 모달, 삭제 확인. 사이드바에 사이클 섹션 추가. | CP4-DS-1, CP4-BE-1 | `apps/web/src/pages/cycles/`, `apps/web/src/components/cycles/` |
| CP4-FE-2 | Frontend | 사이클 상세 페이지: 이슈 목록(리스트 뷰 재활용), 진행률 표시(원형 차트), 이슈 추가 Popover(프로젝트 이슈 검색 + 선택), 이슈 제거. | CP4-FE-1, CP4-BE-2 | `apps/web/src/pages/cycles/cycle-detail.tsx` |
| CP4-FE-3 | Frontend | 이월 플로우: "사이클 완료" 버튼 → 미완료 이슈 목록 모달 → 다음 사이클 선택 → 확인 → API 호출. 이월된 이슈에 뱃지 표시. | CP4-FE-2, CP4-BE-3 | `apps/web/src/components/cycles/carry-over-modal.tsx` |
| CP4-FE-4 | Frontend | 이슈 필터/상세에 사이클 정보 연동: 필터에 사이클 선택 추가, 이슈 상세 속성에 사이클 표시. | CP4-FE-2, **CP3-FE-3** | `apps/web/src/components/issues/`(확장) |
| CP4-TL-1 | Tech Lead | 통합 검증: 사이클 생성 → 이슈 추가 → 활성화 → 이슈 진행 → 완료 → 이월 전체 플로우. 활성 사이클 1개 제한 동작. | CP4-FE-4 | 리뷰 코멘트 |
| CP4-QA-1 | QA | 서버 테스트: Cycle CRUD + 활성 1개 제한, CycleIssue 추가/제거, 이월(carried_from_id 체인, 다음 사이클 없을 때), 진행률 계산, 날짜 겹침 경고. | CP4-TL-1 | `apps/server/test/cycles.test.ts` |
| CP4-QA-2 | QA | 프론트엔드 테스트: 사이클 리스트 렌더링, 이슈 추가/제거, 이월 모달 동작, 진행률 표시, 빈 상태. | CP4-TL-1 | `apps/web/test/cycles/` |

---

## CP-5: Wiki

> Wiki Space, 페이지 CRUD, TipTap 에디터 + 슬래시 명령어, 페이지 트리, 이슈 링크, 파일 업로드, Wiki Space 멤버 관리 UI
>
> **착수 시점**: CP-2 완료 후 바로 착수 가능. CP-4와 **시차 병렬** — CP-5의 DBA/Design/Backend는 CP-3 진행 중에도 착수 가능.

### 실행 순서

1. **[Phase 1]** DBA: Wiki + File 스키마
2. **[Phase 2 — 병렬]** Backend: Wiki API + File API | Design: Wiki UI 스펙 | Frontend: 에디터 확장(슬래시 명령어)
3. **[Phase 3 — 병렬]** Frontend: Wiki UI (멤버 관리 포함) | Frontend: 파일 업로드 UI
4. **[Phase 4]** Tech Lead: 통합 검증
5. **[Phase 5]** QA: 테스트 작성

### 상세 태스크

| Task ID | Agent | 설명 | 의존성 | 핵심 산출물 |
|---------|-------|------|--------|------------|
| CP5-DBA-1* | DBA | Wiki 스키마: `wiki_spaces`, `wiki_space_members`, `wiki_pages`. content(jsonb), content_format('json'), content_text(plaintext), search_vector(tsvector + GIN). **트리거로 `title` + `content_text` → tsvector 자동 갱신** (CP2-DBA-2의 이슈 tsvector 트리거와 동일 패턴). sort_order(text). parent_id → SET NULL. `UNIQUE(workspace_id, slug)`. 마이그레이션. | CP2-DBA-3 | `packages/db/src/schema/wiki.ts` |
| CP5-DBA-2 | DBA | File 스키마: `files`(id, issue_id, page_id, name, path, mime_type, size, uploaded_by). 다형적 CHECK(**raw SQL 마이그레이션 필요**). IssueMention 스키마: `issue_mentions`(issue_id, page_id). 마이그레이션. | CP5-DBA-1 | `packages/db/src/schema/files.ts`, `mentions.ts` |
| CP5-DS-1 | Design | Wiki 전체 레이아웃 스펙: 사이드바 Wiki 섹션(Space 목록), Space 페이지(페이지 트리 + 메인 콘텐츠). 페이지 트리(들여쓰기 16px/레벨, 최대 6단계, DnD, 펼침/접힘). Breadcrumb(스페이스 > 상위 > 현재). | 없음 | `docs/design/wiki-layout.md` |
| CP5-DS-2 | Design | Wiki 에디터 스펙: TipTap 편집 영역, 슬래시 명령어(/) 메뉴 UI(floating menu, 카테고리별 블록 목록, 키보드 네비게이션), 이슈 링크 InputRule(`WORK-142` → 링크 노드), 자동 저장 상태 표시("저장됨"/"저장 중..."/"저장 실패"). | 없음 | `docs/design/wiki-editor.md` |
| CP5-DS-3 | Design | 파일 업로드 스펙: 에디터 내 이미지(붙여넣기/드래그 → 업로드 → URL 삽입), 파일 첨부 UI, 업로드 진행률, 에러 표시(25MB 초과, 차단 파일). | 없음 | `docs/design/file-upload.md` |
| CP5-BE-1* | Backend | WikiSpace API: CRUD, 멤버 관리(editor/viewer). WikiSpaceMember 권한 검증. | CP5-DBA-1, CP1-BE-2 | `apps/server/src/routes/wiki-spaces.ts`, `apps/server/src/services/wiki-space-service.ts` |
| CP5-BE-2* | Backend | WikiPage API: CRUD, 페이지 트리 조회(space별 전체, parent_id 기반 계층), 페이지 이동(parent_id/sort_order 변경). 순환 참조 방지(CTE recursive query, `400 CIRCULAR_REFERENCE`). 최대 깊이 6단계. 자동 저장(PATCH content). Last-Write-Wins(updated_at 체크, 충돌 시 경고 응답 헤더). | CP5-DBA-1 | `apps/server/src/routes/wiki-pages.ts`, `apps/server/src/services/wiki-page-service.ts` |
| CP5-BE-3a | Backend | **File CRUD API**: `POST /files/upload`(multipart, 25MB, 차단 확장자, entity_type/entity_id optional). `GET /files/:id`, `DELETE /files/:id`. UUID 기반 스토리지 경로. 워크스페이스 용량 체크(10GB). | CP5-DBA-2 | `apps/server/src/routes/files.ts`, `apps/server/src/services/file-service.ts` |
| CP5-BE-3b | Backend | **이미지 썸네일 BullMQ job**: 이미지 업로드 시 WebP 변환 + 400px 리사이즈 비동기 처리. CP1-BE-8 BullMQ 인프라 사용. | CP5-BE-3a, CP1-BE-8 | `apps/server/src/jobs/image-thumbnail.ts` |
| CP5-BE-3c | Backend | **고아 파일 정리 BullMQ 크론**: 24시간 이내 entity에 연결되지 않은 파일 삭제. 반복 job. | CP5-BE-3a, CP1-BE-8 | `apps/server/src/jobs/orphan-file-cleanup.ts` |
| CP5-BE-4 | Backend | IssueMention 서비스: Wiki 페이지 저장 시 content에서 이슈 링크 패턴 추출 → `issue_mentions` 테이블 upsert. | CP5-DBA-2, CP5-BE-2 | `apps/server/src/services/mention-service.ts` |
| CP5-BE-5 | Backend | Wiki WebSocket 이벤트: `wiki-page.created`, `wiki-page.updated`, `wiki-page.deleted`. `workspace:{wsId}` 채널. | CP5-BE-2, CP1-BE-6 | `apps/server/src/websocket/wiki-events.ts` |
| CP5-BE-6 | Backend | Wiki/File Zod 공유 스키마. | CP5-DBA-1 | `packages/shared/src/schemas/wiki.ts`, `files.ts` |
| CP5-BE-7 | Backend | TipTap 서버 사이드 sanitize: 저장 시 XSS 방지용 JSON 정화. content → content_text plaintext 추출 로직. | CP5-BE-2 | `apps/server/src/lib/sanitize.ts`, `apps/server/src/lib/extract-text.ts` |
| CP5-FE-1 | Frontend | 슬래시 명령어(/) TipTap extension: floating 메뉴, 블록 목록(heading/list/todo/code/table/image/file/quote/divider), 키보드 네비게이션(↑↓ Enter), 검색 필터. | CP5-DS-2 | `packages/editor/src/extensions/slash-command.ts` |
| CP5-FE-2 | Frontend | 이슈 링크 TipTap extension: InputRule(`/([A-Z]{2,5}-\d+)/`), PasteRule, 클릭 시 이슈 페이지 네비게이션. 링크 노드 스타일(밑줄 + 색상). | CP5-DS-2 | `packages/editor/src/extensions/issue-link.ts` |
| CP5-FE-3* | Frontend | Wiki Space 페이지: Space 리스트, Space 생성/편집 모달, 사이드바 Wiki 섹션 연동. **Wiki Space 멤버 관리 UI**: 멤버 목록, editor/viewer 역할 변경, 멤버 추가/제거 Popover. | CP5-DS-1, CP5-BE-1 | `apps/web/src/pages/wiki/`, `apps/web/src/components/wiki/`, `apps/web/src/components/wiki/space-members.tsx` |
| CP5-FE-4* | Frontend | 페이지 트리 컴포넌트: 계층 표시(들여쓰기), 펼침/접힘, DnD(dnd-kit tree), 순환 참조 불가 위치 시각적 표시, 새 페이지 추가 인라인. | CP5-FE-3, CP5-BE-2 | `apps/web/src/components/wiki/page-tree/` |
| CP5-FE-5* | Frontend | Wiki 페이지 편집 화면: Breadcrumb, 제목 인라인 편집, TipTap 에디터(슬래시 명령어 + 이슈 링크), 자동 저장(2초 디바운스), 저장 상태 표시. Last-Write-Wins 충돌 toast. | CP5-FE-1, CP5-FE-2, CP5-BE-2 | `apps/web/src/pages/wiki/page-editor.tsx` |
| CP5-FE-6 | Frontend | 파일 업로드 컴포넌트: 에디터 이미지(붙여넣기/드래그 → 업로드 → URL 삽입), 파일 첨부 UI, 업로드 진행률, 에러 핸들링(25MB, 차단 파일, 용량 초과). 이슈/Wiki 공용. | CP5-DS-3, CP5-BE-3a | `apps/web/src/components/file-upload/`, `packages/editor/src/extensions/image-upload.ts` |
| CP5-TL-1 | Tech Lead | 통합 검증: Wiki Space 생성 → 페이지 생성 → 에디터 편집 → 슬래시 명령어 → 이슈 링크 → 파일 업로드 → 페이지 트리 DnD → 자동 저장 전체 플로우. 순환 참조 방지 동작. 멤버 관리 동작. | CP5-FE-6 | 리뷰 코멘트 |
| CP5-QA-1 | QA | 서버 테스트: WikiSpace CRUD + 권한 + 멤버 관리, WikiPage CRUD + 순환 참조 방지 + 최대 깊이, File 업로드(25MB, 차단, 용량), 고아 파일 정리, IssueMention 추출, content sanitize, plaintext 추출. | CP5-TL-1 | `apps/server/test/wiki.test.ts`, `files.test.ts` |
| CP5-QA-2 | QA | 프론트엔드 테스트: 페이지 트리 렌더링 + DnD, 에디터 슬래시 명령어, 이슈 링크 InputRule, 자동 저장 디바운스, 파일 업로드 진행/에러, Breadcrumb 네비게이션, Space 멤버 관리 UI. | CP5-TL-1 | `apps/web/test/wiki/`, `apps/web/test/editor/` |

---

## CP-6: 공통 기능

> Cmd+K 검색, My Work, 댓글/리액션/활동, 알림

### 실행 순서

1. **[Phase 1 — 병렬]** DBA: 댓글, 리액션, 알림, 즐겨찾기 스키마 (Activity 스키마는 CP2-DBA-3에서 이미 생성됨)
2. **[Phase 2 — 병렬]** Backend: 검색 API + 댓글 API + 알림 API + My Work API | Design: Cmd+K + My Work + 댓글 UI 스펙
3. **[Phase 3 — 병렬]** Frontend: Cmd+K 구현 | Frontend: 댓글/리액션 UI | Frontend: My Work UI
4. **[Phase 4]** Frontend: 알림 시스템 (WebSocket 실시간)
5. **[Phase 5]** Tech Lead: 통합 검증
6. **[Phase 6]** QA: 테스트 작성

### 상세 태스크

| Task ID | Agent | 설명 | 의존성 | 핵심 산출물 |
|---------|-------|------|--------|------------|
| CP6-DBA-1* | DBA | 댓글 + 리액션 스키마: `comments`(다형적 — issue_id/page_id 중 하나, CHECK 제약(**raw SQL 마이그레이션 필요**), parent_id 스레드, content jsonb, soft delete), `reactions`(comment_id, user_id, emoji, UNIQUE). 마이그레이션. | CP5-DBA-1 | `packages/db/src/schema/comments.ts`, `reactions.ts` |
| CP6-DBA-2 | DBA | 알림 + 즐겨찾기 스키마: `notifications`(user_id, issue_id/page_id 다형적 CHECK(**raw SQL 마이그레이션 필요**), type enum, message, read_at), `favorites`(user_id, project_id/issue_id/page_id/space_id 다형적 CHECK(**raw SQL 마이그레이션 필요**), sort_order). 마이그레이션. | CP5-DBA-1 | `packages/db/src/schema/notifications.ts`, `favorites.ts` |
| CP6-DS-1 | Design | Cmd+K 명령 팔레트 스펙: 640px 너비 중앙 상단, 반투명 백드롭, 입력 auto-focus, 최근 항목(기본 5개), 검색 결과 카테고리(이슈/Wiki/프로젝트/명령어), 이슈 ID 즉시 이동, `>` prefix 명령어 모드, ↑↓ Enter Esc 네비게이션, 디바운스 300ms. | 없음 | `docs/design/command-palette.md` |
| CP6-DS-2 | Design | 댓글/활동 UI 스펙: 통합 타임라인(시간순 혼합, 필터 분리), 댓글 입력 필드(TipTap 미니 에디터 — @멘션 포함), 리액션(이모지 피커 + 카운트), 댓글 수정/삭제. | 없음 | `docs/design/comments-activity.md` |
| CP6-DS-3 | Design | My Work 스펙: Inbox(알림 목록, 읽음/안읽음, 벨 아이콘 뱃지), My Issues(할당된 이슈 상태별 그룹), Favorites(즐겨찾기 목록 DnD 정렬). 각 Empty State. | 없음 | `docs/design/my-work.md` |
| CP6-DS-4 | Design | 알림 스펙: 벨 아이콘 + 미읽음 카운트 뱃지, 알림 드롭다운(최근 알림 목록, 전체 읽음 처리), 알림 클릭 → 해당 엔티티로 네비게이션. | 없음 | `docs/design/notifications.md` |
| CP6-BE-1* | Backend | 검색 API: `GET /workspaces/:wsId/search?q=...&type=issue,page,project`. PostgreSQL `ILIKE` + `pg_trgm` GIN. 이슈 ID 패턴 감지 → `(prefix, sequence_id)` 직접 조회. 결과 카테고리별 그룹(이슈/페이지/프로젝트). 커서 페이지네이션. | CP5-DBA-1, CP2-DBA-2 | `apps/server/src/routes/search.ts`, `apps/server/src/services/search-service.ts` |
| CP6-BE-2 | Backend | Comment API: 이슈 댓글 CRUD(`POST/GET /issues/:id/comments`), Wiki 댓글 CRUD(`POST/GET /wiki-pages/:id/comments`). `PATCH/DELETE /comments/:id`(entity_type 검증). 스레드(parent_id). @멘션 추출. WebSocket **`comment.created`/`comment.updated`/`comment.deleted`** 이벤트(`issue:{id}` 채널). | CP6-DBA-1, CP1-BE-6 | `apps/server/src/routes/comments.ts`, `apps/server/src/services/comment-service.ts`, `apps/server/src/websocket/comment-events.ts` |
| CP6-BE-3 | Backend | Reaction API: `POST /comments/:id/reactions`, `DELETE /comments/:id/reactions/:emoji`. 토글 동작(이미 있으면 제거). | CP6-DBA-1 | `apps/server/src/routes/comments.ts`(확장) |
| CP6-BE-4 | Backend | Notification 서비스: 이벤트(이슈 할당/멘션/댓글/상태 변경/WS 초대) → DB INSERT + Redis Pub/Sub → WebSocket `user:{id}` 채널. 자기 이벤트 제외. 중복 방지. BullMQ 비동기 처리(CP1-BE-8 인프라 사용). WebSocket **`notification.new`** 이벤트. | CP6-DBA-2, CP1-BE-6, CP1-BE-8 | `apps/server/src/services/notification-service.ts`, `apps/server/src/jobs/notification-job.ts` |
| CP6-BE-5 | Backend | Notification API: `GET /my/notifications`, `GET /my/notifications/unread-count`, `PATCH /notifications/:id`(읽음), `PATCH /my/notifications/read-all`, `DELETE /notifications/:id`. | CP6-BE-4 | `apps/server/src/routes/notifications.ts` |
| CP6-BE-6 | Backend | My Issues API: `GET /my/issues?workspace_id=...`. IssueAssignee JOIN + 상태별 그룹. | CP2-BE-2 | `apps/server/src/routes/my-work.ts`(확장) |
| CP6-BE-7 | Backend | Favorite API: CRUD(`POST/GET/PATCH/DELETE /my/favorites`). 다형적 엔티티(project/issue/page/space). sort_order fractional indexing. | CP6-DBA-2 | `apps/server/src/routes/favorites.ts`, `apps/server/src/services/favorite-service.ts` |
| CP6-BE-8 | Backend | 검색/댓글/알림/즐겨찾기 Zod 공유 스키마. | CP6-DBA-1 | `packages/shared/src/schemas/search.ts`, `comments.ts`, `notifications.ts`, `favorites.ts` |
| CP6-FE-1* | Frontend | Cmd+K 명령 팔레트(cmdk 라이브러리): 640px 중앙, 검색 입력(디바운스 300ms), 최근 항목(localStorage 최대 20개, 표시 5개), 검색 결과 카테고리, 이슈 ID 즉시 라우팅, `>` 명령어 모드(이슈 생성/프로젝트 이동/페이지 생성/내 이슈/설정/로그아웃), ↑↓ Enter Esc, 백드롭. Cmd+K 항상 활성. | CP6-DS-1, CP6-BE-1 | `apps/web/src/components/command-palette/` |
| CP6-FE-2 | Frontend | 댓글/활동 통합 타임라인: 시간순 혼합 표시, 활동/댓글 필터, 댓글 입력(TipTap 미니 에디터 + @멘션), 댓글 수정/삭제, 낙관적 업데이트. 이슈 상세 + Wiki 페이지 공용. WebSocket `comment.*` 이벤트 수신. | CP6-DS-2, CP6-BE-2 | `apps/web/src/components/comments/`, `apps/web/src/components/activity-timeline/` |
| CP6-FE-3 | Frontend | 리액션 컴포넌트: 이모지 피커(Popover), 리액션 카운트 표시, 토글(클릭 추가/제거), 낙관적 업데이트. | CP6-FE-2, CP6-BE-3 | `apps/web/src/components/comments/reactions.tsx` |
| CP6-FE-4 | Frontend | My Work — Inbox 페이지: 알림 목록(읽음/안읽음 스타일), 전체 읽음 처리, 알림 클릭 → 엔티티 네비게이션, Empty State. | CP6-DS-3, CP6-BE-5 | `apps/web/src/pages/my-work/inbox.tsx` |
| CP6-FE-5 | Frontend | My Work — My Issues 페이지: 할당된 이슈 상태별 그룹(accordions), 이슈 클릭 → Side Panel, Empty State. | CP6-DS-3, CP6-BE-6 | `apps/web/src/pages/my-work/my-issues.tsx` |
| CP6-FE-6 | Frontend | My Work — Favorites 페이지: 즐겨찾기 목록(프로젝트/이슈/페이지/스페이스 아이콘 구분), DnD 정렬, 즐겨찾기 추가/제거(별 아이콘 토글, 각 엔티티에 배치), Empty State. 사이드바 Favorites 섹션 연동. | CP6-DS-3, CP6-BE-7 | `apps/web/src/pages/my-work/favorites.tsx`, `apps/web/src/components/favorite-button.tsx` |
| CP6-FE-7 | Frontend | 알림 실시간 수신: WebSocket `notification.new` → 벨 아이콘 미읽음 카운트 업데이트 + TanStack Query 캐시 추가. 벨 아이콘 드롭다운(최근 알림 5개). | CP6-DS-4, CP6-BE-4 | `apps/web/src/components/notification-bell.tsx` |
| CP6-TL-1 | Tech Lead | 통합 검증: Cmd+K 검색(이슈/페이지/프로젝트/명령어), 댓글 작성 → 알림 수신 → Inbox 표시, My Issues/Favorites 동작, WebSocket 알림 실시간 수신, comment WebSocket 이벤트. | CP6-FE-7 | 리뷰 코멘트 |
| CP6-QA-1 | QA | 서버 테스트: 검색(ILIKE + 이슈 ID 패턴 + 빈 결과 + 권한 필터), Comment CRUD + entity_type 검증 + 스레드, Reaction 토글, Notification 트리거(각 이벤트 + 자기 제외 + 중복 방지), Favorite CRUD + 다형적 CHECK, My Issues 조회. | CP6-TL-1 | `apps/server/test/search.test.ts`, `comments.test.ts`, `notifications.test.ts`, `favorites.test.ts` |
| CP6-QA-2 | QA | 프론트엔드 테스트: Cmd+K 렌더링 + 키보드 네비게이션 + 명령어 모드, 댓글 입력 + 수정 + 삭제, 리액션 토글, Inbox/My Issues/Favorites 렌더링 + Empty State, 알림 벨 뱃지 업데이트. | CP6-TL-1 | `apps/web/test/command-palette/`, `apps/web/test/comments/`, `apps/web/test/my-work/` |

---

## CP-7: 배포 & QA

> Dockerfile, docker-compose.prod, 리버스 프록시, .dockerignore, 셀프호스팅 문서, 온보딩 위저드, Empty State, Swagger, 에러 페이지, 버그 수정

### 실행 순서

1. **[Phase 1 — 병렬]** DevOps: 프로덕션 Docker 구성 | Design: 온보딩 위저드 + Empty State + 에러 페이지 최종 스펙
2. **[Phase 2 — 병렬]** Backend: Swagger 최종 정리 + 헬스체크 고도화 | Frontend: 온보딩 위저드 + Empty State + 에러 페이지 구현
3. **[Phase 3]** DevOps: 셀프호스팅 배포 문서
4. **[Phase 4]** Tech Lead: 전체 통합 검증 + 성능 리뷰
5. **[Phase 5]** QA: 최종 E2E 시나리오 + 회귀 테스트
6. **[Phase 6]** 전체: 버그 수정 사이클

### 상세 태스크

| Task ID | Agent | 설명 | 의존성 | 핵심 산출물 |
|---------|-------|------|--------|------------|
| CP7-DO-1* | DevOps | `Dockerfile.server`: Multi-stage build(build → runtime). Node.js 20 alpine. pnpm fetch + install + build. 최소 런타임 이미지. 헬스체크 CMD. | CP6-TL-1 | `Dockerfile.server` |
| CP7-DO-2* | DevOps | `Dockerfile.web`: Multi-stage build(build → nginx). Vite build → nginx 정적 서빙. SPA fallback 설정. 환경 변수 런타임 주입(entrypoint.sh에서 `env.js` 생성). | CP6-TL-1 | `Dockerfile.web` |
| CP7-DO-3* | DevOps | `docker-compose.prod.yml`: server, web, **worker**(BullMQ 워커 전용 컨테이너, 동일 서버 이미지에서 `--worker` 플래그로 분리 실행), postgres, redis, minio. 볼륨(데이터 영속), 네트워크, 재시작 정책(unless-stopped), 리소스 제한(deploy.resources). `.env.example` 프로덕션용. | CP7-DO-1, CP7-DO-2 | `docker-compose.prod.yml` |
| CP7-DO-4 | DevOps | 리버스 프록시: Caddy 설정(자동 HTTPS). WebSocket 업그레이드 프록시. `/api` → server, `/` → web 라우팅. 헤더(HSTS, X-Frame-Options 등). | CP7-DO-3 | `Caddyfile`, `docker-compose.prod.yml`(Caddy 서비스 추가) |
| CP7-DO-5 | DevOps | `.dockerignore` 작성. GitHub Actions release workflow: tag push → **Docker 이미지 빌드 검증** → Docker Hub/GHCR 이미지 push. **build.yml workflow**: PR 시 Docker 이미지 빌드 성공 여부 검증(push 없이 build-only). | CP7-DO-3 | `.dockerignore`, `.github/workflows/release.yml`, `.github/workflows/build.yml` |
| CP7-DO-6 | DevOps | 셀프호스팅 배포 문서: 사전 요구사항(Docker, Compose), 빠른 시작(3단계), 환경 변수 설명, 백업/복원, 업그레이드 절차, 트러블슈팅. | CP7-DO-4 | `docs/self-hosting.md` |
| CP7-DS-1 | Design | 온보딩 위저드 최종 스펙: 신규 가입 시 단계별 가이드(Org 생성 → WS 생성 → Project 생성 → 첫 이슈 생성 유도). 프로그레스 바, 건너뛰기 옵션. | 없음 | `docs/design/onboarding-wizard.md` |
| CP7-DS-2 | Design | Empty State 최종 정리: 기능정의서 12.10 목록 기준, 각 화면별 일러스트/아이콘 + 메시지 + CTA 버튼 일관된 스타일. | 없음 | `docs/design/empty-states.md` |
| CP7-DS-3 | Design | **에러 페이지 디자인 스펙**: 404 (페이지 없음), 500 (서버 오류), 403 (접근 거부) 화면. 일관된 레이아웃, 홈/뒤로가기 CTA, 에러 코드 표시. | 없음 | `docs/design/error-pages.md` |
| CP7-BE-1 | Backend | Swagger 최종 정리: 모든 API 태그/설명/예시 확인, 응답 스키마 일관성, `@fastify/swagger-ui` 설정(`/api/v1/docs`). | CP6-BE-8 | `apps/server/src/routes/`(Swagger 어노테이션 보완) |
| CP7-BE-2 | Backend | 헬스체크 고도화: `/readyz` — DB 연결 + Redis 연결 + 디스크 공간 확인. 응답에 각 서비스 상태 포함. | CP1-BE-1 | `apps/server/src/routes/health.ts`(확장) |
| CP7-BE-3 | Backend | Soft delete 크론 job: 30일 경과 엔티티 hard delete + 파일 스토리지 정리. BullMQ 반복 job(CP1-BE-8 인프라 사용). | CP6-DBA-1, CP1-BE-8 | `apps/server/src/jobs/hard-delete-cleanup.ts` |
| CP7-BE-4 | Backend | 보안 헤더 미들웨어: CORS origin whitelist + credentials, Content-Security-Policy, X-Content-Type-Options, X-Frame-Options. | CP1-BE-1 | `apps/server/src/middleware/security.ts` |
| CP7-FE-1 | Frontend | 온보딩 위저드 개선: CP1-FE-4 기반, 프로그레스 바, 각 단계 유효성 검증, 건너뛰기 → 기본값으로 생성, 완료 시 My Work으로 리다이렉트. | CP7-DS-1, CP1-FE-4 | `apps/web/src/pages/onboarding/`(리팩토링) |
| CP7-FE-2 | Frontend | Empty State 전체 구현: 기능정의서 12.10 목록 전체. 통일된 `EmptyState` 컴포넌트(아이콘, 메시지, CTA). 각 화면에 적용 확인. | CP7-DS-2 | `apps/web/src/components/empty-state.tsx`, 각 페이지 적용 |
| CP7-FE-3 | Frontend | 에러 바운더리 + **에러 페이지**: 전역 에러 바운더리 + 라우트별 에러 페이지(404, 500, 403). CP7-DS-3 디자인 스펙 반영. 에러 리포트 토스트. | CP7-DS-3 | `apps/web/src/components/error-boundary.tsx`, `apps/web/src/pages/errors/` |
| CP7-FE-4 | Frontend | 반응형 최종 점검: 1280+/1024~1279 동작 확인, ~1023px "데스크톱 브라우저 사용" 안내. 사이드바 축소(48px 아이콘) 동작. | 없음 | 각 레이아웃 컴포넌트 수정 |
| CP7-TL-1* | Tech Lead | 전체 통합 검증: 전체 유저 시나리오 플로우(가입 → 온보딩 → 프로젝트 생성 → 이슈 CRUD → 칸반 → 사이클 → Wiki → 검색 → 알림). 성능 리뷰(N+1 쿼리, 불필요한 리렌더, 인덱스 누락). 보안 리뷰(인증/권한/XSS/CORS). 코드 컨벤션 최종 확인. | CP7-FE-4, CP7-BE-4 | 최종 리뷰 리포트 |
| CP7-TL-2 | Tech Lead | 기술 부채 정리: TODO 주석 해결, 미사용 코드 제거, 타입 `any` 제거, 에러 핸들링 일관성 확인. | CP7-TL-1 | 리팩토링 PR |
| CP7-QA-1* | QA | 최종 E2E 시나리오 테스트(Playwright): 신규 가입 → 온보딩 → 프로젝트 생성 → 이슈 생성(Quick Add) → 칸반 DnD → 사이클 생성 + 이슈 추가 → Wiki 페이지 작성 → Cmd+K 검색 → 알림 확인. | CP7-TL-1 | `e2e/full-flow.spec.ts` |
| CP7-QA-2 | QA | 회귀 테스트: CP1~CP6 모든 테스트 실행, 깨진 테스트 수정. 커버리지 리포트 생성. | CP7-QA-1 | 테스트 커버리지 리포트 |
| CP7-QA-3 | QA | 보안 테스트: 권한 우회 시도(다른 사용자 리소스 접근), Rate limiting 동작, XSS 페이로드 삽입, CSRF 방어, 세션 만료 동작. | CP7-TL-1 | `apps/server/test/security.test.ts` |
| CP7-QA-4 | QA | 엣지 케이스 테스트: 이슈 삭제 연쇄 처리(서브이슈 승격, CycleIssue 제거, Wiki 링크 표시), 프로젝트 prefix 재사용 방지, Wiki 순환 참조, 동시 편집 Last-Write-Wins. | CP7-TL-1 | `apps/server/test/edge-cases.test.ts` |

---

## 전체 의존성 그래프 (체크포인트 간)

```
CP-1 (프로젝트 셋업)
 │
 ├──→ CP-2 (이슈 핵심)
 │     │
 │     ├──→ CP-3 (이슈 뷰) ──→ CP-4 (사이클)  ← CP4-FE-4가 CP3-FE-3 필터에 의존
 │     │                          │
 │     └──→ CP-5 (Wiki)  ← CP-2 완료 후 바로 착수 (CP-3과 시차 병렬)
 │           │                    │
 │           └──→ CP-6 (공통)  ←──┘  ← CP-4/CP-5 완료 후 착수
 │
 └─────────────────────────→ CP-7 (배포 & QA)  ← 모든 CP 완료 후
```

**시차 병렬(Staggered Parallel) 설명**:
- CP-5(Wiki)는 CP-2 완료 직후 착수 가능 (CP-3 완료를 기다리지 않음)
- CP-4(사이클)는 CP-3 완료 후 착수 (CP4-FE-4 → CP3-FE-3 필터 의존)
- CP-5의 DBA/Design은 CP-3 Backend/Frontend 진행 중에도 병렬 착수 가능
- CP-6은 CP-4와 CP-5 모두 완료된 후 착수

---

## 에이전트별 워크로드 요약

| Agent | CP-1 | CP-2 | CP-3 | CP-4 | CP-5 | CP-6 | CP-7 | 합계 |
|-------|------|------|------|------|------|------|------|------|
| **DBA** | 2 | 3 | 1 | 1 | 2 | 2 | 0 | **11** |
| **Backend** | 9 | 8 | 6 | 5 | 9 | 8 | 4 | **49** |
| **Frontend** | 8 | 8 | 6 | 4 | 6 | 7 | 4 | **43** |
| **Design** | 4 | 4 | 4 | 1 | 3 | 4 | 3 | **23** |
| **QA** | 3 | 2 | 2 | 2 | 2 | 2 | 4 | **17** |
| **DevOps** | 3 | 0 | 0 | 0 | 0 | 0 | 6 | **9** |
| **Tech Lead** | 2 | 1 | 1 | 1 | 1 | 1 | 2 | **9** |

---

## 핵심 경로 (Critical Path)

아래 태스크가 지연되면 전체 일정에 직접 영향:

```
CP1-DBA-1 → CP1-BE-1 → CP1-BE-2 → CP2-DBA-1 → CP2-DBA-2 → CP2-DBA-3 → CP2-BE-2 → CP3-BE-1 → CP3-FE-1
                                                                  ↓                        ↓
                                                           CP2-BE-8 (Activity)      CP3-FE-3 → CP4-FE-4
                                                                  ↓
                                                           CP5-DBA-1 → CP5-BE-2 → CP5-FE-5
                                                                  ↓
                                                           CP6-DBA-1 → CP6-BE-2 (병렬: CP6-BE-1)
                                                                  ↓              ↓
                                                           CP6-FE-2        CP6-FE-1
                                                                  ↓
                                                           CP7-DO-1 → CP7-DO-3 → CP7-TL-1 → CP7-QA-1
```

**주요 체인 설명**:
- **메인 경로**: CP1 인프라 → CP2 이슈 DBA(DBA-1→DBA-2→DBA-3 체인) → CP3 뷰 → CP6 공통 → CP7 배포
- **사이클 경로**: CP3-FE-3 필터 → CP4-FE-4 사이클 필터 연동
- **Wiki 경로**: CP2-DBA-3 → CP5-DBA-1 → CP5-BE-2 → CP5-FE-5
- **CP6 내부**: DBA-1 완료 후 BE-1(검색)과 BE-2(댓글)는 **병렬** 착수 가능

---

## 위험 요소 및 대응

| 위험 | 영향 | 대응 |
|------|------|------|
| Better Auth 통합 복잡도 | CP-1 지연 | 초기에 인증 PoC 먼저 진행, 문서 부족 시 소스 코드 직접 분석 |
| TipTap 에디터 커스터마이징 | CP-2, CP-5 지연 | 슬래시 명령어/이슈 링크는 독립적으로 extension 개발 가능, 에디터 기초는 CP-2에서 확보 |
| dnd-kit 칸반 + 페이지 트리 DnD | CP-3, CP-5 지연 | 기본 DnD 먼저, 정교한 피드백은 CP-7 버그 수정에서 보완 |
| WebSocket 안정성 | CP-2~CP-6 전반 | 재연결 로직(지수 백오프) 조기 구현, 폴링 fallback은 v1.0 |
| DB 마이그레이션 번호 충돌 | 전체 | DBA가 스키마를 먼저 확정하고 Backend/Frontend가 따라가는 순서 엄수. **CP 간 마이그레이션 파일 번호는 DBA가 전역 관리**(예: CP1=0001, CP2=0002, CP3=0003...). 병렬 작업 시 번호 예약 규칙 사전 합의 |
| BullMQ 설정 복잡도 | CP-2, CP-5, CP-6, CP-7 | CP1-BE-8에서 기초 인프라(Queue/Worker 추상화, 공통 에러 처리)를 먼저 확보. 이후 CP들은 job 정의만 추가. Worker 프로세스 분리는 CP7-DO-3에서 처리 |
| `packages/shared` barrel export 충돌 | 전체 | 각 CP에서 새 스키마 추가 시 index.ts re-export 충돌 가능. **모듈별 독립 import 경로 사용** (예: `@worknest/shared/schemas/issues`) 또는 barrel export 추가 시 rebase 규칙 명확화 |
| 프로덕션 Docker 이미지 크기 | CP-7 | Multi-stage build, alpine 베이스, .dockerignore 철저, layer 캐싱 |

---

## MVP 기능 매핑 검증

아래는 FEATURE_SPEC.md의 모든 MVP 기능이 CP 태스크에 매핑되었는지 확인하는 체크리스트입니다.

| 기능 영역 | MVP 기능 | CP 태스크 |
|----------|---------|-----------|
| 인증 | 이메일+비밀번호, 세션, 초대, 로그인 제한 | CP1-BE-2, CP1-BE-3, CP1-FE-3 |
| Profile | GET/PATCH /my/profile | CP1-BE-9 |
| 조직/워크스페이스 | CRUD, 멤버 관리, 초대 관리, 설정 | CP1-BE-3, CP1-BE-4, CP1-FE-7, CP1-FE-8 |
| 프로젝트 | CRUD, 멤버, prefix, 설정 | CP2-BE-1, CP2-FE-1, CP2-FE-8 |
| 이슈 | CRUD, 타입/상태, 담당자, 라벨, 서브이슈, Quick Add | CP2-BE-2~8, CP2-FE-2~5 |
| 이슈 뷰 | 리스트, 보드(칸반), 필터, 저장된 뷰, 벌크 작업 | CP3 전체 |
| 사이클 | CRUD, 이슈 추가/제거, 진행률, 이월 | CP4 전체 |
| Wiki | Space CRUD, 멤버 관리, 페이지 CRUD, 트리, 에디터 | CP5 전체 |
| 에디터 | TipTap 블록, 슬래시 명령어, @멘션, 이슈 링크, 자동 저장 | CP2-FE-3, CP5-FE-1, CP5-FE-2 |
| 댓글/활동 | 댓글 CRUD, 리액션, 활동 로그 | CP2-BE-8, CP6-BE-2~3, CP6-FE-2~3 |
| 검색 | Cmd+K, 통합 검색, 이슈 ID 이동, 명령어 | CP6-BE-1, CP6-FE-1 |
| My Work | Inbox, My Issues, Favorites | CP6-BE-5~7, CP6-FE-4~6 |
| 알림 | 인앱 알림, 실시간 WebSocket | CP6-BE-4~5, CP6-FE-7 |
| 파일 | 업로드, 썸네일, 다운로드 | CP5-BE-3a~c, CP5-FE-6 |
| 키보드 | 단축키 시스템, 시트 | CP2-FE-6 |
| 배포 | Docker, 셀프호스팅, 헬스체크, Swagger | CP7 전체 |
| UI | Empty State, 에러 페이지, 반응형, 온보딩 | CP7-FE-1~4 |
| 라벨 관리 | 라벨 CRUD 설정 UI | CP2-FE-8 |

---

## 백로그 (CAN WAIT)

CP-1 Tech Lead 리뷰에서 식별된 항목. CP-2 진행에 영향 없으나 추후 해결 필요.

| # | 항목 | 위치 | 설명 | 해결 시점 |
|---|------|------|------|----------|
| BL-1 | Rate Limiter In-Memory | `apps/server/src/middleware/rate-limit.ts` | 다중 인스턴스 배포 시 Redis 전환 필요. MVP 단일 인스턴스에서는 문제 없음. | v1.0 |
| BL-2 | 사이드바 하드코딩 프로젝트 | `apps/web/src/components/layout/sidebar.tsx` L97~105 | "WORK" 프로젝트가 하드코딩. CP-2에서 동적 프로젝트 목록으로 교체 예정. | CP-2 |
| BL-3 | 로그아웃 미구현 (프론트) | `apps/web/src/components/layout/sidebar.tsx` L425~431 | 로그아웃 버튼 존재하지만 실제 API 호출 없음. | CP-2 |
| BL-4 | hashToken/generateToken 중복 | `organization-service.ts`, `workspace-service.ts` | 동일 함수가 두 서비스에 각각 정의. `apps/server/src/lib/crypto.ts`로 추출 권장. | CP-3 |
| BL-5 | BullMQ 작업 미등록 | `apps/server/src/jobs/index.ts` | `registerAllJobs()`가 빈 함수. CP-2 Activity job 추가 시 채워질 예정. | CP-2 |
| BL-6 | 초대 만료/수락 UX 분기 미작동 | `apps/web/src/routes/_auth/invite.$token.tsx` | 프론트엔드가 expired/accepted를 에러 코드로 처리하지만 백엔드는 데이터 플래그로 반환. UX 분기가 트리거되지 않음. | CP-2 |
| BL-7 | 로그인/회원가입 Zod 스키마 로컬 중복 | `login.tsx`, `register.tsx` | 한국어 에러 메시지를 위해 shared에서 import 안하고 로컬 정의. error map 패턴으로 통합 검토. | CP-3 |
| BL-8 | Better Auth secret 명시적 전달 | `apps/server/src/lib/auth.ts` | 환경변수 자동 감지에 의존. createAuth()에 secret 옵션 명시적 전달 권장. | CP-7 |
