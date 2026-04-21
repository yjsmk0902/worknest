# 이슈 관리 개선/추가 기능 구현 계획

## 1. 알림 시스템 연동

### 현황
- 알림 프레임워크(DB 스키마, REST API, NotificationService) 이미 구현 완료
- 이벤트 훅이 연결되지 않아 실제 알림이 발생하지 않는 상태

### 구현 범위
- [x] 이슈 담당자 배정 시 알림 (`assigned`) ✅
- [x] 댓글 작성 시 이슈 참여자에게 알림 (`commented`) ✅
- [x] 댓글에서 @멘션 시 알림 (`mentioned`) ✅
- [x] 이슈 상태 변경 시 담당자에게 알림 (`status_changed`) ✅
- [x] 프론트엔드 알림 벨 UI + 읽음 처리 (기존 구현 확인) ✅

### 수정 파일
- `apps/server/src/routes/issues.ts` — 담당자 배정 시 assigned 알림 dispatch
- `apps/server/src/routes/comments.ts` — 댓글 생성 시 commented/mentioned 알림 dispatch + 멘션 파서 추가
- `apps/server/src/services/issue-service.ts` — 상태 변경 시 status_changed 알림 dispatch + getIssueSummary/getAssigneeIds 헬퍼 추가

---

## 2. CSV 가져오기/내보내기

### 구현 범위
- [ ] 이슈 목록 CSV 내보내기 (현재 필터 적용 상태 기준)
- [ ] CSV 가져오기 (제목, 설명, 우선순위, 상태, 담당자, 라벨, 시작일, 마감일)
- [ ] 가져오기 시 미리보기 + 필드 매핑 UI
- [ ] Jira CSV 형식 호환

### 수정/생성 파일
- `apps/server/src/routes/issues.ts` — export 엔드포인트 추가
- `apps/server/src/services/issue-import-service.ts` — 새로 생성
- `apps/web/src/components/issues/import-export/` — UI 컴포넌트

---

## 3. 이슈 템플릿

### 구현 범위
- [ ] 프로젝트별 이슈 템플릿 CRUD (이름, 설명, 기본 필드값)
- [ ] 이슈 생성 시 템플릿 선택 UI
- [ ] 기본 제공 템플릿: 버그 리포트, 기능 요청, 작업

### 수정/생성 파일
- `packages/db/src/schema/issue-templates.ts` — 새 테이블
- `packages/shared/src/schemas/issue-templates.ts` — Zod 스키마
- `apps/server/src/services/issue-template-service.ts` — CRUD 서비스
- `apps/server/src/routes/issue-templates.ts` — API 라우트
- `apps/web/src/components/issues/template-picker.tsx` — 선택 UI

---

## 4. 워크플로우 자동화

### 구현 범위
- [ ] 자동화 규칙 CRUD (트리거 → 조건 → 액션)
- [ ] 트리거: 상태 변경, 담당자 변경, 라벨 추가, 이슈 생성
- [ ] 액션: 상태 변경, 담당자 배정, 라벨 추가, 우선순위 설정
- [ ] 상태 전이 규칙 (허용되는 상태 변경 경로 정의)
- [ ] 프로젝트 설정 > 자동화 관리 UI

### 수정/생성 파일
- `packages/db/src/schema/automations.ts` — 자동화 규칙 테이블
- `packages/shared/src/schemas/automations.ts` — Zod 스키마
- `apps/server/src/services/automation-service.ts` — 규칙 평가 엔진
- `apps/server/src/routes/automations.ts` — API 라우트
- `apps/web/src/components/automations/` — 관리 UI

---

## 5. 시간 추정/추적

### 구현 범위
- [ ] 이슈에 추정 시간(estimate) 필드 추가
- [ ] 시간 기록(time entry) 시스템: 시작/정지 또는 수동 입력
- [ ] 이슈별 소요 시간 합산 표시
- [ ] 사이클 번다운 차트 (추정 vs 실제)

### 수정/생성 파일
- `packages/db/src/schema/issues.ts` — estimate 컬럼 추가
- `packages/db/src/schema/time-entries.ts` — 새 테이블
- `packages/shared/src/schemas/time-entries.ts` — Zod 스키마
- `apps/server/src/services/time-entry-service.ts` — CRUD + 집계
- `apps/web/src/components/issues/issue-detail/time-tracker.tsx` — UI

---

## 6. UX 개선사항

### 6-1. 간트 차트 드래그로 날짜 변경
- [ ] 바 좌우 드래그로 시작일/마감일 변경
- [ ] 바 전체 드래그로 기간 이동
- [ ] 수정 파일: `apps/web/src/components/issues/gantt-view/gantt-chart.tsx`

### 6-2. 보드 뷰 그룹 기준 변경
- [ ] 상태(현재) / 우선순위 / 담당자 / 라벨별 그룹 전환
- [ ] 수정 파일: `apps/web/src/components/issues/board-view/kanban-board.tsx`

### 6-3. 이슈 복제
- [ ] 이슈 상세에서 "복제" 버튼 → 모든 필드 복사하여 새 이슈 생성
- [ ] 수정 파일: `apps/server/src/services/issue-service.ts`, `issue-detail-panel.tsx`

### 6-4. 이슈 간 의존성
- [ ] 관계 유형: blocks / blocked by / relates to
- [ ] DB 테이블: `issue_relations`
- [ ] 이슈 상세 패널에 의존성 표시 + 추가/제거 UI
- [ ] 간트 차트에서 의존성 화살표 표시

---

## 7. 위키 기능 확장 (노션 수준)

### 현황
- 스페이스/페이지 계층, TipTap 에디터, 슬래시 커맨드, 이슈 링크, 이미지 업로드, 파일 첨부, 자동 저장, 페이지 트리 DnD 구현 완료
- Hocuspocus + Yjs 인프라는 이미 프로젝트에 포함 (v1.0 실시간 편집용)
- 페이지 `content_format` 컬럼으로 TipTap JSON ↔ Yjs binary lazy migration 경로 설계됨

### 목표
노션 수준의 "페이지 메타 + 블록 에디터 + 협업 + 고급 기능"을 4단계로 점진 구현.
Phase 1이 가장 가시적 효과가 크므로 먼저 진행.

---

### Phase 1 — 페이지 메타 & 탐색 ✅

#### 1-1. 페이지 아이콘(이모지) ✅ / 커버 ❌ 제거됨
- [x] `wiki_pages.icon`, `wiki_pages.cover_url` 컬럼 추가 (migration 0009)
- [x] 페이지 상단에 이모지 피커 (6카테고리 curated)
- [x] 페이지 트리에 아이콘 표시
- [x] **커버 이미지는 사용자 요청으로 UI 제거** (컬럼은 유지, 추후 재도입 가능)

#### 1-2. 페이지/스페이스 즐겨찾기 ✅
- [x] favorites 시스템의 pageId/spaceId 활용
- [x] 페이지 브레드크럼 + 스페이스 패널 헤더에 별 아이콘 토글

#### 1-3. 최근 편집 페이지 ✅
- [x] `/workspaces/:wsId/wiki-pages/recent` 엔드포인트 (드래프트는 본인 것만 노출)
- [x] 위키 인덱스 상단 "최근 편집" 섹션 (4열 카드)

#### 1-4. 인라인 서브페이지 생성 ✅ (트리에서)
- [x] 페이지 트리 hover 시 `+` 버튼으로 서브페이지 생성 (부모 자동 expand)
- [ ] 에디터 내부 슬래시 `/page`는 후속 (page-link 노드 필요)

#### 1-5. 전역 검색 (페이지 제목 + 본문) ✅
- [x] `wiki_pages.search_vector` FTS 활용 (제목 A, 본문 B weight) + ILIKE fallback
- [x] 검색 결과 `spaceId`/`icon`/드래프트 필터 포함 → command palette에서 실제 라우트 이동

---

### Phase 2 — 에디터 블록 확장 ✅ (대부분 완료, Embed만 deferred)

#### 2-1. 노션 필수 블록 ✅
- [x] Callout (이모지 + 배경 컬러 5종, ::before 의사요소 아이콘, 다중 문단 grid 레이아웃)
- [x] Toggle (`<details>` NodeView 기반 커스텀 chevron, 빈 줄 Enter 시 블록 탈출)
- [x] Code block (lowlight, ` ``` ` 마크다운 단축키)
- [x] To-do 체크박스 (TaskList/TaskItem)
- [x] Divider + `--- ` 마크다운 단축키
- [x] **마크다운 단축키 재배치**: `| ` → 인용, `> ` → 토글
- [x] 블록 타입별 placeholder (제목 N / 인용 / /로 블록 추가)
- [x] @tiptap/extension-typography (em-dash, ellipsis, smart quotes)

#### 2-2. @멘션 시스템 ✅
- [x] **통합 `@` 멘션** `createUniversalMentionExtension` — 멤버/위키/이슈 한 트리거에
      섹션별 표시, 종류별 색상 구분 (멤버 amber, 페이지 blue, 이슈 emerald),
      Tab 선택으로 IME 상황 회피
- [x] `#ISSUE-NN` 패턴 기반 `IssueLink` (기존)

#### 2-3. Table 블록 ✅
- [x] @tiptap/extension-table 기반 기본 표
- [ ] 행/열 추가/삭제, 병합 컨텍스트 메뉴는 후속

#### 2-4. 북마크 ✅ / Embed (auto-unfurl) — 후속
- [x] **노션 스타일 북마크 카드** — `Bookmark` atom 노드 + 전용 모달(제목 수기 입력
      + URL 검증) + 서버 `/api/v1/url-preview` (OG/Twitter 메타 + favicon, 6초/500KB 제한)
- [ ] URL 붙여넣기 자동 임베드 변환 (paste rule) — 후속

---

### Phase 2 외 추가 구현 (사용자 요청으로 중간 투입된 기능)

#### 드래그 앤 드롭 (블록 이동) ✅
- [x] `DragHandle` 익스텐션 — 포인터 이벤트 기반(HTML5 drag API 브라우저 차이 우회),
      `document.body`에 핸들/드롭 라인 마운트, 에디터 좌측 gutter에 고정 위치,
      컨테이너 블록(토글/콜아웃/인용) 내부도 드롭 타겟, 콜아웃 첫 줄은 "전체 이동"으로 승격

#### 페이지 초안(Draft) ✅
- [x] `wiki_pages.status` ('draft' | 'published') 컬럼 (migration 0010)
- [x] 작성자 본인에게만 노출 — list/getById/listRecent/search 전부 필터
- [x] 페이지 상단 토글 버튼 + 트리에 이탤릭/배지 표시

#### 프로젝트 ↔ 위키 연동 ✅
- [x] `wiki_spaces.project_id` 컬럼 (migration 0011) + project 당 unique 부분 인덱스
- [x] 프로젝트 생성 시 자동 위키 공간 + 에디터 멤버십 생성 (ProjectService.create 트랜잭션)
- [x] `GET /projects/:projectId/wiki-space` + `/projects/$projectId/wiki` 리다이렉트 라우트
- [x] 프로젝트 사이드바 "위키" 서브메뉴 + 위키 인덱스의 프로젝트 위키 아이콘/배지 구분

#### 삭제 UI ✅
- [x] 페이지 트리 hover 시 ⋯ 메뉴 → 페이지 soft-delete (하위 페이지는 한 단계 위로 이동)
- [x] 스페이스 드롭다운에 "스페이스 삭제" (확인 후 전체 페이지 포함 제거)

#### 그 외 세부 개선
- [x] TipTap 버전 정렬 — `@tiptap/pm` / `@tiptap/suggestion` v3 → v2, pnpm overrides로 강제
- [x] 슬래시 커맨드 IME 조합 Enter 무시, selectedIndex 리셋 버그 수정, 키보드 하이라이트 가시화
- [x] 에디터/제목 `[contenteditable]` focus-visible 글로우 제거
- [x] 빈 제목 저장 허용 + 항상 "제목 없음" placeholder 노출 (`<br>` 정리)
- [x] 저장 상태 인디케이터를 에디터 내부 → 브레드크럼 우측으로 이동

---

### Phase 3 — 협업/공유

#### 3-1. 실시간 공동 편집 (Yjs + Hocuspocus)
- [ ] `content_format = 'yjs'` lazy migration (첫 편집 시 TipTap JSON → Yjs binary 변환)
- [ ] EditorWithAutosave → EditorWithCollab 모드 분기
- [ ] 현재 편집자 커서/아바타 표시 (awareness)
- [ ] 수정 파일
  - `apps/hocuspocus/src/` — 기존 서버 설정 연결 확인
  - `packages/editor/src/collab-editor.tsx` — 새로 생성
  - `packages/db/src/schema/wiki.ts` — content_format 활용 점검

#### 3-2. 블록 단위 코멘트
- [ ] 블록 ID (ProseMirror `data-block-id`) 기반 코멘트 앵커
- [ ] 우측 사이드바에 코멘트 스레드 / 인라인 인디케이터
- [ ] 수정 파일
  - `packages/db/src/schema/comments.ts` — wiki_page + block_id 지원
  - `apps/server/src/services/comment-service.ts` — 위키 코멘트 API
  - `apps/web/src/components/wiki/page-comments.tsx` — 새로 생성

#### 3-3. 페이지 공유 링크 / 퍼블리시
- [ ] 스페이스 멤버 외 공개 읽기 전용 링크 (토큰 기반)
- [ ] `wiki_page_shares` 테이블 (id, page_id, token, expires_at, created_by)
- [ ] `/wiki-share/:token` 공개 라우트 (auth bypass)

#### 3-4. 페이지 히스토리/버전
- [ ] 자동 저장마다 snapshot 저장 (혹은 diff)
- [ ] "히스토리 보기" 패널에서 버전 비교/복원
- [ ] 수정 파일
  - `packages/db/src/schema/wiki.ts` — `wiki_page_revisions` 테이블
  - `apps/server/src/services/wiki-service.ts` — snapshot 기록

---

### Phase 4 — 고급

#### 4-1. 페이지 템플릿
- [ ] 워크스페이스/스페이스별 템플릿 CRUD
- [ ] 새 페이지 생성 시 템플릿 선택 모달
- [ ] 기본 제공: 회의록, 주간 리포트, 프로젝트 킥오프, 1-on-1
- [ ] 수정 파일
  - `packages/db/src/schema/wiki.ts` — `wiki_page_templates` 테이블
  - `apps/server/src/routes/wiki.ts` — 템플릿 API
  - `apps/web/src/components/wiki/template-picker.tsx` — 새로 생성

#### 4-2. 인라인 이슈 DB (이슈 뷰 임베드)
- [ ] 페이지 안에 저장된 이슈 뷰를 블록으로 임베드 (list/board 미니 뷰)
- [ ] 수정 파일
  - `packages/editor/src/extensions/issue-view-embed.ts` — 새로 생성
  - `apps/web/src/components/issues/embedded-view.tsx` — 재사용 가능한 뷰

#### 4-3. AI 보조 (요약/작성/번역)
- [ ] 블록 선택 → "요약/이어쓰기/번역/맞춤법" 커맨드
- [ ] OpenAI/Anthropic API 연동 (기존 AI 설정 활용)
- [ ] 수정 파일
  - `packages/editor/src/ai/` — 새로 생성
  - `apps/server/src/routes/ai.ts` — 프록시 엔드포인트 (기존 있다면 활용)

---

## 기술 부채 (별도 정리 필요)

### 테스트 스위트 정비 (우선순위: 중)
현재 `apps/server` vitest에서 62개 테스트가 실패 중. CI에서 non-blocking으로 처리.

**실패 원인 카테고리:**
- **Mock DB 격리 부족** (대부분): 이슈 필터/정렬/페이지네이션 테스트들이 전체 데이터(20/40/50개)를 반환하여 expected 1/2/3/5와 불일치
- **Rate limiting 상태 유지**: auth 테스트가 429를 반환 (테스트 간 리셋 안 됨)
- **Better Auth 모킹**: register/login 400·401 반환
- **Error 코드 불일치**: 위키 순환 참조가 400 대신 403 반환

### 타입 오류 정리 (우선순위: 낮)
- `apps/server`: Drizzle ORM `strict` 타입과 `request.user!.id` 패턴 충돌 → 수십 개 에러
- `apps/web`: 라우트 타입(`Link to="..."`), 배열 인덱스 undefined 체크 → ~30개
- `packages/editor`: TipTap `@tiptap/pm` v2/v3 버전 충돌 → ✅ **해결됨** (2026-04-21, pnpm overrides로 v2 고정)

현재 CI에서 typecheck 제외하고 build(tsup + Vite)로 대체 검증.

## 구현 순서

### 이슈 트랙
```
Phase 1: 알림 시스템 연동 (기존 인프라 활용, 빠른 완성) — 진행 중
Phase 2: UX 개선 (6-1 ~ 6-4, 기존 코드 보강)
Phase 3: CSV 가져오기/내보내기
Phase 4: 이슈 템플릿
Phase 5: 워크플로우 자동화
Phase 6: 시간 추정/추적
```

### 위키 트랙 (섹션 7)
```
Wiki Phase 1 ✅: 페이지 메타 & 탐색 (아이콘/즐겨찾기/최근/서브페이지/검색, 커버는 제거)
Wiki Phase 2 ✅: 에디터 블록 확장 (callout, toggle, code, @mention, table, 북마크)
Wiki Phase 2+ ✅: 드래그앤드롭, Draft, 프로젝트-위키, 삭제 UI (사용자 요청으로 추가)
Wiki Phase 3  : 협업/공유 (Yjs 실시간, 블록 코멘트, 공유 링크, 히스토리)
Wiki Phase 4  : 고급 (템플릿, 이슈 DB 임베드, AI)
```

**남은 Phase 2 후속 개선** (선택)
- Embed auto-unfurl (URL 붙여넣기 → 북마크 카드 자동 변환)
- 테이블 컨텍스트 메뉴 (행/열 추가·삭제·병합)
- 에디터 내부 `/page` 슬래시 (page-link 노드)
- `window.confirm` → 전용 삭제 확인 모달
- 기존 프로젝트용 위키 백필 스크립트

두 트랙은 DB/에디터 공유 지점(페이지 메타 ↔ 에디터 확장 ↔ 멘션 ↔ 이슈 임베드)이 있어
이슈 트랙 진행과 병행 가능. 각 Wiki Phase 내 세부 항목은 독립적으로 배치해도 무방.
