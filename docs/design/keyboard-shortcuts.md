# Worknest 키보드 단축키 시스템 설계 (CP2-DS-4)

> 이 문서는 키보드 단축키 시스템의 아키텍처, `useHotkey` 훅 설계, 전역/뷰별 단축키 매핑, 단축키 시트 오버레이 컴포넌트를 정의합니다.
> 디자인 시스템 토큰은 `design-system.md`를 참조합니다.

---

## 1. 설계 원칙

### 1.1 핵심 원칙

1. **Keyboard-first**: 마우스 없이 모든 주요 동작을 수행할 수 있어야 합니다.
2. **컨텍스트 인식**: 입력 필드, 에디터 포커스 시 단축키를 비활성화하여 충돌을 방지합니다.
3. **점진적 학습**: 툴팁에 단축키 힌트를 표시하여 사용자가 자연스럽게 학습합니다.
4. **일관성**: 동일 기능에는 동일 단축키를 사용하고, 업계 표준(Jira, Linear)을 참고합니다.
5. **비파괴적**: 단축키로 삭제 등 위험 동작을 직접 실행하지 않습니다. (확인 모달 거침)

---

## 2. `useHotkey` 훅 설계

### 2.1 인터페이스

```typescript
type HotkeyOptions = {
  /** 단축키가 활성화되는 컨텍스트 */
  context?: 'global' | 'issue-list' | 'issue-detail' | 'board' | 'wiki';
  /** 단축키 활성화 조건 (false면 비활성) */
  enabled?: boolean;
  /** 이벤트 전파 중단 여부 (기본: true) */
  preventDefault?: boolean;
};

function useHotkey(
  key: string,
  handler: (event: KeyboardEvent) => void,
  options?: HotkeyOptions
): void;
```

### 2.2 사용 예시

```typescript
// 전역 단축키
useHotkey('mod+k', openCommandPalette, { context: 'global' });

// 이슈 리스트 단축키
useHotkey('j', selectNextIssue, { context: 'issue-list' });
useHotkey('k', selectPrevIssue, { context: 'issue-list' });

// 이슈 상세 단축키
useHotkey('s', openStatusDropdown, { context: 'issue-detail' });
useHotkey('a', openAssigneePopover, { context: 'issue-detail' });

// 조건부 활성화
useHotkey('c', openQuickAdd, {
  context: 'issue-list',
  enabled: !isQuickAddOpen,
});
```

### 2.3 키 표기법

| 표기 | 의미 | macOS | Windows/Linux |
|------|------|-------|---------------|
| `mod` | 플랫폼 메타 키 | `Cmd` | `Ctrl` |
| `shift` | Shift 키 | `Shift` | `Shift` |
| `alt` | Alt/Option 키 | `Option` | `Alt` |
| `+` | 키 조합 구분자 | — | — |

예시: `mod+k` = macOS: `Cmd+K`, Windows: `Ctrl+K`

### 2.4 구현 요구사항

```typescript
// 내부 구현 개요
function useHotkey(key, handler, options = {}) {
  const { context = 'global', enabled = true, preventDefault = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const listener = (event: KeyboardEvent) => {
      // 1. activeContext 체크
      if (!isContextActive(context)) return;

      // 2. 입력 요소 포커스 체크 (context가 'global'이 아닌 경우)
      if (context !== 'global' && isInputFocused()) return;

      // 3. 키 매칭
      if (!matchesKey(event, key)) return;

      // 4. 이벤트 처리
      if (preventDefault) event.preventDefault();
      handler(event);
    };

    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [key, handler, context, enabled, preventDefault]);
}
```

---

## 3. activeContext 관리

### 3.1 컨텍스트 계층

```
global
├── issue-list      (이슈 리스트 뷰)
├── issue-detail    (이슈 상세 — Side Panel 또는 Full Page)
├── board           (칸반 보드 뷰)
└── wiki            (Wiki 에디터)
```

- `global` 컨텍스트의 단축키는 항상 활성화됩니다.
- 하위 컨텍스트의 단축키는 해당 뷰가 활성화된 경우에만 동작합니다.
- Side Panel이 열린 경우: `issue-detail` 컨텍스트가 활성화되고, `issue-list` 단축키도 유지됩니다.

### 3.2 입력 요소 비활성화

다음 요소에 포커스가 있을 때, 단일 키 단축키 (modifier 없는 키)는 비활성화됩니다.

```typescript
function isInputFocused(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  // contenteditable (TipTap 에디터 등)
  if (activeElement.getAttribute('contenteditable') === 'true') {
    return true;
  }

  // Radix Popover, Dialog 등 내부 입력
  if (activeElement.closest('[role="dialog"]') ||
      activeElement.closest('[role="listbox"]')) {
    return true;
  }

  return false;
}
```

> **예외**: `mod+` 조합 단축키 (예: `mod+k`, `mod+/`)는 입력 요소 포커스 중에도 동작합니다.

### 3.3 컨텍스트 결정 로직

```
1. 현재 라우트 확인
   - /projects/:prefix/issues  → issue-list
   - /projects/:prefix/issues/:key  → issue-detail
   - /projects/:prefix/board  → board
   - /wiki/**  → wiki

2. Side Panel 열림 여부
   - Side Panel 열림 → issue-detail 추가 활성화

3. 모달/다이얼로그 열림 여부
   - 모달 열림 → 모든 단축키 비활성 (모달 내부 키만 허용)
   - Command Palette 열림 → 모든 단축키 비활성
```

---

## 4. 전역 단축키

모든 페이지에서 동작하는 단축키입니다.

| 단축키 | 동작 | 비고 |
|--------|------|------|
| `Cmd+K` | Command Palette 열기/닫기 | 검색, 네비게이션, 명령어 |
| `Cmd+/` | 단축키 시트 오버레이 열기/닫기 | 전체 단축키 목록 표시 |
| `Cmd+\` | 사이드바 토글 (열림/축소) | 레이아웃 전환 |

### 4.1 Command Palette (`Cmd+K`)

- 이미 `app-shell.md`에서 정의된 레이아웃과 동작을 따릅니다.
- 입력 필드 포커스 중에도 `Cmd+K`는 동작합니다.
- 열려 있는 경우 `Esc`로 닫습니다.

---

## 5. 이슈 뷰 단축키

이슈 리스트(`issue-list`)와 칸반 보드(`board`) 컨텍스트에서 동작하는 단축키입니다.

### 5.1 이슈 네비게이션

| 단축키 | 동작 | 비고 |
|--------|------|------|
| `J` 또는 `↓` | 다음 이슈로 이동 (포커스) | 리스트: 아래로, 보드: 컬럼 내 아래로 |
| `K` 또는 `↑` | 이전 이슈로 이동 (포커스) | 리스트: 위로, 보드: 컬럼 내 위로 |
| `Enter` | 포커스된 이슈 열기 | Side Panel 또는 Full Page |
| `X` 또는 `Space` | 이슈 선택 토글 | 체크박스 토글 |
| `Esc` | 패널 닫기 / 선택 해제 | Side Panel 닫기 또는 모든 선택 해제 |
| `C` | Quick Add 활성화 | 이슈 빠른 생성 |

### 5.2 포커스 표시

```
리스트 뷰:
┌──────────────────────────────────────────────────────────┐
│  ☐  WRK-1  로그인 페이지 구현         ● Todo   Medium    │  ← 일반 행
│  ☐  WRK-2  회원가입 API              ● IP     High      │  ← 포커스 행
│  ☐  WRK-3  비밀번호 재설정            ● Done   Low       │     bg-accent
│                                                          │     border-l-2 border-primary
└──────────────────────────────────────────────────────────┘

보드 뷰:
┌─────────────────────┐
│                     │
│  ┌───────────────┐  │
│  │ WRK-1         │  │  ← 일반 카드
│  │ 로그인 구현     │  │
│  └───────────────┘  │
│                     │
│  ┌───────────────┐  │
│  │ WRK-2         │  │  ← 포커스 카드
│  │ 회원가입 API   │  │     ring-2 ring-primary
│  └───────────────┘  │
│                     │
└─────────────────────┘
```

| 속성 | 리스트 뷰 | 보드 뷰 |
|------|----------|---------|
| 포커스 배경 | `bg-accent` | 없음 |
| 포커스 보더 | `border-l-2 border-primary` | `ring-2 ring-primary` |
| 스크롤 | 포커스 이동 시 자동 스크롤 (viewport에 보이도록) | 동일 |
| 초기 포커스 | 첫 번째 이슈 (페이지 진입 시) | 첫 번째 컬럼의 첫 번째 카드 |

### 5.3 선택 동작

| 단축키 | 동작 |
|--------|------|
| `X` 또는 `Space` | 현재 포커스된 이슈의 체크박스 토글 |
| `Shift+↓` | 현재 이슈 선택 + 다음 이슈로 이동 (범위 선택) |
| `Shift+↑` | 현재 이슈 선택 + 이전 이슈로 이동 (범위 선택) |
| `Esc` | 모든 선택 해제 |

선택된 이슈가 있을 때 벌크 액션 바 표시:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  3개 선택됨    [상태 변경 ▼]  [우선순위 ▼]  [담당자 ▼]  [삭제] │  ← 하단 고정 바
│                                                              │     bg-card border-t shadow-lg
└──────────────────────────────────────────────────────────────┘     z-30
```

---

## 6. 이슈 상세 단축키

이슈 상세(`issue-detail`) 컨텍스트에서 동작하는 단축키입니다.
Side Panel 또는 Full Page 모두에서 동작합니다.

| 단축키 | 동작 | 비고 |
|--------|------|------|
| `S` | 상태 드롭다운 열기 | 상태 변경 |
| `A` | 담당자 Popover 열기 | 담당자 변경 |
| `L` | 라벨 Popover 열기 | 라벨 변경 |
| `P` | 우선순위 드롭다운 열기 | 우선순위 변경 |
| `T` | 타입 드롭다운 열기 | 타입 변경 |
| `D` | 마감일 DatePicker 열기 | 마감일 설정 |
| `F2` | 제목 인라인 편집 모드 진입 | 제목 편집 |
| `Esc` | 패널 닫기 (Side Panel) / 뒤로가기 (Full Page) | 닫기 |

### 6.1 드롭다운/Popover 열림 후 키보드 동작

| 키 | 동작 |
|------|------|
| `↑` / `↓` | 옵션 이동 |
| `Enter` | 선택 확정 |
| `Esc` | 드롭다운/Popover 닫기 |
| 문자 입력 | 검색 필터 (담당자, 라벨 Popover) |

### 6.2 단축키와 속성 컴포넌트 연결

```
[S] 키 → 상태 Select 트리거 클릭 → 드롭다운 열림 → 키보드 네비게이션
[A] 키 → 담당자 Popover 트리거 클릭 → Popover 열림 → 검색 필드 포커스
[L] 키 → 라벨 Popover 트리거 클릭 → Popover 열림 → 검색 필드 포커스
[P] 키 → 우선순위 Select 트리거 클릭 → 드롭다운 열림 → 키보드 네비게이션
[T] 키 → 타입 Select 트리거 클릭 → 드롭다운 열림 → 키보드 네비게이션
[D] 키 → 마감일 Popover 트리거 클릭 → DatePicker 열림
```

---

## 7. 단축키 시트 오버레이

### 7.1 트리거

| 트리거 | 동작 |
|--------|------|
| `Cmd+/` | 오버레이 열기/닫기 (토글) |
| 사이드바 사용자 메뉴 → "단축키" | 오버레이 열기 |
| `Esc` | 오버레이 닫기 |

### 7.2 레이아웃

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  키보드 단축키                                          [X]      │  ← text-lg font-semibold
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  전역                                                           │  ← 카테고리 헤더
│                                                                 │     text-sm font-semibold
│  ┌───────────────────────────────────────────────────────────┐  │     mb-2
│  │  Command Palette 열기          ⌘ K                        │  │
│  │  단축키 도움말                   ⌘ /                        │  │  ← 행 높이: 36px
│  │  사이드바 토글                   ⌘ \                        │  │     text-sm
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  이슈 네비게이션                                                 │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  이전 이슈                      K  또는  ↑                 │  │
│  │  다음 이슈                      J  또는  ↓                 │  │
│  │  이슈 열기                      Enter                     │  │
│  │  이슈 선택                      X  또는  Space             │  │
│  │  이슈 생성 (Quick Add)          C                          │  │
│  │  패널 닫기 / 선택 해제           Esc                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  이슈 상세                                                       │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  상태 변경                      S                          │  │
│  │  담당자 변경                    A                           │  │
│  │  라벨 변경                      L                          │  │
│  │  우선순위 변경                   P                          │  │
│  │  타입 변경                      T                          │  │
│  │  마감일 설정                    D                           │  │
│  │  제목 편집                      F2                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 오버레이 속성

| 속성 | 값 |
|------|-----|
| 컴포넌트 | Radix `Dialog` |
| 크기 | **640px** (max-width), 높이 자동 (max-height: `80vh`) |
| 위치 | 화면 중앙 |
| 백드롭 | `bg-black/50`, 클릭 시 닫기 |
| 패딩 | `p-6` |
| 스크롤 | `overflow-y: auto` (내용 많을 경우) |
| 애니메이션 | 진입: `opacity + scale(0.95→1)` 150ms ease-out, 퇴장: `opacity` 100ms ease-in |
| z-index | `50` (모달과 동일) |

### 7.4 카테고리 헤더

| 속성 | 값 |
|------|-----|
| 텍스트 | `text-sm font-semibold text-foreground` |
| 하단 간격 | `mb-2` |
| 상단 간격 | `mt-6` (첫 번째 제외) |

### 7.5 단축키 행

```
┌─────────────────────────────────────────────────────────┐
│  Command Palette 열기                           ⌘ K     │
│  text-sm text-muted-foreground           단축키 뱃지     │
└─────────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 행 높이 | 36px |
| 동작 설명 | `text-sm text-muted-foreground` |
| 단축키 뱃지 | 우측 정렬, 키 뱃지 조합 |
| 배치 | `flex items-center justify-between` |
| 호버 | 없음 (읽기 전용 리스트) |
| 구분선 | 없음 (카테고리 내에서는 구분선 미사용) |

### 7.6 키 뱃지 컴포넌트

```
개별 키:  ┌───┐
          │ K │  ← 단일 키 뱃지
          └───┘

조합 키:  ┌───┐ ┌───┐
          │ ⌘ │ │ K │  ← modifier + 키
          └───┘ └───┘

또는:     ┌───┐       ┌───┐
          │ J │ 또는  │ ↓ │  ← 대체 키
          └───┘       └───┘
```

| 속성 | 값 |
|------|-----|
| 배경 | `bg-muted` |
| 텍스트 | `text-xs font-mono text-muted-foreground` |
| 보더 | `border border-border` |
| 패딩 | `px-1.5 py-0.5` |
| 둥글기 | `rounded-sm` (4px) |
| 최소 너비 | 24px |
| 정렬 | 중앙 (`text-center`) |
| 간격 | 조합 키 사이 `gap-1` (4px) |
| "또는" | `text-xs text-muted-foreground`, 키 뱃지 사이 |

#### 플랫폼별 modifier 표시

| 플랫폼 | 표시 |
|--------|------|
| macOS | `⌘` (Cmd), `⌥` (Option), `⇧` (Shift), `⌃` (Ctrl) |
| Windows/Linux | `Ctrl`, `Alt`, `Shift` |

```typescript
// 플랫폼 감지
const isMac = navigator.platform.toUpperCase().includes('MAC');
const modKey = isMac ? '⌘' : 'Ctrl';
```

---

## 8. 툴팁 단축키 힌트

### 8.1 규칙

- 단축키가 있는 버튼/아이콘은 Tooltip에 단축키 힌트를 포함합니다.
- 형식: `"{동작명} ({단축키})"`

### 8.2 예시

```
버튼 호버/포커스 시:

┌────────────────────┐
│  이슈 추가 (C)      │  ← Tooltip
└────────────────────┘

┌────────────────────┐
│  검색 (⌘K)         │  ← Tooltip
└────────────────────┘

┌────────────────────┐
│  닫기 (Esc)         │  ← Tooltip
└────────────────────┘
```

### 8.3 Tooltip 컴포넌트 단축키 확장

```typescript
// 기존 Tooltip에 shortcut prop 추가
interface TooltipProps {
  content: string;
  shortcut?: string;  // "C", "mod+k", "esc" 등
  side?: 'top' | 'bottom' | 'left' | 'right';
  delayDuration?: number;
}

// 렌더링:
// shortcut이 있으면 → "{content} ({formattedShortcut})"
// 예: content="이슈 추가", shortcut="c" → "이슈 추가 (C)"
// 예: content="검색", shortcut="mod+k" → "검색 (⌘K)" (macOS)
```

| 속성 | 값 |
|------|-----|
| 컴포넌트 | Radix `Tooltip` |
| 딜레이 | 200ms |
| 텍스트 | `text-xs` |
| 단축키 부분 | `text-muted-foreground` (본문보다 약간 연한 색) |
| 배경 | `bg-popover`, `shadow-md`, `rounded-md` |
| 패딩 | `px-2 py-1` |

---

## 9. 전체 단축키 매핑 요약

### 9.1 전역

| 단축키 | 동작 | 입력 중 동작 |
|--------|------|------------|
| `Cmd+K` | Command Palette | 동작 |
| `Cmd+/` | 단축키 시트 | 동작 |
| `Cmd+\` | 사이드바 토글 | 동작 |

### 9.2 이슈 네비게이션

| 단축키 | 동작 | 입력 중 동작 |
|--------|------|------------|
| `J` / `↓` | 다음 이슈 | 비활성 |
| `K` / `↑` | 이전 이슈 | 비활성 |
| `Enter` | 이슈 열기 | 비활성 |
| `X` / `Space` | 선택 토글 | 비활성 |
| `C` | Quick Add | 비활성 |
| `Esc` | 패널 닫기 / 선택 해제 | 비활성 |

### 9.3 이슈 상세

| 단축키 | 동작 | 입력 중 동작 |
|--------|------|------------|
| `S` | 상태 변경 | 비활성 |
| `A` | 담당자 변경 | 비활성 |
| `L` | 라벨 변경 | 비활성 |
| `P` | 우선순위 변경 | 비활성 |
| `T` | 타입 변경 | 비활성 |
| `D` | 마감일 설정 | 비활성 |
| `F2` | 제목 편집 | 비활성 |
| `Esc` | 닫기 / 뒤로가기 | 비활성 |

---

## 10. 충돌 방지 규칙

### 10.1 우선순위

단축키가 여러 컨텍스트에서 등록된 경우, 가장 구체적인 컨텍스트가 우선합니다.

```
issue-detail > issue-list > board > global
```

### 10.2 모달/다이얼로그 열림 시

- 모달이 열려 있으면 모든 커스텀 단축키 비활성화
- `Esc`만 예외적으로 동작 (모달 닫기)
- Command Palette 열림 시 모든 단축키 비활성화 (`Esc`로 닫기만 가능)

### 10.3 브라우저 기본 단축키와의 충돌

다음 키 조합은 사용하지 않습니다 (브라우저 기본 동작 보존):

| 키 조합 | 브라우저 기본 동작 |
|---------|------------------|
| `Cmd+T` | 새 탭 |
| `Cmd+W` | 탭 닫기 |
| `Cmd+N` | 새 창 |
| `Cmd+L` | 주소창 포커스 |
| `Cmd+R` | 새로고침 |
| `Cmd+C/V/X` | 복사/붙여넣기/잘라내기 |
| `Cmd+Z/Shift+Z` | 실행 취소/재실행 |
| `Cmd+A` | 전체 선택 |
| `Cmd+F` | 찾기 |
| `F5` | 새로고침 |
| `F11` | 전체 화면 |

---

## 11. 접근성 (Accessibility)

### 11.1 ARIA

- 단축키 시트 오버레이: `role="dialog" aria-modal="true" aria-labelledby="키보드 단축키"`
- 카테고리: `role="group" aria-label="{카테고리명}"`
- 각 단축키 행: `role="listitem"`
- 키 뱃지: `aria-label` 속성에 읽기 가능한 키 이름 (예: `aria-label="Command + K"`)

### 11.2 스크린 리더 지원

- 단축키 실행 시 동작 결과를 `aria-live` 영역으로 알림
- 예: `S` 키로 상태 드롭다운 열림 → `"상태 변경 드롭다운이 열렸습니다"` 알림

### 11.3 키보드만 사용하는 사용자 지원

- 모든 단축키는 Tab/Enter로도 접근 가능한 UI 요소에 대응
- 단축키는 편의 기능이며, 단축키 없이도 모든 기능 접근 가능해야 합니다

---

## 12. 요약 Quick Reference

```
┌───────────────────────────────────────────────────┐
│ 키보드 단축키 시스템 요약                            │
├───────────────────────────────────────────────────┤
│ 훅: useHotkey(key, handler, { context, enabled }) │
│ 컨텍스트: global > issue-list/board > issue-detail│
│ 입력 필드 포커스 시: 단일 키 비활성, mod+ 키 유지   │
│ 모달 열림 시: 모든 단축키 비활성 (Esc 제외)         │
│ Cmd+K: Command Palette                            │
│ Cmd+/: 단축키 시트 오버레이                         │
│ J/K: 이슈 이동, Enter: 열기, C: Quick Add          │
│ S/A/L/P/T/D: 속성 변경 (이슈 상세)                 │
│ 툴팁에 단축키 힌트 표시: "동작명 (단축키)"           │
│ 키 뱃지: bg-muted, font-mono, rounded-sm          │
└───────────────────────────────────────────────────┘
```
