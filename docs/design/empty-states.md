# Worknest Empty State 디자인 스펙 (CP7-DS-1)

> 이 문서는 Worknest 전체 애플리케이션에서 사용되는 모든 빈 상태(Empty State) 화면의 디자인을 정의합니다.
> 디자인 시스템 토큰은 `design-system.md`를 참조합니다.
> FEATURE_SPEC 12.10 Empty State 목록을 기반으로 합니다.

---

## 1. 개요

빈 상태는 데이터가 없거나 검색 결과가 없을 때 사용자에게 맥락과 다음 행동을 안내하는 UI 패턴입니다.

### 1.1 핵심 원칙

- **안내**: 왜 비어있는지, 무엇을 해야 하는지를 명확히 전달
- **행동 유도**: CTA 버튼으로 즉시 다음 행동을 유도
- **일관성**: 모든 빈 상태는 동일한 `EmptyState` 컴포넌트를 사용
- **간결함**: 일러스트 없이 아이콘 + 텍스트 + CTA 조합으로 구성

---

## 2. 공통 컴포넌트: `EmptyState`

### 2.1 컴포넌트 인터페이스

```tsx
interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "ghost";
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  compact?: boolean; // 컬럼 내부 등 좁은 영역용
}
```

### 2.2 레이아웃 (기본)

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│                                                      │
│              [아이콘, 48px]                           │
│              text-muted-foreground/50                │
│                                                      │
│          타이틀 텍스트                                 │
│          text-lg font-medium                         │
│                                                      │
│          설명 텍스트                                   │
│          text-sm text-muted-foreground               │
│                                                      │
│          [CTA 버튼]                                   │
│          Button variant="outline"                    │
│                                                      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 2.3 기본 스타일

| 속성 | 값 |
|------|-----|
| 컨테이너 | `flex flex-col items-center justify-center py-16 gap-2` |
| 아이콘 크기 | `w-12 h-12` (48px) |
| 아이콘 색상 | `text-muted-foreground/50` |
| 제목 | `text-lg font-medium text-foreground mt-2` |
| 설명 | `text-sm text-muted-foreground text-center max-w-sm` |
| CTA 버튼 | `Button` variant=`outline`, `mt-4` |
| CTA 텍스트 | `text-sm font-medium` |
| 보조 액션 | `text-sm text-muted-foreground hover:text-foreground cursor-pointer mt-1` |

### 2.4 컴팩트 스타일 (`compact={true}`)

칸반 컬럼, 사이드 패널 내부 등 좁은 영역에서 사용합니다.

| 속성 | 값 |
|------|-----|
| 컨테이너 | `flex flex-col items-center justify-center py-8 gap-1.5` |
| 아이콘 크기 | `w-8 h-8` (32px) |
| 아이콘 색상 | `text-muted-foreground/40` |
| 제목 | `text-sm font-medium text-muted-foreground` |
| 설명 | `text-xs text-muted-foreground/80 text-center max-w-[200px]` |
| CTA 버튼 | `Button` variant=`ghost` size=`sm`, `mt-2` |

### 2.5 접근성

| 요소 | ARIA |
|------|------|
| 컨테이너 | `role="status" aria-label="{title}"` |
| 아이콘 | `aria-hidden="true"` |
| CTA 버튼 | 표준 `Button` ARIA |
| 포커스 | CTA 버튼에 자동 포커스하지 않음 (자연 포커스 순서 유지) |

### 2.6 구현 예시

```tsx
import { Folder, Plus } from "lucide-react";
import { Button } from "@worknest/ui/button";

function EmptyState({ icon: Icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-label={title}
      className={compact
        ? "flex flex-col items-center justify-center py-8 gap-1.5"
        : "flex flex-col items-center justify-center py-16 gap-2"
      }
    >
      <Icon
        aria-hidden="true"
        className={compact
          ? "w-8 h-8 text-muted-foreground/40"
          : "w-12 h-12 text-muted-foreground/50"
        }
      />
      <p className={compact
        ? "text-sm font-medium text-muted-foreground mt-1"
        : "text-lg font-medium text-foreground mt-2"
      }>
        {title}
      </p>
      {description && (
        <p className={compact
          ? "text-xs text-muted-foreground/80 text-center max-w-[200px]"
          : "text-sm text-muted-foreground text-center max-w-sm"
        }>
          {description}
        </p>
      )}
      {action && (
        <Button
          variant={compact ? "ghost" : (action.variant ?? "outline")}
          size={compact ? "sm" : "default"}
          onClick={action.onClick}
          className={compact ? "mt-2" : "mt-4"}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

---

## 3. 화면별 Empty State 정의

### 3.1 프로젝트 없음

프로젝트 목록 페이지에서 워크스페이스에 프로젝트가 없을 때 표시됩니다.

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [Folder, 48px]                          │
│              text-muted-foreground/50                │
│                                                      │
│          프로젝트가 없습니다                            │
│          text-lg font-medium                         │
│                                                      │
│          프로젝트를 만들어 이슈와 작업을 관리하세요       │
│          text-sm text-muted-foreground               │
│                                                      │
│          [프로젝트 만들기]  Button outline             │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 아이콘 | `Folder` (Lucide, 48px) |
| 제목 | `"프로젝트가 없습니다"` |
| 설명 | `"프로젝트를 만들어 이슈와 작업을 관리하세요"` |
| CTA | `"프로젝트 만들기"` → 프로젝트 생성 모달 열기 |
| CTA variant | `outline` |

---

### 3.2 이슈 없음 (리스트 뷰)

프로젝트 이슈 목록에서 이슈가 하나도 없을 때 표시됩니다.

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [CirclePlus, 48px]                      │
│              text-muted-foreground/50                │
│                                                      │
│          C 를 눌러 첫 이슈를 만들어보세요                │
│          text-lg font-medium                         │
│                                                      │
│          이슈를 만들어 프로젝트의 작업을 추적하세요       │
│          text-sm text-muted-foreground               │
│                                                      │
│          [이슈 만들기]  Button outline                 │
│          text-xs text-muted-foreground: "C"          │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 아이콘 | `CirclePlus` (Lucide, 48px) |
| 제목 | `"C 를 눌러 첫 이슈를 만들어보세요"` |
| 설명 | `"이슈를 만들어 프로젝트의 작업을 추적하세요"` |
| CTA | `"이슈 만들기"` → Quick Add 모달 열기 |
| CTA variant | `outline` |
| 단축키 힌트 | CTA 버튼 우측에 `kbd` 스타일 `"C"`, `text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5 ml-2 font-mono` |

---

### 3.3 이슈 필터 결과 없음

필터 적용 후 조건에 맞는 이슈가 없을 때 표시됩니다.

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [SearchX, 48px]                         │
│              text-muted-foreground/50                │
│                                                      │
│          조건에 맞는 이슈가 없습니다                    │
│          text-lg font-medium                         │
│                                                      │
│          필터 조건을 변경하거나 초기화해보세요            │
│          text-sm text-muted-foreground               │
│                                                      │
│          [필터 초기화]  Button outline                 │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 아이콘 | `SearchX` (Lucide, 48px) |
| 제목 | `"조건에 맞는 이슈가 없습니다"` |
| 설명 | `"필터 조건을 변경하거나 초기화해보세요"` |
| CTA | `"필터 초기화"` → 모든 필터 제거 |
| CTA variant | `outline` |

---

### 3.4 칸반 전체 비어있음

칸반 보드에서 모든 컬럼에 이슈가 없을 때 표시됩니다.

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [LayoutGrid, 48px]                      │
│              text-muted-foreground/50                │
│                                                      │
│          이슈를 만들어 보드를 시작하세요                 │
│          text-lg font-medium                         │
│                                                      │
│          이슈를 생성하면 상태별로 칸반 보드에 표시됩니다   │
│          text-sm text-muted-foreground               │
│                                                      │
│          [이슈 만들기]  Button outline                 │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 아이콘 | `LayoutGrid` (Lucide, 48px) |
| 제목 | `"이슈를 만들어 보드를 시작하세요"` |
| 설명 | `"이슈를 생성하면 상태별로 칸반 보드에 표시됩니다"` |
| CTA | `"이슈 만들기"` → Quick Add 모달 열기 |
| CTA variant | `outline` |

---

### 3.5 칸반 특정 컬럼 비어있음

칸반 보드에서 특정 상태 컬럼에 이슈가 없을 때 표시됩니다. `compact` 모드를 사용합니다.

```
┌─ Todo ──────────────┐
│                      │
│   이슈를 드래그하거나  │
│   추가하세요          │
│   text-xs            │
│   text-muted-fg/60   │
│                      │
│   [+ 이슈]  ghost sm │
│                      │
└──────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 모드 | `compact` |
| 아이콘 | 없음 (컬럼 헤더에 이미 상태 아이콘 존재) |
| 제목 | 없음 |
| 설명 | `"이슈를 드래그하거나 추가하세요"`, `text-xs text-muted-foreground/60 text-center` |
| CTA | `"+ 이슈"` → 해당 상태로 Quick Add 열기 |
| CTA variant | `ghost` size=`sm` |
| 컨테이너 | `flex flex-col items-center justify-center py-6 gap-2` |
| 드롭 타겟 | `min-h-[120px]` (DnD 드롭 영역 확보) |
| 드롭 활성 | `border-2 border-dashed border-primary/30 rounded-lg bg-primary/5` |

---

### 3.6 사이클 없음

사이클 목록에서 프로젝트에 사이클이 없을 때 표시됩니다.

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [RefreshCw, 48px]                       │
│              text-muted-foreground/50                │
│                                                      │
│          사이클이 없습니다                              │
│          text-lg font-medium                         │
│                                                      │
│          사이클을 만들어 스프린트를 관리하세요             │
│          text-sm text-muted-foreground               │
│                                                      │
│          [사이클 만들기]  Button outline               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 아이콘 | `RefreshCw` (Lucide, 48px) |
| 제목 | `"사이클이 없습니다"` |
| 설명 | `"사이클을 만들어 스프린트를 관리하세요"` |
| CTA | `"사이클 만들기"` → 사이클 생성 모달 열기 |
| CTA variant | `outline` |

---

### 3.7 사이클 내 이슈 없음

특정 사이클을 선택했을 때 해당 사이클에 이슈가 없는 경우 표시됩니다.

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [ListChecks, 48px]                      │
│              text-muted-foreground/50                │
│                                                      │
│          이 사이클에 이슈가 없습니다                     │
│          text-lg font-medium                         │
│                                                      │
│          기존 이슈를 추가하거나 새 이슈를 만들어보세요     │
│          text-sm text-muted-foreground               │
│                                                      │
│          [이슈 추가]  Button outline                   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 아이콘 | `ListChecks` (Lucide, 48px) |
| 제목 | `"이 사이클에 이슈가 없습니다"` |
| 설명 | `"기존 이슈를 추가하거나 새 이슈를 만들어보세요"` |
| CTA | `"이슈 추가"` → 이슈 추가 Popover 열기 |
| CTA variant | `outline` |

---

### 3.8 Wiki 스페이스 없음

Wiki 영역에서 워크스페이스에 스페이스가 없을 때 표시됩니다.

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [BookOpen, 48px]                        │
│              text-muted-foreground/50                │
│                                                      │
│          지식을 한 곳에 모아보세요                      │
│          text-lg font-medium                         │
│                                                      │
│          스페이스를 만들어 팀의 문서를 정리하세요          │
│          text-sm text-muted-foreground               │
│                                                      │
│          [스페이스 만들기]  Button outline              │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 아이콘 | `BookOpen` (Lucide, 48px) |
| 제목 | `"지식을 한 곳에 모아보세요"` |
| 설명 | `"스페이스를 만들어 팀의 문서를 정리하세요"` |
| CTA | `"스페이스 만들기"` → 스페이스 생성 모달 열기 |
| CTA variant | `outline` |

---

### 3.9 Wiki 페이지 없음

Wiki 스페이스 내에서 페이지가 없을 때 표시됩니다.

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [FileText, 48px]                        │
│              text-muted-foreground/50                │
│                                                      │
│          첫 페이지를 작성해보세요                       │
│          text-lg font-medium                         │
│                                                      │
│          페이지를 만들어 팀과 지식을 공유하세요           │
│          text-sm text-muted-foreground               │
│                                                      │
│          [페이지 만들기]  Button outline               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 아이콘 | `FileText` (Lucide, 48px) |
| 제목 | `"첫 페이지를 작성해보세요"` |
| 설명 | `"페이지를 만들어 팀과 지식을 공유하세요"` |
| CTA | `"페이지 만들기"` → 페이지 생성 (자동 라우팅) |
| CTA variant | `outline` |

---

### 3.10 Wiki 페이지 미선택

Wiki 레이아웃에서 사이드바 트리는 있지만 페이지를 선택하지 않은 상태입니다.

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [FileText, 48px]                        │
│              text-muted-foreground/50                │
│                                                      │
│          페이지를 선택하세요                            │
│          text-lg font-medium                         │
│                                                      │
│          왼쪽 트리에서 페이지를 선택하거나               │
│          새 페이지를 만들어보세요                       │
│          text-sm text-muted-foreground               │
│                                                      │
│          [새 페이지 만들기]  Button outline            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 아이콘 | `FileText` (Lucide, 48px) |
| 제목 | `"페이지를 선택하세요"` |
| 설명 | `"왼쪽 트리에서 페이지를 선택하거나 새 페이지를 만들어보세요"` |
| CTA | `"새 페이지 만들기"` → 페이지 생성 |
| CTA variant | `outline` |

---

### 3.11 댓글 없음

이슈 상세의 댓글/활동 영역에서 댓글이 없을 때 표시됩니다. `compact` 모드를 사용합니다.

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [MessageSquare, 32px]                   │
│              text-muted-foreground/40                │
│                                                      │
│          아직 댓글이 없습니다                           │
│          text-sm font-medium                         │
│                                                      │
│          첫 댓글을 남겨보세요                           │
│          text-xs text-muted-foreground               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 모드 | `compact` |
| 아이콘 | `MessageSquare` (Lucide, 32px) |
| 제목 | `"아직 댓글이 없습니다"` |
| 설명 | `"첫 댓글을 남겨보세요"` |
| CTA | 없음 (댓글 입력 필드가 하단에 이미 존재) |

---

### 3.12 알림 없음 (Inbox)

Inbox 페이지에서 알림이 없을 때 표시됩니다.

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [Bell, 48px]                            │
│              text-muted-foreground/50                │
│                                                      │
│          새로운 알림이 없습니다                         │
│          text-lg font-medium                         │
│                                                      │
│          알림이 도착하면 여기에 표시됩니다                │
│          text-sm text-muted-foreground               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 아이콘 | `Bell` (Lucide, 48px) |
| 제목 | `"새로운 알림이 없습니다"` |
| 설명 | `"알림이 도착하면 여기에 표시됩니다"` |
| CTA | 없음 |

---

### 3.13 할당된 이슈 없음 (My Issues)

My Issues 페이지에서 사용자에게 할당된 이슈가 없을 때 표시됩니다.

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [CircleUser, 48px]                      │
│              text-muted-foreground/50                │
│                                                      │
│          할당된 이슈가 없습니다                         │
│          text-lg font-medium                         │
│                                                      │
│          이슈에 할당되면 여기에 표시됩니다                │
│          text-sm text-muted-foreground               │
│                                                      │
│          [프로젝트로 이동]  Button outline             │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 아이콘 | `CircleUser` (Lucide, 48px) |
| 제목 | `"할당된 이슈가 없습니다"` |
| 설명 | `"이슈에 할당되면 여기에 표시됩니다"` |
| CTA | `"프로젝트로 이동"` → 프로젝트 목록 페이지로 이동 |
| CTA variant | `outline` |

---

### 3.14 즐겨찾기 없음

Favorites 페이지에서 즐겨찾기한 항목이 없을 때 표시됩니다.

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [Star, 48px]                            │
│              text-muted-foreground/50                │
│                                                      │
│          즐겨찾기한 항목이 없습니다                      │
│          text-lg font-medium                         │
│                                                      │
│          프로젝트, 이슈, Wiki 페이지에서                │
│          별 아이콘을 눌러 즐겨찾기에 추가하세요           │
│          text-sm text-muted-foreground               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 아이콘 | `Star` (Lucide, 48px) |
| 제목 | `"즐겨찾기한 항목이 없습니다"` |
| 설명 | `"프로젝트, 이슈, Wiki 페이지에서 별 아이콘을 눌러 즐겨찾기에 추가하세요"` |
| CTA | 없음 (가이드 텍스트로 대체) |

---

### 3.15 검색 결과 없음

Command Palette (Cmd+K) 또는 검색 화면에서 결과가 없을 때 표시됩니다. `compact` 모드를 사용합니다.

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [Search, 32px]                          │
│              text-muted-foreground/40                │
│                                                      │
│          검색 결과가 없습니다                           │
│          text-sm font-medium                         │
│                                                      │
│          다른 검색어로 시도해보세요                      │
│          text-xs text-muted-foreground               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 모드 | `compact` |
| 아이콘 | `Search` (Lucide, 32px) |
| 제목 | `"검색 결과가 없습니다"` |
| 설명 | `"다른 검색어로 시도해보세요"` |
| CTA | 없음 |

---

### 3.16 저장된 뷰 없음

뷰 관리 영역에서 저장된 뷰가 없을 때 표시됩니다.

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [LayoutList, 48px]                      │
│              text-muted-foreground/50                │
│                                                      │
│          저장된 뷰가 없습니다                           │
│          text-lg font-medium                         │
│                                                      │
│          현재 필터를 뷰로 저장하여 빠르게 재사용하세요    │
│          text-sm text-muted-foreground               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 아이콘 | `LayoutList` (Lucide, 48px) |
| 제목 | `"저장된 뷰가 없습니다"` |
| 설명 | `"현재 필터를 뷰로 저장하여 빠르게 재사용하세요"` |
| CTA | 없음 (뷰 저장은 필터 툴바에서 수행) |

---

### 3.17 라벨 없음

프로젝트 설정 라벨 관리 화면에서 라벨이 없을 때 표시됩니다.

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [Tag, 48px]                             │
│              text-muted-foreground/50                │
│                                                      │
│          라벨이 없습니다                               │
│          text-lg font-medium                         │
│                                                      │
│          라벨을 만들어 이슈를 분류하세요                 │
│          text-sm text-muted-foreground               │
│                                                      │
│          [라벨 만들기]  Button outline                 │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 아이콘 | `Tag` (Lucide, 48px) |
| 제목 | `"라벨이 없습니다"` |
| 설명 | `"라벨을 만들어 이슈를 분류하세요"` |
| CTA | `"라벨 만들기"` → 라벨 생성 모달 열기 |
| CTA variant | `outline` |

---

### 3.18 멤버 없음 (빈 목록)

멤버 관리 화면에서 멤버 목록이 비어있을 때 표시됩니다. (초대 전 상태 또는 검색 결과 없음)

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              [Users, 48px]                           │
│              text-muted-foreground/50                │
│                                                      │
│          멤버가 없습니다                               │
│          text-lg font-medium                         │
│                                                      │
│          팀원을 초대하여 함께 협업하세요                 │
│          text-sm text-muted-foreground               │
│                                                      │
│          [멤버 초대]  Button outline                   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 아이콘 | `Users` (Lucide, 48px) |
| 제목 | `"멤버가 없습니다"` |
| 설명 | `"팀원을 초대하여 함께 협업하세요"` |
| CTA | `"멤버 초대"` → 멤버 초대 모달 열기 |
| CTA variant | `outline` |

---

## 4. 전체 목록 요약

| # | 화면 | 아이콘 (Lucide) | 제목 | CTA |
|---|------|----------------|------|-----|
| 1 | 프로젝트 없음 | `Folder` | 프로젝트가 없습니다 | 프로젝트 만들기 |
| 2 | 이슈 없음 (리스트) | `CirclePlus` | C 를 눌러 첫 이슈를 만들어보세요 | 이슈 만들기 + `C` 힌트 |
| 3 | 이슈 필터 결과 없음 | `SearchX` | 조건에 맞는 이슈가 없습니다 | 필터 초기화 |
| 4 | 칸반 전체 비어있음 | `LayoutGrid` | 이슈를 만들어 보드를 시작하세요 | 이슈 만들기 |
| 5 | 칸반 컬럼 비어있음 | (없음) | (없음) | + 이슈 (compact ghost) |
| 6 | 사이클 없음 | `RefreshCw` | 사이클이 없습니다 | 사이클 만들기 |
| 7 | 사이클 내 이슈 없음 | `ListChecks` | 이 사이클에 이슈가 없습니다 | 이슈 추가 |
| 8 | Wiki 스페이스 없음 | `BookOpen` | 지식을 한 곳에 모아보세요 | 스페이스 만들기 |
| 9 | Wiki 페이지 없음 | `FileText` | 첫 페이지를 작성해보세요 | 페이지 만들기 |
| 10 | Wiki 페이지 미선택 | `FileText` | 페이지를 선택하세요 | 새 페이지 만들기 |
| 11 | 댓글 없음 | `MessageSquare` | 아직 댓글이 없습니다 | (입력 필드 존재) |
| 12 | 알림 없음 (Inbox) | `Bell` | 새로운 알림이 없습니다 | 없음 |
| 13 | 할당된 이슈 없음 | `CircleUser` | 할당된 이슈가 없습니다 | 프로젝트로 이동 |
| 14 | 즐겨찾기 없음 | `Star` | 즐겨찾기한 항목이 없습니다 | (가이드 텍스트) |
| 15 | 검색 결과 없음 | `Search` | 검색 결과가 없습니다 | 없음 |
| 16 | 저장된 뷰 없음 | `LayoutList` | 저장된 뷰가 없습니다 | (가이드 텍스트) |
| 17 | 라벨 없음 | `Tag` | 라벨이 없습니다 | 라벨 만들기 |
| 18 | 멤버 없음 | `Users` | 멤버가 없습니다 | 멤버 초대 |

---

## 5. 디자인 규칙

### 5.1 아이콘 선택 기준

- 해당 엔티티를 대표하는 Lucide 아이콘 사용
- 디자인 시스템의 아이콘 매핑(`design-system.md` 5.5절)과 일관성 유지
- 검색/필터 관련은 `Search`, `SearchX` 계열 사용

### 5.2 CTA 가이드라인

| 유형 | CTA 패턴 |
|------|----------|
| 생성 가능 | `Button` variant=`outline` → 생성 모달 열기 |
| 이동 유도 | `Button` variant=`outline` → 해당 페이지로 네비게이션 |
| 초기화 | `Button` variant=`outline` → 필터/검색 초기화 |
| 가이드 | CTA 버튼 없이 설명 텍스트로 안내 |
| 기존 UI 활용 | CTA 버튼 없음 (댓글 입력 필드 등 기존 UI가 역할 대체) |

### 5.3 다크 모드

- 모든 색상은 CSS 변수(`text-foreground`, `text-muted-foreground` 등)를 사용하므로 자동 대응
- 아이콘 불투명도(`/50`, `/40`)도 다크 모드에서 적절한 대비 유지
- 추가적인 다크 모드 전용 스타일 불필요

### 5.4 반응형

| 화면 크기 | 동작 |
|-----------|------|
| 1280px+ | 기본 레이아웃, 콘텐츠 영역 중앙 |
| 1024~1279px | 사이드바 축소, 콘텐츠 전체 너비 — 빈 상태 동일 |
| ~1023px | 미지원 |

---

## 6. 요약 Quick Reference

```
┌───────────────────────────────────────────────────┐
│ Empty State 요약                                    │
├───────────────────────────────────────────────────┤
│ 컴포넌트: EmptyState (공통)                         │
│                                                    │
│ 기본 모드:                                          │
│   컨테이너: py-16, items-center, gap-2             │
│   아이콘: 48px (w-12 h-12), muted-foreground/50    │
│   제목: text-lg font-medium                        │
│   설명: text-sm text-muted-foreground, max-w-sm    │
│   CTA: Button outline, mt-4                        │
│                                                    │
│ 컴팩트 모드:                                        │
│   컨테이너: py-8, items-center, gap-1.5            │
│   아이콘: 32px (w-8 h-8), muted-foreground/40     │
│   제목: text-sm font-medium muted-foreground       │
│   설명: text-xs muted-foreground/80, max-w-[200px]│
│   CTA: Button ghost sm, mt-2                      │
│                                                    │
│ 전체 18개 화면 커버 (섹션 4 요약 테이블 참조)         │
│ ARIA: role="status", 아이콘 aria-hidden             │
└───────────────────────────────────────────────────┘
```
