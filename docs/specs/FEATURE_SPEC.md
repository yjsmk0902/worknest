# Worknest 기능정의서

**목표**: Atlassian Jira + Confluence를 대체하는 셀프호스팅 가능한 올인원 프로젝트 관리 & 지식 관리 플랫폼

**버전**: v0.5 (7개 에이전트 최종 리뷰 반영)

---

## 목차

1. [제품 개요](#1-제품-개요)
2. [사용자 및 권한](#2-사용자-및-권한)
3. [Projects — 프로젝트 관리](#3-projects--프로젝트-관리)
4. [Wiki — 지식 관리](#4-wiki--지식-관리)
5. [공통 기능](#5-공통-기능)
6. [개발 체크포인트](#6-개발-체크포인트)
7. [부록: 데이터 모델](#7-부록-데이터-모델)
8. [부록: API 엔드포인트](#8-부록-api-엔드포인트)
9. [부록: 프론트엔드 URL 라우팅](#9-부록-프론트엔드-url-라우팅)
10. [부록: WebSocket 이벤트](#10-부록-websocket-이벤트)
11. [부록: 에러 코드 체계](#11-부록-에러-코드-체계)
12. [부록: 엣지 케이스 및 정책](#12-부록-엣지-케이스-및-정책)

---

## 1. 제품 개요

### 1.1 핵심 가치

| 항목 | 설명 |
|------|------|
| **빠른 속도** | 낙관적 업데이트 + 캐싱으로 클릭 즉시 반응 |
| **키보드 중심 UX** | Cmd+K 검색, 단축키로 마우스 없이 전체 조작 |
| **실시간 동기화** | 이슈 변경 WebSocket 실시간 반영, Wiki 동시 편집 (v1.0) |
| **통합 경험** | 이슈 ↔ Wiki 양방향 링크, 하나의 앱에서 모든 작업 |
| **셀프호스팅** | Docker Compose 한 줄로 배포, 데이터 소유권 |

### 1.2 제품 구조

```
Worknest
├── Organization (조직)
│   └── Workspace (팀/프로젝트 단위, 복수 가능)
│       ├── My Work (개인 대시보드)
│       │   ├── Inbox (알림/멘션)
│       │   ├── My Issues (할당된 이슈)
│       │   └── Favorites (즐겨찾기)
│       │
│       ├── Projects (프로젝트 관리 = Jira)
│       │   ├── Issues (이슈/태스크)
│       │   ├── Cycles (스프린트)
│       │   ├── Views (저장된 뷰)
│       │   └── Settings
│       │
│       ├── Wiki (지식 관리 = Confluence)
│       │   ├── Spaces (공간)
│       │   └── Pages (문서)
│       │
│       └── Settings
│           ├── Members & Roles
│           └── Integrations
```

### 1.3 기술 결정 사항

| 항목 | 결정 | 근거 |
|------|------|------|
| 인증 | Better Auth | 보안 취약점 위험 감소, OAuth 확장 용이 |
| 세션 | Better Auth 기본 (DB 세션 + cookie caching) | 토큰 즉시 무효화, 성능은 캐시로 해결 |
| 담당자/라벨 | 정규화 join 테이블 (IssueAssignee, IssueLabel) | FK 무결성, My Issues 쿼리 최적화 |
| 이슈 상태 | DB 테이블 (IssueStatus) — 하드코딩 아님 | v1.0 커스텀 상태 전환 비용 최소화 |
| 정렬 순서 | text 기반 fractional indexing | 무한 삽입, 리밸런싱 불필요 |
| Wiki 저장 | MVP: TipTap JSON, v1.0: Yjs binary | `content_format` 컬럼으로 lazy migration |
| 이슈 링크 | MVP: 클릭 가능한 링크만 (InputRule + PasteRule), v1.0: 상태 뱃지 | MVP 구현 복잡도 감소 |
| 상태 관리 | 서버 데이터: TanStack Query / UI 상태: Zustand / 필터: URL searchParams / 인증: Better Auth hooks | 관심사 분리 |
| 자동 저장 | Wiki/이슈 설명: 타이핑 중지 후 2초 디바운스 자동 저장 | 사용자 데이터 손실 방지 |
| DB 마이그레이션 | 서버 시작 시 Drizzle migrator 자동 실행, 실패 시 서버 미기동 | 배포 안전성 |
| 로깅 | Pino JSON 구조화 로그, `LOG_LEVEL` 환경변수 (기본: info) | 운영 관찰성 |

---

## 2. 사용자 및 권한

### 2.1 인증 (Better Auth)

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 이메일 + 비밀번호 | O | O | Better Auth 기본 제공 |
| 세션 관리 | O | O | DB 세션 + httpOnly cookie caching |
| Google OAuth | - | O | Better Auth 소셜 프로바이더 |
| SAML SSO | - | - | v1.5 |
| 초대 링크 | O | O | 이메일 초대 + 토큰 (7일 만료, 설정 가능) |
| 로그인 시도 제한 | O | O | 5회 실패 시 5분 잠금 |

### 2.2 조직 구조

```
Organization (최상위 — 회사/조직)
├── OrgMember (조직 소속 사용자, role: owner/admin/member)
└── Workspace (팀 단위, 복수 가능)
    ├── WorkspaceMember (role: admin/member/guest)
    └── Project
        └── ProjectMember (role: admin/member/viewer)
```

- 한 사용자가 여러 Organization에 소속 가능
- Organization 내에서 여러 Workspace 참여 가능
- Workspace 내에서 여러 Project에 투입 가능

### 2.3 권한 매트릭스

**Organization:**

| 역할 | WS 생성 | 멤버 초대 | 조직 설정 | 조직 삭제 |
|------|--------|----------|----------|----------|
| Owner | O | O | O | O |
| Admin | O | O | O | - |
| Member | - | - | - | - |

**Workspace:**

| 역할 | 프로젝트 생성 | 멤버 초대 | 설정 변경 | Wiki 편집 | Wiki 읽기 |
|------|-------------|----------|----------|----------|----------|
| Admin | O | O | O | O | O |
| Member | O | - | - | O | O |
| Guest | - | - | - | 허용된 Space만 | 허용된 Space만 |

**Project:**

| 역할 | 이슈 생성 | 이슈 수정 | 이슈 삭제 | 댓글 작성 | 설정 변경 |
|------|----------|----------|----------|----------|----------|
| Admin | O | O | O | O | O |
| Member | O | O (자기 것+할당) | - | O | - |
| Viewer | - | - | - | O | - |

**Guest 접근 범위:**
- 할당된 이슈 + 해당 이슈의 서브이슈만 접근
- 링크된 이슈는 제목과 상태만 읽기 전용 표시
- Wiki: 허용된 Space만 접근 가능

### 2.4 온보딩 플로우

**신규 가입:**
```
회원가입 → Organization 생성 → Workspace 생성 가이드 → Project 생성 가이드
```

**초대받은 사용자:**
```
초대 이메일 → 링크 클릭 →
  ├── 계정 있음: 로그인 → 자동 워크스페이스 추가
  └── 계정 없음: 회원가입 → 자동 워크스페이스 추가
```

**초대 관리:**
- 초대 목록 조회, 취소, 재발송 가능
- 초대 링크 만료: 7일 (설정 가능)
- 초대 토큰: `crypto.randomBytes(32)` + URL-safe encoding, 사용 후 무효화

---

## 3. Projects — 프로젝트 관리

### 3.1 프로젝트

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 프로젝트 CRUD | O | O | |
| 아이콘 & 커버 | O | O | |
| 설명 (리치 텍스트) | O | O | |
| 멤버 관리 (Admin/Member/Viewer) | O | O | |
| 즐겨찾기 | O | O | 사이드바 상단 고정 |
| 접두사 (prefix) | O | O | 영문 대문자 2~5자, 생성 후 변경 불가, WS 내 유니크 |
| 아카이브 | - | O | Soft delete (30일 복구) |

### 3.2 이슈 (Issue)

#### 3.2.1 이슈 타입 (DB 테이블, 프로젝트별)

| 기본 타입 | 아이콘 | MVP | 설명 |
|----------|--------|-----|------|
| Task | 체크 | O | 일반 작업 |
| Bug | 벌레 | O | 버그/결함 |
| Story | 책 | O | 유저 스토리 |
| Sub-task | 하위 체크 | O | 서브 이슈 (부모 필수) |
| 커스텀 타입 | 사용자 지정 | - | v1.0 |

프로젝트 생성 시 기본 4개 타입이 자동 시드됩니다.

#### 3.2.2 이슈 상태 (DB 테이블, 프로젝트별)

| 기본 상태 | 카테고리 | MVP |
|----------|---------|-----|
| Backlog | backlog | O |
| Todo | unstarted | O |
| In Progress | started | O |
| Done | completed | O |
| Cancelled | cancelled | O |

프로젝트 생성 시 기본 5개 상태가 자동 시드. v1.0에서 커스텀 상태 추가 가능.

#### 3.2.3 기본 속성

| 속성 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 제목 | O | O | 필수 |
| 설명 | O | O | TipTap JSON (`description_text`로 plaintext 추출, 검색용) |
| 타입 | O | O | FK → IssueType |
| 상태 | O | O | FK → IssueStatus |
| 우선순위 | O | O | Urgent, High, Medium, Low, None |
| 담당자 | O | O | IssueAssignee join 테이블 (멀티) |
| 라벨 | O | O | IssueLabel join 테이블 (멀티) |
| 마감일 | O | O | |
| Story Points | - | O | 피보나치 (1, 2, 3, 5, 8, 13) |

#### 3.2.4 이슈 생성 방식

| 기능 | MVP | 설명 |
|------|-----|------|
| 일반 생성 (폼) | O | 전체 속성 입력 |
| **Quick Add (C 키)** | O | 인라인 제목 입력 → Enter로 즉시 생성 |
| 이슈 템플릿 | - | v1.0 |

**Quick Add 상세:**
- 트리거: 모든 뷰에서 `C` 키 (포커스가 input/textarea/contenteditable 밖일 때)
- 기본값: type=Task, status=Backlog, priority=None, assignee=없음
- 보드 뷰: 해당 컬럼의 상태가 기본 status
- 생성 후: 다음 Quick Add 입력으로 포커스 (연속 생성)

#### 3.2.5 이슈 계층 & 관계

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 서브 이슈 | O | O | parent_id, 삭제 시 부모 없는 이슈로 승격 |
| **벌크 작업** | O | O | 다중 선택 → 일괄 상태/담당자/라벨 변경 (최대 50건/요청) |
| 이슈 링크 | - | O | blocks, is blocked by, relates to, duplicates |
| 이슈 이동 (프로젝트 간) | - | O | |

**벌크 작업 정책:**
- All-or-Nothing 트랜잭션 (부분 실패 없음)
- Activity/Notification 생성은 BullMQ 비동기 처리
- 최대 50건/요청, 초과 시 `BATCH_SIZE_EXCEEDED`

#### 3.2.6 이슈 ID 체계

프로젝트 접두사 + 순번: `WORK-142`, `API-53`

- 접두사: 영문 대문자 2~5자, WS 내 유니크, 생성 후 변경 불가, 삭제 후 재사용 불가
- 순번: `Project.issue_counter` atomic increment (`UPDATE ... SET issue_counter = issue_counter + 1 RETURNING`)
- `Issue.sequence_id`는 `issue_counter`의 결과값
- `(project_id, sequence_id) UNIQUE` 제약 필수
- 간극(gap) 허용 (트랜잭션 롤백 시 발생 가능, Jira도 동일)

### 3.3 이슈 뷰 (Views)

| 뷰 | MVP | v1.0 | 설명 |
|----|-----|------|------|
| **리스트** | O | O | 테이블, 정렬/필터 |
| **보드 (칸반)** | O | O | 상태별 DnD (단일 카드만, 벌크 드래그는 v1.0) |
| **캘린더** | - | O | 마감일 기준 |
| **타임라인 (간트)** | - | O | 기간별 |

#### 3.3.1 필터 & 정렬

**MVP 비주얼 필터 빌더 (AND-only):**

| 필터 속성 | 연산자 |
|----------|--------|
| 상태 | is, is not |
| 타입 | is, is not |
| 우선순위 | is, is not |
| 담당자 | is, is not, is empty |
| 라벨 | includes, excludes |
| 마감일 | before, after, between, is empty |
| 제목 | contains |
| 사이클 | is, is not, is empty |

| 기능 | MVP | v1.0 |
|------|-----|------|
| 비주얼 필터 빌더 (AND-only) | O | O |
| 복합 필터 (AND/OR) | - | O |
| 정렬: 생성일, 수정일, 우선순위, 마감일, 수동(Manual) | O | O |
| 저장된 뷰 (Saved View) | O | O |
| 그룹핑 | - | O |

**필터 상태는 URL searchParams와 동기화** (링크 공유 가능).

#### 3.3.2 이슈 리스트 뷰 레이아웃

```
[☐] [우선순위●] [이슈키] [제목.................] [상태 뱃지] [담당자 아바타] [마감일]
```
- 체크박스: 벌크 작업용 (X 키)
- 행 높이: 40px, hover 시 배경색 변경
- 행 클릭: 이슈 상세 Side Panel 열기
- Enter 또는 더블클릭: Full Page로 열기
- 인라인 속성 변경: 행에서 바로 상태/담당자 클릭하여 변경 가능

#### 3.3.3 칸반 보드 레이아웃

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│● Backlog │● Todo    │● In Prog │● Done    │● Cancel  │
│  (12)    │  (5)     │  (3)     │  (8)     │  (1)     │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│┌────────┐│┌────────┐│┌────────┐│          │          │
││WORK-12 │││WORK-5  │││WORK-8  ││          │          │
││로그인   │││API설계  │││결제연동 ││          │          │
││🔴 High │││🟡 Med  │││🔴 Urg  ││          │          │
││👤 Luke │││👤 Kim  │││👤 Park ││          │          │
│└────────┘│└────────┘│└────────┘│          │          │
│ + 이슈   │ + 이슈   │ + 이슈   │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```
- 컬럼 헤더: 상태 카테고리 색상 dot + 상태명 + 카운트
- 카드: 이슈키, 제목(최대 2줄), 우선순위 아이콘, 담당자 아바타(최대 2명), 라벨 색상 dot
- 마감일: 임박(3일 이내)일 때만 카드에 표시
- 컬럼 최소 너비: 280px, 수평 스크롤 허용
- 각 컬럼 하단: `+ 이슈` Quick Add 버튼

#### 3.3.4 이슈 상세 화면

**Side Panel (기본, 640px):** Esc로 닫기. 리스트/보드에서 이슈 클릭 시 열림.

**Full Page (Enter/더블클릭):** 전체 화면. 뒤로가기로 리스트 복귀.

```
┌─ Full Page Layout ──────────────────────────────────────┐
│ ← 뒤로   WORK-142   [상태 드롭다운]                      │
├─────────────────────────────────┬────────────────────────┤
│ 본문 (왼쪽)                      │ 속성 (오른쪽, 280px)    │
│                                 │                        │
│ [제목 — 클릭 편집]                │ 상태: In Progress      │
│                                 │ 우선순위: High          │
│ [TipTap 설명 에디터]             │ 타입: Bug              │
│                                 │ 담당자: Luke, Kim       │
│                                 │ 라벨: frontend, urgent  │
│                                 │ 마감일: 2026-04-15      │
│                                 │ 사이클: Sprint 3        │
│ ─── 서브이슈 ──────              │                        │
│ ☐ WORK-143 하위 작업            │                        │
│ + 서브이슈 추가                  │                        │
│                                 │                        │
│ ─── 활동 + 댓글 (통합 타임라인) ─│                        │
│ [활동/댓글 혼합 시간순 표시]      │                        │
│ [댓글 입력 필드]                 │                        │
└─────────────────────────────────┴────────────────────────┘
```
- 활동 + 댓글: 통합 타임라인 (시간순 혼합, 필터로 분리 가능)
- Side Panel에서는 속성을 상단 컴팩트로, 본문은 아래로 표시
- 1024px 미만: Side Panel 대신 Full Page로 열기

### 3.4 사이클 (Cycles = 스프린트)

**이슈-사이클 관계: 다대다** (CycleIssue 중간 테이블, 이월 히스토리 추적)

| 기능 | MVP | v1.0 |
|------|-----|------|
| 사이클 CRUD | O | O |
| 이슈 추가/제거 | O | O |
| 활성 사이클 (프로젝트당 최대 1개) | O | O |
| 사이클 진행률 | O | O |
| 미완료 이슈 이월 | O | O |
| 번다운 차트 | - | O |

**사이클 규칙:**
- 활성 사이클: 프로젝트당 최대 1개 (partial unique index)
- 날짜 겹침: 허용하되 경고 표시
- 이월: 사용자가 "사이클 완료" 시 미완료 이슈를 다음 사이클로 이동. 다음 사이클 없으면 이슈의 cycle 소속 해제 (백로그로)
- `CycleIssue.carried_from_id`로 이월 체인 추적

### 3.5 모듈 (Modules = 에픽) — v1.0

> MVP에서 제외. v1.0에서 추가.

### 3.6 댓글 & 활동

| 기능 | MVP | v1.0 |
|------|-----|------|
| 이슈 댓글 (리치 텍스트, @멘션) | O | O |
| 댓글 수정/삭제 | O | O |
| 댓글 리액션 (이모지) | O | O |
| 활동 로그 (자동 기록) | O | O |
| 이슈 구독 (Watch/Unwatch) | - | O |

**댓글 API:** `PATCH /comments/:id`, `DELETE /comments/:id`는 `entity_type` 검증 포함 (이슈 댓글을 Wiki API로 수정 방지).

### 3.7 키보드 단축키

**활성화 조건:** 포커스가 input/textarea/contenteditable 밖일 때만 단일 키 활성화. 모달 열림 시 Esc 외 비활성화.

| 단축키 | 동작 |
|--------|------|
| `C` | Quick Add |
| `S` | 상태 변경 |
| `A` | 담당자 변경 |
| `L` | 라벨 변경 |
| `P` | 우선순위 변경 |
| `T` | 타입 변경 |
| `X` | 이슈 선택 (벌크) |
| `D` | 마감일 설정 |
| `Cmd+K` | 글로벌 검색 (항상 활성) |
| `Cmd+/` | 단축키 도움말 시트 |
| `↑ ↓` 또는 `J K` | 이슈 목록 이동 |
| `Enter` | 이슈 열기 |
| `Space` | 이슈 Side Panel 프리뷰 |
| `Esc` | 닫기/취소 |

구현: `useHotkey(key, handler, { context })` 커스텀 훅. Zustand `activeContext` 상태로 컨텍스트 관리.

**단축키 학습 지원:**
- 툴팁에 단축키 표시 (예: "상태 변경 (S)")
- `Cmd+/`로 단축키 시트 오버레이
- 제목 편집: 제목 영역 클릭 또는 `F2` (T와 충돌 방지)

---

## 4. Wiki — 지식 관리

### 4.1 Wiki Space

| 기능 | MVP | v1.0 |
|------|-----|------|
| Space CRUD | O | O |
| 아이콘 & 설명 | O | O |
| Space 멤버 권한 (Editor/Viewer) | O | O |
| 즐겨찾기 | O | O |
| 페이지 레벨 접근 제한 | - | O |

### 4.2 페이지 (Pages)

| 기능 | MVP | v1.0 |
|------|-----|------|
| 페이지 CRUD | O | O |
| 페이지 트리 (계층, 최대 6단계) | O | O |
| 드래그앤드롭 이동 (순환 참조 방지) | O | O |
| 즐겨찾기 | O | O |
| 히스토리 (버전 관리 + 복원) | - | O |
| 템플릿 | - | O |
| 조회 통계 (조회수, 방문자, 오래된 문서 알림) | - | O |
| 내보내기 (Markdown, PDF) | - | O |

**저장 포맷:**
- MVP: TipTap JSON (`content_format = 'json'`), 별도 `content_binary (bytea)` 컬럼은 v1.0에서 추가
- v1.0: Yjs binary (`content_format = 'yjs'`, `content_binary` 컬럼 사용)
- Lazy migration: 문서 접근 시 `json`이면 변환 후 `yjs`로 업데이트

**자동 저장 정책:**
- 타이핑 중지 후 2초 디바운스로 자동 저장
- 저장 상태 UI: "저장됨" / "저장 중..." / "저장 실패" 표시
- 이슈 설명도 동일 정책 적용

**Breadcrumb 네비게이션:**
- 페이지 상단에 `스페이스 > 상위 페이지 > 현재 페이지` 경로 표시
- 각 항목 클릭 시 해당 위치로 이동

### 4.3 에디터 (TipTap)

**MVP: 단일 사용자 편집 + 자동 저장. v1.0에서 CRDT 동시 편집 (Hocuspocus).**

에디터는 `packages/editor`에서 단일 에디터 + feature flag 패턴. 사용처(이슈 설명, Wiki, 댓글)별로 TipTap extension 조합을 달리 전달.

#### 슬래시 명령어 (/)

에디터에서 `/` 입력 시 블록 삽입 메뉴 표시:
- `/heading` → H1~H3
- `/list` → 순서 있는/없는 리스트
- `/todo` → 체크리스트
- `/code` → 코드 블록
- `/table` → 테이블
- `/image` → 이미지 업로드
- `/file` → 파일 첨부
- `/quote` → 인용구
- `/divider` → 구분선

#### 블록 타입

| 블록 | MVP | v1.0 |
|------|-----|------|
| Paragraph, Heading (H1~H3) | O | O |
| 순서 있는/없는 리스트, 체크리스트 | O | O |
| 인용구, 구분선 | O | O |
| 코드 블록 (구문 강조) | O | O |
| 테이블 | O | O |
| 이미지, 파일 첨부 | O | O |
| 콜아웃, 토글, 임베드 | - | O |

#### 인라인 서식

| 서식 | MVP |
|------|-----|
| Bold / Italic / Underline / Strikethrough | O |
| 인라인 코드, 링크, 하이라이트 | O |
| @멘션 (사용자) | O |
| **이슈 링크** (`WORK-142` → 클릭 가능한 링크, InputRule + PasteRule) | O |
| 이슈 링크 상태 뱃지 + 호버 팝오버 | v1.0 |

**이슈 링크 구현 (MVP):**
- TipTap InputRule: `/([A-Z]{2,5}-\d+)/` 패턴 감지 → 클릭 가능한 링크 노드로 변환
- 클릭 시 해당 이슈로 네비게이션
- 상태 뱃지, 호버 팝오버는 v1.0

#### 실시간 협업 — v1.0

| 기능 | v1.0 |
|------|------|
| 동시 편집 (Yjs + Hocuspocus) | O |
| 커서 위치 + 아바타 표시 | O |

### 4.4 댓글

| 기능 | MVP | v1.0 |
|------|-----|------|
| 페이지 댓글 | O | O |
| 인라인 댓글 | - | O |
| 댓글 해결 (Resolve) | - | O |

---

## 5. 공통 기능

### 5.1 글로벌 검색 (Cmd+K)

| 기능 | MVP | v1.0 |
|------|-----|------|
| 통합 검색 (이슈, 페이지, 프로젝트) | O | O |
| 이슈 ID 즉시 이동 (`WORK-142`) | O | O |
| 명령어 실행 | O | O |
| Wiki 전문 검색 | O | O |
| 최근 방문 항목 (localStorage) | O | O |

**검색 기술:** PostgreSQL `ILIKE` + `pg_trgm` GIN 인덱스 (MVP). v1.5에서 Meilisearch 검토.

**이슈 ID 검색:** 클라이언트 패턴 매칭 → 서버 호출 없이 직접 라우팅.

**MVP 명령어:** `>` prefix로 명령어 모드 진입. 예: `>이슈 생성`

| 명령어 | 동작 |
|--------|------|
| 이슈 생성 | 이슈 생성 모달 |
| 프로젝트로 이동 | 프로젝트 선택 → 이동 |
| Wiki 페이지 생성 | 페이지 생성 |
| 내 이슈 | My Issues 이동 |
| 설정 | 워크스페이스 설정 |
| 로그아웃 | 로그아웃 |

**시각적 구조:**
```
┌─────────────────────────────────────────────┐
│ 🔍 이슈, 페이지, 명령어 검색...              │ ← auto-focus
├─────────────────────────────────────────────┤
│ 최근 항목                                    │ ← 입력 전 기본 표시 (최대 5개)
│   📄 API 설계 가이드         Wiki   2시간 전  │
│   🔵 WORK-142 로그인 버그    Issue  어제      │
├─────────────────────────────────────────────┤
│ 이슈                                        │ ← 검색 결과 카테고리
│   [상태●] WORK-142 로그인 버그  🔴 High 👤   │
├─────────────────────────────────────────────┤
│ Wiki 페이지                                  │
│   📄 배포 절차 가이드       DevOps Space      │
├─────────────────────────────────────────────┤
│ 프로젝트                                     │
│   📁 Worknest Backend      WORK              │
├─────────────────────────────────────────────┤
│ 명령어                                       │ ← ">" 입력 시 명령어만 표시
│   ➕ 이슈 생성                               │
└─────────────────────────────────────────────┘
```
- 너비: 640px (max), 중앙 상단 배치
- 최대 높이: 400px (스크롤)
- 백드롭: 반투명 오버레이
- 키보드: ↑↓ 이동, Enter 선택, Esc 닫기
- 입력 디바운스 300ms
- 최근 항목: localStorage에 최대 20개 저장, 표시 최대 5개

### 5.2 이슈 ↔ Wiki 양방향 연결

| 기능 | MVP | v1.0 |
|------|-----|------|
| Wiki에서 이슈 링크 (클릭 가능) | O | O |
| 이슈에서 Wiki 링크 (미리보기 팝업) | O | O |
| 이슈에서 관련 Wiki 목록 자동 표시 | - | O |
| Wiki에서 관련 이슈 사이드바 | - | O |

### 5.3 My Work (개인 대시보드)

| 기능 | MVP | v1.0 |
|------|-----|------|
| Inbox (알림 통합) | O | O |
| My Issues (할당된 이슈, 상태별 그룹) | O | O |
| Favorites (즐겨찾기) | O | O |
| My Activity (최근 활동 타임라인) | - | O |

### 5.4 알림

| 기능 | MVP | v1.0 |
|------|-----|------|
| 인앱 알림 (Inbox + 벨 아이콘) | O | O |
| 이메일 알림 | - | O |
| 알림 설정 (구독/해제) | - | O |

**MVP 알림 트리거:**

| 이벤트 | 대상 | 비고 |
|--------|------|------|
| 이슈 할당 | 할당된 사용자 | 자기 할당 시 제외 |
| @멘션 | 멘션된 사용자 | 중복 방지 |
| 이슈 댓글 | 이슈 생성자 + 담당자 | 댓글 작성자 제외 |
| 이슈 상태 변경 | 이슈 생성자 + 담당자 | |
| 워크스페이스 초대 | 초대받은 사용자 | |

**구현:** 이벤트 → NotificationService → DB INSERT + Redis Pub/Sub → WebSocket `user:{id}` 채널 실시간 전달.

### 5.5 파일 관리

| 기능 | MVP | v1.0 |
|------|-----|------|
| 파일 업로드 (multipart, 이슈/페이지) | O | O |
| 이미지 미리보기 + 썸네일 자동 생성 (400px, 비동기) | O | O |
| 파일 다운로드 | O | O |

**정책:**
- 단일 파일: 25MB (설정 가능), 단건 업로드 (프론트에서 병렬 호출)
- 워크스페이스 총 용량: 10GB (설정 가능, 업로드 전 확인)
- 차단 파일: .exe, .sh, .bat, .cmd, .ps1
- 파일명: 원본명은 DB, 스토리지는 UUID 기반 경로
- 이미지 최적화: 업로드 후 BullMQ Job으로 WebP 변환 + 리사이즈

**임시 업로드 흐름 (이슈/페이지 생성 중 첨부):**
- `entity_id`는 optional. 생성 폼에서 이미지 첨부 시 entity 미확정
- 24시간 내 엔티티에 연결되지 않은 파일은 BullMQ 크론으로 삭제 (고아 파일 정리)
- 에디터 이미지 흐름: 붙여넣기/드래그 → `POST /files/upload` → File ID + URL 반환 → 에디터 문서에 URL 삽입

### 5.6 연동 (Integrations)

| 기능 | MVP | v1.0 | v1.5 |
|------|-----|------|------|
| REST API (공개) | O | O | O |
| GitHub PR ↔ 이슈 | - | O | O |
| GitHub 브랜치 자동 생성 | - | O | O |
| Webhook | - | O | O |
| Jira CSV 임포트 | - | O | O |
| Slack / GitLab / Jira API 임포트 | - | - | O |

### 5.7 관리자 & 운영

| 기능 | MVP | v1.0 |
|------|-----|------|
| Organization/Workspace 설정 | O | O |
| 멤버 초대/제거/역할 변경 | O | O |
| 헬스체크 (`GET /healthz`, `GET /readyz`) | O | O |
| Docker Compose 배포 | O | O |
| Swagger API 문서 (`/api/v1/docs`) | O | O |
| 구조화 로깅 (Pino JSON, `LOG_LEVEL` 환경변수) | O | O |
| `.env.example` + 셀프호스팅 배포 문서 | O | O |
| 데이터 내보내기 (JSON/CSV) | - | O |
| 감사 로그 | - | v1.5 |

---

## 6. 개발 체크포인트

Agent 팀 병렬 개발 기반. 각 체크포인트마다 브라우저 확인 → 피드백 → 수정 사이클.

### MVP 체크포인트

| # | 체크포인트 | 산출물 |
|---|----------|--------|
| **CP-1** | 프로젝트 셋업 | 모노레포(pnpm+Turbo), Biome, CI, Docker Compose, DB 스키마, Better Auth 인증, Org/WS/User CRUD |
| **CP-2** | 이슈 핵심 | 프로젝트 CRUD, 이슈 CRUD, 타입/상태(DB 테이블), Label CRUD, Quick Add, 서브이슈, 키보드 단축키 |
| **CP-3** | 이슈 뷰 | 리스트 뷰, 보드 뷰(칸반 DnD), 비주얼 필터 빌더, 저장된 뷰, 벌크 작업 |
| **CP-4** | 사이클 | 사이클 CRUD, 이슈 추가/제거, 진행률, 이월 |
| **CP-5** | Wiki | Wiki Space, 페이지 CRUD, TipTap 에디터 + 슬래시 명령어, 페이지 트리, 이슈 링크, 파일 업로드 |
| **CP-6** | 공통 | Cmd+K 검색, My Work, 댓글/리액션/활동, 알림 |
| **CP-7** | 배포 & QA | Dockerfile.server, Dockerfile.web, docker-compose.prod.yml, 리버스 프록시 설정, .dockerignore, 셀프호스팅 배포 문서, 온보딩 위저드, Empty State, Swagger, 버그 수정 |

### v1.0 체크포인트

| # | 체크포인트 | 산출물 |
|---|----------|--------|
| **CP-8** | Wiki CRDT | Hocuspocus, Yjs 동시 편집, 커서 표시, lazy migration |
| **CP-9** | 모듈 + 뷰 확장 | 모듈(에픽), 캘린더/타임라인 뷰, 번다운 차트 |
| **CP-10** | GitHub 연동 | PR ↔ 이슈, 브랜치 자동 생성, 상태 자동 변경 |
| **CP-11** | 고도화 | 커스텀 상태/타입, 인라인 댓글, 이슈 구독, 이슈 링크 상태 뱃지 |
| **CP-12** | 운영 | 이메일 알림, OAuth, Webhook, Jira 임포트, 데이터 내보내기 |

---

## 7. 부록: 데이터 모델

### FK 정책 범례
- `CASCADE`: 부모 삭제 시 함께 삭제
- `SET NULL`: 부모 삭제 시 null로 설정
- `RESTRICT`: 참조 중이면 삭제 불가

### Soft Delete 대상
`Organization`, `Workspace`, `Project`, `Issue`, `WikiPage`, `Comment` — `deleted_at` 컬럼 포함. 30일 후 hard delete (BullMQ 크론).

UNIQUE 제약에는 **부분 인덱스** 적용: `WHERE deleted_at IS NULL`

### 주요 엔티티

```
User
├── id (uuid), email (unique), name, avatar_url, password_hash
├── created_at, updated_at

Organization
├── id, name, slug, logo
├── created_at, updated_at, deleted_at
├── UNIQUE(slug) WHERE deleted_at IS NULL

OrgMember
├── id, org_id → Organization (CASCADE), user_id → User (CASCADE)
├── role (owner/admin/member)
├── joined_at
├── UNIQUE(org_id, user_id)

Workspace
├── id, org_id → Organization (CASCADE), name, slug, logo, description
├── created_at, updated_at, deleted_at
├── UNIQUE(org_id, slug) WHERE deleted_at IS NULL

WorkspaceMember
├── id, workspace_id → Workspace (CASCADE), user_id → User (CASCADE)
├── role (admin/member/guest)
├── invited_by → User (SET NULL), joined_at
├── UNIQUE(workspace_id, user_id)

Project
├── id, workspace_id → Workspace (CASCADE)
├── name, prefix, description, icon, cover
├── issue_counter (int, atomic increment)
├── status (active/archived)
├── created_by → User (SET NULL)
├── created_at, updated_at, deleted_at
├── UNIQUE(workspace_id, prefix) WHERE deleted_at IS NULL

ProjectMember
├── id, project_id → Project (CASCADE), user_id → User (CASCADE)
├── role (admin/member/viewer)
├── joined_at
├── UNIQUE(project_id, user_id)

IssueStatus (프로젝트별, 시드 데이터)
├── id, project_id → Project (CASCADE)
├── name, color, category (backlog/unstarted/started/completed/cancelled)
├── is_default, sort_order (text)
├── created_at

IssueType (프로젝트별, 시드 데이터)
├── id, project_id → Project (CASCADE)
├── name, icon, color
├── is_default, sort_order (text)
├── created_at

Issue
├── id, project_id → Project (CASCADE), sequence_id
├── title
├── description (jsonb — TipTap JSON)
├── description_text (text — plaintext 추출, 검색용)
├── search_vector (tsvector — GIN 인덱스, 트리거로 자동 갱신)
├── status_id → IssueStatus (RESTRICT)
├── type_id → IssueType (RESTRICT)
├── priority (enum: urgent/high/medium/low/none)
├── parent_id → Issue (SET NULL)
├── start_date, due_date
├── estimate_points
├── sort_order (text — fractional indexing)
├── created_by → User (SET NULL)
├── created_at, updated_at, deleted_at
├── UNIQUE(project_id, sequence_id)

IssueAssignee (정규화 join 테이블)
├── id, issue_id → Issue (CASCADE), user_id → User (CASCADE)
├── assigned_at
├── UNIQUE(issue_id, user_id)
├── INDEX(user_id) — My Issues 고속 조회

IssueLabel (정규화 join 테이블)
├── id, issue_id → Issue (CASCADE), label_id → Label (CASCADE)
├── created_at
├── UNIQUE(issue_id, label_id)

Label
├── id, project_id → Project (CASCADE)
├── name, color
├── created_at, updated_at
├── UNIQUE(project_id, name)

Cycle
├── id, project_id → Project (CASCADE)
├── name, start_date, end_date
├── status (draft/active/completed)
├── created_by → User (SET NULL)
├── created_at, updated_at
├── UNIQUE PARTIAL: (project_id) WHERE status = 'active'

CycleIssue (다대다, 이월 추적)
├── id, cycle_id → Cycle (CASCADE), issue_id → Issue (CASCADE)
├── added_at, removed_at
├── carried_from_id → CycleIssue (SET NULL) — 이월 체인
├── UNIQUE PARTIAL: (cycle_id, issue_id) WHERE removed_at IS NULL

WikiSpace
├── id, workspace_id → Workspace (CASCADE)
├── name, slug, icon, description
├── created_at, updated_at
├── UNIQUE(workspace_id, slug)

WikiSpaceMember
├── id, space_id → WikiSpace (CASCADE), user_id → User (CASCADE)
├── role (editor/viewer)
├── joined_at
├── UNIQUE(space_id, user_id)

WikiPage
├── id, space_id → WikiSpace (CASCADE)
├── parent_id → WikiPage (SET NULL)
├── title, slug
├── content (jsonb — TipTap JSON)
├── content_format (text: 'json' | 'yjs') — v1.0 lazy migration용
├── content_binary (bytea, nullable) — v1.0에서 Yjs binary 저장용
├── content_text (text — plaintext 추출, 검색용)
├── search_vector (tsvector — GIN 인덱스)
├── sort_order (text)
├── created_by → User (SET NULL), updated_by → User (SET NULL)
├── created_at, updated_at, deleted_at

Comment (다형적 — issue_id/page_id 중 하나만 NOT NULL)
├── id
├── issue_id → Issue (CASCADE), nullable
├── page_id → WikiPage (CASCADE), nullable
├── CHECK: (issue_id IS NOT NULL AND page_id IS NULL) OR (issue_id IS NULL AND page_id IS NOT NULL)
├── content (jsonb — TipTap JSON)
├── parent_id → Comment (CASCADE) — 스레드
├── author_id → User (SET NULL)
├── resolved_at (v1.0 — 인라인 댓글)
├── created_at, updated_at, deleted_at

Reaction
├── id, comment_id → Comment (CASCADE), user_id → User (CASCADE)
├── emoji, created_at
├── UNIQUE(comment_id, user_id, emoji)

Activity (다형적 — 정확히 하나만 NOT NULL)
├── id
├── issue_id → Issue (CASCADE), nullable
├── page_id → WikiPage (CASCADE), nullable
├── project_id → Project (CASCADE), nullable
├── CHECK: exactly one of (issue_id, page_id, project_id) IS NOT NULL
├── action (created/updated/status_changed/assigned/commented 등)
├── field, old_value, new_value
├── actor_id → User (SET NULL)
├── created_at

Notification (둘 다 NULL 허용 — invited 등)
├── id, user_id → User (CASCADE)
├── issue_id → Issue (CASCADE), nullable
├── page_id → WikiPage (CASCADE), nullable
├── CHECK: NOT (issue_id IS NOT NULL AND page_id IS NOT NULL)
├── type (assigned/mentioned/commented/status_changed/invited)
├── message, read_at
├── created_at

Favorite (정확히 하나만 NOT NULL)
├── id, user_id → User (CASCADE)
├── project_id → Project (CASCADE), nullable
├── issue_id → Issue (CASCADE), nullable
├── page_id → WikiPage (CASCADE), nullable
├── space_id → WikiSpace (CASCADE), nullable
├── CHECK: exactly one of (project_id, issue_id, page_id, space_id) IS NOT NULL
├── sort_order (text), created_at

IssueMention (이슈 ↔ Wiki 양방향 링크)
├── id, issue_id → Issue (CASCADE), page_id → WikiPage (CASCADE)
├── created_at

View (저장된 뷰)
├── id, project_id → Project (CASCADE)
├── name, created_by → User (SET NULL)
├── filters (jsonb), sort (jsonb), group_by
├── type (list/board)
├── created_at, updated_at

File (둘 다 NULL 허용 — 임시 업로드)
├── id
├── issue_id → Issue (CASCADE), nullable
├── page_id → WikiPage (CASCADE), nullable
├── CHECK: NOT (issue_id IS NOT NULL AND page_id IS NOT NULL)
├── name, path, mime_type, size
├── uploaded_by → User (SET NULL)
├── created_at

Invitation (Organization 또는 Workspace 초대)
├── id
├── org_id → Organization (CASCADE), nullable
├── workspace_id → Workspace (CASCADE), nullable
├── CHECK: exactly one of (org_id, workspace_id) IS NOT NULL
├── email, role, token_hash (UNIQUE)
├── invited_by → User (SET NULL)
├── expires_at, accepted_at
├── created_at
├── UNIQUE(workspace_id, email) WHERE accepted_at IS NULL — 중복 초대 방지
├── UNIQUE(org_id, email) WHERE accepted_at IS NULL

Module (v1.0)
├── id, project_id → Project (CASCADE)
├── name, description, start_date, target_date, status
├── created_by → User (SET NULL)
├── created_at, updated_at

IssueLink (v1.0)
├── id, issue_id → Issue (CASCADE), linked_issue_id → Issue (CASCADE)
├── type (blocks/is_blocked_by/relates_to/duplicates)
├── created_by → User (SET NULL), created_at

IssueWatcher (v1.0)
├── id, issue_id → Issue (CASCADE), user_id → User (CASCADE)
├── created_at, UNIQUE(issue_id, user_id)
```

---

## 8. 부록: API 엔드포인트

> **패턴**: Flat. 리소스 ID 직접 접근. 리스트만 부모 경로.

### 인증

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/invitations/:token/accept
GET    /api/v1/my/profile
PATCH  /api/v1/my/profile
```

### Organization

```
GET    /api/v1/organizations
POST   /api/v1/organizations
GET    /api/v1/organizations/:id
PATCH  /api/v1/organizations/:id
DELETE /api/v1/organizations/:id
GET    /api/v1/organizations/:id/members
POST   /api/v1/organizations/:id/invitations
GET    /api/v1/organizations/:id/invitations
DELETE /api/v1/invitations/:id
PATCH  /api/v1/org-members/:id
DELETE /api/v1/org-members/:id
```

### Workspace

```
GET    /api/v1/organizations/:orgId/workspaces
POST   /api/v1/organizations/:orgId/workspaces
GET    /api/v1/workspaces/:id
PATCH  /api/v1/workspaces/:id
DELETE /api/v1/workspaces/:id
GET    /api/v1/workspaces/:id/members
POST   /api/v1/workspaces/:id/invitations
GET    /api/v1/workspaces/:id/invitations
PATCH  /api/v1/workspace-members/:id
DELETE /api/v1/workspace-members/:id
```

### Project

```
GET    /api/v1/workspaces/:wsId/projects
POST   /api/v1/workspaces/:wsId/projects
GET    /api/v1/projects/:id
PATCH  /api/v1/projects/:id
DELETE /api/v1/projects/:id
GET    /api/v1/projects/:id/members
POST   /api/v1/projects/:id/members
PATCH  /api/v1/project-members/:id
DELETE /api/v1/project-members/:id
GET    /api/v1/workspaces/:wsId/projects/check-prefix?prefix=WORK
```

### Issue

```
GET    /api/v1/projects/:id/issues?status=...&type=...&priority=...&assignee=...&label=...&due_before=...&due_after=...&title=...&cycle=...&sort=...&order=...&cursor=...&limit=...
POST   /api/v1/projects/:id/issues
GET    /api/v1/issues/:id
PATCH  /api/v1/issues/:id
DELETE /api/v1/issues/:id
PATCH  /api/v1/projects/:id/issues/bulk
GET    /api/v1/issues/:id/sub-issues
GET    /api/v1/issues/:id/activities
GET    /api/v1/projects/:id/issues/stats        # 상태별 카운트
```

### Issue Type & Status

```
GET    /api/v1/projects/:id/issue-types
POST   /api/v1/projects/:id/issue-types          # v1.0
PATCH  /api/v1/issue-types/:id
DELETE /api/v1/issue-types/:id

GET    /api/v1/projects/:id/issue-statuses
POST   /api/v1/projects/:id/issue-statuses       # v1.0
PATCH  /api/v1/issue-statuses/:id
DELETE /api/v1/issue-statuses/:id
```

### Label

```
GET    /api/v1/projects/:id/labels
POST   /api/v1/projects/:id/labels
PATCH  /api/v1/labels/:id
DELETE /api/v1/labels/:id
```

### Comment & Reaction

```
GET    /api/v1/issues/:id/comments
POST   /api/v1/issues/:id/comments
GET    /api/v1/wiki-pages/:id/comments
POST   /api/v1/wiki-pages/:id/comments
PATCH  /api/v1/comments/:id
DELETE /api/v1/comments/:id
POST   /api/v1/comments/:id/reactions
DELETE /api/v1/comments/:id/reactions/:emoji
```

### Cycle

```
GET    /api/v1/projects/:id/cycles
POST   /api/v1/projects/:id/cycles
GET    /api/v1/cycles/:id
PATCH  /api/v1/cycles/:id
DELETE /api/v1/cycles/:id
GET    /api/v1/cycles/:id/issues
POST   /api/v1/cycles/:id/issues
DELETE /api/v1/cycles/:id/issues/:issueId
```

### View (저장된 뷰)

```
GET    /api/v1/projects/:id/views
POST   /api/v1/projects/:id/views
PATCH  /api/v1/views/:id
DELETE /api/v1/views/:id
```

### Wiki

```
GET    /api/v1/workspaces/:wsId/wiki-spaces
POST   /api/v1/workspaces/:wsId/wiki-spaces
GET    /api/v1/wiki-spaces/:id
PATCH  /api/v1/wiki-spaces/:id
DELETE /api/v1/wiki-spaces/:id
GET    /api/v1/wiki-spaces/:id/members
POST   /api/v1/wiki-spaces/:id/members
PATCH  /api/v1/wiki-space-members/:id
DELETE /api/v1/wiki-space-members/:id
GET    /api/v1/wiki-spaces/:id/pages
POST   /api/v1/wiki-spaces/:id/pages
GET    /api/v1/wiki-pages/:id
PATCH  /api/v1/wiki-pages/:id
DELETE /api/v1/wiki-pages/:id
```

### Search & My Work

```
GET    /api/v1/workspaces/:wsId/search?q=...&type=issue,page,project&project_id=...&sort=relevance&limit=20&cursor=...
GET    /api/v1/my/issues?workspace_id=...
GET    /api/v1/my/notifications
GET    /api/v1/my/notifications/unread-count
PATCH  /api/v1/notifications/:id
PATCH  /api/v1/my/notifications/read-all
DELETE /api/v1/notifications/:id
GET    /api/v1/my/favorites
POST   /api/v1/my/favorites
PATCH  /api/v1/favorites/:id
DELETE /api/v1/favorites/:id
```

### File

```
POST   /api/v1/files/upload          # multipart, entity_type + entity_id
GET    /api/v1/files/:id
DELETE /api/v1/files/:id
```

### Health

```
GET    /healthz                       # liveness probe
GET    /readyz                        # readiness probe (DB + Redis 확인)
```

### 페이지네이션

모든 리스트 API는 **커서 기반** 페이지네이션:
```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJ...",
    "has_more": true
  }
}
```

### Rate Limiting

| 그룹 | 제한 |
|------|------|
| 전체 API | 1000 req/분 |
| 인증 (login/register) | 10 req/15분 |
| 검색 | 30 req/분 |
| 파일 업로드 | 20 req/분 |
| 벌크 작업 | 10 req/분 |

키: 인증된 요청은 user_id, 미인증은 IP.

---

## 9. 부록: 프론트엔드 URL 라우팅

```
# 인증
/login
/register
/invite/:token

# 조직
/orgs
/orgs/new

# 워크스페이스 컨텍스트
/:orgSlug/:wsSlug                                    # → My Work 리다이렉트

# My Work
/:orgSlug/:wsSlug/my/inbox
/:orgSlug/:wsSlug/my/issues
/:orgSlug/:wsSlug/my/favorites

# Projects
/:orgSlug/:wsSlug/projects
/:orgSlug/:wsSlug/projects/:prefix/issues             # 리스트 뷰
/:orgSlug/:wsSlug/projects/:prefix/board               # 칸반 뷰
/:orgSlug/:wsSlug/projects/:prefix/cycles
/:orgSlug/:wsSlug/projects/:prefix/cycles/:cycleId
/:orgSlug/:wsSlug/projects/:prefix/views/:viewId
/:orgSlug/:wsSlug/projects/:prefix/settings

# 이슈 상세
/:orgSlug/:wsSlug/projects/:prefix/issues/:issueKey   # 예: WORK-142

# Wiki
/:orgSlug/:wsSlug/wiki
/:orgSlug/:wsSlug/wiki/:spaceSlug
/:orgSlug/:wsSlug/wiki/:spaceSlug/:pageSlug

# 설정
/:orgSlug/:wsSlug/settings
/:orgSlug/:wsSlug/settings/members
/:orgSlug/:wsSlug/settings/integrations
```

---

## 10. 부록: WebSocket 이벤트

### 연결

```
WS /api/v1/ws    # Cookie 헤더의 Better Auth 세션 쿠키로 자동 인증
```

- Fastify `upgrade` 핸들러에서 Better Auth `getSession()` 호출로 인증
- 세션 만료 시 `close(4401, 'session_expired')` 전송 후 연결 종료
- 클라이언트 재연결: 지수 백오프 (1초, 2초, 4초, ..., 최대 30초)

### 채널 (Room)

```
workspace:{wsId}          # 워크스페이스 전역
project:{projectId}       # 프로젝트 이슈 변경
issue:{issueId}           # 이슈 상세
user:{userId}             # 개인 알림
```

### 클라이언트 → 서버 메시지

| 메시지 | 페이로드 | 용도 |
|--------|----------|------|
| `subscribe` | `{ channel: "project:abc" }` | 채널 구독 |
| `unsubscribe` | `{ channel: "project:abc" }` | 채널 해제 |

서버는 `subscribe` 수신 시 `{ type: "subscribed", channel }` ACK 응답.

### 서버 → 클라이언트 이벤트

| 이벤트 | 채널 | 페이로드 |
|--------|------|----------|
| `issue.created` | `project:{id}` | 이슈 전체 데이터 |
| `issue.updated` | `project:{id}` + `issue:{id}` | 변경된 필드만 (patch) |
| `issue.deleted` | `project:{id}` | `{ issueId }` |
| `issue.bulk_updated` | `project:{id}` | `{ issueIds, changes }` |
| `comment.created` | `issue:{id}` | 댓글 데이터 |
| `comment.updated` | `issue:{id}` | patch |
| `comment.deleted` | `issue:{id}` | `{ commentId }` |
| `cycle.updated` | `project:{id}` | patch |
| `member.added` | `workspace:{id}` / `project:{id}` | 멤버 정보 |
| `notification.new` | `user:{id}` | 알림 데이터 |
| `wiki-page.created` | `workspace:{wsId}` | `{ pageId, spaceId, title }` |
| `wiki-page.updated` | `workspace:{wsId}` | `{ pageId, title }` |
| `wiki-page.deleted` | `workspace:{wsId}` | `{ pageId, spaceId }` |

### 메시지 포맷

```json
{
  "type": "issue.updated",
  "payload": { "id": "...", "changes": { "status_id": "..." } },
  "actor": { "id": "...", "name": "Luke" },
  "timestamp": "2026-04-01T12:00:00Z"
}
```

### 멀티 인스턴스

Redis Pub/Sub로 인스턴스 간 이벤트 전파. MVP는 단일 인스턴스 가정하되, 인터페이스 분리로 v1.0 Redis adapter 교체 가능.

---

## 11. 부록: 에러 코드 체계

### 응답 형식

```json
{
  "error": {
    "code": "ISSUE_NOT_FOUND",
    "message": "이슈를 찾을 수 없습니다.",
    "details": {}
  }
}
```

### Validation 에러

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력값이 올바르지 않습니다.",
    "details": {
      "fields": [
        { "path": "title", "message": "제목은 필수입니다." },
        { "path": "prefix", "message": "영문 대문자 2~5자만 허용됩니다." }
      ]
    }
  }
}
```

### 코드 목록

| HTTP | 코드 | 사용 |
|------|------|------|
| 400 | `VALIDATION_ERROR` | Zod 스키마 검증 실패 |
| 400 | `INVALID_PREFIX` | 접두사 규칙 위반 |
| 400 | `CIRCULAR_REFERENCE` | Wiki 페이지 순환 참조 |
| 400 | `BATCH_SIZE_EXCEEDED` | 벌크 작업 50건 초과 |
| 400 | `FILE_TOO_LARGE` | 25MB 초과 |
| 400 | `FILE_TYPE_BLOCKED` | 차단 파일 |
| 400 | `STORAGE_QUOTA_EXCEEDED` | 워크스페이스 용량 초과 |
| 401 | `UNAUTHORIZED` | 인증 실패/세션 만료 |
| 403 | `FORBIDDEN` | 권한 없음 |
| 404 | `{RESOURCE}_NOT_FOUND` | 리소스 미존재 |
| 409 | `PREFIX_ALREADY_EXISTS` | 접두사 중복 |
| 409 | `ACTIVE_CYCLE_EXISTS` | 활성 사이클 1개 초과 |
| 409 | `EMAIL_ALREADY_EXISTS` | 이메일 중복 |
| 410 | `INVITATION_EXPIRED` | 초대 링크 만료 |
| 429 | `RATE_LIMITED` | Rate limit 초과 |
| 500 | `INTERNAL_ERROR` | 서버 오류 |

---

## 12. 부록: 엣지 케이스 및 정책

### 12.1 이슈 삭제 시 연쇄 처리

| 연관 데이터 | 처리 |
|------------|------|
| 서브이슈 | parent_id = null (승격) |
| Wiki 링크 | "[삭제된 이슈] WORK-142" 표시 |
| CycleIssue | 레코드 제거 |
| IssueAssignee, IssueLabel | CASCADE 삭제 |
| 댓글/활동 | Soft delete |
| 삭제 확인 | 모달에 영향 범위 표시 |

### 12.2 프로젝트/워크스페이스/조직 삭제

- Soft delete: 30일간 복구 가능 (휴지통)
- 30일 후 hard delete + 파일 스토리지 정리 (BullMQ 크론)
- 삭제 확인에 이름 입력 요구

### 12.3 Wiki 페이지 순환 참조 방지

- 서버에서 CTE recursive query로 순환 검증
- 순환 시 `400 CIRCULAR_REFERENCE`
- 프론트에서 드래그 시 불가능한 위치 시각적 표시
- 최대 깊이: 6단계

### 12.4 사이클 이월

- 사용자가 "사이클 완료" 버튼 클릭 시 트리거
- 미완료 이슈 → 다음 활성/draft 사이클이 있으면 이동, 없으면 cycle 소속 해제
- CycleIssue: 이전 레코드 `removed_at` 기록 + 새 레코드 `carried_from_id` 연결

### 12.5 검색 인덱싱

- 이슈: `title` + `description_text` → tsvector (트리거 자동 갱신) + GIN 인덱스
- Wiki: `content_text` → tsvector + GIN 인덱스
- 이슈 ID 검색: 클라이언트 패턴 매칭 → `(project.prefix, issue.sequence_id)` 직접 조회
- MVP: PostgreSQL `ILIKE` + `pg_trgm` GIN. 한국어 형태소 분석은 v1.5

### 12.6 보안 정책

| 항목 | 정책 |
|------|------|
| 비밀번호 해시 | Better Auth 기본 (bcrypt) |
| XSS 방지 | TipTap JSON 저장 시 서버에서 sanitize |
| CORS | origin whitelist + credentials |
| Rate limiting | 섹션 8 참조 |
| 로그인 시도 제한 | 5회 실패 시 5분 잠금 |
| 초대 토큰 | `crypto.randomBytes(32)`, 사용 후 무효화 |
| 수평적 권한 검증 | 모든 리소스 접근 시 ownership 검증 미들웨어 |
| API Key | v1.0에서 외부 연동용 추가 |

### 12.7 반응형 전략 (MVP)

| 브레이크포인트 | 동작 |
|-------------|------|
| 1280px+ | 풀 레이아웃 (사이드바 + 콘텐츠 + Side Panel) |
| 1024~1279px | 사이드바 축소(48px 아이콘), Side Panel은 오버레이 |
| ~1023px | "데스크톱 브라우저를 사용해주세요" 안내 (MVP 미지원) |

### 12.8 프로젝트 접두사(prefix) 재사용 정책

- Soft delete 기간(30일): 재사용 불가
- Hard delete 이후에도: 재사용 불가 (삭제된 프로젝트 레코드에서 prefix 유지)
- 부분 인덱스 `WHERE deleted_at IS NULL`로 UNIQUE 관리하되, 삭제 레코드의 prefix도 중복 체크

### 12.9 Wiki 동시 편집 충돌 (MVP)

MVP는 단일 사용자 편집이지만, 두 사용자가 동시에 같은 페이지를 열고 저장할 수 있음:
- **정책: Last-Write-Wins** — 나중에 저장한 내용이 덮어씀
- 저장 시 `updated_at` 체크: 다른 사용자가 수정한 경우 경고 toast 표시 ("이 페이지가 다른 사용자에 의해 수정되었습니다. 새로고침하시겠습니까?")
- v1.0 CRDT 도입으로 근본 해결

### 12.10 Empty State 목록

| 화면 | 메시지 | CTA |
|------|--------|-----|
| 조직 목록 | "아직 조직이 없습니다" | "조직 만들기" |
| 워크스페이스 목록 | "워크스페이스를 만들어 시작하세요" | "워크스페이스 만들기" |
| 프로젝트 목록 | "프로젝트가 없습니다" | "프로젝트 만들기" |
| 이슈 목록 | "C 를 눌러 첫 이슈를 만들어보세요" | "이슈 만들기" + 단축키 힌트 |
| 이슈 필터 결과 없음 | "조건에 맞는 이슈가 없습니다" | "필터 초기화" |
| 칸반 보드 전체 비어있음 | "이슈를 만들어 보드를 시작하세요" | "이슈 만들기" |
| 칸반 특정 컬럼 비어있음 | (빈 영역) | 컬럼 하단 "+ 이슈" 버튼 |
| 사이클 목록 | "사이클이 없습니다" | "사이클 만들기" |
| 사이클 이슈 없음 | "이 사이클에 이슈가 없습니다" | "이슈 추가" |
| 저장된 뷰 목록 | "저장된 뷰가 없습니다" | "현재 필터를 뷰로 저장하세요" |
| Wiki 스페이스 | "지식을 한 곳에 모아보세요" | "스페이스 만들기" |
| Wiki 페이지 | "첫 페이지를 작성해보세요" | "페이지 만들기" |
| Inbox | "새로운 알림이 없습니다" | 없음 |
| My Issues | "할당된 이슈가 없습니다" | "프로젝트로 이동" |
| Favorites | "즐겨찾기한 항목이 없습니다" | 가이드 텍스트 |
| 댓글 | "아직 댓글이 없습니다" | 댓글 입력 필드 |
| 라벨 목록 | "라벨이 없습니다" | "라벨 만들기" |
| 서브이슈 | "서브이슈가 없습니다" | "서브이슈 추가" |
| 검색 결과 없음 (Cmd+K) | "검색 결과가 없습니다" | 검색어 수정 가이드 |
