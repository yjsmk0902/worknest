# Worknest 알림 시스템 설계 (CP6-DS-4)

> 이 문서는 알림 벨 아이콘, 알림 드롭다운, 실시간 토스트 알림의 디자인을 정의합니다.
> Inbox 전체 페이지 레이아웃은 `my-work.md` 섹션 2를 참조합니다.
> 디자인 시스템 토큰은 `design-system.md`를 참조합니다.

---

## 1. 개요

알림 시스템은 세 가지 UI 요소로 구성됩니다:
1. **벨 아이콘**: 사이드바 상단, 읽지 않은 알림 수 표시
2. **알림 드롭다운**: 벨 클릭 시 최근 알림 목록 Popover
3. **실시간 토스트**: WebSocket `notification.new` 이벤트 수신 시 Sonner 토스트

### 1.1 핵심 원칙

- **비간섭**: 토스트는 작업 흐름을 방해하지 않고 5초 후 자동 닫힘
- **즉각 인지**: 벨 아이콘 뱃지로 읽지 않은 알림 수를 항상 표시
- **빠른 동선**: 드롭다운에서 직접 엔티티로 이동, 전체 목록은 Inbox로 연결

---

## 2. 벨 아이콘

### 2.1 위치

사이드바 상단 OrgWorkspaceSelector 우측에 배치합니다.

```
┌─ 사이드바 상단 ──────────────────────────┐
│  [OW] Org / Workspace  ▼        🔔      │
│  org/ws selector                bell     │
│                                 (알림)   │
└──────────────────────────────────────────┘
```

**확장 사이드바(240px):** OrgWorkspaceSelector 행 우측에 벨 아이콘 배치

```
┌────────────────────────────────────────┐
│  [O] Organization Name              🔔│
│      Workspace Name     ▼              │
└────────────────────────────────────────┘
```

**축소 사이드바(48px):** My Work 아이콘 그룹 내 Bell 아이콘 (이미 구현됨)

### 2.2 벨 아이콘 스타일

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `button` (PopoverTrigger) |
| 크기 | `w-9 h-9 flex items-center justify-center rounded-md` |
| 아이콘 | `Bell` (Lucide) |
| 아이콘 크기 | `w-5 h-5` |
| 아이콘 색상 | `text-muted-foreground` |
| 호버 | `hover:bg-sidebar-accent hover:text-sidebar-accent-foreground` |
| 포커스 | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |
| 위치 | `relative` (뱃지 기준점) |

### 2.3 읽지 않은 알림 뱃지

```
      🔔
    [3]    ← 뱃지 (absolute 위치)
```

| 속성 | 값 |
|------|-----|
| 위치 | `absolute -top-1 -right-1` |
| 크기 | `w-4 h-4` (16px) |
| 배경 | `bg-destructive` |
| 텍스트 | `text-[10px] font-medium text-white` |
| 모서리 | `rounded-full` |
| 정렬 | `flex items-center justify-center` |
| 표시 조건 | 읽지 않은 알림 > 0일 때만 표시 |
| 최대 숫자 | 9 초과 시 `"9+"` 표시 |
| 애니메이션 | 새 알림 수신 시 미세 스케일 (`animate-badge-pulse`: `scale-110 → scale-100`, 300ms) |

### 2.4 벨 아이콘 알림 애니메이션

새로운 알림 수신 시 벨 아이콘에 미세한 흔들림 효과를 적용합니다.

```css
@keyframes bell-shake {
  0%, 100% { transform: rotate(0deg); }
  15% { transform: rotate(8deg); }
  30% { transform: rotate(-8deg); }
  45% { transform: rotate(5deg); }
  60% { transform: rotate(-5deg); }
  75% { transform: rotate(2deg); }
}

.animate-bell-shake {
  animation: bell-shake 0.6s ease-in-out;
}
```

| 속성 | 값 |
|------|-----|
| 트리거 | WebSocket `notification.new` 수신 시 1회 |
| 지속 시간 | 600ms |
| 반복 | 1회 |

---

## 3. 알림 드롭다운 (Popover)

### 3.1 전체 레이아웃

```
┌─ 알림 Popover ──────────────────────────────────┐
│                                                   │
│  ┌─ 헤더 ──────────────────────────────────────┐ │
│  │  알림                        모두 읽음       │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─ 알림 목록 (ScrollArea) ────────────────────┐ │
│  │                                              │ │
│  │  [UserPlus] Luke가 당신을 할당...  2시간 전 ●│ │
│  │  [AtSign]   Kim이 멘션...        1시간 전 ● │ │
│  │  [MsgSq]    Park가 댓글...       30분 전  ● │ │
│  │  [RefreshCw] 상태 변경...         어제       │ │
│  │                                              │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  ┌─ 푸터 ──────────────────────────────────────┐ │
│  │  모든 알림 보기 →                            │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
└───────────────────────────────────────────────────┘
```

### 3.2 Popover 컨테이너

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `Popover` + `PopoverContent` (shadcn/ui) |
| 너비 | `w-[360px]` |
| 최대 높이 | `max-h-[400px]` |
| 배경 | `bg-popover` |
| 보더 | `border border-border` |
| 모서리 | `rounded-xl` |
| 그림자 | `shadow-lg` |
| 패딩 | `p-0` (내부 요소에서 개별 패딩) |
| 정렬 | `align="end"` (벨 아이콘 우측 정렬) |
| 사이드 | `side="bottom"` |

### 3.3 헤더

| 속성 | 값 |
|------|-----|
| 레이아웃 | `flex items-center justify-between px-4 py-3` |
| 하단 보더 | `border-b border-border` |
| 제목 | `"알림"`, `text-sm font-semibold` |
| 버튼 | `"모두 읽음"`, `text-xs text-muted-foreground hover:text-foreground cursor-pointer` |

### 3.4 알림 목록

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `ScrollArea` (shadcn/ui) |
| 최대 항목 수 | 10개 |
| 오버플로우 | `overflow-y-auto` |

### 3.5 알림 항목 (컴팩트)

```
┌─────────────────────────────────────────────────────┐
│  [UserPlus]  Luke가 당신을 WORK-42에 할당  2시간 전 ●│
│  icon(16px)  message                     time  dot  │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 높이 | `h-12` (48px) |
| 패딩 | `px-4` |
| 레이아웃 | `flex items-center gap-2.5` |
| 배경 (기본) | `bg-popover` |
| 호버 | `bg-accent/50` |
| 커서 | `cursor-pointer` |
| 하단 보더 | `border-b border-border/30` (마지막 항목 제외) |

#### 좌측 아이콘 (컴팩트)

| 알림 유형 | 아이콘 | 크기 | 색상 |
|-----------|--------|------|------|
| 이슈 할당 | `UserPlus` (Lucide) | `w-4 h-4` | `text-blue-500` |
| @멘션 | `AtSign` (Lucide) | `w-4 h-4` | `text-purple-500` |
| 댓글 | `MessageSquare` (Lucide) | `w-4 h-4` | `text-green-500` |
| 상태 변경 | `RefreshCw` (Lucide) | `w-4 h-4` | `text-orange-500` |
| 워크스페이스 초대 | `Mail` (Lucide) | `w-4 h-4` | `text-primary` |

#### 중앙 메시지 (컴팩트)

| 속성 | 값 |
|------|-----|
| 컨테이너 | `flex-1 min-w-0` |
| 메시지 | `text-xs text-foreground truncate` |
| 사용자 이름 | `font-medium` (인라인) |
| 엔티티 링크 | `text-primary` (인라인) |

#### 우측 영역 (컴팩트)

| 요소 | 스타일 |
|------|--------|
| 타임스탬프 | `text-[10px] text-muted-foreground whitespace-nowrap` |
| 읽지 않음 dot | `w-2 h-2 bg-primary rounded-full ml-1 shrink-0` |

### 3.6 알림 클릭 동작

| 동작 | 설명 |
|------|------|
| 항목 클릭 | 엔티티로 이동 + 읽음 처리 + Popover 닫기 |
| 낙관적 업데이트 | 즉시 dot 제거 + 뱃지 카운트 감소 |

### 3.7 푸터

| 속성 | 값 |
|------|-----|
| 레이아웃 | `flex items-center justify-center py-2.5` |
| 상단 보더 | `border-t border-border` |
| 링크 텍스트 | `"모든 알림 보기"`, `text-xs text-muted-foreground hover:text-foreground cursor-pointer` |
| 동작 | 클릭 시 Inbox 페이지로 이동 (`/:orgSlug/:wsSlug/my/inbox`) + Popover 닫기 |

### 3.8 빈 상태

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│            [Bell 아이콘, 28px]                        │
│            text-muted-foreground/40                  │
│                                                      │
│        새로운 알림이 없습니다                           │
│        text-xs text-muted-foreground                 │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 레이아웃 | `flex flex-col items-center justify-center py-8 gap-2` |
| 아이콘 | `Bell` (Lucide, 28px), `text-muted-foreground/40` |
| 텍스트 | `"새로운 알림이 없습니다"`, `text-xs text-muted-foreground` |

---

## 4. 실시간 토스트 알림

### 4.1 트리거

WebSocket `notification.new` 이벤트 수신 시 Sonner 토스트를 표시합니다.

### 4.2 토스트 레이아웃

```
┌─────────────────────────────────────────────────────┐
│  [UserPlus]  Luke가 당신을 WORK-42에 할당  [보기]    │
│  icon(16px)  message text-sm              action    │
│  colored                                  link      │
└─────────────────────────────────────────────────────┘
```

### 4.3 토스트 스타일

| 속성 | 값 |
|------|-----|
| 라이브러리 | Sonner |
| 위치 | `bottom-right` (기본) |
| 너비 | Sonner 기본 (356px) |
| 배경 | `bg-popover` |
| 보더 | `border border-border` |
| 모서리 | `rounded-lg` |
| 그림자 | `shadow-lg` |
| z-index | `z-[100]` |

### 4.4 토스트 내용

| 요소 | 스타일 |
|------|--------|
| 아이콘 | 알림 유형별 아이콘 (드롭다운과 동일), `w-4 h-4` |
| 메시지 | `text-sm text-foreground` |
| 사용자 이름 | `font-medium` (인라인) |
| 엔티티 참조 | `text-primary` (인라인) |
| "보기" 액션 | Sonner `action` 옵션, `text-sm text-primary font-medium hover:underline cursor-pointer` |

### 4.5 토스트 동작

| 속성 | 값 |
|------|-----|
| 자동 닫힘 | 5초 (`duration: 5000`) |
| "보기" 클릭 | 해당 엔티티로 이동 + 토스트 닫기 |
| 닫기 | 우측 X 버튼 또는 스와이프 |
| 중복 방지 | 같은 알림 ID에 대해 중복 토스트 미표시 |

### 4.6 토스트 + 벨 아이콘 연동

1. WebSocket `notification.new` 수신
2. 벨 아이콘 뱃지 카운트 증가 (낙관적)
3. 벨 아이콘 `animate-bell-shake` 실행
4. Sonner 토스트 표시
5. Inbox가 열려 있으면 알림 목록에 실시간 추가

---

## 5. 알림 데이터 흐름

```
[서버] 이벤트 발생 (이슈 할당, 멘션, 댓글 등)
  │
  ├─ NotificationService → DB INSERT (notifications 테이블)
  │
  ├─ WebSocket → `notification.new` 이벤트 전송
  │   (user:{id} 채널)
  │
  └─ [클라이언트]
      ├─ WebSocket 수신
      ├─ 벨 뱃지 카운트 업데이트 (Zustand 스토어)
      ├─ 벨 아이콘 shake 애니메이션
      ├─ Sonner 토스트 표시
      └─ (Inbox 열림 시) 알림 목록 맨 위에 추가
```

---

## 6. 알림 메시지 템플릿

| 유형 | 메시지 형식 |
|------|------------|
| 이슈 할당 | `"{사용자명}가 당신을 {이슈키}에 할당했습니다"` |
| @멘션 | `"{사용자명}가 {이슈키/페이지명}에서 당신을 멘션했습니다"` |
| 댓글 | `"{사용자명}가 {이슈키}에 댓글을 추가했습니다"` |
| 상태 변경 | `"{사용자명}가 {이슈키}의 상태를 {새상태}로 변경했습니다"` |
| 워크스페이스 초대 | `"{워크스페이스명}에 초대되었습니다"` |

---

## 7. 접근성 (Accessibility)

### 7.1 ARIA

| 요소 | ARIA |
|------|------|
| 벨 아이콘 버튼 | `aria-label="알림" aria-haspopup="true" aria-expanded="{open}"` |
| 뱃지 | `aria-label="읽지 않은 알림 {count}개"` |
| 드롭다운 | Popover 기본 ARIA (Radix) |
| 알림 목록 | `role="list" aria-label="최근 알림"` |
| 알림 항목 | `role="listitem" aria-label="{알림 메시지}"` |
| 토스트 | `role="status" aria-live="polite"` (Sonner 기본) |
| "모두 읽음" 버튼 | `aria-label="모든 알림 읽음 처리"` |

### 7.2 키보드

| 키 | 동작 | 조건 |
|------|------|------|
| `Enter` / `Space` | 벨 아이콘 클릭 → Popover 토글 | 벨 아이콘 포커스 |
| `↓` | 다음 알림 항목으로 포커스 이동 | Popover 열림 |
| `↑` | 이전 알림 항목으로 포커스 이동 | Popover 열림 |
| `Enter` | 포커스된 알림 항목 클릭 (이동) | 항목 포커스 |
| `Esc` | Popover 닫기 | Popover 열림 |
| `Tab` | 다음 포커스 가능 요소 | — |

### 7.3 스크린 리더

- 새 알림: 토스트의 `aria-live` 영역이 자동으로 알림 읽기
- 뱃지 업데이트: `aria-label` 동적 업데이트 (`"읽지 않은 알림 3개"` → `"읽지 않은 알림 4개"`)
- 모두 읽음: `"모든 알림이 읽음 처리되었습니다"` 토스트

---

## 8. 반응형 동작

| 화면 크기 | 동작 |
|-----------|------|
| 1280px+ | 벨 아이콘 사이드바 상단, Popover `w-[360px]` |
| 1024~1279px | 축소 사이드바에서 벨 아이콘 유지, Popover 동일 |
| ~1023px | 미지원 |

---

## 9. 요약 Quick Reference

```
┌───────────────────────────────────────────────────┐
│ 알림 시스템 요약                                     │
├───────────────────────────────────────────────────┤
│ 벨 아이콘:                                         │
│   위치: 사이드바 상단 (OrgWS 우측)                   │
│   크기: w-9 h-9, 아이콘 w-5 h-5                    │
│   뱃지: absolute -top-1 -right-1, w-4 h-4          │
│         bg-destructive, text-[10px] text-white      │
│         max "9+"                                    │
│   애니메이션: bell-shake (600ms, 1회)               │
│                                                    │
│ 드롭다운 (Popover):                                 │
│   너비: w-[360px], max-h-[400px]                   │
│   헤더: "알림" + "모두 읽음"                         │
│   항목: h-12, icon(16px) + 메시지(text-xs) +        │
│         시간(text-[10px]) + dot(w-2)               │
│   최대 10개, ScrollArea                             │
│   푸터: "모든 알림 보기" → Inbox                    │
│   빈 상태: "새로운 알림이 없습니다"                  │
│                                                    │
│ 실시간 토스트:                                      │
│   라이브러리: Sonner                                │
│   위치: bottom-right                                │
│   내용: icon + 메시지 + "보기" 액션                  │
│   자동 닫힘: 5초                                    │
│   트리거: WebSocket notification.new                │
│                                                    │
│ 알림 유형 아이콘:                                    │
│   할당: UserPlus (blue)                             │
│   멘션: AtSign (purple)                             │
│   댓글: MessageSquare (green)                       │
│   상태: RefreshCw (orange)                          │
│   초대: Mail (primary)                              │
└───────────────────────────────────────────────────┘
```
