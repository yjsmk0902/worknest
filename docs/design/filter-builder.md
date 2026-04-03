# Worknest 비주얼 필터 빌더 설계 (CP3-DS-3)

> 이 문서는 비주얼 필터 빌더의 레이아웃, 필터 칩, 추가/편집 흐름, URL 동기화, 필드별 연산자를 정의합니다.
> 디자인 시스템 토큰은 `design-system.md`를 참조합니다.

---

## 1. 개요

비주얼 필터 빌더는 이슈 목록을 필터링하기 위한 인라인 UI입니다. 필터 조건을 칩(chip) 형태로 시각화하여 현재 적용된 필터를 한눈에 파악하고 수정할 수 있습니다.

### 1.1 핵심 원칙

- **시각적 명확성**: 적용된 필터를 칩으로 즉시 확인
- **최소 클릭**: 필드 → 연산자 → 값 3단계로 필터 추가 완료
- **URL 동기화**: 필터 상태가 URL searchParams에 반영되어 링크 공유 가능
- **AND 전용**: MVP에서는 모든 필터가 AND 조건으로 결합 (OR은 v1.0)

---

## 2. 전체 레이아웃

### 2.1 위치

```
┌─ 페이지 ──────────────────────────────────────────────┐
│  ┌─ 툴바 (view-toolbar.md) ────────────────────────┐  │
│  │ [리스트|보드] | [필터] [정렬] | [뷰] ... 42개 이슈│  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─ 필터 빌더 ──────────────────────────────────────┐ │  ← 이 영역
│  │ [상태: Todo, In Prog] [우선순위: High] [× 초기화] │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─ 이슈 리스트 / 보드 ─────────────────────────────┐ │
│  │ ...                                               │ │
│  └───────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

### 2.2 필터 영역 스타일

| 속성 | 값 |
|------|-----|
| 레이아웃 | `flex flex-wrap items-center gap-2` |
| 패딩 | `px-4 py-2` |
| 표시 조건 | 필터가 1개 이상 활성화되었을 때만 표시 |
| 하단 보더 | `border-b border-border/50` (리스트/보드와 시각적 분리) |

---

## 3. 필터 트리거 버튼

### 3.1 기본 상태 (필터 미적용)

```
┌──────────────┐
│ 🔍 필터      │  ← Button variant="outline" size="sm"
└──────────────┘
```

### 3.2 활성 상태 (필터 적용 중)

```
┌──────────────────┐
│ 🔍 필터  (3)     │  ← 카운트 뱃지 표시
└──────────────────┘
```

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `Button` variant=`outline` size=`sm` |
| 아이콘 | `Filter` (Lucide, 16px) |
| 텍스트 | `"필터"`, `text-sm` |
| 카운트 뱃지 | 필터 수 > 0일 때: `ml-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center` |
| 동작 | 클릭 시 필드 선택 Popover 열기 |

---

## 4. 필터 칩 (Filter Chip)

### 4.1 칩 레이아웃

```
┌──────────────────────────────────────┐
│  상태: Todo, In Progress          ×  │  ← 필터 칩
│  field   value                  제거 │
└──────────────────────────────────────┘
```

### 4.2 칩 스타일

| 속성 | 값 |
|------|-----|
| 레이아웃 | `inline-flex items-center gap-1.5` |
| 배경 | `bg-secondary` |
| 모서리 | `rounded-full` |
| 패딩 | `px-3 h-7` |
| 커서 | `cursor-pointer` (클릭 시 편집 Popover) |
| 호버 | `bg-secondary/80` |

### 4.3 칩 내부 요소

| 요소 | 스타일 |
|------|--------|
| 필드명 | `text-xs font-medium text-muted-foreground` |
| 구분자 | `:` (콜론), `text-muted-foreground` |
| 연산자 | `text-xs text-muted-foreground` (기본 연산자 `"is"`는 숨김) |
| 값 | `text-xs font-medium text-foreground truncate max-w-[120px]` |
| 제거 버튼 | `X` 아이콘 (Lucide), `w-3.5 h-3.5 text-muted-foreground hover:text-destructive` |

### 4.4 칩 표시 예시

| 필터 | 칩 표시 |
|------|--------|
| 상태 is Todo | `상태: Todo` (연산자 "is" 숨김) |
| 상태 is Todo, In Progress | `상태: Todo, In Progress` |
| 상태 is not Done | `상태: is not Done` |
| 우선순위 is High, Urgent | `우선순위: High, Urgent` |
| 담당자 is empty | `담당자: 없음` |
| 담당자 is Luke | `담당자: Luke` |
| 라벨 includes frontend | `라벨: frontend` |
| 마감일 before 2026-04-15 | `마감일: ~04/15` |
| 마감일 between 04/01~04/30 | `마감일: 04/01 ~ 04/30` |
| 제목 contains 로그인 | `제목: "로그인"` (따옴표로 감쌈) |

### 4.5 칩 줄바꿈

필터 칩이 한 줄에 들어가지 않으면 자연스럽게 다음 줄로 wrap됩니다. MVP에서는 `"+N more"` 패턴을 사용하지 않습니다.

---

## 5. 필터 추가 흐름

### 5.1 단계별 흐름

```
[+ 필터 클릭] → Popover (1단계: 필드 선택)
                 │
                 └─ 필드 선택 → (2단계: 연산자 선택)
                                 │
                                 └─ 연산자 선택 → (3단계: 값 선택)
                                                   │
                                                   └─ 값 확정 → 칩 생성 + Popover 닫힘
```

### 5.2 1단계: 필드 선택

```
┌──────────────────────────┐
│ 필터 추가                 │  ← 제목 text-sm font-medium
│ ─────────────────────── │
│ 상태                     │  ← hover: bg-accent
│ 타입                     │
│ 우선순위                  │
│ 담당자                   │
│ 라벨                     │
│ 마감일                   │
│ 제목                     │
└──────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `Popover` (shadcn/ui) |
| 너비 | `w-[200px]` |
| 제목 | `"필터 추가"`, `text-sm font-medium px-3 py-2` |
| 구분선 | `Separator` |
| 항목 | `px-3 py-1.5 text-sm cursor-pointer rounded-sm` |
| 호버 | `bg-accent` |
| 이미 추가된 필드 | `text-muted-foreground` + 체크 아이콘 (클릭 시 해당 필터 편집으로 이동) |

### 5.3 2단계: 연산자 선택

필드 선택 후 같은 Popover 내에서 연산자 선택 UI로 전환됩니다.

```
┌──────────────────────────┐
│ ← 상태                   │  ← 뒤로 버튼 + 필드명
│ ─────────────────────── │
│ ● is                     │  ← 기본 선택
│ ○ is not                 │
└──────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 뒤로 | `ChevronLeft` 아이콘 + 필드명, `cursor-pointer hover:text-primary` |
| 항목 | `RadioGroup` 패턴, `text-sm` |
| 기본값 | 첫 번째 연산자 (`is`) 자동 선택 |
| 단일 연산자 필드 | 연산자 단계 생략 (예: 제목은 `contains`만 가능) |

### 5.4 3단계: 값 선택

연산자 선택 후 같은 Popover 내에서 값 입력 UI로 전환됩니다. 필드 타입에 따라 다른 UI를 표시합니다.

#### ID 기반 필드 (상태, 타입, 우선순위, 담당자, 라벨)

```
┌──────────────────────────┐
│ ← 상태: is               │  ← 뒤로 + 컨텍스트
│ ─────────────────────── │
│ 🔍 검색...               │  ← Input (담당자/라벨만)
│ ─────────────────────── │
│ ☑ ● Backlog              │  ← 다중 선택 체크박스
│ ☑ ● Todo                 │
│ ☐ ● In Progress          │
│ ☐ ● Done                 │
│ ☐ ● Cancelled            │
│ ─────────────────────── │
│ [적용]                   │  ← Button primary size="sm" w-full
└──────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 검색 입력 | `Input` size=`sm`, `Search` 아이콘 접두사, 상태/타입/우선순위는 항목 수가 적으므로 미표시 |
| 항목 | `Checkbox` + 색상 표시(dot/아이콘) + 이름 `text-sm` |
| 선택 | 다중 선택 (multi-select) |
| 적용 | `Button` variant=`primary` size=`sm`, `w-full mt-2` |
| 빈 검색 결과 | `"검색 결과가 없습니다"`, `text-sm text-muted-foreground text-center py-4` |

#### 날짜 필드 (마감일)

```
┌──────────────────────────┐
│ ← 마감일: before          │
│ ─────────────────────── │
│                          │
│  ◀  2026년 4월       ▶   │  ← Calendar (shadcn/ui)
│ ─────────────────────── │
│ 일  월  화  수  목  금  토│
│  1   2   3   4   5   6  7│
│  8   9  10  11  12  13 14│
│ [15] 16  17  18  19  20 21│
│ 22  23  24  25  26  27 28│
│ 29  30                   │
│                          │
│ [적용]                   │
└──────────────────────────┘
```

| 연산자 | UI |
|--------|-----|
| `before` | 단일 날짜 선택 |
| `after` | 단일 날짜 선택 |
| `between` | 범위 선택 (시작일 + 종료일) |
| `is_empty` | 값 단계 생략 → 즉시 칩 생성 |

#### 텍스트 필드 (제목)

```
┌──────────────────────────┐
│ ← 제목: contains         │
│ ─────────────────────── │
│                          │
│ 검색어 입력...            │  ← Input text
│                          │
│ [적용]                   │
└──────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 입력 | `Input` (shadcn/ui), placeholder `"검색어 입력..."` |
| 적용 | `Button` variant=`primary` size=`sm`, 비어있으면 `disabled` |
| Enter | `Enter` 키로도 적용 가능 |

---

## 6. 필터 편집

### 6.1 기존 필터 편집

기존 필터 칩을 클릭하면 같은 Popover가 열리며, 현재 값이 미리 선택된 상태로 표시됩니다.

```
[상태: Todo, In Prog] 클릭
      │
      └─ Popover 열림 (현재 값 프리셋)
         ┌──────────────────────────┐
         │ ← 상태: is               │
         │ ─────────────────────── │
         │ ☐ ● Backlog              │
         │ ☑ ● Todo                 │  ← 기존 선택 유지
         │ ☑ ● In Progress          │  ← 기존 선택 유지
         │ ☐ ● Done                 │
         │ ☐ ● Cancelled            │
         │ ─────────────────────── │
         │ [적용]                   │
         └──────────────────────────┘
```

### 6.2 연산자 변경

편집 시 뒤로 버튼으로 연산자 선택 단계로 이동하여 연산자를 변경할 수 있습니다.

---

## 7. 필터 초기화

### 7.1 초기화 버튼

```
[상태: Todo] [우선순위: High] [× 필터 초기화]
                                    │
                                    └─ 모든 필터 제거 + URL searchParams 초기화
```

| 속성 | 값 |
|------|-----|
| 컴포넌트 | 텍스트 버튼 (`Button` variant=`ghost` size=`sm`) |
| 텍스트 | `"필터 초기화"`, `text-xs text-muted-foreground hover:text-foreground` |
| 표시 조건 | 필터가 1개 이상 활성화되었을 때 |
| 동작 | 모든 필터 제거, URL searchParams에서 필터 관련 파라미터 삭제 |

---

## 8. URL searchParams 동기화

### 8.1 파라미터 형식

```
?statusId=uuid1,uuid2&priority=high,medium&sort=created_at&order=desc
```

| 필드 | 파라미터 키 | 값 형식 |
|------|-----------|---------|
| 상태 | `statusId` | UUID, 콤마 구분 |
| 타입 | `typeId` | UUID, 콤마 구분 |
| 우선순위 | `priority` | enum 값, 콤마 구분 (`urgent,high,medium,low,none`) |
| 담당자 | `assigneeId` | UUID, 콤마 구분 |
| 라벨 | `labelId` | UUID, 콤마 구분 |
| 마감일 | `dueBefore` / `dueAfter` | ISO date (`2026-04-15`) |
| 제목 | `title` | URL 인코딩된 문자열 |
| 연산자 | `{field}Op` | `is`, `is_not`, `is_empty`, `includes`, `excludes`, `contains`, `before`, `after`, `between` |
| 정렬 | `sort` | 필드명 (`created_at`, `updated_at`, `priority`, `due_date`, `manual`) |
| 정렬 방향 | `order` | `asc`, `desc` |

### 8.2 동기화 규칙

1. 필터 변경 → URL searchParams 즉시 업데이트 (`replaceState`, 히스토리 미추가)
2. 페이지 로드 시 URL searchParams → 필터 상태 복원
3. 뒤로 가기/앞으로 가기 시 필터 상태 동기화
4. 빈 필터 → 해당 파라미터 제거 (URL 깔끔하게 유지)

---

## 9. 필드별 연산자 규칙

| 필드 | 지원 연산자 | 기본 연산자 | 값 타입 |
|------|-----------|------------|--------|
| 상태 | `is`, `is_not` | `is` | multi-select (상태 목록) |
| 타입 | `is`, `is_not` | `is` | multi-select (타입 목록) |
| 우선순위 | `is`, `is_not` | `is` | multi-select (Urgent~None) |
| 담당자 | `is`, `is_not`, `is_empty` | `is` | multi-select (멤버 목록) |
| 라벨 | `includes`, `excludes` | `includes` | multi-select (라벨 목록) |
| 마감일 | `before`, `after`, `between`, `is_empty` | `before` | date / date-range |
| 제목 | `contains` | `contains` | text |

---

## 10. 접근성 (Accessibility)

### 10.1 ARIA

| 요소 | ARIA |
|------|------|
| 필터 영역 | `role="region" aria-label="활성 필터"` |
| 필터 트리거 | `aria-haspopup="dialog" aria-expanded={open}` |
| 필터 칩 | `role="button" aria-label="{필드}: {값}"` |
| 칩 제거 | `aria-label="{필드} 필터 제거"` |
| 필드 목록 | `role="listbox" aria-label="필터 필드 선택"` |
| 필드 항목 | `role="option"` |

### 10.2 키보드

| 키 | 동작 |
|------|------|
| `Tab` | 필터 칩 간 이동 |
| `Enter` / `Space` | 칩 편집 Popover 열기 |
| `Delete` / `Backspace` | 포커스된 칩 삭제 |
| `Esc` | Popover 닫기, 트리거 버튼으로 포커스 복귀 |

### 10.3 스크린 리더

- 필터 추가 시: `"{필드} 필터가 추가되었습니다"` (`aria-live="polite"`)
- 필터 제거 시: `"{필드} 필터가 제거되었습니다"` (`aria-live="polite"`)
- 필터 초기화 시: `"모든 필터가 초기화되었습니다"` (`aria-live="polite"`)

---

## 11. 요약 Quick Reference

```
┌───────────────────────────────────────────────────┐
│ 필터 빌더 요약                                      │
├───────────────────────────────────────────────────┤
│ 위치: 툴바 아래, 이슈 목록 위                        │
│ 트리거: Button outline "필터" + 활성 시 카운트 뱃지  │
│ 칩: bg-secondary rounded-full px-3 h-7             │
│   - 필드명(muted) + 값(foreground) + X(제거)       │
│ 추가 흐름: 필드 → 연산자 → 값 (3단계 Popover)       │
│ 편집: 칩 클릭 → 현재 값 프리셋된 Popover            │
│ 초기화: "필터 초기화" ghost 버튼                     │
│ URL: ?statusId=uuid1,uuid2&priority=high&...       │
│ AND 전용 (MVP), OR은 v1.0                          │
│ 줄바꿈: flex-wrap, "+N more" 없음                   │
└───────────────────────────────────────────────────┘
```
