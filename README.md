# Worknest

**Fit-A-Team** 팀의 오픈소스 로컬 퍼스트 협업 플랫폼

> 실시간 채팅, 리치 텍스트 편집, 커스텀 데이터베이스, 파일 관리를 지원하는 올인원 협업 워크스페이스

## 주요 기능

- **실시간 채팅** — 팀 및 개인 간 즉각적인 메시징
- **리치 텍스트 페이지** — Notion 스타일의 직관적인 에디터로 문서, 위키, 노트 작성
- **커스텀 데이터베이스** — 테이블, 칸반, 캘린더 뷰로 구조화된 데이터 관리
- **파일 관리** — 워크스페이스 내 파일 저장, 공유, 관리

## 기술 스택

| 영역 | 기술 |
|------|------|
| **프론트엔드 (Web)** | React 19, Vite 7, TanStack Router/Query, Tailwind CSS 4, SQLite WASM |
| **프론트엔드 (Desktop)** | Electron 40, better-sqlite3 |
| **백엔드** | Fastify 5, TypeScript 5.9, PostgreSQL 17 + pgvector, Redis/Valkey |
| **실시간 동기화** | WebSocket, Yjs CRDT |
| **파일 저장소** | Local FS / S3 / GCS / Azure Blob (TUS 프로토콜) |
| **빌드** | Turborepo, npm workspaces |

## 아키텍처

```
packages/
├── core       — 공유 타입, Zod 스키마, 노드 레지스트리
├── crdt       — Yjs 기반 CRDT (충돌 없는 실시간 편집)
├── client     — 클라이언트 서비스, SQLite 스키마, 오프라인 동기화
└── ui         — React 컴포넌트 (Radix UI, TipTap 에디터)

apps/
├── server     — Fastify API 서버 (Postgres, Redis, BullMQ)
├── web        — Vite + React 웹 앱 (PWA)
├── desktop    — Electron 데스크톱 앱
└── mobile     — React Native Expo (실험적)
```

### 로컬 퍼스트

모든 데이터 조작은 로컬 SQLite에 먼저 저장되고, 백그라운드에서 서버와 동기화됩니다. 네트워크 없이도 즉시 작업 가능하며, CRDT를 통해 동시 편집 시 자동 병합됩니다.

## 로컬 개발

### 사전 요구사항

- Node.js 20+, npm 10+
- Docker (서버 의존성용)

### 설치 및 실행

```bash
# 의존성 설치 (이모지/아이콘 에셋 자동 생성)
npm install

# 서버 의존성 (Postgres, Redis, Mailpit) 실행
docker compose -f hosting/docker/docker-compose.yaml up -d

# 서버 실행
cd apps/server
cp .env.example .env
npm run dev

# 웹 앱 실행 (별도 터미널)
cd apps/web
npm run dev

# 데스크톱 앱 실행 (별도 터미널)
cd apps/desktop
npm run dev
```

## 테스트

```bash
# 전체 테스트 (Turbo)
npm run test

# 개별 패키지 테스트
cd packages/core && npm run test
cd packages/crdt && npm run test
cd packages/client && npm run test
cd apps/server && npm run test    # Docker 필요 (Testcontainers)
cd apps/web && npm run test
```

## 프로젝트 문서

- [CLAUDE.md](CLAUDE.md) — 프로젝트 아키텍처 상세 문서
- [PLAN.md](PLAN.md) — 개발 로드맵 및 실행 계획
- [CONTRIBUTING.md](CONTRIBUTING.md) — 기여 가이드

## 팀

**Fit-A-Team** — [github.com/Fit-A-Team](https://github.com/Fit-A-Team)

## 참고

이 프로젝트는 [Colanode](https://github.com/colanode/colanode) 오픈소스 프로젝트를 기반으로 개발되었습니다. 로컬 퍼스트 아키텍처, CRDT 기반 실시간 협업 등 핵심 설계를 참고하였으며, Worknest 팀의 요구사항에 맞게 확장 및 커스터마이징하고 있습니다.

## 라이선스

[Apache 2.0 License](LICENSE)
