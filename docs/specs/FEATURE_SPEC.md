# Worknest 기능정의서

**목표**: Atlassian Jira + Confluence를 대체하는 셀프호스팅 가능한 올인원 프로젝트 관리 & 지식 관리 플랫폼

**버전**: v0.1 (초안)

---

## 목차

1. [제품 개요](#1-제품-개요)
2. [사용자 및 권한](#2-사용자-및-권한)
3. [Projects — 프로젝트 관리 (Jira 대체)](#3-projects--프로젝트-관리)
4. [Wiki — 지식 관리 (Confluence 대체)](#4-wiki--지식-관리)
5. [공통 기능](#5-공통-기능)
6. [페이즈별 개발 계획](#6-페이즈별-개발-계획)

---

## 1. 제품 개요

### 1.1 핵심 가치

| 항목 | 설명 |
|------|------|
| **빠른 속도** | 낙관적 업데이트 + 캐싱으로 클릭 즉시 반응 |
| **실시간 협업** | Wiki 동시 편집 (CRDT), 이슈 실시간 동기화 |
| **셀프호스팅** | Docker Compose 한 줄로 배포, 데이터 소유권 |
| **통합 경험** | 프로젝트 관리 + 위키가 하나의 앱에서 연결 |

### 1.2 제품 구조

```
Worknest
├── Workspace (조직 단위)
│   ├── Projects (프로젝트 관리 = Jira)
│   │   ├── Issues (이슈/태스크)
│   │   ├── Cycles (스프린트)
│   │   ├── Modules (모듈/에픽)
│   │   ├── Views (필터/보기)
│   │   └── Settings
│   │
│   ├── Wiki (지식 관리 = Confluence)
│   │   ├── Spaces (공간)
│   │   ├── Pages (문서)
│   │   └── Templates (템플릿)
│   │
│   └── Settings (워크스페이스 설정)
│       ├── Members
│       ├── Roles & Permissions
│       ├── Integrations
│       └── Billing (클라우드 전용)
```

---

## 2. 사용자 및 권한

### 2.1 인증

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 이메일 + 비밀번호 | O | O | 기본 로그인 |
| Google OAuth | - | O | 소셜 로그인 |
| SAML SSO | - | O | 기업 SSO (Okta, Azure AD 등) |
| 2FA (TOTP) | - | O | 추가 보안 |
| 초대 링크 | O | O | 이메일 초대 + 링크 공유 |

### 2.2 조직 구조

```
Organization (최상위)
└── Workspace (팀/프로젝트 단위)
    ├── Members
    └── Projects / Wiki Spaces
```

### 2.3 역할 및 권한

| 역할 | 워크스페이스 관리 | 프로젝트 생성 | 이슈 관리 | Wiki 편집 | Wiki 읽기 |
|------|-----------------|-------------|----------|----------|----------|
| **Owner** | O | O | O | O | O |
| **Admin** | O | O | O | O | O |
| **Member** | - | O | O | O | O |
| **Guest** | - | - | 할당된 것만 | - | 허용된 것만 |

### 2.4 프로젝트 레벨 권한

| 역할 | 이슈 생성 | 이슈 수정 | 이슈 삭제 | 설정 변경 |
|------|----------|----------|----------|----------|
| **Admin** | O | O | O | O |
| **Member** | O | O (자기 것) | - | - |
| **Viewer** | - | - | - | - |

---

## 3. Projects — 프로젝트 관리

Jira를 대체하는 핵심 모듈입니다.

### 3.1 프로젝트

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 프로젝트 생성/수정/삭제 | O | O | |
| 프로젝트 아이콘 & 커버 | O | O | |
| 프로젝트 설명 | O | O | 리치 텍스트 |
| 프로젝트 멤버 관리 | O | O | 역할 기반 |
| 프로젝트 즐겨찾기 | O | O | 사이드바 상단 고정 |
| 프로젝트 아카이브 | - | O | 비활성화 (삭제 아님) |

### 3.2 이슈 (Issue)

이슈는 프로젝트 관리의 핵심 단위입니다.

#### 3.2.1 기본 속성

| 속성 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 제목 | O | O | 필수 |
| 설명 | O | O | 리치 텍스트 에디터 (TipTap) |
| 상태 | O | O | Backlog, Todo, In Progress, Done, Cancelled |
| 우선순위 | O | O | Urgent, High, Medium, Low, None |
| 담당자 | O | O | 멀티 담당자 |
| 라벨 | O | O | 커스텀 라벨 (색상 포함) |
| 마감일 | O | O | 날짜 |
| 예상 시간 | - | O | 숫자 (시간 단위) |
| Story Points | - | O | 피보나치 (1, 2, 3, 5, 8, 13) |

#### 3.2.2 이슈 계층 구조

```
Module (에픽 그룹)
└── Issue (작업 단위)
    └── Sub-issue (하위 작업)
```

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 이슈 생성/수정/삭제 | O | O | |
| 서브 이슈 | O | O | 부모 이슈에 하위 작업 추가 |
| 이슈 링크 (관계) | - | O | blocks, is blocked by, relates to, duplicates |
| 이슈 이동 (프로젝트 간) | - | O | |
| 이슈 복제 | - | O | |

#### 3.2.3 이슈 ID 체계

프로젝트 접두사 + 순번: `WORK-142`, `API-53`

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 프로젝트 접두사 설정 | O | O | 프로젝트 생성 시 지정 (예: WORK, API) |
| 자동 순번 | O | O | 프로젝트 내 자동 증가 |
| ID로 빠른 검색 | O | O | `WORK-142` 입력 시 해당 이슈로 이동 |

#### 3.2.4 커스텀 상태 워크플로우

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 기본 상태 (5개) | O | O | Backlog → Todo → In Progress → Done → Cancelled |
| 커스텀 상태 추가 | - | O | 예: "Code Review", "QA", "Staging" |
| 상태 전환 규칙 | - | v1.5 | 예: "Done은 QA를 거쳐야만 가능" |

### 3.3 이슈 뷰 (Views)

| 뷰 | MVP | v1.0 | 설명 |
|----|-----|------|------|
| **리스트** | O | O | 기본 테이블 형태, 정렬/필터 |
| **보드 (칸반)** | O | O | 상태별 칸반 보드, 드래그앤드롭 |
| **캘린더** | - | O | 마감일 기준 캘린더 |
| **타임라인 (간트)** | - | O | 기간별 막대 차트 |
| **스프레드시트** | - | v1.5 | 엑셀 스타일 편집 |

#### 3.3.1 필터 & 정렬

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 속성별 필터 | O | O | 상태, 우선순위, 담당자, 라벨, 날짜 |
| 복합 필터 (AND/OR) | - | O | `상태=진행중 AND 담당자=나` |
| 정렬 | O | O | 생성일, 수정일, 우선순위, 마감일 |
| 필터 저장 (커스텀 뷰) | O | O | 저장해서 사이드바에 표시 |
| 그룹핑 | - | O | 상태별, 담당자별, 라벨별 그룹 |

### 3.4 사이클 (Cycles = 스프린트)

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 사이클 생성 (이름, 시작일, 종료일) | O | O | |
| 이슈를 사이클에 추가/제거 | O | O | |
| 활성 사이클 표시 | O | O | 현재 진행 중인 사이클 강조 |
| 사이클 진행률 | O | O | 완료된 이슈 / 전체 이슈 |
| 번다운 차트 | - | O | 남은 작업량 시각화 |
| 벨로시티 차트 | - | v1.5 | 사이클별 완료 포인트 비교 |
| 미완료 이슈 자동 이월 | - | O | 다음 사이클로 자동 이동 |

### 3.5 모듈 (Modules = 에픽)

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 모듈 생성 (이름, 설명, 기간) | O | O | |
| 이슈를 모듈에 할당 | O | O | 하나의 이슈는 하나의 모듈 |
| 모듈 진행률 | O | O | |
| 모듈 리스트 뷰 | O | O | |
| 모듈 상태 (Active, Completed) | - | O | |

### 3.6 댓글 & 활동

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 이슈 댓글 | O | O | 리치 텍스트, @멘션 |
| 활동 로그 | O | O | 상태 변경, 담당자 변경 등 자동 기록 |
| 리액션 (이모지) | O | O | 댓글에 이모지 반응 |
| 댓글 수정/삭제 | O | O | |

### 3.7 알림

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 인앱 알림 | O | O | 벨 아이콘 → 드롭다운 |
| 이메일 알림 | - | O | 이슈 할당, 멘션, 댓글 |
| 알림 설정 (구독/해제) | - | O | 프로젝트별, 이슈별 |
| Slack/Teams 웹훅 | - | v1.5 | 채널에 알림 전송 |

---

## 4. Wiki — 지식 관리

Confluence를 대체하는 지식 관리 모듈입니다.

### 4.1 Wiki Space

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| Space 생성/수정/삭제 | O | O | |
| Space 아이콘 & 설명 | O | O | |
| Space 멤버 권한 | O | O | 읽기 전용 / 편집 가능 |
| Space 즐겨찾기 | O | O | |

### 4.2 페이지 (Pages)

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 페이지 생성/수정/삭제 | O | O | |
| 페이지 트리 (계층 구조) | O | O | 사이드바에 트리 형태 |
| 페이지 이동 (드래그앤드롭) | O | O | 트리 내 위치 변경 |
| 페이지 즐겨찾기 | O | O | |
| 페이지 히스토리 (버전) | - | O | 변경 이력 조회 + 복원 |
| 페이지 템플릿 | - | O | 회의록, RFC, 온보딩 등 |
| 페이지 내보내기 | - | O | Markdown, PDF |
| 페이지 임포트 | - | v1.5 | Markdown, Confluence 내보내기 파일 |

### 4.3 에디터 (TipTap + Yjs)

#### 4.3.1 블록 타입

| 블록 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 텍스트 (Paragraph) | O | O | |
| 헤딩 (H1~H3) | O | O | |
| 순서 있는 리스트 | O | O | |
| 순서 없는 리스트 | O | O | |
| 체크리스트 (Todo) | O | O | |
| 인용구 | O | O | |
| 구분선 | O | O | |
| 코드 블록 (구문 강조) | O | O | 언어별 하이라이팅 |
| 테이블 | O | O | 행/열 추가/삭제 |
| 이미지 | O | O | 업로드 + URL |
| 파일 첨부 | O | O | |
| 콜아웃 (정보/경고/팁) | - | O | 색상별 강조 박스 |
| 토글 (접기/펼치기) | - | O | |
| 임베드 (동영상, 외부 링크) | - | O | YouTube, Figma 등 |
| Mermaid 다이어그램 | - | v1.5 | 코드 → 다이어그램 렌더링 |
| 수학 수식 (KaTeX) | - | v1.5 | |

#### 4.3.2 인라인 서식

| 서식 | MVP | 설명 |
|------|-----|------|
| Bold / Italic / Underline / Strikethrough | O | |
| 인라인 코드 | O | |
| 링크 | O | |
| @멘션 (사용자) | O | |
| 이슈 링크 (`WORK-142`) | O | 이슈 ID 입력 시 자동 링크 |
| 하이라이트 (형광펜) | O | |

#### 4.3.3 실시간 협업

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 동시 편집 (CRDT) | O | O | Yjs + Hocuspocus |
| 커서 위치 표시 | O | O | 다른 사용자 커서 실시간 |
| 사용자 아바타 표시 | O | O | 현재 편집 중인 사용자 |
| 오프라인 편집 + 자동 병합 | - | O | |

### 4.4 댓글 (페이지 레벨)

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 페이지 댓글 | O | O | 페이지 하단 댓글 스레드 |
| 인라인 댓글 | - | O | 텍스트 선택 → 댓글 추가 (Confluence 스타일) |
| 댓글 해결 (Resolve) | - | O | |

---

## 5. 공통 기능

### 5.1 검색

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 글로벌 검색 (Cmd+K) | O | O | 이슈, 페이지, 프로젝트 통합 검색 |
| 이슈 검색 (필터) | O | O | 속성 기반 필터링 |
| Wiki 전문 검색 | O | O | 페이지 본문 내용 검색 |
| 최근 방문 항목 | O | O | |

### 5.2 파일 관리

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 파일 업로드 (이슈/페이지) | O | O | 드래그앤드롭 |
| 이미지 미리보기 | O | O | |
| 파일 다운로드 | O | O | |
| 업로드 용량 제한 | O | O | 워크스페이스 설정 |

### 5.3 대시보드

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 내 이슈 목록 | O | O | 나에게 할당된 이슈 |
| 최근 활동 | O | O | 타임라인 형태 |
| 프로젝트별 진행률 | - | O | 차트 |
| 사이클 요약 | - | O | 현재 스프린트 상태 |

### 5.4 연동 (Integrations)

| 기능 | MVP | v1.0 | v1.5 | 설명 |
|------|-----|------|------|------|
| GitHub | - | O | O | PR ↔ 이슈 링크, 상태 자동 변경 |
| GitLab | - | - | O | 동일 |
| Slack | - | - | O | 알림 웹훅 |
| Webhook (일반) | - | O | O | 커스텀 이벤트 발송 |
| API (REST) | O | O | O | 외부 연동용 공개 API |

### 5.5 관리자 기능

| 기능 | MVP | v1.0 | 설명 |
|------|-----|------|------|
| 워크스페이스 설정 | O | O | 이름, 로고, URL |
| 멤버 초대/제거 | O | O | 이메일 초대 |
| 역할 관리 | O | O | 권한 설정 |
| 감사 로그 | - | v1.5 | 누가 언제 무엇을 했는지 |
| 데이터 내보내기 | - | O | JSON/CSV |
| 데이터 삭제 (GDPR) | - | v1.5 | 계정/데이터 완전 삭제 |

---

## 6. 페이즈별 개발 계획

### Phase 1: MVP (8-10주)

**목표**: 핵심 기능으로 실제 사용 가능한 수준

```
Week 1-2: 프로젝트 셋업 + 인증
  - 모노레포 구조 (pnpm + Turborepo)
  - DB 스키마 설계 (Drizzle)
  - 인증 (이메일 + 비밀번호)
  - 워크스페이스 CRUD

Week 3-4: Projects 핵심
  - 프로젝트 CRUD
  - 이슈 CRUD + 기본 속성 (상태, 우선순위, 담당자, 라벨)
  - 이슈 ID 체계 (WORK-142)
  - 서브 이슈

Week 5-6: 이슈 뷰 + 사이클
  - 리스트 뷰 (정렬, 필터)
  - 보드 뷰 (칸반 + 드래그앤드롭)
  - 필터 저장 (커스텀 뷰)
  - 사이클 (스프린트) 기본

Week 7-8: Wiki 핵심
  - Wiki Space + 페이지 CRUD
  - TipTap 에디터 (기본 블록)
  - 페이지 트리 (계층 구조)
  - Hocuspocus 연동 (실시간 협업)

Week 9-10: 공통 + 배포
  - 글로벌 검색 (Cmd+K)
  - 댓글 + 활동 로그
  - 알림 (인앱)
  - Docker Compose 배포
  - 기본 문서 작성
```

**MVP 산출물:**
- 프로젝트 생성 → 이슈 관리 (리스트 + 칸반)
- Wiki 문서 작성 + 실시간 협업
- 스프린트 관리
- 팀 초대 및 권한 관리

### Phase 2: v1.0 (8주)

```
- GitHub 연동 (PR ↔ 이슈)
- 캘린더/타임라인 뷰
- 번다운 차트
- 커스텀 상태 워크플로우
- Wiki 페이지 히스토리 + 템플릿
- 인라인 댓글
- 이메일 알림
- Google OAuth
- Webhook API
```

### Phase 3: v1.5 (8주)

```
- SAML SSO
- Slack/Teams 연동
- 감사 로그
- Confluence 데이터 임포트
- 벨로시티 차트
- Mermaid 다이어그램
- 스프레드시트 뷰
- 모바일 반응형
```

---

## 부록: 데이터 모델 (주요 엔티티)

```
Workspace
├── id, name, slug, logo, created_at

Project
├── id, workspace_id, name, prefix, description, icon, status
├── settings (default_assignee, default_status 등)

Issue
├── id, project_id, sequence_id (순번)
├── title, description (JSON — TipTap 문서)
├── status, priority, type
├── assignee_ids[], label_ids[]
├── parent_id (서브이슈)
├── module_id, cycle_id
├── start_date, due_date
├── estimate_points
├── sort_order (fractional indexing)
├── created_by, created_at, updated_at

Cycle
├── id, project_id, name
├── start_date, end_date, status

Module
├── id, project_id, name, description
├── start_date, target_date, status

Label
├── id, project_id, name, color

WikiSpace
├── id, workspace_id, name, icon, description

WikiPage
├── id, space_id, parent_id
├── title, content (Yjs binary — CRDT)
├── sort_order
├── created_by, updated_at

Comment
├── id, entity_type (issue/page), entity_id
├── content, author_id
├── resolved_at (인라인 댓글용)

Activity
├── id, entity_type, entity_id
├── action (created, updated, status_changed 등)
├── field, old_value, new_value
├── actor_id, created_at

Notification
├── id, user_id, entity_type, entity_id
├── type, message, read_at

IssueLink
├── id, issue_id, linked_issue_id
├── type (blocks, is_blocked_by, relates_to, duplicates)

View (저장된 필터)
├── id, project_id, name
├── filters (JSON), sort (JSON), group_by
├── type (list, board, calendar, timeline)
```

---

## 부록: API 엔드포인트 (주요)

```
# Auth
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout

# Workspaces
GET    /api/v1/workspaces
POST   /api/v1/workspaces
PATCH  /api/v1/workspaces/:slug
DELETE /api/v1/workspaces/:slug

# Projects
GET    /api/v1/workspaces/:slug/projects
POST   /api/v1/workspaces/:slug/projects
PATCH  /api/v1/workspaces/:slug/projects/:id
DELETE /api/v1/workspaces/:slug/projects/:id

# Issues
GET    /api/v1/workspaces/:slug/projects/:id/issues
POST   /api/v1/workspaces/:slug/projects/:id/issues
PATCH  /api/v1/workspaces/:slug/projects/:id/issues/:issueId
DELETE /api/v1/workspaces/:slug/projects/:id/issues/:issueId

# Issue Comments
GET    /api/v1/issues/:id/comments
POST   /api/v1/issues/:id/comments

# Cycles
GET    /api/v1/projects/:id/cycles
POST   /api/v1/projects/:id/cycles
PATCH  /api/v1/projects/:id/cycles/:cycleId
POST   /api/v1/projects/:id/cycles/:cycleId/issues  (이슈 추가)
DELETE /api/v1/projects/:id/cycles/:cycleId/issues/:issueId  (이슈 제거)

# Modules
GET    /api/v1/projects/:id/modules
POST   /api/v1/projects/:id/modules

# Wiki
GET    /api/v1/workspaces/:slug/wiki/spaces
POST   /api/v1/workspaces/:slug/wiki/spaces
GET    /api/v1/wiki/spaces/:id/pages
POST   /api/v1/wiki/spaces/:id/pages
PATCH  /api/v1/wiki/pages/:id
DELETE /api/v1/wiki/pages/:id

# Search
GET    /api/v1/workspaces/:slug/search?q=keyword

# Notifications
GET    /api/v1/notifications
PATCH  /api/v1/notifications/:id/read

# Webhooks
GET    /api/v1/workspaces/:slug/webhooks
POST   /api/v1/workspaces/:slug/webhooks
```
