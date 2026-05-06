# 로컬 테스트 체크리스트 — 2026-04-29

배포 전 검증용 체크리스트. 마이그레이션 0012~0017 + 이슈 P0 4건 + CSV + 위키 P1 5건이
이번 사이클에서 추가된 변경입니다.

우선순위는 **P0 회귀 위험 큼 → P2 부가 확인** 순.

## 사전 준비

```bash
docker compose up -d           # postgres + redis + mailpit
pnpm dev                       # web + server 한 번에
```

> 서버 부팅 시 `runMigrations()`가 0012~0017까지 자동 적용. 별도 명령 불필요.
> 첫 부팅 로그에 `[migrate] All migrations applied successfully.` 가 있는지 확인.

---

## P0 — 이슈 트랙 (이번 사이클 핵심)

### 1. 이슈 복제 (POST `/issues/:id/duplicate`)
- [ ] 상세 패널 헤더 우측 ⋯ → "복제" 버튼 노출
- [ ] 복제 후 새 이슈가 **같은 프로젝트, 같은 상태/우선순위/담당자/라벨**로 생성
- [ ] 제목은 `(복사)` 접미사 또는 명시 prefix 붙는지 확인
- [ ] 첨부/코멘트/링크는 **복사되지 않는** 것이 정상
- [ ] start_date/due_date/estimate 등 일자성 필드도 복사

### 2. 보드 그룹 전환 (kanban-board.tsx)
- [ ] 보드 상단에서 그룹 기준을 **상태 / 우선순위 / 담당자 / 라벨**로 전환
- [ ] 각 모드에서 컬럼이 정확히 재구성됨 (예: 우선순위 모드 = `urgent/high/medium/low/none`)
- [ ] **DnD로 컬럼 간 이동 시**
  - 상태 모드: 상태가 변경 (`PATCH issues/:id` with `statusId`)
  - 우선순위 모드: priority 변경
  - 담당자 모드: 단일 PATCH로 `assigneeIds` 교체 (drop된 컬럼의 멤버 1명으로)
  - 라벨 모드: 단일 PATCH로 `labelIds` 교체
- [ ] 미배정/미라벨 컬럼이 별도로 존재 + 그쪽으로 drop 시 해당 필드 비워짐
- [ ] 다른 모드 전환 후 다시 돌아왔을 때 상태가 정확히 복원

### 3. 간트 바 드래그 (gantt-chart.tsx)
- [ ] **좌측 엣지 드래그** → `start_date`만 변경 (마감일 고정)
- [ ] **우측 엣지 드래그** → `due_date`만 변경 (시작일 고정)
- [ ] **바 중앙 드래그** → 시작일/마감일 **동시 이동** (기간 유지)
- [ ] start ≥ due 가 되는 드래그는 거부 (또는 자동 클램프)
- [ ] 드래그 종료 시 단일 PATCH 요청 (드래그 중 매 프레임 요청 X)
- [ ] 마우스 떼기 전 esc 누르면 원위치로 돌아감

### 4. 이슈 의존성 (`issue_relations` migration 0016)
- [ ] 상세 패널 하단 "의존성" 섹션 표시
- [ ] **추가**: blocks / relates_to 타입 + 대상 이슈 검색 → 추가 가능
- [ ] **삭제**: 휴지통 → DELETE `/relations/:relationId`
- [ ] 양방향 표시: A에 "B를 차단" 추가 → B 상세에 "A에 의해 차단됨"이 보이는지
- [ ] **순환 참조 차단**: A→B blocks 있는 상태에서 B→A blocks 추가 시도 → 400 + 토스트
- [ ] 자기 자신 추가 시도 → 400
- [ ] 다른 프로젝트 이슈 검색은 결과에 안 나오는지

### 5. CSV 가져오기/내보내기 (`csv-modal.tsx` + `issue-csv-service.ts`)

#### 내보내기
- [ ] 이슈 리스트 헤더 "CSV 내보내기" → `issues-{projectId}.csv` 다운로드
- [ ] **현재 적용된 필터/정렬 그대로** 반영되는지 (assignee/label/status/priority 필터 적용 후 export)
- [ ] 컬럼: key, title, status, priority, assignees, labels, startDate, dueDate (정확한 헤더 확인)
- [ ] UTF-8 BOM 또는 `; sep=,` 설정으로 Excel 한글 깨짐 없는지

#### 가져오기
- [ ] "CSV 가져오기" → 모달 열림
- [ ] 파일 업로드 → **미리보기** 테이블 (처음 몇 행)
- [ ] 미존재 라벨이 행에 있으면 **자동 생성** (가져오기 후 라벨 목록 확인)
- [ ] 잘못된 헤더(예: `priority`만 누락)는 미리보기 단계에서 경고
- [ ] 가져오기 후 새 이슈가 정확한 필드로 생성됨
- [ ] 같은 파일 두 번 import 시 중복 생성 (의도적 — dedupe 안 함이 맞는지 확인)

---

## P0 — 위키 트랙 (마무리 P1 회귀)

### 6. 권한 tier 문서화 / content_format 정책
- [ ] 스페이스 멤버 추가 시 role은 `editor | viewer` 둘만 노출
- [ ] 위키 페이지 저장 시 `content_format` 값이 항상 `'json'`
  - 추후 `'yjs'` 사용 안 함 — DB에서 `SELECT DISTINCT content_format FROM wiki_pages` → `json` 단일

### 7. 제목 Enter → 본문 포커스 (querySelector 제거)
- [ ] 페이지 제목에서 Enter → **에디터 첫 줄로 포커스 이동**
- [ ] 페이지 컴포넌트 새로고침 직후에도 동작 (editorRef 마운트 타이밍 검증)
- [ ] 한글 IME 조합 중 Enter는 입력 확정으로만 처리 (포커스 이동 X)

### 8. Slug 통일 (slugifyTitle)
- [ ] 한글 스페이스 이름 입력 → slug 자동 생성 (`space-{random}` 형태 가능)
- [ ] 영문 이름 → kebab-case
- [ ] 같은 워크스페이스에 같은 slug 충돌 시 처리 확인

### 9. files XOR (migration 0017)
- [ ] 위키 페이지 첨부 업로드 OK
- [ ] 이슈 첨부 업로드 OK
- [ ] **DB 직접 삽입 시도** (`INSERT INTO files (issue_id, page_id) VALUES ('x', 'y')`) → CHECK 위반 에러
  - 또는: API 경로에서는 발생할 수 없는지만 코드 리뷰로 확인 후 skip

---

## P1 — 위키 회귀 (이전 사이클에서 완료된 것 재확인)

### 공유 링크 (Phase 3-3)
- [ ] 페이지 헤더 Share2 → 링크 생성 → 시크릿 창에 붙여넣기 → 로그인 없이 페이지 보임
- [ ] 모달에서 해제 → 시크릿 창 새로고침 → 404 페이지
- [ ] Draft 페이지 공유 시도 → 공개 뷰어에서 404 (draft는 공유 불가)
- [ ] 공유 페이지에서 편집 시도 → 읽기 전용

### 페이지 히스토리 (Phase 3-4)
- [ ] 내용 수정 → 자동 저장 → 히스토리 패널에 리비전 추가
- [ ] 5분 이내 같은 사용자 재수정 → **새 리비전 생성 안 되고 in-place update** (dedupe)
- [ ] 과거 버전 선택 → "이 버전으로 복원" → 페이지 내용 변경
- [ ] 복원 직후 히스토리 다시 열면 **복원 직전 상태도 스냅샷**으로 남음

### 에디터 코어 (방향 전환 후 안정성)
- [ ] `/` 슬래시 → 모든 커맨드 (Callout / Code / Table / TaskList / 페이지 링크 / 북마크 / HR)
- [ ] `@` 멘션 (멤버 amber / 페이지 blue / 이슈 emerald) — 키보드 네비게이션 OK
- [ ] `#ISSUE-NN` 자동 링크
- [ ] URL paste → 빈 줄에서는 북마크 카드, 본문 중간에는 링크
- [ ] 마크다운 단축키: `| ` → 인용, `--- ` → HR, ` ``` ` → code

### 테이블 (Placeholder pseudo + colwidth strip)
- [ ] 테이블 셀에 한글 IME 입력 중에도 **행 시프트 없음**
- [ ] 셀 추가/삭제 시 컬럼 폭이 균일
- [ ] 페이지 새로고침 후 저장된 테이블 폭이 인라인 width로 안 박혀있는지

### 페이지 트리 / 삭제
- [ ] 페이지 삭제 시 ConfirmDialog (window.confirm 아님)
- [ ] 자녀 있는 페이지 삭제 → 자녀가 부모로 승격되고 sortOrder 재분배
- [ ] 스페이스 본인 self-remove 방지

---

## P0 — 이슈 템플릿 (이번 사이클 신규)

### 10. 이슈 템플릿 CRUD (프로젝트 설정 > 이슈 템플릿)
- [ ] 신규 프로젝트 생성 시 기본 3종(버그 리포트 / 기능 요청 / 작업) 자동 생성
- [ ] 템플릿 추가 → 이름 중복 시 409 안내
- [ ] 템플릿 수정 → 이름·우선순위·타입·라벨·본문·제목 프리픽스 반영
- [ ] 본문이 서식이 있는 경우 텍스트 편집 시 경고 문구 노출
- [ ] 템플릿 삭제 → 기존 이슈에는 영향 없음
- [ ] 일반 멤버(non-member) 접근 시 403

### 11. Quick Add 템플릿 적용 (`apps/web/src/components/issues/quick-add.tsx`)
- [ ] 템플릿 선택 → 제목에 프리픽스 prefill, 커서가 끝으로 이동
- [ ] 빈 제목 + 템플릿만 적용 → Enter로 생성 시 템플릿 본문/우선순위/타입/라벨이 이슈에 반영
- [ ] 적용 해제 → state 초기화
- [ ] 템플릿 dropdown blur로 Quick Add가 닫히지 않는지

### 백필 스크립트 (이슈 템플릿)
```bash
pnpm --filter @worknest/server tsx scripts/backfill-issue-templates.ts --dry-run
pnpm --filter @worknest/server tsx scripts/backfill-issue-templates.ts
```
- [ ] dry-run 시 누락 프로젝트 수와 inserted 개수 확인
- [ ] 본 실행 후 사전 프로젝트의 설정 화면에서 기본 3종 노출
- [ ] 재실행 시 `alreadyHasAll` 카운트만 증가 (멱등성)

---

## P2 — 보조 / 스크립트 / 보안 스모크

### 백필 스크립트
```bash
pnpm --filter @worknest/server tsx scripts/backfill-project-wikis.ts --dry-run
```
- [ ] dry-run 결과로 대상 프로젝트 수 확인
- [ ] 본 실행 후 사이드바 위키 메뉴에 신규 위키 노출

### 보안 스모크
- [ ] 다른 워크스페이스의 이슈 id로 `POST /issues/:id/duplicate` → **403/404**
- [ ] 다른 프로젝트 이슈 id로 `POST /issues/:id/relations` → **403/404**
- [ ] 만료/해제된 토큰으로 `GET /wiki-share/:token` → **404**
- [ ] CSV 가져오기에서 다른 프로젝트의 statusId 들어간 행 → 거부 또는 매핑 실패 처리

### 알림 회귀 (이전 사이클)
- [ ] 이슈 담당자 변경 → 새 담당자에게 알림
- [ ] 코멘트 작성 → 이슈 참여자에게 알림
- [ ] @멘션 → 멘션된 사용자에게 알림 (중복 안 됨 확인)
- [ ] 알림 벨 → 읽음 처리 → 카운트 0

---

## 특히 불안한 부분 (발견하면 바로 제보)

1. **간트 드래그 중 매 프레임 PATCH** — 네트워크 탭에서 드래그 중 요청 수가 1개여야 함 (mouseup 시점)
2. **보드 그룹 전환 시 React 키 충돌** — 같은 이슈가 두 컬럼에 잠깐 보이는 깜빡임 있는지
3. **이슈 의존성 순환 참조 CTE** — 깊이 5+ 체인에서도 정확히 차단되는지
4. **CSV import 인코딩** — Excel 한글 export → import 왕복에서 깨짐 없는지
5. **마이그레이션 0014→0015 멱등성** — 0014로 추가됐다가 0015로 제거된 컬럼이 dev DB에서 깨끗이 정리되는지
6. **`/wiki-share/$token` 공개 페이지에 커스텀 CSS 변수(`--bg-0` 등)가 로드되는지** — `_app` 바깥이라 스타일이 안 먹힐 가능성

---

## 이슈 재현 노트 공간

테스트 중 발견한 버그는 여기에 적어두면 다음 세션에 바로 fix 진행 가능:

- [ ] 버그 #1:
- [ ] 버그 #2:
- [ ] 버그 #3:
