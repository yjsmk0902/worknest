# Worknest 구현 계획

> 마지막 업데이트: **2026-04-29**
> 최신 커밋: `c0d78b8c chore(wiki): 마무리 리뷰 P1 항목 반영`

본 문서는 **Part A. 이미 구현된 기능**과 **Part B. 미구현 / 남은 작업**으로 분리되어 있습니다.
배포 체크리스트와 변경 기록은 Part C에 모았습니다.

---

## 🎯 다음 작업 (우선순위 순)

### P0 — 바로 착수
1. **CSV 가져오기/내보내기 검증** — 실제 마이그레이션 시나리오로 dry-run (Part B §1)
2. **dev DB 마이그레이션 0012~0017 적용** (Part C §1 배포 체크리스트)

### P1 — 다음 사이클
3. **이슈 템플릿** — 사용자 생산성 직결, 스코프 중간 (Part B §2)
4. **시간 추정/추적** — DB 컬럼 추가 + UI, 스코프 중간 (Part B §3)

### P2 — 큰 기능 (별도 사이클)
5. **워크플로우 자동화** — 가장 복잡, 규칙 평가 엔진 필요 (Part B §4)
6. **간트 차트 의존성 화살표** — 6-4 잔여 (Part B §5)

### P3 — v1.0 이후
7. **위키 Phase 3-1 Yjs 실시간 편집** — `apps/hocuspocus/` 앱 신규 구축 필요 (Part B §6)
8. **위키 Phase 4** — 페이지 템플릿 / 이슈 DB 임베드 / AI 보조 (Part B §7)
9. **위키 마무리 P2 항목** — 휴지통 / slug 리다이렉트 / 활동 로그 등 (Part B §8)

---

# Part A. 이미 구현된 기능 ✅

## A-1. 알림 시스템 연동
- [x] 이슈 담당자 배정 시 알림 (`assigned`)
- [x] 댓글 작성 시 이슈 참여자에게 알림 (`commented`)
- [x] 댓글에서 @멘션 시 알림 (`mentioned`)
- [x] 이슈 상태 변경 시 담당자에게 알림 (`status_changed`)
- [x] 프론트엔드 알림 벨 UI + 읽음 처리

## A-2. CSV 가져오기/내보내기 (커밋 `489b9f0a`)
- [x] 이슈 목록 CSV 내보내기 (현재 필터 적용 상태 기준)
- [x] CSV 가져오기 (제목, 설명, 우선순위, 상태, 담당자, 라벨, 시작일, 마감일)
- [x] 가져오기 시 미리보기 + 필드 매핑 UI (`csv-modal.tsx`)
- [x] 미존재 라벨 자동 생성

**파일**: `apps/server/src/services/issue-csv-service.ts`,
`apps/server/src/routes/issues.ts`, `apps/web/src/components/issues/csv-modal.tsx`

## A-3. 이슈 UX 개선 (커밋 `489b9f0a`)

### A-3-1. 간트 차트 드래그로 날짜 변경
- [x] 바 좌/우 엣지 드래그로 시작일/마감일 변경
- [x] 바 중앙 드래그로 기간 이동

### A-3-2. 보드 뷰 그룹 기준 변경
- [x] 상태 / 우선순위 / 담당자 / 라벨별 컬럼 전환
- [x] DnD 시 해당 필드 자동 업데이트 (단일 PATCH로 그룹 이동 처리)
- [x] `updateIssueInput`에 `assigneeIds` / `labelIds` 추가

### A-3-3. 이슈 복제
- [x] 상세 패널 헤더에 복제 버튼 (필드만 복사, 링크/첨부/코멘트 제외)

### A-3-4. 이슈 간 의존성
- [x] 관계 유형: `blocks` / `relates_to`
- [x] DB 테이블: `issue_relations` (migration 0016)
- [x] 이슈 상세 패널 의존성 관리 UI (`issue-dependencies.tsx`)
- [x] 순환 참조 체크 (재귀 CTE)

> 간트 차트 화살표 표시는 미완 → Part B §5

## A-4. 위키 모듈

### A-4-1. Phase 1 — 페이지 메타 & 탐색
- [x] 아이콘(이모지 피커) — 커버는 UI 제거 (컬럼은 유지)
- [x] 페이지/스페이스 즐겨찾기
- [x] 최근 편집 페이지 카드
- [x] 인라인 서브페이지 생성 (트리에서)
- [x] 전역 검색 (FTS + ILIKE fallback + 드래프트 필터)

### A-4-2. Phase 2 — 에디터 기능 (마크다운 친화)
- [x] Callout / Code (lowlight) / TaskList / HR / Table + TableToolbar
- [x] 통합 `@` 멘션 (멤버 amber / 페이지 blue / 이슈 emerald)
- [x] `#ISSUE-NN` 자동 링크
- [x] 북마크 + URL paste 자동 임베드 (OG 스크래핑, 6초/500KB 제한)
- [x] 마크다운 단축키 `| ` → 인용 / `--- ` → HR / ` ``` ` → code block
- [x] Typography (스마트 따옴표 / em-dash / ellipsis)
- [x] `/페이지 링크` 슬래시 + PageLink 블록 노드

### A-4-3. Phase 2+ — 플랫폼 통합
- [x] 페이지 Draft (작성자 본인 전용)
- [x] 프로젝트 ↔ 위키 연동 (자동 생성 + 양쪽 메뉴)
- [x] ConfirmDialog 기반 삭제 UI
- [x] 프로젝트 위키 백필 스크립트 (`apps/server/scripts/backfill-project-wikis.ts`)

### A-4-4. Phase 3 — 협업/공유 (부분 완료)

#### 3-3. 공유 링크 / 퍼블리시
- [x] `wiki_page_shares` + 토큰 라우트 (auth bypass) + `/wiki-share/$token` 공개 뷰어
- [x] ShareModal (링크 생성/복사/해제, 만료 표시)
- [x] Draft 페이지는 공개 뷰에서 404

#### 3-4. 페이지 히스토리/버전
- [x] `wiki_page_revisions` + snapshot (5분 dedupe, 50개 prune)
- [x] content/title 실제 변경 시에만 pre-update snapshot
- [x] HistoryPanel (타임라인 + 읽기 전용 미리보기 + 복원 확인 다이얼로그)
- [x] 복원 직전 자동 스냅샷 (되돌리기 안전 장치)

> 3-1 Yjs 실시간 / 3-2 블록 코멘트는 Part B §6 / 의도적 제거 (Part C §3)

## A-5. 위키 마무리 리뷰 P1 (커밋 `c0d78b8c` + `489b9f0a`)
- [x] **스페이스 권한 tier** — `editor | viewer` 2-tier 유지 결정, `wiki_space_members.role` 주석으로 admin 미도입 명시
- [x] **`files` 테이블 XOR 제약** — migration 0017로 `CHECK (NOT (issue_id IS NOT NULL AND page_id IS NOT NULL))` 적용
- [x] **`wiki_pages.content_format` 정책** — `'json'`만 사용, `'yjs'`는 v1.0 예약으로 스키마 주석 명시
- [x] **`.ProseMirror` querySelector 하드코딩 제거** — 제목 Enter → `editorRef` 경유로 전환
- [x] **Slug 자동생성 통일** — `space-form-modal`의 중복 `generateSlug` 제거 → 공용 `slugifyTitle()` 사용

## A-6. 디자인 v2 통일 (2026-04-20)
- [x] 이슈/사이클/보드/간트 전반 리디자인
- [x] 브랜드 로고 / 인증 페이지 / 사이드바 재구성

## A-7. 마이그레이션 (0000~0017)
- [x] 0000~0011: 초기 스키마 + 이슈/뷰/사이클/위키/공통 + 인덱스 정리 + 조인 요청 + 위키 아이콘/상태/프로젝트 연결
- [x] 0012 `wiki_page_shares`
- [x] 0013 `wiki_page_revisions`
- [x] 0014→0015 `comments.block_id` 추가 후 제거 (방향 전환)
- [x] 0016 `issue_relations`
- [x] 0017 `files_at_most_one_parent` CHECK

> dev DB 적용은 미완 → Part C §1

---

# Part B. 미구현 / 남은 작업

## B-1. CSV 보강 (선택)
- [ ] Jira CSV 형식 호환 (별도 매핑 프리셋 — 요청 시)

## B-2. 이슈 템플릿 (P1) ✅ 완료 (2026-05-06)
- [x] 프로젝트별 이슈 템플릿 CRUD (이름, 설명, 제목 프리픽스, 본문, 우선순위, 타입, 라벨)
- [x] 이슈 생성 시 템플릿 선택 UI (Quick Add 통합)
- [x] 기본 제공 템플릿: 버그 리포트, 기능 요청, 작업 (프로젝트 생성 시 자동 시드)
- [x] 기존 프로젝트 백필 스크립트 (`scripts/backfill-issue-templates.ts`)
- [x] 프로젝트 설정 > 이슈 템플릿 탭 (CRUD UI)

**구현 파일**
- `packages/db/src/schema/issue-templates.ts` + `migrations/0018_issue_templates.sql`
- `packages/shared/src/schemas/issue-templates.ts` — Zod 입출력 스키마
- `apps/server/src/services/issue-template-service.ts` — CRUD 서비스
- `apps/server/src/routes/issue-templates.ts` — API 라우트
- `apps/server/src/services/project-service.ts` — 프로젝트 생성 트랜잭션 내 시드
- `apps/server/scripts/backfill-issue-templates.ts` — 기존 프로젝트 백필
- `apps/web/src/components/issues/template-picker.tsx` — 드롭다운 선택 UI
- `apps/web/src/components/issues/quick-add.tsx` — 템플릿 적용 통합
- `apps/web/src/routes/_app/.../settings/templates.tsx` — 설정 화면
- `apps/web/src/components/projects/settings-layout.tsx` — `templates` 탭 추가

## B-3. 시간 추정/추적 (P1)
- [ ] 이슈에 추정 시간(estimate) 필드 추가
- [ ] 시간 기록(time entry) 시스템: 시작/정지 또는 수동 입력
- [ ] 이슈별 소요 시간 합산 표시
- [ ] 사이클 번다운 차트 (추정 vs 실제)

**예상 파일**
- `packages/db/src/schema/issues.ts` — estimate 컬럼 추가
- `packages/db/src/schema/time-entries.ts` — 새 테이블
- `packages/shared/src/schemas/time-entries.ts` — Zod 스키마
- `apps/server/src/services/time-entry-service.ts` — CRUD + 집계
- `apps/web/src/components/issues/issue-detail/time-tracker.tsx` — UI

## B-4. 워크플로우 자동화 (P2)
- [ ] 자동화 규칙 CRUD (트리거 → 조건 → 액션)
- [ ] 트리거: 상태 변경, 담당자 변경, 라벨 추가, 이슈 생성
- [ ] 액션: 상태 변경, 담당자 배정, 라벨 추가, 우선순위 설정
- [ ] 상태 전이 규칙 (허용되는 상태 변경 경로 정의)
- [ ] 프로젝트 설정 > 자동화 관리 UI

**예상 파일**
- `packages/db/src/schema/automations.ts` — 자동화 규칙 테이블
- `packages/shared/src/schemas/automations.ts` — Zod 스키마
- `apps/server/src/services/automation-service.ts` — 규칙 평가 엔진
- `apps/server/src/routes/automations.ts` — API 라우트
- `apps/web/src/components/automations/` — 관리 UI

## B-5. 간트 차트 의존성 화살표 (6-4 잔여, P2)
- [ ] 의존성 데이터를 간트 뷰에 화살표로 시각화 (선행 → 후행)
- [ ] 화살표 스타일 (blocks=실선 / relates_to=점선)
- [ ] 호버 시 관계 정보 툴팁

**예상 파일**: `apps/web/src/components/issues/gantt-view/gantt-chart.tsx`

## B-6. 위키 Phase 3-1 Yjs 실시간 편집 (P3 — v1.0)
- [ ] `content_format = 'yjs'` lazy migration
- [ ] `EditorWithCollab` 모드 분기
- [ ] 편집자 커서/아바타 awareness
- [ ] **`apps/hocuspocus/` 앱 신규 구축 필요** (디렉토리 미존재)

## B-7. 위키 Phase 4 — 고급 (P3 — v1.0 이후)

### B-7-1. 페이지 템플릿
- [ ] 워크스페이스/스페이스별 템플릿 CRUD
- [ ] 새 페이지 생성 시 템플릿 선택 모달
- [ ] 기본 제공: 회의록, 주간 리포트, 프로젝트 킥오프, 1-on-1

### B-7-2. 인라인 이슈 DB (이슈 뷰 임베드)
- [ ] 페이지 안에 저장된 이슈 뷰를 블록으로 임베드 (list/board 미니)
- [ ] 파일: `packages/editor/src/extensions/issue-view-embed.ts`,
  `apps/web/src/components/issues/embedded-view.tsx`

### B-7-3. AI 보조 (요약/작성/번역)
- [ ] 블록 선택 → 요약/이어쓰기/번역/맞춤법 커맨드
- [ ] OpenAI/Anthropic API 연동
- [ ] 파일: `packages/editor/src/ai/`, `apps/server/src/routes/ai.ts`

## B-8. 위키 마무리 리뷰 P2 (여유 있을 때)
- [ ] **페이지 휴지통** — `deleted_at` soft delete는 되어있지만 복원 UI/API 없음
- [ ] **이전 slug 리다이렉트** — slug 변경 시 구 URL 404 (`wiki_page_slug_history` 테이블 필요)
- [ ] **활동 로그** — 누가 언제 무엇을 변경했는지 추적 (audit 테이블)
- [ ] **페이지 이동 시 unsaved 경고** — `beforeunload` / router guard
- [ ] **이미지 업로드 에러 UX** — 실패 시 Toast 피드백 명확화
- [ ] **모달 3개 통합** — Bookmark/PageLink/Share 모달이 동일 패턴. `useModalPrompt` 훅 추출 가능
- [ ] **QueryKey 규약 통일** — `['wiki-pages', pageId]` vs `['wiki-spaces', spaceId, 'pages']` 혼재
- [ ] **Drizzle 스키마에 `search_vector` 필드 선언** — DB에는 있고 raw SQL로 쿼리 가능하나 타입 안전성 개선 가능
- [ ] **Embed auto-unfurl** — 북마크는 됐으나, 일반 URL 붙여넣기 → 인라인 카드 자동 변환은 제한적 (현재 빈 문단 한정)
- [ ] **sanitize.ts / extract-text.ts 검증** — 최근 extension 제거(Toggle 등)에 맞춰 화이트리스트 동기화 확인

## B-9. 기술 부채

### B-9-1. 테스트 스위트 정비 (우선순위: 중)
현재 `apps/server` vitest에서 66개 테스트가 실패 중. CI에서 non-blocking.
- [ ] **Mock DB 격리 부족** (대부분): 이슈 필터/정렬/페이지네이션 테스트들이 전체 데이터(20/40/50개)를 반환하여 expected 1/2/3/5와 불일치
- [ ] **Rate limiting 상태 유지**: auth 테스트가 429를 반환 (테스트 간 리셋 안 됨)
- [ ] **Better Auth 모킹**: register/login 400·401 반환

### B-9-2. 타입 오류 정리 (우선순위: 낮)
- [ ] `apps/server`: Drizzle ORM `strict` 타입과 `request.user!.id` 패턴 충돌 → 수십 개 에러 (`typecheck` 스크립트에서 skip 처리)
- [ ] `apps/web`: TanStack Router `<Link to>` 타입 literal 제약 → ~30개
- [x] `packages/editor`: TipTap `@tiptap/pm` v2/v3 버전 충돌 → 해결 (pnpm overrides)

### B-9-3. 번들 크기 (우선순위: 낮)
- [ ] `page-mention-list` 청크가 ~690KB (gzip 215KB). TipTap + prosemirror + lowlight 포함
- [ ] 동적 import / manual chunks 로 split 가능 (현재 로딩 체감상 문제 없음)

---

# Part C. 운영

## C-1. 배포 전 체크리스트

- [ ] **dev DB 마이그레이션** 0012~0017 gcloud SSH로 적용
  - 0012 `wiki_page_shares`
  - 0013 `wiki_page_revisions`
  - 0014/0015 `comments.block_id` 추가 후 제거 (no-op 묶음 가능)
  - 0016 `issue_relations`
  - 0017 `files_at_most_one_parent` CHECK
- [ ] **LOCAL_TEST.md** 체크리스트 전부 green 확인
- [ ] 공유 링크 시크릿 창에서 접근 테스트 (로그인 없이)
- [ ] IME 한글 입력 테스트 (제목 / 에디터 / 테이블 셀)
- [ ] CSV 가져오기 — Jira export 샘플로 dry-run
- [ ] 보드 그룹 전환 시 DnD 라벨/담당자 업데이트 검증
- [ ] 간트 바 드래그 → 시작일/마감일 변경 검증
- [ ] 이슈 의존성 순환 참조 차단 검증 (A→B→A 시도)
- [ ] 기존 프로젝트용 위키 백필 스크립트 dry-run 후 본 실행
- [ ] server test 66 실패는 pre-existing (non-blocking)

## C-2. 구현 순서 요약

```
이슈 트랙:
  Phase 1 ✅ 알림 시스템 연동
  Phase 2 ✅ 이슈 UX 개선 (복제 / 보드 그룹 / 간트 드래그 / 의존성)
  Phase 3 ✅ CSV 가져오기/내보내기
  → Phase 4 이슈 템플릿                    ← 다음 (P1)
  → Phase 5 시간 추정/추적                 ← 다음 (P1)
  → Phase 6 워크플로우 자동화              ← P2
  → Phase 7 간트 의존성 화살표 (6-4 잔여)  ← P2

위키 트랙:
  Phase 1 ✅ 페이지 메타 & 탐색
  Phase 2 ✅ 에디터 기능 (마크다운 친화)
  Phase 2+ ✅ Draft / 프로젝트-위키 / 삭제 UI
  Phase 3 ▲ 부분 완료 (공유/히스토리 ✅, 블록 코멘트 ❌, Yjs ⏸)
  마무리 리뷰 P1 ✅ 전체 반영 완료
  Phase 4 ⏸ 고급 (템플릿 / 이슈 DB 임베드 / AI)
  마무리 리뷰 P2 ⏸ 여유 있을 때

공통:
  기술 부채 (B-9) ← 별도 사이클
```

## C-3. 의도적으로 제거된 기능 (참고)

- **블록 단위 코멘트** (Phase 3-2) — 2026-04-24 방향 전환에서 제거
  - 프론트 UI / 백엔드 라우트 / `comments.block_id` 컬럼 전부 제거 (migration 0015)
  - 이슈 코멘트는 유지
- **BlockId / DragHandle / Toggle / BlockCommentsPanel** 확장 — 마크다운 친화 에디터로 범위 축소 시 제거

## C-4. 변경 기록

### 2026-04-29 — PLAN 구조 개편
- Part A (구현 완료) / Part B (미구현) / Part C (운영) 3-파트로 재정렬
- 의도적 제거 기능을 별도 섹션으로 분리

### 2026-04-27 — PLAN 갱신
- 섹션 6 이슈 UX 4건 + 섹션 2 CSV + 섹션 8 위키 P1 5건 모두 완료 반영
- 다음 작업을 `이슈 템플릿` / `시간 추정` / `워크플로우 자동화`로 재정렬
- 섹션 6-4의 간트 화살표만 후속으로 분리

### 2026-04-24 — 이슈 P0 + CSV (commit `489b9f0a`, `c0d78b8c`)
- 이슈: 복제 / 보드 그룹 전환 / 간트 드래그 / 의존성 (`issue_relations` migration 0016)
- CSV: 내보내기(필터 반영) + 가져오기(미존재 라벨 자동 생성, 미리보기)
- 위키 P1: 권한 tier 문서화, content_format 문서화, querySelector 제거, slug 통일
- 마이그레이션 0016~0017 추가 (`issue_relations`, `files_at_most_one_parent`)

### 2026-04-24 — 위키 모듈 마무리 + 방향 전환 (commit `e7b5c8ae`)
- 마크다운 친화 에디터로 범위 축소 — BlockId/DragHandle/Toggle/BlockCommentsPanel 제거
- Phase 2 후속 5건 + Phase 3 부분(공유/히스토리) 완료
- 테이블 레이아웃 시프트 최종 수정 (Placeholder `tr` pseudo 차단)
- 페이지 slug 생성 개선, 삭제 시 자녀 sortOrder 재분배, 스페이스 self-remove 방지
- 마이그레이션 0012~0015 추가

### 2026-04-21 — 위키 Phase 1 + 2 완료
- 페이지 메타 & 탐색 + 에디터 블록 확장 + 드래그앤드롭 + Draft + 프로젝트 연동 + 삭제 UI

### 2026-04-20 — 디자인 v2 통일
- 이슈/사이클/보드/간트 전반 리디자인
- 브랜드 로고 / 인증 페이지 / 사이드바 재구성
