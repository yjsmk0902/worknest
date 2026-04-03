# Worknest 뷰 툴바 & 저장된 뷰 설계 (CP3-DS-5)

> 이 문서는 뷰 전환 탭, 필터 트리거, 정렬 드롭다운, 저장된 뷰 관리, 이슈 카운트를 포함한 뷰 툴바의 전체 스펙을 정의합니다.
> 디자인 시스템 토큰은 `design-system.md`를 참조합니다.

---

## 1. 개요

뷰 툴바는 이슈 목록 상단에 위치하는 제어 영역으로, 뷰 전환, 필터/정렬 조작, 저장된 뷰 관리를 통합 제공합니다.

### 1.1 핵심 원칙

- **통합 제어**: 뷰 관련 모든 조작을 한 줄의 툴바에서 수행
- **현재 상태 파악**: 활성 뷰, 적용된 정렬, 이슈 수를 한눈에 확인
- **뷰 저장**: 자주 사용하는 필터/정렬 조합을 뷰로 저장하여 재사용

---

## 2. 툴바 레이아웃

### 2.1 전체 구조

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [리스트 | 보드]  │  [🔍 필터]  [정렬 ▼]  │  [🔖 뷰 ▼]                42개 이슈 │
│ ─ 뷰 탭 ─     분리  필터 트리거  정렬    분리  저장된 뷰             이슈 카운트  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 툴바 스타일

| 속성 | 값 |
|------|-----|
| 높이 | `h-10` (40px) |
| 레이아웃 | `flex items-center gap-2` |
| 하단 보더 | `border-b border-border` |
| 패딩 | `px-4` |
| 배경 | `bg-background` |

---

## 3. 뷰 탭 (View Tabs)

### 3.1 탭 그룹

```
┌─────────────────────────────────┐
│ ┌─────────┐ ┌──────────┐       │
│ │📋 리스트 │ │ 📊 보드   │       │  ← 인라인 탭 그룹
│ │ active  │ │          │       │
│ └─────────┘ └──────────┘       │
└─────────────────────────────────┘
```

### 3.2 탭 그룹 스타일

| 속성 | 값 |
|------|-----|
| 컨테이너 | `inline-flex rounded-md bg-muted p-0.5` |
| 탭 | `px-3 h-7 text-sm inline-flex items-center gap-1.5 rounded-sm cursor-pointer` |
| 활성 탭 | `bg-background shadow-sm text-foreground font-medium` |
| 비활성 탭 | `text-muted-foreground hover:text-foreground` |
| 전환 | `transition-all duration-150` |

### 3.3 탭 옵션

| 탭 | 아이콘 | 라벨 | 라우트 |
|-----|--------|------|--------|
| 리스트 | `List` (Lucide, 14px) | `"리스트"` | `?view=list` |
| 보드 | `Columns` (Lucide, 14px) | `"보드"` | `?view=board` |

---

## 4. 구분선 (Separator)

```
│  ← 수직 구분선
```

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `Separator` orientation=`vertical` (shadcn/ui) |
| 높이 | `h-4` |
| 너비 | `w-px` |
| 색상 | `bg-border` |

---

## 5. 필터 트리거

필터 버튼은 `filter-builder.md`의 트리거 버튼과 동일합니다. 클릭 시 필터 필드 선택 Popover를 엽니다.

```
┌──────────────┐       ┌──────────────────┐
│ 🔍 필터      │       │ 🔍 필터  (3)     │
│ 기본 상태    │       │ 필터 활성 시      │
└──────────────┘       └──────────────────┘
```

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `Button` variant=`outline` size=`sm` |
| 아이콘 | `Filter` (Lucide, 14px) |
| 텍스트 | `"필터"` |
| 카운트 | 필터 수 > 0: `ml-1` 뱃지 (`bg-primary text-primary-foreground text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center`) |
| Tooltip | `"필터 추가"` |

> 상세 필터 빌더 UI는 `filter-builder.md` 참조

---

## 6. 정렬 드롭다운

### 6.1 트리거

```
┌──────────────────┐
│ ↕ 정렬: 생성일 ▼  │  ← 현재 정렬 기준 표시
└──────────────────┘
```

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `Button` variant=`outline` size=`sm` + `DropdownMenu` |
| 아이콘 | `ArrowUpDown` (Lucide, 14px) |
| 텍스트 | `"정렬"` + 현재 정렬 기준 (정렬 활성 시) |
| 트리거 | `DropdownMenuTrigger` |

### 6.2 정렬 메뉴

```
┌──────────────────────┐
│ 정렬 기준             │  ← 제목 text-xs font-medium text-muted-foreground
│ ─────────────────── │
│ ● 생성일         ✓   │  ← 현재 선택
│ ○ 수정일              │
│ ○ 우선순위            │
│ ○ 마감일              │
│ ○ 수동               │
│ ─────────────────── │
│ 정렬 방향             │  ← 제목
│ ─────────────────── │
│ ● 오름차순 ↑          │
│ ○ 내림차순 ↓     ✓   │  ← 기본값
└──────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `DropdownMenu` (shadcn/ui) |
| 정렬 기준 섹션 | `DropdownMenuLabel` + `DropdownMenuRadioGroup` |
| 정렬 방향 섹션 | `DropdownMenuSeparator` + `DropdownMenuLabel` + `DropdownMenuRadioGroup` |
| 항목 | `DropdownMenuRadioItem`, `text-sm` |
| 선택됨 | `DropdownMenuRadioItem` 기본 라디오 표시 |

### 6.3 정렬 옵션

| 정렬 기준 | URL 값 | 기본 방향 |
|----------|--------|----------|
| 생성일 | `created_at` | 내림차순 (최신 우선) |
| 수정일 | `updated_at` | 내림차순 (최근 수정 우선) |
| 우선순위 | `priority` | 내림차순 (Urgent 우선) |
| 마감일 | `due_date` | 오름차순 (빠른 마감일 우선) |
| 수동 | `manual` | fractional indexing 순서 |

---

## 7. 저장된 뷰 (Saved Views)

### 7.1 뷰 드롭다운 트리거

```
┌─────────────┐
│ 🔖 뷰 ▼     │
└─────────────┘
```

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `Button` variant=`outline` size=`sm` + `DropdownMenu` |
| 아이콘 | `Bookmark` (Lucide, 14px) |
| 텍스트 | `"뷰"` |

### 7.2 뷰 목록

```
┌─────────────────────────────────────┐
│ 저장된 뷰                            │  ← 제목
│ ──────────────────────────────────  │
│ 내 할당 이슈                    ···  │  ← 뷰 항목 + 더보기 메뉴
│ 긴급 이슈                      ···  │
│ 진행 중 이슈                    ···  │
│ ──────────────────────────────────  │
│ ＋ 현재 뷰 저장                      │  ← 하단 액션
└─────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `DropdownMenu` (shadcn/ui), `w-[240px]` |
| 제목 | `"저장된 뷰"`, `text-xs font-medium text-muted-foreground px-2 py-1.5` |
| 뷰 항목 | `text-sm`, `flex items-center justify-between`, `hover:bg-accent rounded-sm px-2 py-1.5 cursor-pointer` |
| 더보기 | `MoreHorizontal` 아이콘 (Lucide, 14px), `text-muted-foreground`, 호버 시만 표시 |
| 하단 | `Separator` + `"＋ 현재 뷰 저장"` 항목 (`Plus` 아이콘 + 텍스트) |
| 빈 상태 | `"저장된 뷰가 없습니다"`, `text-sm text-muted-foreground text-center py-4` |

### 7.3 뷰 항목 클릭 동작

1. 저장된 뷰의 필터/정렬 설정을 적용
2. 뷰 타입(리스트/보드)이 현재와 다르면 해당 뷰로 전환
3. URL searchParams 업데이트
4. 드롭다운 닫기

### 7.4 뷰 항목 더보기 메뉴

```
[···] 클릭
      │
      └─ DropdownMenu (중첩)
         ┌──────────────────┐
         │ 뷰 이름 변경      │
         │ ──────────────  │
         │ 삭제             │  ← text-destructive
         └──────────────────┘
```

| 항목 | 동작 |
|------|------|
| 뷰 이름 변경 | 이름 편집 Dialog 열기 |
| 삭제 | 확인 Dialog 열기 |

### 7.5 뷰 삭제 확인 Dialog

```
┌─────────────────────────────────────────────┐
│                                             │
│  뷰 삭제                                     │
│                                             │
│  "내 할당 이슈" 뷰를 삭제하시겠습니까?         │
│                                             │
│                    [취소]  [삭제]             │
│                                             │
└─────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `Dialog` (shadcn/ui), `max-w-[400px]` |
| 제목 | `"뷰 삭제"`, `text-lg font-semibold` |
| 설명 | `""{뷰 이름}" 뷰를 삭제하시겠습니까?"`, `text-sm text-muted-foreground` |
| 취소 | `Button` variant=`outline` |
| 삭제 | `Button` variant=`destructive` |

---

## 8. 뷰 저장 Dialog

### 8.1 레이아웃

```
┌─────────────────────────────────────────────────┐
│                                                  │
│  뷰 저장                                         │  ← text-lg font-semibold
│                                                  │
│  이름                                            │
│  ┌─────────────────────────────────────────────┐ │
│  │ 뷰 이름                                      │ │  ← Input, placeholder
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  적용된 필터                                      │  ← text-sm font-medium
│  [상태: Todo, In Prog] [우선순위: High]           │  ← 칩 표시 (읽기 전용)
│                                                  │
│  정렬                                            │  ← text-sm font-medium
│  생성일 내림차순                                   │  ← text-sm text-muted-foreground
│                                                  │
│  뷰 타입                                         │  ← text-sm font-medium
│  리스트                                           │  ← text-sm text-muted-foreground
│                                                  │
│                         [취소]  [저장]            │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 8.2 Dialog 스타일

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `Dialog` (shadcn/ui) |
| 너비 | `max-w-[480px]` (중형 모달) |
| 제목 | `"뷰 저장"`, `text-lg font-semibold` |
| 이름 입력 | `Input` (shadcn/ui), `placeholder="뷰 이름"`, 자동 포커스 |
| 필터 요약 | 현재 적용된 필터 칩을 읽기 전용으로 표시 (클릭 불가, `opacity-75`) |
| 정렬 요약 | `text-sm text-muted-foreground`, 예: `"생성일 내림차순"` |
| 뷰 타입 | `text-sm text-muted-foreground`, 현재 뷰 타입 (`"리스트"` 또는 `"보드"`) |
| 취소 | `Button` variant=`outline` |
| 저장 | `Button` variant=`primary`, 이름 비어있으면 `disabled` |

### 8.3 저장 동작

1. 현재 필터/정렬/뷰 타입 설정을 캡처
2. 사용자가 이름 입력 후 `[저장]` 클릭
3. API 호출 (`POST /api/views`)
4. 성공: Dialog 닫기, 토스트 `"뷰가 저장되었습니다"`, 뷰 드롭다운에 추가
5. 실패: Dialog 유지, 에러 토스트

---

## 9. 뷰 업데이트

### 9.1 업데이트 감지

저장된 뷰를 적용한 후 필터/정렬을 수정하면, 현재 설정이 저장된 뷰와 다르다는 것을 감지합니다.

### 9.2 업데이트 버튼

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [리스트 | 보드]  │  [🔍 필터 (2)]  [정렬 ▼]  │  [🔖 뷰 ▼]  [뷰 업데이트]  42개│
│                                                  ↑ 변경 감지 시 표시         │
└─────────────────────────────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `Button` variant=`outline` size=`sm` |
| 텍스트 | `"뷰 업데이트"` |
| 표시 조건 | 저장된 뷰가 적용 중이고, 현재 필터/정렬이 저장된 값과 다를 때 |
| 동작 | 클릭 시 현재 필터/정렬로 저장된 뷰를 업데이트 (`PATCH /api/views/:id`) |
| 성공 | 토스트 `"뷰가 업데이트되었습니다"` |

---

## 10. 이슈 카운트

### 10.1 스타일

```
                                                              42개 이슈
```

| 속성 | 값 |
|------|-----|
| 위치 | `ml-auto` (우측 정렬) |
| 텍스트 | `"{N}개 이슈"`, `text-sm text-muted-foreground` |
| 업데이트 | 필터 변경 시 실시간 반영 |
| 0건 | `"0개 이슈"` |

---

## 11. 접근성 (Accessibility)

### 11.1 ARIA

| 요소 | ARIA |
|------|------|
| 툴바 | `role="toolbar" aria-label="이슈 뷰 제어"` |
| 뷰 탭 그룹 | `role="tablist" aria-label="뷰 전환"` |
| 뷰 탭 | `role="tab" aria-selected={active} aria-controls="issue-view"` |
| 이슈 뷰 영역 | `role="tabpanel" id="issue-view"` |
| 정렬 트리거 | `aria-haspopup="menu" aria-expanded={open}` |
| 뷰 트리거 | `aria-haspopup="menu" aria-expanded={open}` |
| 이슈 카운트 | `aria-live="polite"` (필터 변경 시 자동 알림) |

### 11.2 키보드

| 키 | 동작 |
|------|------|
| `Tab` | 툴바 내 요소 간 이동 (탭 → 필터 → 정렬 → 뷰 → 카운트) |
| `Enter` / `Space` | 포커스된 버튼/탭 활성화 |
| `ArrowLeft` / `ArrowRight` | 뷰 탭 간 이동 |
| `Esc` | 열린 DropdownMenu/Popover 닫기 |

---

## 12. 반응형 동작

| 화면 크기 | 동작 |
|-----------|------|
| 1280px+ | 모든 요소 표시 |
| 1024~1279px | 정렬 버튼에서 현재 정렬 기준 텍스트 숨김 (아이콘 + `"정렬"`만), 이슈 카운트 숨김 |
| ~1023px | 미지원 배너 (`app-shell.md` 참조) |

---

## 13. 요약 Quick Reference

```
┌───────────────────────────────────────────────────┐
│ 뷰 툴바 요약                                       │
├───────────────────────────────────────────────────┤
│ 높이: h-10, border-b, px-4                        │
│ 뷰 탭: bg-muted p-0.5, 활성=bg-background shadow  │
│   - 리스트 (List) | 보드 (Columns)                 │
│ 구분선: h-4 w-px bg-border                         │
│ 필터: Button outline, filter-builder.md 트리거     │
│ 정렬: DropdownMenu (생성일/수정일/우선순위/마감일/수동)│
│ 저장된 뷰: DropdownMenu + 뷰 목록 + 저장 버튼      │
│ 뷰 저장: Dialog (이름 + 필터 요약 + 정렬 + 타입)    │
│ 뷰 업데이트: 변경 감지 시 툴바에 버튼 표시           │
│ 이슈 카운트: ml-auto, "42개 이슈"                   │
└───────────────────────────────────────────────────┘
```
