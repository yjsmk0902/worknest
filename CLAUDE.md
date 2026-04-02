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
