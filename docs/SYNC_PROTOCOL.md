# Worknest 동기화 프로토콜

이 문서는 Worknest의 클라이언트-서버 간 데이터 동기화 프로토콜을 설명합니다.

---

## 개요

Worknest는 **로컬 퍼스트** 아키텍처를 사용합니다. 모든 데이터 변경은 로컬 SQLite에 먼저 저장되고, 백그라운드에서 서버와 양방향 동기화됩니다.

동기화는 두 가지 경로로 이루어집니다:

| 방향 | 메커니즘 | 용도 |
|------|----------|------|
| **Client → Server** | HTTP POST (Mutation Sync) | 로컬 변경사항을 서버에 전송 |
| **Server → Client** | WebSocket (Synchronizer) | 서버 변경사항을 클라이언트에 전달 |

---

## 1. Client → Server: Mutation 동기화

### 1.1 전체 흐름

```
User Action
    │
    ▼
┌─────────────────┐
│  Local SQLite    │  1. 즉시 로컬 DB에 저장
│  (nodes, docs)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  mutations 테이블 │  2. Mutation 레코드 생성 (pending)
└────────┬────────┘
         │
         ▼ (500ms delay, deduplicated)
┌─────────────────┐
│ MutationService  │  3. 배치 읽기 (500개씩)
│   .sync()        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ consolidate      │  4. 중복/상쇄 mutation 제거
│ Mutations()      │
└────────┬────────┘
         │
         ▼ (50개씩 배치)
┌─────────────────┐
│ HTTP POST        │  5. 서버 API 전송
│ /mutations/sync  │     POST /client/v1/workspaces/:id/mutations
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Server           │  6. 각 mutation 처리
│ handleMutation() │     → Postgres 저장
│                  │     → EventBus 발행
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Response         │  7. 결과 반환 (per mutation)
│ { results: [] }  │     status: OK(200) | CREATED(201) | ERROR
└─────────────────┘
```

### 1.2 Mutation 유형 (8가지)

| Type | 설명 |
|------|------|
| `node.create` | 노드 생성 (CRDT 초기 상태 포함) |
| `node.update` | 노드 속성 업데이트 (CRDT 바이너리 업데이트) |
| `node.delete` | 노드 삭제 |
| `document.update` | 리치 텍스트 문서 업데이트 (CRDT) |
| `node.reaction.create` | 이모지 리액션 추가 |
| `node.reaction.delete` | 이모지 리액션 삭제 |
| `node.interaction.seen` | 읽음 처리 |
| `node.interaction.opened` | 열어봄 처리 |

### 1.3 Mutation 통합 (Consolidation)

서버 전송 전에 중복/상쇄되는 mutation을 제거하여 네트워크 비용을 줄입니다.

**규칙:**

| 나중 mutation | 이전 mutation | 결과 |
|---------------|---------------|------|
| `node.delete` | `node.create` (같은 nodeId) | 둘 다 제거 |
| `node.delete` | `node.update` (같은 nodeId) | 둘 다 제거 |
| `node.delete` | `node.delete` (같은 nodeId) | 이전 것 제거 |
| `node.delete` | `document.update` (documentId === nodeId) | 이전 것 제거 |
| `node.delete` | `node.reaction.*` (같은 nodeId) | 이전 것 제거 |
| `node.delete` | `node.interaction.*` (같은 nodeId) | 이전 것 제거 |
| `node.reaction.delete` | `node.reaction.create` (같은 nodeId + reaction) | 둘 다 제거 |
| `node.reaction.delete` | `node.reaction.delete` (같은 nodeId + reaction) | 이전 것 제거 |
| `node.interaction.seen` | `node.interaction.seen` (같은 nodeId) | 이전 것 제거 |
| `node.interaction.opened` | `node.interaction.opened` (같은 nodeId) | 이전 것 제거 |

### 1.4 실패 처리

- 서버 응답에서 `status !== OK/CREATED`인 mutation은 **retries 카운터 +1**
- **10회 이상 실패** 시 해당 mutation을 로컬에서 **revert** (되돌리기)
  - `node.create` → 로컬 노드 삭제
  - `node.update` → CRDT 상태 롤백
  - `node.delete` → 로컬 노드 복구
  - `document.update` → 문서 CRDT 롤백
  - `node.reaction.create/delete` → 로컬 리액션 되돌리기
- 서버 연결 불가 시 다음 sync까지 대기 (재시도 없음)

---

## 2. Server → Client: Synchronizer 프로토콜

### 2.1 전체 흐름

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client     │         │   WebSocket   │         │   Server     │
│ Synchronizer │         │  Connection   │         │ Synchronizer │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘
       │                       │                        │
       │  synchronizer.input   │                        │
       │  {id, cursor, input}  │                        │
       ├──────────────────────►│  synchronizer.input    │
       │                       ├───────────────────────►│
       │                       │                        │
       │                       │   fetchData()          │
       │                       │   SELECT ... WHERE     │
       │                       │   revision > cursor    │
       │                       │   LIMIT 100            │
       │                       │                        │
       │                       │  ┌──── 데이터 있음 ────┐│
       │                       │  │                     ││
       │  synchronizer.output  │  │ 즉시 응답           ││
       │  {id, items, cursor}  │◄─┤                     ││
       │◄──────────────────────│  └─────────────────────┘│
       │                       │                        │
       │  process items        │                        │
       │  save cursor          │                        │
       │                       │                        │
       │  synchronizer.input   │  ┌── 데이터 없음 ──┐   │
       │  {id, cursor(new)}    │  │                  │   │
       ├──────────────────────►│  │ 대기 (이벤트     │   │
       │                       │  │  발생까지)       │   │
       │                       │  └──────────────────┘   │
       │                       │                        │
       │                       │         Event 발생      │
       │                       │  (EventBus에서 수신)    │
       │                       │                        │
       │                       │   fetchDataFromEvent() │
       │                       │◄───────────────────────│
       │  synchronizer.output  │                        │
       │◄──────────────────────│                        │
       │                       │                        │
```

### 2.2 Synchronizer 유형 (7가지)

**글로벌 (워크스페이스 단위):**

| Type | 데이터 | 커서 키 |
|------|--------|---------|
| `users` | 사용자 목록 변경 | `users` |
| `collaborations` | 접근 권한 변경 | `collaborations` |

**루트 노드 단위 (Space별):**

| Type | 데이터 | 커서 키 |
|------|--------|---------|
| `node.updates` | 노드 CRDT 업데이트 | `{rootId}.node.updates` |
| `document.updates` | 문서 CRDT 업데이트 | `{rootId}.document.updates` |
| `node.reactions` | 이모지 리액션 | `{rootId}.node.reactions` |
| `node.interactions` | 읽음/열어봄 추적 | `{rootId}.node.interactions` |
| `node.tombstones` | 삭제된 노드 | `{rootId}.node.tombstones` |

### 2.3 커서 기반 증분 동기화

- 각 synchronizer는 **커서(revision 번호)** 를 로컬 `cursors` 테이블에 저장
- 서버에 요청 시 `cursor` 값을 전송 → 서버는 `revision > cursor`인 데이터만 반환
- 최대 **100건** 씩 배치 반환
- 클라이언트는 수신한 마지막 item의 cursor를 저장하고 다음 요청에 사용

```
초기 상태: cursor = "0"
    │
    ▼
요청: { cursor: "0" }
응답: { items: [{cursor: "15", data: ...}, {cursor: "23", data: ...}] }
    │
    ▼
처리 후: cursor = "23" (로컬 저장)
    │
    ▼
요청: { cursor: "23" }
응답: { items: [] }  → 대기 모드 진입
    │
    ▼
이벤트 발생 → 서버가 자동 응답
응답: { items: [{cursor: "24", data: ...}] }
    │
    ▼
처리 후: cursor = "24"
```

### 2.4 Synchronizer 생명주기

```
┌───────────────────────────────────────────────────┐
│                 Synchronizer 상태                  │
│                                                   │
│   idle ──► waiting ──► processing ──► idle         │
│    │         │                         │           │
│    │    (서버 응답 대기)    (items 처리)   │           │
│    │                                   │           │
│    └───────────────────────────────────┘           │
│    (초기 1초 후 ping, 이후 1분 간격 반복)              │
└───────────────────────────────────────────────────┘

이벤트 구독:
  - connection.opened  → ping 트리거 (재연결)
  - connection.closed  → event loop 중지
  - message.received   → sync 처리
```

### 2.5 SyncService 초기화 순서

```
SyncService.init()
    │
    ├── 1. UserSynchronizer 생성 + init
    │
    ├── 2. CollaborationSynchronizer 생성 + init
    │
    └── 3. 각 collaboration(rootId)마다:
            ├── NodeUpdatesSynchronizer
            ├── DocumentUpdatesSynchronizer
            ├── NodeReactionsSynchronizer
            ├── NodeInteractionsSynchronizer
            └── NodeTombstonesSynchronizer
            (5개를 Promise.all로 병렬 init)
```

새 collaboration이 생성되면 해당 rootId의 synchronizer 그룹이 동적으로 추가됩니다.

---

## 3. WebSocket 연결

### 3.1 연결 수립

```
Client                          Server
  │                               │
  │  POST /sockets/init           │
  │  (Bearer token)               │
  ├──────────────────────────────►│
  │                               │  SocketContext 생성
  │  { socketId: "sk..." }        │  Redis에 저장 (60초 TTL)
  │◄──────────────────────────────│
  │                               │
  │  WS /sockets/{socketId}       │
  ├──────────────────────────────►│
  │                               │  Redis에서 context 조회
  │                               │  기존 연결 있으면 교체
  │  connection established       │  SocketConnection 생성
  │◄─────────────────────────────►│
  │                               │
```

### 3.2 기기당 단일 연결

- 같은 deviceId로 새 연결이 들어오면 이전 연결은 **자동 종료**
- Socket context는 Redis에 60초 TTL로 저장 (init → connect 사이 유효시간)
- 연결 후 Redis에서 context 삭제 (일회용)

### 3.3 서버 측 이벤트 브로드캐스트

```
Mutation 처리 or DB 변경
    │
    ▼
EventBus.publish(event)
    │
    ├── 로컬 구독자 알림 (같은 프로세스)
    │
    └── Redis pub/sub 발행 (다른 서버 인스턴스)
            │
            ▼
        다른 서버 인스턴스의 EventBus
            │
            ▼
        SocketConnection.handleEvent(event)
            │
            ├── 이벤트 타입별 처리 (account, workspace, collaboration, user)
            │
            └── 각 synchronizer에 fetchDataFromEvent() 호출
                    │
                    ├── 관련 데이터 있으면 → synchronizer.output 전송
                    └── 관련 없으면 → 무시
```

**분산 모드** (`config.mode !== 'standalone'`):

- 이벤트가 Redis pub/sub으로 다른 서버 인스턴스에 전파
- `hostId`로 자기 자신이 발행한 이벤트는 무시 (중복 방지)

---

## 4. CRDT 상태 관리

### 4.1 클라이언트 저장소 계층

```
┌─────────────────────────────────────────────┐
│                   nodes 테이블                │
│  현재 상태 (JSON) — UI 렌더링용               │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│              node_states 테이블              │
│  병합된 CRDT 상태 (Uint8Array)               │
│  — 모든 동기화된 업데이트가 병합된 스냅샷      │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│             node_updates 테이블              │
│  개별 CRDT 업데이트 (Uint8Array)             │
│  — 아직 서버에 동기화되지 않은 로컬 변경      │
│  — 동기화 완료 시 node_states에 병합 후 삭제  │
└─────────────────────────────────────────────┘
```

### 4.2 서버 저장소

```
┌─────────────────────────────────────────────┐
│               nodes 테이블 (Postgres)        │
│  현재 상태 (JSONB)                           │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│           node_updates 테이블 (Postgres)     │
│  CRDT 업데이트 히스토리 (bytea)              │
│  — 각 업데이트는 revision 번호를 가짐         │
│  — 백그라운드 잡이 오래된 업데이트를 주기적 병합│
└─────────────────────────────────────────────┘
```

---

## 5. 재연결 및 오프라인 처리

### 5.1 오프라인 동작

1. 사용자가 오프라인 상태에서 변경 → 로컬 SQLite에 저장
2. `mutations` 테이블에 pending mutation 누적
3. 서버 연결 불가 시 `MutationService.sendMutations()`가 `false` 반환하고 종료
4. 온라인 복귀 시 `mutations.sync` 잡이 재스케줄되어 누적된 mutation 일괄 전송

### 5.2 WebSocket 재연결

1. `connection.closed` 이벤트 → 모든 synchronizer의 event loop 중지
2. `connection.opened` 이벤트 → event loop 트리거
3. 각 synchronizer가 저장된 커서부터 `synchronizer.input` 재전송
4. 서버가 커서 이후의 데이터를 응답 → 클라이언트가 누락된 데이터를 따라잡음

### 5.3 데이터 일관성 보장

- **CRDT (Yjs)**: 순서에 관계없이 모든 업데이트가 동일한 최종 상태로 수렴
- **커서 기반 동기화**: 누락 없이 모든 변경사항을 순서대로 수신
- **Mutation 통합**: 불필요한 중간 상태 전송을 제거하여 효율성 보장
- **Revert 메커니즘**: 영구 실패 시 로컬 상태를 안전하게 되돌림

---

## 6. 주요 파일 참조

| 파일 | 역할 |
|------|------|
| `packages/client/src/services/workspaces/mutation-service.ts` | Mutation 배치 전송 및 통합 |
| `packages/client/src/lib/consolidate-mutations.ts` | Mutation 통합 로직 (순수 함수) |
| `packages/client/src/services/workspaces/synchronizer.ts` | 클라이언트 Synchronizer 클래스 |
| `packages/client/src/services/workspaces/sync-service.ts` | Synchronizer 관리 (생성/소멸) |
| `apps/server/src/services/socket-service.ts` | WebSocket 연결 관리 |
| `apps/server/src/services/socket-connection.ts` | WebSocket 메시지/이벤트 처리 |
| `apps/server/src/synchronizers/base.ts` | 서버 Synchronizer 베이스 클래스 |
| `apps/server/src/synchronizers/node-updates.ts` | 노드 업데이트 동기화 (예시) |
| `apps/server/src/lib/event-bus.ts` | 서버 이벤트 버스 (Redis pub/sub) |
| `apps/server/src/api/client/routes/workspaces/mutations/mutations-sync.ts` | Mutation 수신 API |
