# Worknest 디자인 시스템

> 이 문서는 Worknest 전체 UI에 적용되는 디자인 토큰, 타이포그래피, 레이아웃, 애니메이션 규칙을 정의합니다.
> shadcn/ui + Radix UI + Tailwind CSS 4 기반이며, 라이트/다크 모드를 모두 지원합니다.

---

## 1. 색상 토큰 (Color Tokens)

CSS 커스텀 프로퍼티로 정의하며, `@theme` 블록에서 Tailwind CSS 4와 연동합니다.
shadcn/ui 규칙에 따라 각 시맨틱 색상은 `--{name}` / `--{name}-foreground` 쌍으로 구성합니다.

### 1.1 시맨틱 색상 (라이트 모드)

```css
:root {
  /* 배경/전경 */
  --background: 0 0% 100%;            /* #FFFFFF — 페이지 배경 */
  --foreground: 240 10% 3.9%;         /* #0A0A0B — 기본 텍스트 */

  /* 카드 */
  --card: 0 0% 100%;                  /* #FFFFFF */
  --card-foreground: 240 10% 3.9%;

  /* 팝오버 */
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;

  /* 프라이머리 (브랜드 — 인디고 계열) */
  --primary: 238 76% 54%;             /* #4338CA — 주요 버튼, 링크 */
  --primary-foreground: 0 0% 100%;    /* #FFFFFF */

  /* 세컨더리 */
  --secondary: 240 4.8% 95.9%;        /* #F4F4F5 — 보조 버튼 배경 */
  --secondary-foreground: 240 5.9% 10%;

  /* 뮤트 */
  --muted: 240 4.8% 95.9%;            /* #F4F4F5 — 비활성 텍스트 배경 */
  --muted-foreground: 240 3.8% 46.1%; /* #737380 — 보조 텍스트 */

  /* 액센트 */
  --accent: 240 4.8% 95.9%;           /* 호버/선택 하이라이트 */
  --accent-foreground: 240 5.9% 10%;

  /* 위험/삭제 */
  --destructive: 0 84.2% 60.2%;       /* #EF4444 */
  --destructive-foreground: 0 0% 98%;

  /* 보더/입력/링 */
  --border: 240 5.9% 90%;             /* #E4E4E7 */
  --input: 240 5.9% 90%;
  --ring: 238 76% 54%;                /* 포커스 링 — primary와 동일 */

  /* 사이드바 */
  --sidebar-background: 240 4.8% 97.5%;
  --sidebar-foreground: 240 5.9% 10%;
  --sidebar-border: 240 5.9% 90%;
  --sidebar-accent: 240 4.8% 95.9%;
  --sidebar-accent-foreground: 240 5.9% 10%;

  /* 기타 */
  --radius: 0.375rem;                 /* 6px — 기본 border-radius */
}
```

### 1.2 시맨틱 색상 (다크 모드)

```css
.dark {
  --background: 240 10% 3.9%;         /* #0A0A0B */
  --foreground: 0 0% 98%;             /* #FAFAFA */

  --card: 240 10% 5.5%;               /* #0E0E11 */
  --card-foreground: 0 0% 98%;

  --popover: 240 10% 5.5%;
  --popover-foreground: 0 0% 98%;

  --primary: 238 76% 64%;             /* #6366F1 — 밝기 보정 */
  --primary-foreground: 0 0% 100%;

  --secondary: 240 3.7% 15.9%;        /* #27272A */
  --secondary-foreground: 0 0% 98%;

  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;   /* #A1A1AA */

  --accent: 240 3.7% 15.9%;
  --accent-foreground: 0 0% 98%;

  --destructive: 0 62.8% 50.6%;       /* #DC2626 */
  --destructive-foreground: 0 0% 98%;

  --border: 240 3.7% 18%;             /* #2E2E33 */
  --input: 240 3.7% 18%;
  --ring: 238 76% 64%;

  --sidebar-background: 240 10% 5.5%;
  --sidebar-foreground: 0 0% 98%;
  --sidebar-border: 240 3.7% 18%;
  --sidebar-accent: 240 3.7% 15.9%;
  --sidebar-accent-foreground: 0 0% 98%;
}
```

### 1.3 이슈 우선순위 색상

| 우선순위 | CSS 변수 | 라이트 | 다크 | Tailwind 매핑 |
|---------|---------|--------|------|--------------|
| Urgent | `--priority-urgent` | `#EF4444` | `#F87171` | `red-500` / `red-400` |
| High | `--priority-high` | `#F97316` | `#FB923C` | `orange-500` / `orange-400` |
| Medium | `--priority-medium` | `#EAB308` | `#FACC15` | `yellow-500` / `yellow-400` |
| Low | `--priority-low` | `#3B82F6` | `#60A5FA` | `blue-500` / `blue-400` |
| None | `--priority-none` | `#9CA3AF` | `#6B7280` | `gray-400` / `gray-500` |

```css
:root {
  --priority-urgent: 0 84% 60%;
  --priority-high: 25 95% 53%;
  --priority-medium: 48 96% 53%;
  --priority-low: 217 91% 60%;
  --priority-none: 220 9% 66%;
}

.dark {
  --priority-urgent: 0 91% 71%;
  --priority-high: 27 96% 61%;
  --priority-medium: 48 97% 63%;
  --priority-low: 217 93% 68%;
  --priority-none: 220 9% 46%;
}
```

### 1.4 이슈 상태 카테고리 색상

| 카테고리 | CSS 변수 | 라이트 (bg / text) | 다크 (bg / text) | 용도 |
|---------|---------|-------------------|-----------------|------|
| Backlog | `--status-backlog` | `#F4F4F5` / `#71717A` | `#27272A` / `#A1A1AA` | 회색 — 대기 |
| Unstarted | `--status-unstarted` | `#DBEAFE` / `#2563EB` | `#1E3A5F` / `#60A5FA` | 파란색 — 시작 전 |
| Started | `--status-started` | `#FEF3C7` / `#D97706` | `#422006` / `#FBBF24` | 앰버/노란색 — 진행 중 |
| Completed | `--status-completed` | `#DCFCE7` / `#16A34A` | `#14532D` / `#4ADE80` | 초록색 — 완료 |
| Cancelled | `--status-cancelled` | `#FEE2E2` / `#DC2626` | `#450A0A` / `#F87171` | 빨간색 — 취소 |

```css
:root {
  --status-backlog-bg: 240 5% 96%;
  --status-backlog-text: 240 4% 46%;
  --status-unstarted-bg: 214 95% 93%;
  --status-unstarted-text: 217 91% 53%;
  --status-started-bg: 48 96% 89%;
  --status-started-text: 32 95% 44%;
  --status-completed-bg: 142 77% 93%;
  --status-completed-text: 142 72% 39%;
  --status-cancelled-bg: 0 93% 94%;
  --status-cancelled-text: 0 72% 51%;
}

.dark {
  --status-backlog-bg: 240 4% 16%;
  --status-backlog-text: 240 5% 65%;
  --status-unstarted-bg: 215 50% 23%;
  --status-unstarted-text: 217 93% 68%;
  --status-started-bg: 28 73% 15%;
  --status-started-text: 45 93% 58%;
  --status-completed-bg: 143 64% 17%;
  --status-completed-text: 142 69% 58%;
  --status-cancelled-bg: 0 63% 15%;
  --status-cancelled-text: 0 91% 71%;
}
```

### 1.5 상태 뱃지 컴포넌트 규칙

```
상태 뱃지 = 카테고리 색상 dot(8px) + 상태명 텍스트
배경: --status-{category}-bg
텍스트: --status-{category}-text
dot: --status-{category}-text (fill)
border-radius: 9999px (pill 형태)
padding: 2px 8px
font-size: 12px (xs)
```

---

## 2. 타이포그래피 (Typography)

### 2.1 폰트 패밀리

| 용도 | 폰트 | Fallback |
|------|------|----------|
| UI 텍스트 | Pretendard | -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif |
| 코드 | JetBrains Mono | "Fira Code", "SF Mono", Menlo, Consolas, monospace |

```css
:root {
  --font-sans: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", "SF Mono", Menlo, Consolas, monospace;
}
```

**CDN 로드:**
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css" />
```

**선택 근거:** Pretendard는 한국어 가독성이 뛰어나며, 토스/카카오 등 국내 주요 서비스에서 검증된 폰트입니다.

### 2.2 크기 스케일 (Size Scale)

| 토큰 | 크기 | line-height | 용도 |
|------|------|-------------|------|
| `text-xs` | 12px (0.75rem) | 16px (1rem) | 뱃지, 메타 정보, 타임스탬프 |
| `text-sm` | 14px (0.875rem) | 20px (1.25rem) | 보조 텍스트, 테이블 셀, 사이드바 항목 |
| `text-base` | 16px (1rem) | 24px (1.5rem) | 본문 텍스트, 입력 필드 |
| `text-lg` | 18px (1.125rem) | 28px (1.75rem) | 섹션 타이틀, 카드 헤더 |
| `text-xl` | 20px (1.25rem) | 28px (1.75rem) | 페이지 제목 (소) |
| `text-2xl` | 24px (1.5rem) | 32px (2rem) | 페이지 제목 (중) |
| `text-3xl` | 30px (1.875rem) | 36px (2.25rem) | 페이지 제목 (대), 히어로 텍스트 |

### 2.3 굵기 스케일 (Weight Scale)

| 토큰 | 값 | 용도 |
|------|-----|------|
| `font-normal` | 400 | 본문, 설명, 일반 텍스트 |
| `font-medium` | 500 | 라벨, 사이드바 섹션명, 테이블 헤더 |
| `font-semibold` | 600 | 버튼, 페이지 제목, 강조 텍스트 |
| `font-bold` | 700 | 히어로 타이틀, 특별 강조 (절제하여 사용) |

### 2.4 타이포그래피 사용 규칙

- 페이지 제목: `text-2xl font-semibold`
- 섹션 헤딩: `text-lg font-semibold`
- 사이드바 섹션 라벨: `text-xs font-medium uppercase tracking-wider text-muted-foreground`
- 사이드바 항목: `text-sm font-normal` (활성 시 `font-medium`)
- 이슈 제목 (리스트): `text-sm font-normal`
- 이슈 키 (WORK-142): `text-xs font-mono text-muted-foreground`
- 본문 텍스트: `text-base font-normal leading-relaxed`
- 버튼 텍스트: `text-sm font-medium`
- 입력 플레이스홀더: `text-sm text-muted-foreground`
- 에러 메시지: `text-sm text-destructive`

---

## 3. 간격 (Spacing)

Tailwind 기본 스케일을 따릅니다.

| 토큰 | 값 | 주요 사용처 |
|------|-----|-----------|
| `0` | 0px | — |
| `0.5` | 2px | 미세 간격 (아이콘-텍스트 사이) |
| `1` | 4px | 인라인 요소 간격, 뱃지 내 패딩 |
| `1.5` | 6px | 작은 패딩 |
| `2` | 8px | 아이콘과 라벨 사이, 컴팩트 패딩 |
| `3` | 12px | 리스트 아이템 간격, 카드 내부 패딩 |
| `4` | 16px | 기본 컴포넌트 패딩, 그리드 갭 |
| `5` | 20px | 섹션 간격 (소) |
| `6` | 24px | 섹션 간격 (중) |
| `8` | 32px | 섹션 간격 (대), 페이지 여백 |
| `10` | 40px | 영역 분리 |
| `12` | 48px | 사이드바 축소 상태 너비 |
| `16` | 64px | 대형 간격 |

### 간격 사용 원칙

1. **관련 요소는 가까이, 비관련 요소는 멀리** (근접성 원칙)
2. **계층적 간격**: 같은 그룹 내(4px~8px) < 그룹 간(16px~24px) < 섹션 간(32px~48px)
3. **일관된 패딩**: 카드=`p-4`, 모달=`p-6`, 페이지=`px-6 py-8`

---

## 4. 레이아웃 상수 (Layout Constants)

### 4.1 주요 치수

| 요소 | 값 | 비고 |
|------|-----|------|
| 사이드바 (열림) | **240px** | 고정 너비 |
| 사이드바 (축소) | **48px** | 아이콘만 표시 |
| 콘텐츠 최대 너비 | **1200px** | 중앙 정렬, 양쪽 `px-6` |
| Side Panel | **640px** | 이슈 상세 등 |
| 이슈 상세 속성 패널 | **280px** | Full Page 우측 |
| 커맨드 팔레트 | **640px** (max) | 중앙 상단 배치 |
| 커맨드 팔레트 높이 | **400px** (max) | 스크롤 |
| 페이지 트리 인덴트 | **16px** / 레벨 | 최대 52px (레벨 5+) |
| 칸반 컬럼 최소 너비 | **280px** | 수평 스크롤 허용 |
| 이슈 리스트 행 높이 | **40px** | — |
| 칸반 카드 너비 | **컬럼 너비 - 16px** | — |
| 모달 (소) | **400px** | 확인 다이얼로그 |
| 모달 (중) | **560px** | 생성/수정 폼 |
| 모달 (대) | **720px** | 복잡한 폼 |
| 최소 터치 타겟 | **32x32px** | 접근성 |

### 4.2 페이지 트리 인덴트 규칙

```
레벨 0: padding-left = 8px  (루트)
레벨 1: padding-left = 24px (+16px)
레벨 2: padding-left = 40px (+16px)
레벨 3: padding-left = 52px (최대, 이후 고정)
레벨 4: padding-left = 52px
레벨 5: padding-left = 52px
```

### 4.3 Z-Index 스케일

| 레이어 | z-index | 요소 |
|--------|---------|------|
| 기본 | `auto` | 페이지 콘텐츠 |
| 사이드바 | `30` | 좌측 내비게이션 |
| Side Panel | `40` | 이슈 상세 오버레이 |
| 드롭다운/팝오버 | `50` | Radix Popover, DropdownMenu |
| 모달 백드롭 | `50` | Dialog overlay |
| 모달 | `50` | Dialog content (Radix 기본) |
| 커맨드 팔레트 | `50` | Cmd+K 검색 |
| 토스트 | `100` | Sonner 알림 |

> Radix UI의 Portal이 z-index를 자동 관리하므로, 커스텀 z-index는 최소한으로 사용합니다.

---

## 5. 아이콘 시스템 (Icon System)

### 5.1 라이브러리

**Lucide React** (`lucide-react`) 사용.

- 일관된 스트로크 기반 아이콘 세트
- Tree-shakable (번들 사이즈 최적화)
- React 컴포넌트로 직접 임포트

### 5.2 크기 규칙

| 크기 | px | 용도 |
|------|-----|------|
| `sm` | **16px** | 인라인 아이콘 (뱃지, 메타 정보, 사이드바 항목) |
| `md` | **20px** | 버튼 아이콘, 리스트 항목 선행 아이콘 |
| `lg` | **24px** | 페이지 헤더, 빈 상태 아이콘 |

### 5.3 색상 상속 규칙

```
기본: 부모의 text color를 상속 (currentColor)
비활성: text-muted-foreground
활성/선택: text-foreground 또는 text-primary
위험: text-destructive
우선순위: 해당 --priority-{level} 색상
상태: 해당 --status-{category}-text 색상
```

### 5.4 아이콘 + 텍스트 배치

```
[아이콘 16px] [gap 8px] [텍스트]  — 사이드바 항목
[아이콘 20px] [gap 8px] [텍스트]  — 버튼
[아이콘 16px] [gap 4px] [텍스트]  — 컴팩트 뱃지
```

`flex items-center gap-2` (8px) 기본, 컴팩트 시 `gap-1` (4px)

### 5.5 주요 아이콘 매핑

| 용도 | 아이콘 | Lucide 이름 |
|------|--------|-------------|
| 프로젝트 | 폴더 | `Folder` |
| 이슈 | 원 체크 | `CircleCheck` |
| 버그 | 벌레 | `Bug` |
| 스토리 | 책 | `BookOpen` |
| 서브태스크 | 하위 체크 | `ListChecks` |
| 사이클 | 반복 | `RefreshCw` |
| Wiki | 파일 텍스트 | `FileText` |
| 설정 | 톱니바퀴 | `Settings` |
| 검색 | 돋보기 | `Search` |
| 알림 | 벨 | `Bell` |
| 사용자 | 사람 | `User` |
| 즐겨찾기 | 별 | `Star` |
| 추가 | 더하기 | `Plus` |
| 닫기 | X | `X` |
| 메뉴 | 햄버거 | `Menu` |
| 필터 | 깔때기 | `Filter` |
| 정렬 | 화살표 정렬 | `ArrowUpDown` |
| 칸반 | 레이아웃 | `LayoutGrid` |
| 리스트 | 목록 | `List` |

---

## 6. 컴포넌트 커스터마이제이션

### 6.1 Border Radius

| 토큰 | 값 | 용도 |
|------|-----|------|
| `rounded-sm` | 4px | 작은 뱃지, 인라인 코드 |
| `rounded-md` | **6px** | **기본** — 버튼, 입력, 카드, 드롭다운 |
| `rounded-lg` | 8px | 모달, Side Panel |
| `rounded-xl` | 12px | 큰 카드, 팝오버 |
| `rounded-full` | 9999px | 아바타, 상태 뱃지 (pill), dot |

### 6.2 그림자 (Shadow Levels)

```css
:root {
  /* 레벨 0 — 그림자 없음 (인라인 요소) */
  --shadow-none: none;

  /* 레벨 1 — 미세 그림자 (카드, 드롭다운 트리거) */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);

  /* 레벨 2 — 기본 그림자 (팝오버, 드롭다운 메뉴) */
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1),
               0 2px 4px -2px rgb(0 0 0 / 0.1);

  /* 레벨 3 — 강조 그림자 (모달, Side Panel) */
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1),
               0 4px 6px -4px rgb(0 0 0 / 0.1);

  /* 레벨 4 — 드래그 중 아이템 */
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1),
               0 8px 10px -6px rgb(0 0 0 / 0.1);
}
```

다크 모드에서는 그림자 대신 `border` 또는 밝은 배경색으로 구분합니다.

### 6.3 포커스 링 스타일

```css
/* 모든 포커스 가능 요소에 적용 */
.focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

/* 또는 Tailwind 유틸리티 */
focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background
```

규칙:
- 키보드 포커스(`:focus-visible`)에서만 표시, 마우스 클릭 시 미표시
- 링 색상: `--ring` (primary와 동일)
- 링 너비: 2px
- 링 오프셋: 2px (배경색과 분리)
- 모든 인터랙티브 요소(버튼, 링크, 입력, 체크박스 등)에 필수 적용

### 6.4 Transition 기본값

```css
/* 모든 인터랙티브 요소에 적용 */
transition: all 150ms ease;

/* Tailwind 유틸리티 */
transition-all duration-150 ease-in-out
```

---

## 7. 애니메이션 & 트랜지션 규칙

### 7.1 기본 원칙

> **"속도 > 장식"** — 불필요한 애니메이션은 제거하고, 트랜지션은 150ms 이하로 유지합니다.

### 7.2 트랜지션 적용 대상

| 요소 | 속성 | 시간 | 이징 |
|------|------|------|------|
| 버튼 호버/활성 | `background-color`, `border-color`, `color` | 150ms | ease |
| 사이드바 항목 호버 | `background-color` | 150ms | ease |
| 드롭다운/팝오버 진입 | `opacity`, `transform` | 150ms | ease-out |
| 드롭다운/팝오버 퇴장 | `opacity`, `transform` | 100ms | ease-in |
| 모달 진입 | `opacity`, `transform(scale)` | 150ms | ease-out |
| 모달 퇴장 | `opacity` | 100ms | ease-in |
| Side Panel 슬라이드 | `transform(translateX)` | 150ms | ease-out |
| 사이드바 축소/확장 | `width` | 150ms | ease |
| 토스트 진입 | `transform(translateY)`, `opacity` | 150ms | ease-out |
| 토스트 퇴장 | `opacity` | 100ms | ease-in |
| 체크박스 체크 | `background-color`, `border-color` | 150ms | ease |
| 토글 스위치 | `transform(translateX)` | 150ms | ease |

### 7.3 트랜지션 비적용 대상

- 페이지 라우트 전환 (즉시 전환)
- 이슈 리스트 스크롤
- 텍스트 입력
- 드래그 중 아이템 이동 (즉시 반응)
- 텍스트 선택

### 7.4 드래그 앤 드롭 애니메이션

```
드래그 시작: 원본 → opacity: 0.4, 드래그 아이템 → shadow-xl + scale(1.02)
드래그 중: 즉시 위치 추적 (트랜지션 없음)
드롭 위치 표시: border 또는 placeholder 라인 (2px, primary 색상)
드롭 완료: 즉시 반영 (낙관적 업데이트)
```

### 7.5 스켈레톤 로딩

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    hsl(var(--muted)) 25%,
    hsl(var(--muted) / 0.5) 50%,
    hsl(var(--muted)) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius);
}
```

---

## 8. 다크 모드 (Dark Mode)

### 8.1 접근 방식

CSS 커스텀 프로퍼티 기반으로 전환합니다.

```
1. 시스템 설정 감지: prefers-color-scheme
2. 사용자 선택: localStorage에 "theme" 값 저장
3. 우선순위: 사용자 설정 > 시스템 설정
4. 적용: <html> 태그에 class="dark" 토글
```

### 8.2 구현

```typescript
// 테마 초기화 (HTML head에서 FOUC 방지)
const theme = localStorage.getItem("theme");
if (theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}
```

### 8.3 다크 모드 디자인 규칙

1. **절대 색상 금지**: `text-black`, `bg-white` 대신 시맨틱 토큰(`text-foreground`, `bg-background`) 사용
2. **대비 유지**: WCAG AA 기준 4.5:1 이상 (텍스트), 3:1 이상 (UI 요소)
3. **그림자 대체**: 다크 모드에서는 그림자 효과가 약하므로, `border`로 영역 구분
4. **이미지**: 밝은 이미지에 약간의 밝기 조정 (`brightness(0.9)`) 고려
5. **포커스 링**: 다크 모드에서 visibility 확인 필수

### 8.4 테마 전환 UI

```
설정 > 외관 (Appearance)
  ○ 라이트 모드
  ○ 다크 모드
  ● 시스템 설정 따르기  (기본값)
```

---

## 9. 접근성 (Accessibility) 가이드라인

### 9.1 키보드 내비게이션

- 모든 인터랙티브 요소는 Tab으로 접근 가능
- 포커스 순서는 시각적 순서와 일치
- 포커스 트랩: 모달, 커맨드 팔레트 열림 시 내부에서만 순환
- Esc: 항상 닫기/취소

### 9.2 ARIA 규칙

- 사이드바: `<nav role="navigation" aria-label="주 내비게이션">`
- 모달: `role="dialog" aria-modal="true" aria-labelledby="제목"`
- 드롭다운: `role="listbox"`, 옵션은 `role="option"`
- 토스트: `role="status" aria-live="polite"`
- 로딩 스켈레톤: `aria-busy="true" aria-label="로딩 중"`
- 아이콘 버튼: `aria-label` 필수

### 9.3 색각이상 대응

- 색상만으로 정보를 전달하지 않음 (아이콘/텍스트 병행)
- 우선순위: 색상 dot + 텍스트 라벨
- 상태: 색상 배경 + 텍스트 라벨

---

## 10. 요약 Quick Reference

```
┌─────────────────────────────────────────────────────────┐
│ 디자인 토큰 요약                                          │
├─────────────────────────────────────────────────────────┤
│ 폰트: Pretendard (UI) + JetBrains Mono (코드)            │
│ 기본 크기: 14px (text-sm) — UI 요소                      │
│ 본문 크기: 16px (text-base) — 에디터, 설명               │
│ 기본 radius: 6px (rounded-md)                            │
│ 기본 트랜지션: 150ms ease                                │
│ 포커스 링: 2px solid ring, offset 2px                    │
│ 사이드바: 240px (열림) / 48px (축소)                      │
│ Side Panel: 640px                                        │
│ 콘텐츠 최대 너비: 1200px                                  │
│ 최소 터치 타겟: 32x32px                                   │
│ 아이콘: Lucide React (16/20/24px)                        │
│ 그림자: 다크 모드에서는 border로 대체                      │
└─────────────────────────────────────────────────────────┘
```
