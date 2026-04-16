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
- `packages/editor`: TipTap `@tiptap/pm` v2/v3 버전 충돌 → 버전 통일 필요

현재 CI에서 typecheck 제외하고 build(tsup + Vite)로 대체 검증.

## 구현 순서

```
Phase 1: 알림 시스템 연동 (기존 인프라 활용, 빠른 완성)
Phase 2: UX 개선 (6-1 ~ 6-4, 기존 코드 보강)
Phase 3: CSV 가져오기/내보내기
Phase 4: 이슈 템플릿
Phase 5: 워크플로우 자동화
Phase 6: 시간 추정/추적
```
