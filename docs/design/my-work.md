# Worknest My Work 설계 (CP6-DS-3)

> 이 문서는 My Work 영역(Inbox, My Issues, Favorites)의 페이지 레이아웃, 항목 디자인, 상호작용을 정의합니다.
> 사이드바의 My Work 섹션은 `sidebar.tsx`에 이미 구현되어 있습니다.
> 디자인 시스템 토큰은 `design-system.md`를 참조합니다.

---

## 1. 개요

My Work는 개인 업무를 한 곳에서 관리하는 허브입니다. Inbox(알림), My Issues(할당된 이슈), Favorites(즐겨찾기) 세 페이지로 구성됩니다.

### 1.1 핵심 원칙

- **빠른 인지**: 읽지 않은 알림, 진행 중인 이슈를 시각적으로 즉시 구분
- **원클릭 이동**: 항목 클릭으로 해당 엔티티(이슈, Wiki, 프로젝트)로 바로 이동
- **개인화**: 즐겨찾기 순서 드래그 변경, 알림 필터링으로 나만의 뷰 구성

### 1.2 사이드바 My Work 섹션 (기존)

사이드바에 이미 구현된 My Work 내비게이션:

```
─ My Work
  🔔 Inbox          (3)   ← Bell 아이콘 + 읽지 않은 수 뱃지
  👤 My Issues             ← CircleUser 아이콘
  ⭐ Favorites             ← Star 아이콘
```

라우팅 패턴: `/:orgSlug/:wsSlug/my/inbox`, `/:orgSlug/:wsSlug/my/issues`, `/:orgSlug/:wsSlug/my/favorites`

---

## 2. Inbox 페이지 (알림)

### 2.1 전체 레이아웃

```
┌─ Inbox ────────────────────────────────────────────────────┐
│                                                             │
│  ┌─ 헤더 ────────────────────────────────────────────────┐  │
│  │  알림                                  [모두 읽음 처리] │  │
│  │  text-2xl font-semibold                  text button   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ 필터 토글 ───────────────────────────────────────────┐  │
│  │  [전체]  [읽지 않음]                                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ 알림 목록 ───────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  [UserPlus] Luke가 당신을 WORK-42에 할당...  2시간 전 ● │  │
│  │  [AtSign]   Kim이 댓글에서 당신을 멘션...    1시간 전 ● │  │
│  │  [MessageSq] Park가 WORK-43에 댓글 추가...  30분 전  ● │  │
│  │  [RefreshCw] Luke가 WORK-44 상태 변경...    어제       │  │
│  │  [Mail]     Worknest에 초대되었습니다       3일 전      │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 페이지 헤더

| 속성 | 값 |
|------|-----|
| 레이아웃 | `flex items-center justify-between` |
| 패딩 | `px-6 py-4` |
| 제목 | `"알림"`, `text-2xl font-semibold` |
| 버튼 | `"모두 읽음 처리"`, `Button` variant=`ghost`, `text-sm text-muted-foreground hover:text-foreground` |
| 버튼 아이콘 | `CheckCheck` (Lucide, 16px), 좌측 |

### 2.3 필터 토글

```
┌─────────────────────────────────────────────────────────┐
│  [전체]  [읽지 않음]                                       │
└─────────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 레이아웃 | `flex items-center gap-1 px-6 pb-2` |
| 활성 탭 | `bg-secondary text-secondary-foreground font-medium rounded-md px-3 py-1.5` |
| 비활성 탭 | `text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md` |
| 텍스트 | `text-sm` |
| 기본값 | "전체" 활성 |

### 2.4 알림 항목

```
┌─────────────────────────────────────────────────────────────┐
│  [UserPlus]  Luke가 당신을 WORK-42에 할당했습니다  2시간 전 ●│
│  icon(18px)  message text-sm               time    unread  │
│  colored     entity link=text-primary      text-xs  dot    │
└─────────────────────────────────────────────────────────────┘
```

#### 알림 항목 스타일

| 속성 | 값 |
|------|-----|
| 높이 | `h-14` (56px) |
| 패딩 | `px-4` (목록 자체는 `px-6` 컨테이너 내부) |
| 레이아웃 | `flex items-center gap-3` |
| 배경 (기본) | `bg-background` |
| 배경 (읽지 않음) | `bg-background` (동일, dot으로 구분) |
| 호버 | `bg-accent/50` |
| 커서 | `cursor-pointer` |
| 하단 보더 | `border-b border-border/50` |
| 전환 | `transition-colors duration-150` |

#### 좌측 아이콘

| 알림 유형 | 아이콘 | 크기 | 색상 |
|-----------|--------|------|------|
| 이슈 할당 | `UserPlus` (Lucide) | `w-[18px] h-[18px]` | `text-blue-500` |
| @멘션 | `AtSign` (Lucide) | `w-[18px] h-[18px]` | `text-purple-500` |
| 댓글 | `MessageSquare` (Lucide) | `w-[18px] h-[18px]` | `text-green-500` |
| 상태 변경 | `RefreshCw` (Lucide) | `w-[18px] h-[18px]` | `text-orange-500` |
| 워크스페이스 초대 | `Mail` (Lucide) | `w-[18px] h-[18px]` | `text-primary` |

#### 중앙 메시지

| 요소 | 스타일 |
|------|--------|
| 컨테이너 | `flex-1 min-w-0` |
| 메시지 | `text-sm text-foreground truncate` |
| 사용자 이름 | `font-medium` (인라인) |
| 엔티티 링크 | `text-primary hover:underline cursor-pointer` (예: "WORK-42", 페이지명) |

#### 우측 영역

| 요소 | 스타일 |
|------|--------|
| 타임스탬프 | `text-xs text-muted-foreground whitespace-nowrap ml-2` |
| 읽지 않음 dot | `w-2 h-2 bg-primary rounded-full ml-2 shrink-0` |
| dot 표시 조건 | `is_read === false`일 때만 표시 |

### 2.5 알림 클릭 동작

| 동작 | 설명 |
|------|------|
| 클릭 | 해당 엔티티로 이동 + 읽음 처리 (낙관적 업데이트) |
| 이슈 할당/상태 변경 | 이슈 상세 페이지로 이동 |
| @멘션/댓글 | 이슈 상세 → 댓글 영역으로 스크롤 |
| 워크스페이스 초대 | 초대 수락 페이지로 이동 |

### 2.6 빈 상태

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│              [Bell 아이콘, 48px]                          │
│              text-muted-foreground/50                    │
│                                                          │
│          새로운 알림이 없습니다                             │
│          text-lg font-medium                             │
│                                                          │
│          알림이 도착하면 여기에 표시됩니다                    │
│          text-sm text-muted-foreground                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 레이아웃 | `flex flex-col items-center justify-center py-16 gap-2` |
| 아이콘 | `Bell` (Lucide, 48px), `text-muted-foreground/50` |
| 제목 | `"새로운 알림이 없습니다"`, `text-lg font-medium` |
| 설명 | `"알림이 도착하면 여기에 표시됩니다"`, `text-sm text-muted-foreground` |

---

## 3. My Issues 페이지

### 3.1 전체 레이아웃

```
┌─ My Issues ─────────────────────────────────────────────────┐
│                                                              │
│  ┌─ 헤더 ─────────────────────────────────────────────────┐  │
│  │  내 이슈                                                │  │
│  │  text-2xl font-semibold                                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ In Progress (3) ─────────────────────── ▾ ───────────┐  │
│  │  WRK  WORK-42  로그인 버그 수정        ● In Prog  🔴  │  │
│  │  WRK  WORK-45  API 리팩토링            ● In Prog  🟡  │  │
│  │  API  API-12   결제 연동               ● In Prog  🔴  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Todo (5) ─────────────────────────────── ▾ ──────────┐  │
│  │  WRK  WORK-43  회원가입 구현            ● Todo    🟡  │  │
│  │  WRK  WORK-46  에러 페이지 디자인       ● Todo    🔵  │  │
│  │  ...                                                   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Backlog (2) ──────────────────────────── ▸ ──────────┐  │
│  │  (접힘)                                                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Done (8) ─────────────────────────────── ▸ ──────────┐  │
│  │  (접힘)                                                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 페이지 헤더

| 속성 | 값 |
|------|-----|
| 패딩 | `px-6 py-4` |
| 제목 | `"내 이슈"`, `text-2xl font-semibold` |

### 3.3 상태 카테고리 아코디언

이슈를 상태 카테고리(Backlog, Todo/Unstarted, In Progress/Started, Done/Completed)별로 그룹화하여 접고 펼 수 있는 아코디언으로 표시합니다.

#### 아코디언 헤더

```
┌─────────────────────────────────────────────────────────┐
│  ▾  ● In Progress  (3)                                   │
│  chevron  status dot   category name   count             │
└─────────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 높이 | `h-10` (40px) |
| 패딩 | `px-4` |
| 레이아웃 | `flex items-center gap-2` |
| 배경 | `bg-muted/30` |
| 호버 | `hover:bg-muted/50` |
| 커서 | `cursor-pointer` |
| 모서리 | `rounded-md` |
| 마진 | `mx-6 mb-1` |

#### 아코디언 헤더 요소

| 요소 | 스타일 |
|------|--------|
| 셰브론 | `ChevronRight` / `ChevronDown` (Lucide, 16px), `text-muted-foreground`, `transition-transform duration-150` |
| 상태 카테고리 dot | `w-2.5 h-2.5 rounded-full`, `--status-{category}-text` 색상 |
| 카테고리명 | `text-sm font-medium text-foreground` |
| 카운트 | `text-xs text-muted-foreground ml-auto`, 뱃지 형태 `bg-muted rounded-full px-2 py-0.5` |

#### 기본 펼침/접힘 상태

| 카테고리 | 기본 상태 |
|----------|----------|
| In Progress (Started) | 펼침 |
| Todo (Unstarted) | 펼침 |
| Backlog | 접힘 |
| Done (Completed) | 접힘 |

### 3.4 이슈 행

```
┌─────────────────────────────────────────────────────────────┐
│  WRK   WORK-42   로그인 버그 수정         ● In Progress  🔴 │
│  prefix  key       title                  status badge  prio│
└─────────────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 높이 | `h-10` (40px) |
| 패딩 | `px-6` |
| 레이아웃 | `flex items-center gap-2` |
| 배경 (기본) | `bg-background` |
| 호버 | `bg-accent/50` |
| 커서 | `cursor-pointer` |
| 하단 보더 | `border-b border-border/50` |

#### 이슈 행 요소

| 요소 | 스타일 |
|------|--------|
| 프로젝트 접두사 | `text-xs font-mono text-muted-foreground w-10` |
| 이슈 키 | `text-xs font-mono text-muted-foreground w-20` |
| 제목 | `text-sm text-foreground truncate flex-1` |
| 상태 뱃지 | 카테고리 색상 dot `w-2 h-2 rounded-full` + 상태명 `text-xs`, `--status-{category}-bg/text` |
| 우선순위 아이콘 | `w-4 h-4`, `--priority-{level}` 색상 |

### 3.5 이슈 클릭 동작

| 동작 | 결과 |
|------|------|
| 클릭 | 이슈 상세 페이지로 이동 (`/:orgSlug/:wsSlug/projects/:prefix/issues/:key`) |
| 호버 | `bg-accent/50` |

### 3.6 빈 상태

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│              [CircleUser 아이콘, 48px]                    │
│              text-muted-foreground/50                    │
│                                                          │
│          할당된 이슈가 없습니다                             │
│          text-lg font-medium                             │
│                                                          │
│          이슈에 할당되면 여기에 표시됩니다                    │
│          text-sm text-muted-foreground                   │
│                                                          │
│          [프로젝트로 이동]  Button outline                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 레이아웃 | `flex flex-col items-center justify-center py-16 gap-2` |
| 아이콘 | `CircleUser` (Lucide, 48px), `text-muted-foreground/50` |
| 제목 | `"할당된 이슈가 없습니다"`, `text-lg font-medium` |
| 설명 | `"이슈에 할당되면 여기에 표시됩니다"`, `text-sm text-muted-foreground` |
| CTA | `Button` variant=`outline`, `"프로젝트로 이동"`, `mt-4` |

---

## 4. Favorites 페이지

### 4.1 전체 레이아웃

```
┌─ Favorites ─────────────────────────────────────────────────┐
│                                                              │
│  ┌─ 헤더 ─────────────────────────────────────────────────┐  │
│  │  즐겨찾기                                               │  │
│  │  text-2xl font-semibold                                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ 즐겨찾기 목록 ────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  ⠿  📁  Worknest Backend         프로젝트          ⭐  │  │
│  │  ⠿  ✓   WORK-42 로그인 버그      이슈              ⭐  │  │
│  │  ⠿  📄  API 설계 가이드           Wiki 페이지       ⭐  │  │
│  │  ⠿  📖  DevOps Guide             Wiki 스페이스     ⭐  │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 페이지 헤더

| 속성 | 값 |
|------|-----|
| 패딩 | `px-6 py-4` |
| 제목 | `"즐겨찾기"`, `text-2xl font-semibold` |

### 4.3 즐겨찾기 항목

```
┌─────────────────────────────────────────────────────────────┐
│  ⠿  📁  Worknest Backend                  프로젝트      ⭐ │
│  grip  icon  name                          type badge   star│
└─────────────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 높이 | `h-11` (44px) |
| 패딩 | `px-4` (목록 자체는 `px-6` 컨테이너 내부) |
| 레이아웃 | `flex items-center gap-3` |
| 배경 (기본) | `bg-background` |
| 호버 | `bg-accent/50` |
| 커서 | `cursor-pointer` |
| 하단 보더 | `border-b border-border/50` |
| 모서리 | `rounded-md` |
| DnD | `dnd-kit` sortable |

#### 드래그 핸들

| 속성 | 값 |
|------|-----|
| 아이콘 | `GripVertical` (Lucide, 16px) |
| 색상 | `text-muted-foreground/50` |
| 호버 시 | `text-muted-foreground` |
| 커서 | `cursor-grab` (드래그 중: `cursor-grabbing`) |
| 표시 | 항상 표시 |

#### 엔티티 아이콘

| 엔티티 유형 | 아이콘 | 크기 |
|-------------|--------|------|
| 프로젝트 | `Folder` (Lucide) | `w-4 h-4` |
| 이슈 | `CircleCheck` (Lucide) | `w-4 h-4` |
| Wiki 페이지 | `FileText` (Lucide) | `w-4 h-4` |
| Wiki 스페이스 | `BookOpen` (Lucide) | `w-4 h-4` |

아이콘 색상: `text-muted-foreground`

#### 엔티티 이름

| 속성 | 값 |
|------|-----|
| 텍스트 | `text-sm text-foreground truncate flex-1` |

#### 엔티티 유형 뱃지

| 속성 | 값 |
|------|-----|
| 텍스트 | "프로젝트" / "이슈" / "Wiki 페이지" / "Wiki 스페이스" |
| 스타일 | `text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5` |

#### 즐겨찾기 토글 (별 아이콘)

| 속성 | 값 |
|------|-----|
| 아이콘 | `Star` (Lucide, 16px) |
| 색상 (즐겨찾기됨) | `text-yellow-500 fill-yellow-500` |
| 호버 | `hover:text-yellow-400` |
| 크기 | `w-8 h-8 flex items-center justify-center rounded-md` |
| 동작 | 클릭 시 즐겨찾기 해제 (낙관적 업데이트) |

### 4.4 드래그 앤 드롭 순서 변경

| 속성 | 값 |
|------|-----|
| 라이브러리 | `@dnd-kit/sortable` |
| 드래그 중 | `opacity-85 shadow-lg scale-[1.01]` |
| 플레이스홀더 | `border-2 border-dashed border-border bg-muted/30 rounded-md` |
| 드롭 완료 | API 호출 (`PATCH /favorites/reorder`), 낙관적 업데이트 |

### 4.5 빈 상태

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│              [Star 아이콘, 48px]                          │
│              text-muted-foreground/50                    │
│                                                          │
│          즐겨찾기한 항목이 없습니다                         │
│          text-lg font-medium                             │
│                                                          │
│          프로젝트, 이슈, Wiki 페이지에서                    │
│          ⭐를 눌러 즐겨찾기에 추가하세요                     │
│          text-sm text-muted-foreground                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 레이아웃 | `flex flex-col items-center justify-center py-16 gap-2` |
| 아이콘 | `Star` (Lucide, 48px), `text-muted-foreground/50` |
| 제목 | `"즐겨찾기한 항목이 없습니다"`, `text-lg font-medium` |
| 설명 | `"프로젝트, 이슈, Wiki 페이지에서 ⭐를 눌러 즐겨찾기에 추가하세요"`, `text-sm text-muted-foreground` |

---

## 5. 로딩 상태

### 5.1 Inbox 스켈레톤

```
┌─────────────────────────────────────────────────────────┐
│  ░░  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ░░░░░░  ░░    │
│  ░░  ░░░░░░░░░░░░░░░░░░░░░░░░░░        ░░░░░░  ░░    │
│  ░░  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    ░░░░░░  ░░    │
│  ░░  ░░░░░░░░░░░░░░░░░░░░░░░           ░░░░░░        │
│  ░░  ░░░░░░░░░░░░░░░░░░░░░░░░░░░       ░░░░░░  ░░    │
└─────────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 행 수 | 5개 |
| 행 높이 | `h-14` (56px) |
| 컴포넌트 | `Skeleton` (shadcn/ui) |
| ARIA | `aria-busy="true" aria-label="알림 로딩 중"` |

### 5.2 My Issues 스켈레톤

| 속성 | 값 |
|------|-----|
| 아코디언 헤더 | `Skeleton` 2개 (`h-10`) |
| 행 수 | 각 아코디언 내부 3개 (`h-10`) |
| ARIA | `aria-busy="true" aria-label="이슈 로딩 중"` |

### 5.3 Favorites 스켈레톤

| 속성 | 값 |
|------|-----|
| 행 수 | 4개 (`h-11`) |
| ARIA | `aria-busy="true" aria-label="즐겨찾기 로딩 중"` |

---

## 6. 반응형 동작

| 화면 크기 | 동작 |
|-----------|------|
| 1280px+ | 전체 레이아웃 (사이드바 240px + 콘텐츠) |
| 1024~1279px | 사이드바 축소(48px) + 콘텐츠 전체 너비 |
| ~1023px | 미지원 배너 |

---

## 7. 접근성 (Accessibility)

### 7.1 ARIA

| 요소 | ARIA |
|------|------|
| Inbox 알림 목록 | `role="list" aria-label="알림 목록"` |
| 알림 항목 | `role="listitem" aria-label="{알림 메시지}"` |
| 읽지 않음 dot | `aria-label="읽지 않음"` (스크린 리더용) |
| My Issues 아코디언 | `role="region" aria-label="{카테고리명} 이슈"` |
| 아코디언 트리거 | `aria-expanded="{open}" aria-controls="section-{id}"` |
| Favorites 목록 | `role="list" aria-label="즐겨찾기 목록"` |
| 드래그 핸들 | `aria-roledescription="드래그 가능한 즐겨찾기"` |
| 모두 읽음 버튼 | `aria-label="모든 알림 읽음 처리"` |

### 7.2 키보드

| 키 | 동작 | 페이지 |
|------|------|--------|
| `Enter` | 선택된 항목으로 이동 | Inbox, My Issues, Favorites |
| `J` / `K` | 이전/다음 항목 포커스 이동 | 전체 |
| `Space` | 아코디언 토글 | My Issues |

### 7.3 스크린 리더

- 알림 도착: `aria-live="polite"` 영역에 새 알림 메시지 알림
- 즐겨찾기 순서 변경: `"{항목명}을 {위치}로 이동했습니다"` 알림
- 모두 읽음: `"모든 알림이 읽음 처리되었습니다"` 토스트

---

## 8. 요약 Quick Reference

```
┌───────────────────────────────────────────────────┐
│ My Work 요약                                       │
├───────────────────────────────────────────────────┤
│ 라우트: /my/inbox, /my/issues, /my/favorites      │
│                                                    │
│ Inbox:                                             │
│   페이지 제목: "알림", "모두 읽음 처리" 버튼         │
│   필터: 전체 | 읽지 않음                             │
│   항목: h-14, 아이콘(18px colored) + 메시지 +       │
│         시간(text-xs) + 읽지않음dot(w-2 bg-primary)│
│   빈 상태: "새로운 알림이 없습니다"                  │
│                                                    │
│ My Issues:                                         │
│   페이지 제목: "내 이슈"                             │
│   그룹: 상태 카테고리별 아코디언                      │
│   아코디언: h-10, chevron + dot + 카테고리명 + 카운트│
│   이슈 행: h-10, prefix + key + title + badge + prio│
│   빈 상태: "할당된 이슈가 없습니다"                  │
│                                                    │
│ Favorites:                                         │
│   페이지 제목: "즐겨찾기"                            │
│   항목: h-11, grip + icon + name + type badge + star│
│   DnD: dnd-kit sortable, 순서 변경 가능             │
│   빈 상태: "즐겨찾기한 항목이 없습니다"              │
└───────────────────────────────────────────────────┘
```
