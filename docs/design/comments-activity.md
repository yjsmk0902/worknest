# Worknest 댓글 & 활동 타임라인 설계 (CP6-DS-2)

> 이 문서는 이슈/Wiki 페이지의 댓글, 이모지 리액션, 활동 로그, 통합 타임라인 UI를 정의합니다.
> 디자인 시스템 토큰은 `design-system.md`를 참조합니다.

---

## 1. 개요

댓글과 활동 로그를 하나의 시간순 타임라인으로 통합하여 이슈/페이지의 전체 이력을 한 눈에 파악할 수 있도록 합니다.

### 1.1 핵심 원칙

- **통합 타임라인**: 댓글과 활동을 시간순으로 혼합 표시, 필터로 분리 가능
- **경량 에디터**: TipTap MiniEditor로 빠른 댓글 작성 (StarterKit + Placeholder + Link + Mention)
- **플랫 스레딩**: 1단계 답글만 허용 (깊은 중첩 없음)
- **이모지 리액션**: 20개 선별된 이모지로 빠른 감정 표현

---

## 2. 통합 타임라인

### 2.1 전체 레이아웃

```
┌─ 댓글 & 활동 ──────────────────────────────────────────┐
│                                                         │
│  ┌─ 필터 탭 ─────────────────────────────────────────┐  │
│  │  [전체]  [댓글]  [활동]                             │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ 타임라인 ────────────────────────────────────────┐  │
│  │                                                    │  │
│  │  [활동] Luke가 상태를 Todo에서 In Progress로...    │  │
│  │         2시간 전                                   │  │
│  │                                                    │  │
│  │  [댓글] 👤 Kim Park · 1시간 전                     │  │
│  │         이 이슈 관련해서 API 스펙 확인 부탁합니다     │  │
│  │         @Luke 참고해주세요                          │  │
│  │         👍2  ❤️1  [+]                               │  │
│  │         ─── 답글 ──────                            │  │
│  │         👤 Luke · 30분 전                          │  │
│  │         → 원본 댓글에 답글                          │  │
│  │         네 확인했습니다!                             │  │
│  │                                                    │  │
│  │  [활동] Luke가 우선순위를 Medium에서 High로...     │  │
│  │         20분 전                                    │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ 댓글 에디터 ─────────────────────────────────────┐  │
│  │  댓글 작성...                           [Cmd+↵]  │  │
│  │                                                    │  │
│  │  [B] [I] [🔗] [@]                                  │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.2 필터 탭

```
┌─────────────────────────────────────────────────────────┐
│  [전체]  [댓글]  [활동]                                   │
│  active  inactive  inactive                              │
└─────────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 컴포넌트 | 탭 버튼 그룹 (커스텀, shadcn `Tabs`와 유사) |
| 높이 | `h-9` (36px) |
| 레이아웃 | `flex items-center gap-1` |
| 패딩 | `px-3 py-1.5` |
| 활성 탭 | `bg-secondary text-secondary-foreground font-medium rounded-md` |
| 비활성 탭 | `text-muted-foreground hover:text-foreground` |
| 텍스트 | `text-sm` |
| 기본값 | "전체" 활성 |

---

## 3. 댓글 컴포넌트

### 3.1 댓글 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│  👤  Kim Park  ·  1시간 전                    [···]     │
│  avatar                                    more menu    │
│       name       timestamp                              │
│                                                         │
│  이 이슈 관련해서 API 스펙 확인 부탁합니다.                │
│  @Luke 참고해주세요                                      │
│                                                         │
│  [👍 2] [❤️ 1]  [+]                                     │
│  reaction pills   add                                   │
│                                                         │
│  💬 답글 1개                                             │
└─────────────────────────────────────────────────────────┘
```

### 3.2 댓글 헤더

| 요소 | 스타일 |
|------|--------|
| 아바타 | `Avatar` (shadcn/ui), `w-7 h-7 rounded-full` |
| 이름 | `text-sm font-medium text-foreground` |
| 구분자 | `"·"`, `text-muted-foreground mx-1` |
| 타임스탬프 | `text-xs text-muted-foreground` (상대 시간: "1시간 전") |
| 레이아웃 | `flex items-center gap-2` |

### 3.3 댓글 헤더 액션 메뉴

| 속성 | 값 |
|------|-----|
| 트리거 | `MoreHorizontal` 아이콘 (Lucide, 16px), 호버 시 표시 |
| 트리거 스타일 | `opacity-0 group-hover:opacity-100`, `h-7 w-7 rounded-md hover:bg-accent` |
| 컴포넌트 | `DropdownMenu` (shadcn/ui) |
| 메뉴 항목 (본인 댓글) | 수정 (`Pencil` 아이콘), 삭제 (`Trash2` 아이콘, `text-destructive`) |
| 메뉴 항목 (타인 댓글) | 답글 (`Reply` 아이콘) |
| 위치 | 헤더 우측 `ml-auto` |

### 3.4 댓글 본문

| 속성 | 값 |
|------|-----|
| 텍스트 | `text-sm text-foreground leading-relaxed` |
| 상단 간격 | `mt-1` |
| 좌측 간격 | `pl-9` (아바타 너비 + gap 정렬: 28px + 8px = 36px) |
| @멘션 | `text-primary font-medium cursor-pointer hover:underline` |
| 링크 | `text-primary underline underline-offset-2 hover:text-primary/80` |
| 이슈 키 | `text-primary font-mono text-xs hover:underline` (클릭 시 이슈로 이동) |

### 3.5 댓글 수정 모드

수정 버튼 클릭 시 댓글 본문이 MiniEditor로 교체됩니다.

```
┌─────────────────────────────────────────────────────────┐
│  👤  Kim Park  ·  1시간 전  (수정 중)                    │
│                                                         │
│  ┌─ MiniEditor (pre-filled) ──────────────────────────┐│
│  │  이 이슈 관련해서 API 스펙 확인 부탁합니다.           ││
│  │  @Luke 참고해주세요                                  ││
│  │                                                     ││
│  │  [B] [I] [🔗] [@]           [취소] [저장 Cmd+↵]    ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 에디터 | MiniEditor (기존 댓글 내용 pre-fill) |
| 취소 버튼 | `Button` variant=`ghost`, `text-sm`, "취소" |
| 저장 버튼 | `Button` variant=`default`, `text-sm`, "저장" |
| 단축키 | `Cmd+Enter` 로 저장 |
| 전환 | 인라인 교체 (모달 없음) |

### 3.6 댓글 삭제 확인

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `AlertDialog` (shadcn/ui) |
| 제목 | `"댓글 삭제"` |
| 설명 | `"삭제하시겠습니까?"` |
| 취소 버튼 | `"취소"`, variant=`outline` |
| 확인 버튼 | `"삭제"`, variant=`destructive` |

---

## 4. 플랫 답글 (Flat Replies)

### 4.1 답글 레이아웃

답글은 부모 댓글 아래에 32px 들여쓰기하여 표시합니다. 2단계 이상 중첩은 없습니다.

```
┌─────────────────────────────────────────────────────────┐
│  👤  Kim Park  ·  1시간 전                     [···]    │
│       이 이슈 관련해서 확인 부탁합니다                     │
│       [👍 2]  [+]                                       │
│                                                         │
│       ┌─── 답글 ─────────────────────────────────────┐  │
│       │  👤  Luke  ·  30분 전              [···]     │  │
│       │       → 원본 댓글에 답글                      │  │
│       │       네 확인했습니다!                         │  │
│       │       [+]                                     │  │
│       └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 4.2 답글 스타일

| 속성 | 값 |
|------|-----|
| 들여쓰기 | `ml-8` (32px) |
| 부모 참조 | `"→ 원본 댓글에 답글"`, `text-xs text-muted-foreground italic` |
| 좌측 보더 | `border-l-2 border-border pl-4` |
| 아바타 크기 | `w-6 h-6` (부모보다 약간 작게) |
| 나머지 | 부모 댓글과 동일한 구조 |

### 4.3 답글 작성

답글 버튼 클릭 또는 액션 메뉴에서 "답글" 선택 시, 부모 댓글 바로 아래에 MiniEditor가 인라인으로 삽입됩니다.

```
┌─────────────────────────────────────────────────────────┐
│  👤  Kim Park  ·  1시간 전                               │
│       이 이슈 관련해서 확인 부탁합니다                     │
│                                                         │
│       ┌─ MiniEditor (답글) ───────────────────────────┐ │
│       │  답글 작성...                                  │ │
│       │                                                │ │
│       │  [B] [I] [🔗] [@]              [취소] [답글]  │ │
│       └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 5. 이모지 리액션

### 5.1 이모지 세트

총 20개의 선별된 이모지를 사용합니다:

```
👍 ❤️ 😄 👀 🚀 🎉 😕 👎 ✅ ❌
🔥 💯 🙏 😱 💡 🤔 😂 🥳 👏 🙌
```

### 5.2 리액션 바

댓글 본문 아래에 표시됩니다.

```
┌─────────────────────────────────────────────────────────┐
│  [👍 2]  [❤️ 1]  [🚀 3]  [+]                           │
│  pill     pill     pill    add                          │
│  (self)   (other)  (self)  button                      │
└─────────────────────────────────────────────────────────┘
```

### 5.3 리액션 pill 스타일

| 속성 | 기본 (타인이 반응) | 본인이 반응 (self-reacted) |
|------|-------------------|--------------------------|
| 배경 | `bg-muted` | `bg-primary/10` |
| 보더 | `border border-transparent` | `border border-primary/30` |
| 모서리 | `rounded-full` | `rounded-full` |
| 패딩 | `px-2` | `px-2` |
| 높이 | `h-6` (24px) | `h-6` (24px) |
| 텍스트 | `text-xs` | `text-xs font-medium` |
| 커서 | `cursor-pointer` | `cursor-pointer` |
| 호버 | `hover:bg-muted/80` | `hover:bg-primary/15` |
| 레이아웃 | `inline-flex items-center gap-1` | 동일 |
| 간격 | pill 사이 `gap-1.5` | 동일 |

### 5.4 리액션 추가 버튼

```
[+]  ← 클릭 시 Popover 열림
```

| 속성 | 값 |
|------|-----|
| 아이콘 | `Plus` (Lucide, 14px) 또는 `SmilePlus` (Lucide, 14px) |
| 크기 | `w-6 h-6` |
| 배경 | `bg-muted/50 hover:bg-muted` |
| 모서리 | `rounded-full` |
| 표시 조건 | 댓글 호버 시 또는 기존 리액션이 있을 때 항상 표시 |

### 5.5 이모지 Popover (선택 패널)

```
┌───────────────────────────────────┐
│  👍  ❤️  😄  👀                   │
│  🚀  🎉  😕  👎                   │
│  ✅  ❌  🔥  💯                   │
│  🙏  😱  💡  🤔                   │
│  😂  🥳  👏  🙌                   │
└───────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `Popover` (shadcn/ui) |
| 너비 | `w-[180px]` |
| 레이아웃 | `grid grid-cols-4 gap-1` |
| 패딩 | `p-2` |
| 이모지 버튼 | `w-9 h-9 flex items-center justify-center rounded-md text-lg cursor-pointer hover:bg-accent` |
| 동작 | 이모지 클릭 → 리액션 토글 + Popover 닫기 |
| 이미 반응한 이모지 | `bg-primary/10` 배경 하이라이트 |

### 5.6 리액션 동작

| 동작 | 설명 |
|------|------|
| 이모지 pill 클릭 (self) | 내 리액션 제거 (토글) |
| 이모지 pill 클릭 (other) | 같은 이모지로 리액션 추가 |
| 이모지 pill 호버 | Tooltip: 반응한 사용자 이름 목록 (최대 5명 + "+N명") |
| "+" 클릭 | Popover 열기 |
| 낙관적 업데이트 | 즉시 UI 반영, 실패 시 롤백 |

---

## 6. 댓글 MiniEditor

### 6.1 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│  댓글 작성...                                            │
│                                                         │
│  (auto-expand)                                          │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│  [B] [I] [🔗] [@]                        Cmd+Enter 전송│
└─────────────────────────────────────────────────────────┘
```

### 6.2 에디터 영역

| 속성 | 값 |
|------|-----|
| 컴포넌트 | TipTap MiniEditor (`packages/editor`) |
| Extensions | StarterKit (Heading 비활성), Placeholder, Link, Mention |
| 기본 높이 | `min-h-[80px]` |
| 자동 확장 | 내용에 따라 자동 확장 (max-h 제한 없음, 스크롤 없음) |
| 보더 | `border border-input rounded-md` |
| 포커스 | `focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2` |
| 패딩 | `px-3 py-2` |
| placeholder | `"댓글 작성..."` |
| placeholder 스타일 | `text-muted-foreground` |

### 6.3 하단 툴바

| 속성 | 값 |
|------|-----|
| 레이아웃 | `flex items-center gap-1 border-t border-border px-2 py-1` |
| 높이 | `h-9` (36px) |

#### 툴바 버튼

| 버튼 | 아이콘 | 동작 | 단축키 |
|------|--------|------|--------|
| 굵게 | `Bold` (Lucide, 14px) | `toggleBold()` | `Cmd+B` |
| 기울임 | `Italic` (Lucide, 14px) | `toggleItalic()` | `Cmd+I` |
| 링크 | `Link` (Lucide, 14px) | 링크 삽입 Popover | `Cmd+K` |
| 멘션 | `AtSign` (Lucide, 14px) | `@` 문자 삽입 → 멘션 자동완성 | — |

| 툴바 버튼 스타일 | 값 |
|-----|-----|
| 크기 | `w-7 h-7` |
| 배경 (기본) | `bg-transparent` |
| 배경 (호버) | `hover:bg-accent` |
| 배경 (활성) | `bg-accent text-accent-foreground` |
| 모서리 | `rounded-sm` |
| 아이콘 색상 | `text-muted-foreground` (기본), `text-foreground` (활성) |

### 6.4 전송

| 속성 | 값 |
|------|-----|
| 단축키 | `Cmd+Enter` (macOS) / `Ctrl+Enter` (Windows/Linux) |
| 힌트 텍스트 | 툴바 우측 `"Cmd+Enter"`, `text-xs text-muted-foreground` |
| 전송 동작 | 에디터 내용 전송 → 에디터 초기화 → 타임라인에 낙관적 추가 |
| 빈 내용 방지 | 에디터가 비어있으면 전송 비활성화 |

### 6.5 @멘션 자동완성

```
입력: @lu
┌─────────────────────────┐
│  👤 Luke Kim            │  ← 자동완성 Popover
│  👤 Lucia Park          │     워크스페이스 멤버 검색
└─────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 트리거 | `@` 입력 후 문자 입력 |
| 컴포넌트 | TipTap Mention extension + 커스텀 suggestion |
| 팝오버 너비 | `w-[200px]` |
| 항목 | 아바타 `w-5 h-5` + 이름 `text-sm` |
| 필터 | 입력값으로 멤버 이름 필터링 (클라이언트) |
| 선택 | 클릭 또는 Enter |
| 스타일 | 삽입된 멘션: `text-primary font-medium` |

---

## 7. 활동 로그 항목

### 7.1 활동 항목 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│  [아이콘]  Luke가 상태를 Todo에서 In Progress로 변경     │
│  (18px)   text-sm text-muted-foreground    · 2시간 전   │
└─────────────────────────────────────────────────────────┘
```

### 7.2 활동 항목 스타일

| 속성 | 값 |
|------|-----|
| 레이아웃 | `flex items-start gap-3 py-2` |
| 패딩 | `px-4` |
| 좌측 아이콘 | 변경 유형별 아이콘, `w-[18px] h-[18px]` |
| 설명 텍스트 | `text-sm text-muted-foreground` |
| 사용자 이름 | `text-sm font-medium text-foreground` (본문 내 인라인) |
| 타임스탬프 | `text-xs text-muted-foreground` |
| 구분자 | `"·"`, `text-muted-foreground mx-1` |

### 7.3 활동 유형별 아이콘

| 활동 유형 | 아이콘 | 색상 |
|-----------|--------|------|
| 상태 변경 | `RefreshCw` (Lucide) | `text-blue-500` |
| 우선순위 변경 | `AlertTriangle` (Lucide) | `text-orange-500` |
| 담당자 변경 | `UserPlus` (Lucide) | `text-green-500` |
| 라벨 변경 | `Tag` (Lucide) | `text-purple-500` |
| 마감일 변경 | `Calendar` (Lucide) | `text-amber-500` |
| 타입 변경 | `Layers` (Lucide) | `text-teal-500` |
| 이슈 생성 | `Plus` (Lucide) | `text-green-500` |
| 서브이슈 추가 | `ListPlus` (Lucide) | `text-blue-500` |

### 7.4 활동 설명 형식

```
{사용자명}가 {속성}를 {이전값}에서 {새값}으로 변경
{사용자명}가 이슈를 생성
{사용자명}가 {담당자명}를 담당자로 추가
{사용자명}가 {라벨명} 라벨을 추가
```

| 요소 | 스타일 |
|------|--------|
| 사용자명 | `font-medium text-foreground` |
| 속성/값 | `font-medium` |
| 나머지 텍스트 | `text-muted-foreground` |

---

## 8. 빈 상태 (Empty State)

### 8.1 댓글 없음

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              [MessageSquare 아이콘, 32px]                │
│              text-muted-foreground/50                   │
│                                                         │
│          아직 댓글이 없습니다                               │
│          text-sm text-muted-foreground                  │
│                                                         │
│          첫 번째 댓글을 작성해 보세요                       │
│          text-xs text-muted-foreground/70               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 레이아웃 | `flex flex-col items-center justify-center py-8` |
| 아이콘 | `MessageSquare` (Lucide, 32px), `text-muted-foreground/50` |
| 제목 | `"아직 댓글이 없습니다"`, `text-sm text-muted-foreground mt-2` |
| 설명 | `"첫 번째 댓글을 작성해 보세요"`, `text-xs text-muted-foreground/70 mt-1` |

### 8.2 활동 없음 (필터 적용 시)

| 속성 | 값 |
|------|-----|
| 텍스트 | `"활동 기록이 없습니다"`, `text-sm text-muted-foreground` |
| 레이아웃 | 동일 |

---

## 9. 로딩 상태

### 9.1 타임라인 스켈레톤

```
┌─────────────────────────────────────────────────────────┐
│  ░░  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ░░░░░           │
│                                                         │
│  ░░░░░  ░░░░░░░░░░░  ·  ░░░░░░                        │
│         ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                │
│         ░░░░░░░░░░░░░░░                                │
│                                                         │
│  ░░  ░░░░░░░░░░░░░░░░░░░░░░░░░░  ░░░░░                │
└─────────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 행 수 | 4개 (댓글 2 + 활동 2) |
| 컴포넌트 | `Skeleton` (shadcn/ui) |
| 애니메이션 | shimmer |
| ARIA | `aria-busy="true" aria-label="댓글 및 활동 로딩 중"` |

---

## 10. 키보드 내비게이션

| 키 | 동작 | 조건 |
|------|------|------|
| `Cmd+Enter` | 댓글 전송 | MiniEditor 포커스 |
| `Esc` | 수정 모드 취소 / 답글 에디터 닫기 | 에디터 포커스 |
| `Tab` | 툴바 버튼 간 이동 | MiniEditor 포커스 |

---

## 11. 접근성 (Accessibility)

### 11.1 ARIA

| 요소 | ARIA |
|------|------|
| 타임라인 컨테이너 | `role="feed" aria-label="댓글 및 활동"` |
| 댓글 항목 | `role="article" aria-label="{작성자} 댓글"` |
| 활동 항목 | `role="article" aria-label="활동 로그"` |
| 필터 탭 | `role="tablist"`, 각 탭은 `role="tab" aria-selected` |
| 리액션 pill | `role="button" aria-label="{이모지} {count}개 리액션"` |
| 이모지 Popover | `role="grid" aria-label="이모지 선택"` |
| MiniEditor | `role="textbox" aria-label="댓글 작성" aria-multiline="true"` |
| 삭제 확인 | `role="alertdialog"` |

### 11.2 스크린 리더

- 새 댓글 추가: `aria-live="polite"` 영역에 `"{작성자}가 댓글을 추가했습니다"` 알림
- 리액션 변경: pill의 `aria-label` 업데이트
- 삭제 완료: `"댓글이 삭제되었습니다"` 토스트

---

## 12. 요약 Quick Reference

```
┌───────────────────────────────────────────────────┐
│ 댓글 & 활동 요약                                    │
├───────────────────────────────────────────────────┤
│ 타임라인: 댓글 + 활동 혼합 시간순                    │
│ 필터 탭: 전체 | 댓글 | 활동                         │
│ 댓글 헤더: avatar(28px) + 이름 + 타임스탬프          │
│ 댓글 본문: text-sm, @멘션=text-primary              │
│ 답글: ml-8, border-l-2, "→ 원본 댓글에 답글"        │
│ 리액션: pill(rounded-full, h-6, px-2)              │
│   - self: bg-primary/10 border-primary/30          │
│   - other: bg-muted                                │
│   - Popover: grid-cols-4, 20 emojis, w-[180px]    │
│ MiniEditor: TipTap (StarterKit+Placeholder+        │
│             Link+Mention), min-h-[80px]            │
│ 툴바: B, I, Link, @, 우측 Cmd+Enter 힌트          │
│ 활동: 아이콘(18px, colored) + 설명(muted) + 시간   │
│ 수정: 인라인 MiniEditor 교체                        │
│ 삭제: AlertDialog "삭제하시겠습니까?"               │
│ 빈 상태: "아직 댓글이 없습니다"                      │
└───────────────────────────────────────────────────┘
```
