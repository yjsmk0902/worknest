# PLAN.md

Worknest 프로젝트의 당면 과제와 실행 계획을 정리합니다.

---

## P0: 즉시 해결 (Critical)

### 1. 테스트 커버리지 확대

현재 상태: 1,117개 소스 파일 중 테스트 파일 16개 (~1.4%). `apps/server`와 `apps/web`만 테스트 존재.

**해야 할 것:**

- [x] **`packages/core` 테스트 추가** — ID 생성, 권한 체크, 텍스트 추출, 멘션 추출, 노드 유틸리티, 레지스트리 모델 테스트
  - 파일: `test/lib/id.test.ts`, `test/lib/permissions.test.ts`, `test/lib/texts.test.ts`, `test/lib/mentions.test.ts`, `test/lib/nodes.test.ts`, `test/registry/node-models.test.ts`

- [x] **`packages/crdt` 테스트 추가** — YDoc CRUD, 텍스트 필드, 중첩 객체/레코드, 배열, 상태 관리, undo/redo, 동시 편집 충돌 해결, 인코딩 유틸리티 테스트
  - 파일: `test/ydoc.test.ts`

- [x] **`packages/client` 테스트 추가** — mutation consolidation 로직을 순수 함수로 추출 후 테스트. node.delete 통합, 리액션 상쇄, 인터랙션 중복 제거, 순서 보존 테스트
  - 파일: `src/lib/consolidate-mutations.ts` (추출), `test/consolidate-mutations.test.ts`
  - 버그 수정: `document.update` 삭제 시 nodeId 범위 체크 없이 모든 document.update를 삭제하던 버그 수정

### 2. 미완성 코드 완료

- [x] **Avatar Upload 구현** — URL에서 이미지 fetch → File 변환 → temp 저장 → avatar.upload mutation 호출. 이중 제출 방지(`isLoading` 상태) 추가.
- [x] **Database 유틸리티 구현** — `isFilterableField`: `file`과 `rollup` 타입만 필터링 불가로 판정 (실제 filter 컴포넌트 존재 여부 기반)
- [x] **Validation 에러 상세 반환** — Zod validation 에러에서 필드별 상세 메시지 추출. `apiErrorOutputSchema`에 `fields` 옵셔널 필드 추가. 방어적 null 체크 포함.

### 3. 문서 업데이트

- [x] **CONTRIBUTING.md 수정** — 테스트 존재 사실 반영, 각 패키지별 테스트 실행 방법 문서화, 기여 시 테스트 작성 가이드 추가.

---

## P1: 단기 과제 (1-2 Sprints)

### 4. Server API 문서화

- [ ] **OpenAPI/Swagger 스펙 생성** — Fastify + Zod 조합이므로 `fastify-swagger`와 `fastify-swagger-ui` 플러그인으로 자동 생성 가능
  - 외부 기여자와 프론트엔드 개발 시 API 인터페이스 명세가 없으면 비효율적
  - 현재는 코드를 직접 읽어야 API 스펙을 알 수 있음

### 5. 동기화 프로토콜 문서화

- [ ] **Sync Protocol 문서** 작성 — Mutation → Server → WebSocket → Synchronizer 전체 흐름을 시퀀스 다이어그램으로 정리
  - 커서 기반 동기화, 재연결 로직, 에러 핸들링 포함
  - 새 기여자가 가장 이해하기 어려운 부분

### 6. Error Handling 일관성

- [ ] **에러 코드 체계 정리** — `ApiErrorCode` enum 검토 및 클라이언트 측 에러 핸들링 통합
- [ ] **클라이언트 에러 바운더리** — Desktop/Mobile 앱에 React Error Boundary 추가

---

## P2: 중기 과제 (다음 분기)

### 7. AI/Embeddings 기능 복원

- [ ] **AI 기능 로드맵 결정** — LangChain 의존성 제거됨 (#281), 하지만 pgvector 테이블과 job 인프라는 남아있음
  - 임베딩 생성, 시맨틱 검색, AI 어시스턴트 기능의 방향성 결정 필요
  - 제거할 것인지 대체 구현할 것인지 결정

### 8. Mobile 앱 안정화

- [ ] **WebView 브리지 안정화** — 네이티브 ↔ WebView 메시지 프로토콜 에러 핸들링 강화
- [ ] **네이티브 기능 확장** — 푸시 알림, 백그라운드 동기화
- [ ] **성능 최적화** — WebView 기반이므로 메모리/렌더링 성능 프로파일링

### 9. 성능 테스트

- [ ] **대규모 워크스페이스 부하 테스트** — 다수 노드, 동시 편집, 대용량 CRDT 문서
- [ ] **동기화 성능 벤치마크** — 많은 pending mutations, 느린 네트워크 조건에서의 동작 확인
- [ ] **메모리 프로파일링** — synchronizer per root node 메모리 압박 측정

### 10. Database Schema 문서화

- [ ] **Server Postgres 스키마** — ER 다이어그램 생성 (33개 마이그레이션 누적)
- [ ] **Client SQLite 스키마** — App DB + Workspace DB 구조 다이어그램

---

## P3: 장기 개선 (Backlog)

### 11. `packages/ui` 테스트

- [ ] 주요 공유 컴포넌트 (Button, Dialog, Editor 등) 스냅샷/인터랙션 테스트
- [ ] TipTap 에디터 커스텀 익스텐션 테스트

### 12. E2E 테스트 인프라

- [ ] Playwright 기반 E2E 테스트 환경 구축
- [ ] 핵심 사용자 시나리오 (회원가입 → 워크스페이스 생성 → 문서 편집 → 실시간 동기화) 테스트

### 13. Desktop 앱 테스트

- [ ] Electron main process 유닛 테스트
- [ ] IPC 통신 테스트
- [ ] 자동 업데이트 로직 테스트

---

## 참고: 최근 개발 동향 (git log 기반)

최근 30개 커밋의 주요 방향:
- **테스트 인프라 구축** — Vitest 하네스, 서버 통합 테스트, 웹 테스트 셋업 (#302, #313, #328)
- **이메일 알림** — 워크스페이스 초대 이메일 (#321)
- **패키지 업데이트** — 의존성 최신화 (#311, #322)
- **버그 수정** — undo/redo (#314), 내부 링크 (#315), OTP 파싱 (#292), 워크스페이스 업데이트 (#310)
- **서버 설정 개선** — 설정 시스템 (#284), nginx SPA 모드 (#319), 앱 정보 (#320)
- **사이드바 노드 트리** — (#280)
- **모바일 관련** — 다수 커밋 (WebView, 보안, UI)
- **AI 코드 비활성화** — LangChain 제거 (#281)
