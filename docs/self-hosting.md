# Worknest 셀프 호스팅 가이드

이 문서는 Worknest를 직접 서버에 배포하여 운영하는 방법을 설명합니다.

---

## 목차

1. [사전 요구사항](#1-사전-요구사항)
2. [빠른 시작](#2-빠른-시작)
3. [환경 변수 설명](#3-환경-변수-설명)
4. [서비스 구성](#4-서비스-구성)
5. [백업 & 복원](#5-백업--복원)
6. [업그레이드 절차](#6-업그레이드-절차)
7. [트러블슈팅](#7-트러블슈팅)

---

## 1. 사전 요구사항

### 소프트웨어

| 항목 | 최소 버전 |
|------|----------|
| Docker Engine | 24.0+ |
| Docker Compose | v2.20+ (docker compose CLI 플러그인) |
| Git | 2.30+ |

### 하드웨어 (최소 사양)

| 항목 | 권장 사양 |
|------|----------|
| CPU | 2코어 이상 |
| RAM | 4GB 이상 |
| 디스크 | 20GB 이상 (데이터 증가에 따라 확장) |

### 네트워크

- **로컬 테스트**: 별도 도메인 없이 `localhost`로 접근 가능
- **프로덕션 배포**: 도메인 필요 (Caddy가 자동으로 Let's Encrypt HTTPS 인증서 발급)
- 방화벽에서 포트 80, 443 오픈 필요

---

## 2. 빠른 시작

3단계로 Worknest를 실행할 수 있습니다.

### Step 1: 저장소 클론 + 환경 설정

```bash
git clone https://github.com/A-Team-kr/worknest.git
cd worknest
cp .env.example .env
```

`.env` 파일을 열어 프로덕션 값으로 수정합니다. **최소 필수 변경 항목**:

```bash
# 보안 시크릿 (반드시 변경)
BETTER_AUTH_SECRET=<32자-이상의-랜덤-문자열>
POSTGRES_PASSWORD=<강력한-비밀번호>
MINIO_ROOT_PASSWORD=<강력한-비밀번호>
S3_SECRET_KEY=<MINIO_ROOT_PASSWORD와-동일>

# 프로덕션 모드
NODE_ENV=production
LOG_LEVEL=info

# 도메인 (HTTPS 사용 시)
DOMAIN=worknest.example.com
BETTER_AUTH_URL=https://worknest.example.com
CORS_ORIGIN=https://worknest.example.com

# SMTP (이메일 발송)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=<SMTP-비밀번호>
SMTP_FROM=noreply@example.com
```

> **Tip**: `BETTER_AUTH_SECRET`은 다음 명령으로 생성할 수 있습니다:
> ```bash
> openssl rand -base64 32
> ```

### Step 2: Docker 이미지 빌드 + 실행

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

첫 빌드 시 수 분이 소요됩니다. 멀티스테이지 빌드로 최종 이미지는 경량화되어 있습니다.

### Step 3: 접속 확인

```bash
# 로컬 테스트
open http://localhost

# 프로덕션 (도메인 설정 시)
open https://worknest.example.com

# 헬스체크 확인
curl http://localhost/healthz
```

---

## 3. 환경 변수 설명

### PostgreSQL

| 변수 | 설명 | 기본값 | 필수 |
|------|------|--------|------|
| `POSTGRES_USER` | DB 사용자명 | `worknest` | 선택 |
| `POSTGRES_PASSWORD` | DB 비밀번호 | `worknest` | **필수** (프로덕션에서 변경) |
| `POSTGRES_DB` | DB 이름 | `worknest` | 선택 |
| `DATABASE_URL` | DB 연결 문자열 | docker-compose.prod.yml에서 자동 구성 | 자동 |

### Redis

| 변수 | 설명 | 기본값 | 필수 |
|------|------|--------|------|
| `REDIS_URL` | Redis 연결 문자열 | docker-compose.prod.yml에서 자동 구성 | 자동 |

### 서버 (API)

| 변수 | 설명 | 기본값 | 필수 |
|------|------|--------|------|
| `NODE_ENV` | 실행 환경 | `development` | **필수** (`production`으로 변경) |
| `PORT` | API 서버 포트 | `4000` (prod) | 선택 |
| `LOG_LEVEL` | 로그 레벨 (`debug`, `info`, `warn`, `error`) | `debug` | 선택 (`info` 권장) |
| `BETTER_AUTH_SECRET` | 인증 시크릿 키 | `change-me-in-production` | **필수** (반드시 변경) |
| `BETTER_AUTH_URL` | 인증 서비스 URL | `http://localhost:3000` | **필수** (도메인으로 변경) |
| `CORS_ORIGIN` | CORS 허용 오리진 | - | **필수** (도메인으로 설정) |

### SMTP (이메일)

| 변수 | 설명 | 기본값 | 필수 |
|------|------|--------|------|
| `SMTP_HOST` | SMTP 서버 호스트 | `mailpit` (dev) | **필수** (프로덕션) |
| `SMTP_PORT` | SMTP 서버 포트 | `1025` (dev) | **필수** (보통 `587`) |
| `SMTP_USER` | SMTP 인증 사용자 | - | 선택 |
| `SMTP_PASSWORD` | SMTP 인증 비밀번호 | - | 선택 |
| `SMTP_FROM` | 발신자 이메일 주소 | - | 선택 |

### MinIO (S3 호환 스토리지)

| 변수 | 설명 | 기본값 | 필수 |
|------|------|--------|------|
| `MINIO_ROOT_USER` | MinIO 관리자 사용자명 | `worknest` | 선택 |
| `MINIO_ROOT_PASSWORD` | MinIO 관리자 비밀번호 | `worknest123` | **필수** (프로덕션에서 변경) |
| `S3_ENDPOINT` | S3 엔드포인트 URL | docker-compose.prod.yml에서 자동 구성 | 자동 |
| `S3_ACCESS_KEY` | S3 액세스 키 | `worknest` | 선택 |
| `S3_SECRET_KEY` | S3 시크릿 키 | `worknest123` | **필수** (MINIO_ROOT_PASSWORD와 동일) |
| `S3_BUCKET` | S3 버킷 이름 | `worknest` | 선택 |

### Caddy (리버스 프록시)

| 변수 | 설명 | 기본값 | 필수 |
|------|------|--------|------|
| `DOMAIN` | 서비스 도메인 | `localhost` | 선택 (HTTPS 시 필수) |

---

## 4. 서비스 구성

`docker-compose.prod.yml`은 다음 7개의 서비스로 구성됩니다:

```
                    ┌─────────┐
                    │  Caddy  │ :80, :443
                    │ (proxy) │
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
        ┌─────┴─────┐   │    ┌─────┴─────┐
        │    web     │   │    │  server   │
        │  (nginx)   │   │    │  (API)    │
        │  :80 내부  │   │    │  :4000    │
        └───────────┘   │    └─────┬─────┘
                        │          │
                        │    ┌─────┴─────┐
                        │    │  worker   │
                        │    │ (BullMQ)  │
                        │    └─────┬─────┘
                        │          │
              ┌─────────┼──────────┼─────────┐
              │         │          │         │
        ┌─────┴────┐ ┌──┴───┐ ┌───┴───┐ ┌───┴───┐
        │ postgres │ │redis │ │ minio │ │uploads│
        │  :5432   │ │:6379 │ │ :9000 │ │(vol)  │
        └──────────┘ └──────┘ └───────┘ └───────┘
```

### server (API 서버)

- **이미지**: `Dockerfile.server` (Node.js 20 Alpine, 멀티스테이지 빌드)
- **역할**: REST API, 인증 (Better Auth), WebSocket, DB 마이그레이션 (시작 시 자동 실행)
- **내부 포트**: 4000
- **헬스체크**: `GET /healthz` (30초 간격)
- **의존성**: postgres, redis

### worker (백그라운드 워커)

- **이미지**: `Dockerfile.server`와 동일 (같은 이미지, 다른 모드)
- **역할**: BullMQ 작업 큐 처리 (이메일 발송 등)
- **환경변수**: `WORKER_ONLY=true`
- **의존성**: postgres, redis

### web (프론트엔드)

- **이미지**: `Dockerfile.web` (Vite 빌드 결과를 nginx로 서빙)
- **역할**: React SPA 정적 파일 서빙
- **내부 포트**: 80
- **특징**: gzip 압축, 정적 에셋 1년 캐싱, SPA fallback

### postgres (데이터베이스)

- **이미지**: `postgres:16-alpine`
- **내부 포트**: 5432
- **데이터 볼륨**: `postgres_data`
- **헬스체크**: `pg_isready` (10초 간격)

### redis (캐시 + 큐)

- **이미지**: `redis:7-alpine`
- **역할**: 세션 캐시, BullMQ 작업 큐
- **설정**: AOF 영속성, 최대 메모리 256MB, LRU 정책
- **데이터 볼륨**: `redis_data`
- **헬스체크**: `redis-cli ping` (10초 간격)

### minio (파일 스토리지)

- **이미지**: `minio/minio:RELEASE.2024-12-18T13-15-44Z`
- **역할**: S3 호환 오브젝트 스토리지 (파일 업로드)
- **내부 포트**: 9000 (API), 9001 (관리 콘솔)
- **데이터 볼륨**: `minio_data`

### caddy (리버스 프록시)

- **이미지**: `caddy:2-alpine`
- **역할**: 리버스 프록시, 자동 HTTPS 인증서 발급 (Let's Encrypt)
- **외부 포트**: 80, 443
- **라우팅**:
  - `/api/v1/*` -> server:4000
  - `/healthz`, `/readyz` -> server:4000
  - 그 외 -> web:80 (SPA)
- **데이터 볼륨**: `caddy_data` (인증서), `caddy_config`

---

## 5. 백업 & 복원

### PostgreSQL 백업

```bash
# 백업
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U worknest -d worknest -F c -f /tmp/backup.dump

docker compose -f docker-compose.prod.yml cp postgres:/tmp/backup.dump ./backup.dump

# 복원
docker compose -f docker-compose.prod.yml cp ./backup.dump postgres:/tmp/backup.dump

docker compose -f docker-compose.prod.yml exec postgres \
  pg_restore -U worknest -d worknest -c /tmp/backup.dump
```

### Redis 백업

Redis는 AOF(Append Only File) 모드로 실행되므로, 볼륨을 직접 백업합니다:

```bash
# 백업
docker compose -f docker-compose.prod.yml exec redis redis-cli BGSAVE
docker cp $(docker compose -f docker-compose.prod.yml ps -q redis):/data ./redis-backup

# 복원: redis 컨테이너 중지 후 볼륨 데이터 교체
docker compose -f docker-compose.prod.yml stop redis
docker cp ./redis-backup/. $(docker compose -f docker-compose.prod.yml ps -q redis):/data
docker compose -f docker-compose.prod.yml start redis
```

### 파일 스토리지 백업

#### uploads 볼륨 (로컬 파일)

```bash
# 백업
docker compose -f docker-compose.prod.yml exec server \
  tar czf /tmp/uploads-backup.tar.gz /app/uploads

docker compose -f docker-compose.prod.yml cp server:/tmp/uploads-backup.tar.gz ./uploads-backup.tar.gz

# 복원
docker compose -f docker-compose.prod.yml cp ./uploads-backup.tar.gz server:/tmp/uploads-backup.tar.gz

docker compose -f docker-compose.prod.yml exec server \
  tar xzf /tmp/uploads-backup.tar.gz -C /
```

#### MinIO (오브젝트 스토리지)

MinIO CLI(`mc`)를 사용하여 백업합니다:

```bash
# mc 설정 (호스트 머신에 mc 설치 필요)
mc alias set worknest http://localhost:9000 worknest <MINIO_ROOT_PASSWORD>

# 백업 (로컬 디렉토리로 미러링)
mc mirror worknest/worknest ./minio-backup

# 복원
mc mirror ./minio-backup worknest/worknest
```

### 자동 백업 (cron 예시)

```bash
# /etc/cron.d/worknest-backup
# 매일 새벽 3시에 DB 백업 실행
0 3 * * * root cd /path/to/worknest && \
  docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U worknest -d worknest -F c > /backups/worknest-$(date +\%Y\%m\%d).dump
```

---

## 6. 업그레이드 절차

### 일반 업그레이드

```bash
cd /path/to/worknest

# 1. 최신 코드 가져오기
git pull origin main

# 2. 이미지 재빌드 + 재시작
docker compose -f docker-compose.prod.yml up -d --build
```

- DB 마이그레이션은 서버 시작 시 자동 실행됩니다 (Drizzle ORM).
- 다운타임은 빌드 + 재시작 시간(보통 1~3분)입니다.

### 안전한 업그레이드 절차 (권장)

```bash
cd /path/to/worknest

# 1. 현재 상태 확인
docker compose -f docker-compose.prod.yml ps

# 2. DB 백업 (업그레이드 전 필수)
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U worknest -d worknest -F c -f /tmp/pre-upgrade.dump
docker compose -f docker-compose.prod.yml cp postgres:/tmp/pre-upgrade.dump ./pre-upgrade.dump

# 3. 최신 코드 가져오기
git pull origin main

# 4. 이미지 재빌드 + 재시작
docker compose -f docker-compose.prod.yml up -d --build

# 5. 서비스 상태 확인
docker compose -f docker-compose.prod.yml ps
curl http://localhost/healthz
```

### 롤백

문제가 발생한 경우:

```bash
# 이전 버전으로 되돌리기
git checkout <이전-커밋-해시>
docker compose -f docker-compose.prod.yml up -d --build

# DB 복원이 필요한 경우
docker compose -f docker-compose.prod.yml cp ./pre-upgrade.dump postgres:/tmp/pre-upgrade.dump
docker compose -f docker-compose.prod.yml exec postgres \
  pg_restore -U worknest -d worknest -c /tmp/pre-upgrade.dump
```

---

## 7. 트러블슈팅

### 로그 확인

```bash
# 전체 서비스 로그
docker compose -f docker-compose.prod.yml logs

# 특정 서비스 로그 (최근 100줄, 실시간 추적)
docker compose -f docker-compose.prod.yml logs -f --tail=100 server
docker compose -f docker-compose.prod.yml logs -f --tail=100 worker
docker compose -f docker-compose.prod.yml logs -f --tail=100 web
docker compose -f docker-compose.prod.yml logs -f --tail=100 caddy

# 서비스 상태 확인
docker compose -f docker-compose.prod.yml ps
```

### DB 연결 실패

**증상**: 서버 로그에 `ECONNREFUSED` 또는 `connection refused` 에러

**원인 및 해결**:

1. PostgreSQL 컨테이너가 실행 중인지 확인:
   ```bash
   docker compose -f docker-compose.prod.yml ps postgres
   ```
2. 헬스체크 통과 여부 확인:
   ```bash
   docker compose -f docker-compose.prod.yml exec postgres pg_isready -U worknest
   ```
3. `.env` 파일의 `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` 값이 올바른지 확인
4. 볼륨 초기화 후 재시작 (데이터 손실 주의):
   ```bash
   docker compose -f docker-compose.prod.yml down
   docker volume rm worknest_postgres_data
   docker compose -f docker-compose.prod.yml up -d --build
   ```

### Redis 연결 실패

**증상**: 서버 로그에 Redis 연결 에러, BullMQ 작업 미처리

**원인 및 해결**:

1. Redis 컨테이너 상태 확인:
   ```bash
   docker compose -f docker-compose.prod.yml ps redis
   docker compose -f docker-compose.prod.yml exec redis redis-cli ping
   # 정상이면 "PONG" 응답
   ```
2. 메모리 부족 확인:
   ```bash
   docker compose -f docker-compose.prod.yml exec redis redis-cli info memory
   ```
3. Redis 재시작:
   ```bash
   docker compose -f docker-compose.prod.yml restart redis
   ```

### 포트 충돌

**증상**: `Bind for 0.0.0.0:80: address already in use`

**원인 및 해결**:

1. 포트 80 또는 443을 사용 중인 프로세스 확인:
   ```bash
   # Linux
   sudo ss -tlnp | grep ':80\|:443'
   # macOS
   sudo lsof -i :80 -i :443
   ```
2. 충돌하는 서비스 중지 (예: Apache, nginx):
   ```bash
   sudo systemctl stop nginx
   sudo systemctl stop apache2
   ```
3. 또는 Caddy의 포트를 변경 (`docker-compose.prod.yml`에서 수정):
   ```yaml
   caddy:
     ports:
       - "8080:80"
       - "8443:443"
   ```

### HTTPS 인증서 발급 실패

**증상**: Caddy 로그에 `acme` 관련 에러, 브라우저에서 HTTPS 접속 불가

**원인 및 해결**:

1. 도메인의 DNS A 레코드가 서버 IP를 가리키는지 확인:
   ```bash
   dig +short worknest.example.com
   ```
2. 포트 80, 443이 외부에서 접근 가능한지 확인 (방화벽, 보안그룹):
   ```bash
   # 외부에서 테스트
   curl -v http://worknest.example.com
   ```
3. `.env` 파일의 `DOMAIN` 값이 올바른지 확인
4. Caddy 인증서 캐시 초기화 후 재시작:
   ```bash
   docker compose -f docker-compose.prod.yml stop caddy
   docker volume rm worknest_caddy_data worknest_caddy_config
   docker compose -f docker-compose.prod.yml up -d caddy
   ```
5. **localhost 사용 시**: `DOMAIN` 변수를 설정하지 않으면 기본값 `localhost`로 동작하며, Caddy가 자체 서명 인증서를 사용합니다. 이 경우 HTTPS 경고가 표시될 수 있으나 정상입니다.

### 빌드 실패

**증상**: `docker compose up --build` 시 에러 발생

**원인 및 해결**:

1. Docker 빌드 캐시 초기화:
   ```bash
   docker builder prune -f
   docker compose -f docker-compose.prod.yml build --no-cache
   ```
2. 디스크 공간 확인:
   ```bash
   df -h
   docker system df
   ```
3. 불필요한 이미지/볼륨 정리:
   ```bash
   docker system prune -a --volumes
   ```

### 서비스 전체 재시작

모든 서비스를 중지 후 다시 시작:

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

> **주의**: `down` 명령은 컨테이너만 제거하며, `volumes`에 저장된 데이터(DB, Redis, MinIO)는 유지됩니다. 데이터까지 삭제하려면 `down -v`를 사용하세요 (비가역적).
