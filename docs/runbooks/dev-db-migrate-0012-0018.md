# Dev DB 마이그레이션 적용 (0012 → 0018)

> 대상: dev 환경 (gcloud Cloud SQL Postgres). 운영 적용은 별도 사이클.
> 작성: 2026-05-07.
> 참조: `PLAN.md` Part C §1 배포 체크리스트.

이번 사이클에서 추가된 마이그레이션 7개를 dev DB에 적용한다.
서버 부팅 시 `runMigrations(db)`가 자동 실행되므로, **새 서버 이미지를 배포하기만 하면**
Drizzle migrator가 `__drizzle_migrations` 테이블을 보고 미적용분만 순차 실행한다.

## 적용될 마이그레이션

| # | 파일 | 효과 |
|---|------|------|
| 0012 | `wiki_page_shares.sql` | 위키 공개 링크 테이블 (CREATE) |
| 0013 | `wiki_page_revisions.sql` | 위키 페이지 히스토리 (CREATE) |
| 0014 | `comment_block_id.sql` | `comments.block_id` 컬럼 추가 |
| 0015 | `drop_comment_block_id.sql` | 0014 컬럼/인덱스 제거 (방향 전환) |
| 0016 | `issue_relations.sql` | 이슈 의존성 테이블 (CREATE + CHECK) |
| 0017 | `files_at_most_one_parent.sql` | `files.issue_id`/`page_id` XOR CHECK |
| 0018 | `issue_templates.sql` | 이슈 템플릿 테이블 (CREATE + UNIQUE) |

> 0014→0015는 컬럼 추가→제거 묶음. 데이터 이전 없음 (블록 코멘트 기능이 dev에
> 도달한 적 없음). 두 마이그레이션 모두 멱등.

## 사전 점검

```bash
# 1. 현재 dev DB가 어디까지 적용됐는지 확인 (서버 SSH 후)
psql "$DATABASE_URL" -c \
  "SELECT hash, created_at FROM __drizzle_migrations ORDER BY id DESC LIMIT 10;"

# 2. 0011까지만 보이면 정상 (0012~0018이 신규 적용 대상)
```

## 적용 절차

### 옵션 A — 서버 이미지 배포 (권장)

```bash
# 새 server 컨테이너 부팅 시 자동 실행됨
# 부팅 로그에서 다음 메시지 확인:
#   [migrate] Running pending migrations...
#   [migrate] All migrations applied successfully.
```

### 옵션 B — 수동 실행 (롤아웃 전 dry-run)

```bash
# 서버 디렉토리에서
pnpm --filter @worknest/server tsx -e '
import { createDb } from "@worknest/db";
import { runMigrations } from "@worknest/db/migrate";
const { db, client } = createDb();
await runMigrations(db);
await client.end();
'
```

## 적용 후 확인

```bash
psql "$DATABASE_URL" <<'SQL'
-- 1. 새 테이블 4개 존재 확인
SELECT tablename FROM pg_tables
WHERE tablename IN (
  'wiki_page_shares', 'wiki_page_revisions',
  'issue_relations', 'issue_templates'
)
ORDER BY tablename;

-- 2. comments.block_id 컬럼 부재 확인 (0015로 제거됨)
SELECT column_name FROM information_schema.columns
WHERE table_name = 'comments' AND column_name = 'block_id';
-- → 0행이어야 정상

-- 3. files CHECK 제약 확인
SELECT conname FROM pg_constraint WHERE conname = 'files_one_parent_check';
-- → 1행이어야 정상

-- 4. issue_templates priority CHECK 확인
SELECT conname FROM pg_constraint WHERE conname = 'issue_templates_priority_check';
SQL
```

## 후속 작업 (적용 직후)

### 1. 위키 백필 (기존 프로젝트 → 자동 위키 생성)

```bash
pnpm --filter @worknest/server tsx scripts/backfill-project-wikis.ts --dry-run
pnpm --filter @worknest/server tsx scripts/backfill-project-wikis.ts
```

### 2. 이슈 템플릿 백필 (기존 프로젝트 → 기본 3종 시드)

```bash
pnpm --filter @worknest/server tsx scripts/backfill-issue-templates.ts --dry-run
# dry-run 결과에서 inserted=N, alreadyHasAll=M 확인 후 실행
pnpm --filter @worknest/server tsx scripts/backfill-issue-templates.ts
```

> 두 스크립트 모두 멱등 (이미 시드된 프로젝트는 `alreadyHasAll`로 분류).

## 롤백 시나리오

각 마이그레이션은 `__drizzle_migrations` 테이블에 기록된다. 롤백이 필요하면
다음 순서로 수동 처리 (Drizzle은 자동 down 미지원):

```sql
-- 0018 롤백
DROP INDEX IF EXISTS issue_templates_project_id_idx;
DROP INDEX IF EXISTS issue_templates_project_name_unique;
DROP TABLE IF EXISTS issue_templates;

-- 0017 롤백
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_one_parent_check;

-- 0016 롤백
DROP INDEX IF EXISTS issue_relations_target_idx;
DROP INDEX IF EXISTS issue_relations_source_idx;
DROP INDEX IF EXISTS issue_relations_unique;
DROP TABLE IF EXISTS issue_relations;

-- 0015/0014 롤백 (현재 상태가 컬럼 없음 → 다시 추가)
-- 일반적으로 롤백 불필요. 원래 컬럼 자체를 안 쓰는 상태로 정착.

-- 0013 롤백
DROP TABLE IF EXISTS wiki_page_revisions;

-- 0012 롤백
DROP TABLE IF EXISTS wiki_page_shares;

-- 마지막으로 트래킹 행 제거 (적용 행 N개 삭제)
DELETE FROM __drizzle_migrations
WHERE id IN (
  SELECT id FROM __drizzle_migrations ORDER BY id DESC LIMIT 7
);
```

> 롤백 시 데이터 손실 가능: `wiki_page_shares` / `wiki_page_revisions` /
> `issue_relations` / `issue_templates`의 모든 행이 사라진다. 운영 전이라
> 일반적으로 무관하지만 실행 전 한 번 더 확인.

## 위험 요소 / 주의

- **0017 CHECK 위반 가능성**: dev DB에 이미 `issue_id`와 `page_id`가 동시에
  설정된 `files` 행이 있으면 적용 실패. 사전 점검 쿼리:
  ```sql
  SELECT id FROM files
  WHERE issue_id IS NOT NULL AND page_id IS NOT NULL;
  ```
  결과 0행이면 안전.
- **0018은 `issue_types` 참조**: `type_id` FK는 SET NULL이라 타입 삭제 시 무난.
  단, 백필 스크립트는 type 이름(`버그`/`스토리`/`작업`)으로 매핑하므로
  프로젝트마다 해당 이름의 타입이 있어야 typeId가 비지 않음.
- **트랜잭션 경계**: Drizzle migrator는 각 마이그레이션을 별도 트랜잭션으로 실행.
  중간 실패 시 그 마이그레이션만 롤백되고 이전은 커밋된 상태로 남음.
