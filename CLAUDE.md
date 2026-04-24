# CLAUDE.md

## Project

Worknest — Jira + Confluence 대체 올인원 프로젝트 관리 & 지식 관리 플랫폼

## Key Documents

- Feature Spec: `docs/specs/FEATURE_SPEC.md`
- Agent Definitions: `.claude/agents/*.md`

## Agent Team

프로젝트에 특화된 서브 에이전트가 `.claude/agents/`에 정의되어 있습니다. 기능 구현 시 해당 에이전트의 지침을 읽고 따라야 합니다.

| Agent | File | Role | Model |
|-------|------|------|-------|
| **PM** | `pm.md` | 기능 기획, 유저 스토리, 수용 기준 | opus |
| **Design** | `design.md` | UI/UX 설계, 와이어프레임, 디자인 시스템, 컴포넌트 스펙 | opus |
| **DBA** | `dba.md` | DB 스키마, 마이그레이션, 쿼리 최적화 | opus |
| **Backend** | `backend.md` | API, 서비스 레이어, 인증, WebSocket | opus |
| **Frontend** | `frontend.md` | React, 상태 관리, UX, 에디터 | opus |
| **QA** | `qa.md` | 테스트, 코드 리뷰, 품질 보증 | opus |
| **DevOps** | `devops.md` | Docker, CI/CD, 배포 | opus |
| **Tech Lead** | `tech-lead.md` | 아키텍처, 코드 리뷰 총괄, 통합 | opus |

## Parallel Agent Usage

기능 구현 시 에이전트를 병렬로 활용합니다:

```
Step 1: DBA — 스키마 생성
Step 2 (병렬): Backend — API 구현 | Frontend — UI 구현
Step 3: QA — 테스트 작성 + 코드 리뷰
Step 4: Tech Lead — 통합 검증
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm + Turborepo |
| Frontend | Vite + React 19 + TypeScript + Tailwind CSS 4 |
| Backend | Node.js + Fastify + TypeScript |
| Auth | Better Auth (DB 세션 + cookie caching) |
| Database | PostgreSQL + Drizzle ORM |
| Cache/Queue | Redis + BullMQ |
| Real-time (Issues) | WebSocket |
| Real-time (Wiki) | Hocuspocus (Yjs CRDT) — v1.0 |
| Editor | TipTap (ProseMirror) |
| UI Components | Radix UI + shadcn/ui |
| Linting | Biome |
| Testing | Vitest + Playwright |
| Container | Docker Compose |

## Key Decisions

- `assignee_ids` / `label_ids`: 정규화 join 테이블 (IssueAssignee, IssueLabel)
- Issue Status/Type: DB 테이블 (하드코딩 아님), 프로젝트 생성 시 시드
- Wiki 저장: MVP=TipTap JSON, v1.0=Yjs binary, `content_format` 컬럼으로 lazy migration
- Sort order: text 기반 fractional indexing
- 이슈 링크: MVP=클릭 가능한 링크만, v1.0=상태 뱃지
- 세션: Better Auth 기본 (DB 세션 + httpOnly cookie caching)
- CRDT 동시 편집: v1.0 (MVP는 단일 사용자 편집)
- 모듈(에픽): v1.0
- **TipTap 버전 고정**: root `package.json`의 `pnpm.overrides`로 `@tiptap/pm` +
  `@tiptap/suggestion`을 v2.27.2로 강제. v3 혼입 시 슬래시/멘션 플러그인이
  ProseMirror 스키마 공유에 실패해 런타임 깨짐.

## Wiki 모듈 현황 (2026-04-24 기준 — 마무리)

**방향 전환**: 노션 스타일 블록 기반 에디터에서 **마크다운 친화 에디터**로 범위 축소.

### 최종 포함 기능
- Phase 1 완료: 아이콘, 즐겨찾기, 최근 편집, 인라인 서브페이지, FTS 검색
- Phase 2 완료 (블록 중심 기능은 제거):
  Callout / Code / TaskList / Table + `TableToolbar` / 통합 `@` 멘션 /
  북마크(OG 스크래핑 + URL paste 자동 임베드) / 마크다운 단축키
  (`| ` → 인용, `--- ` → HR, ` ``` ` → code) / Typography /
  `/페이지 링크` 슬래시 + `PageLink` 블록 / `ConfirmDialog`
- Phase 3 — 협업/공유 (일부만):
  - ✅ 공유 링크 — `wiki_page_shares` + `/wiki-share/$token` 공개 뷰어 + `ShareModal`
  - ✅ 히스토리 — `wiki_page_revisions` + snapshot(5분 dedupe, 50개 prune) + `HistoryPanel`
  - ❌ 블록 코멘트 (방향 전환 후 제거 — 2026-04-24)
  - ⏸ Yjs 실시간 (v1.0 이후)
- 페이지 Draft(작성자 전용), 프로젝트 생성 시 자동 위키 + 양쪽 메뉴 접근,
  페이지/스페이스 삭제 UI (ConfirmDialog)

### 2026-04-24 방향 전환에서 제거된 것
- **BlockId 확장** (`data-block-id` 주입)
- **DragHandle 확장** + 블록 hover UI
- **ToggleBlock/Summary/Content** (Details NodeView)
- **블록 코멘트 전체** — 프론트 패널 + 헤더 아이콘 + BubbleMenu 버튼 제거
- **백엔드 wiki-page 코멘트 라우트/서비스 메소드/`comments.block_id` 컬럼** (migration 0015)
- `/토글` 슬래시, `> ` 마크다운 단축키

### 2026-04-24 추가 안정화
- **Placeholder `tr/td/th` ::before 차단** — IME 조합 중 테이블 행 시프트 수정
  (Placeholder 확장이 `tr`에 `is-empty` 클래스 + float-left pseudo 붙이던 문제)
- **StripTableColwidth 플러그인** — 저장된 `colwidth` attr 자동 제거 → `<colgroup>` 인라인
  width 방지 → 행 간 폭 불일치 해소
- **Table extension: `resizable: false`** + `contain: layout` CSS
- **Share 응답 정돈**: coverUrl/status 미포함, draft 재확인 로직 유지
- **페이지 삭제 시 자녀 sortOrder 재분배** — 부모로 승격될 때 기존 sibling 뒤로 재배치
- **스페이스 멤버 self-remove 방지** — 본인이 본인 빼는 lockout 방지
- **페이지 slug 생성 개선** — `page-${Date.now()}` → `pageSlug(title)` (한글 title → `page-{random}`)

## Project Structure

```
worknest/
├── apps/
│   ├── web/              # Vite + React SPA
│   ├── server/           # Fastify API
│   └── hocuspocus/       # Wiki 실시간 협업 서버
├── packages/
│   ├── shared/           # 타입, Zod 스키마, 상수
│   ├── ui/               # shadcn/ui 컴포넌트
│   ├── editor/           # TipTap 에디터 + 익스텐션
│   └── db/               # Drizzle 스키마 + 마이그레이션
├── docker-compose.yml
├── turbo.json
├── biome.json
└── pnpm-workspace.yaml
```

## Conventions

- 커밋 Author: `Luke <yjsmk0902@gmail.com>` (Co-Author 없이)
- 커밋 메시지: 영어
- 코드 주석: 영어
- 문서: 한국어
- Remote: `team` → `https://github.com/A-Team-kr/worknest.git`
