# Worknest 파일 업로드 설계 (CP5-DS-3)

> 이 문서는 에디터 내 이미지 업로드, 파일 첨부 UI, 업로드 제약, 진행률 표시를 정의합니다.
> 디자인 시스템 토큰은 `design-system.md`를 참조합니다.

---

## 1. 개요

파일 업로드는 Wiki 페이지 및 이슈 설명에서 이미지와 파일을 첨부하는 기능입니다. 클립보드 붙여넣기, 드래그 앤 드롭, 파일 선택 다이얼로그를 통해 업로드할 수 있습니다.

### 1.1 핵심 원칙

- **다양한 입력 방식**: 붙여넣기, 드래그 앤 드롭, 파일 선택 모두 지원
- **진행률 피드백**: 업로드 중 진행률 바와 파일명 표시
- **에러 복구**: 실패 시 명확한 에러 메시지와 재시도/제거 옵션
- **안전한 제약**: 파일 크기, 확장자, 워크스페이스 용량 제한

---

## 2. 에디터 내 이미지 업로드

### 2.1 업로드 방법

| 방법 | 설명 |
|------|------|
| 클립보드 붙여넣기 | `Cmd+V` 로 이미지 붙여넣기 |
| 드래그 앤 드롭 | 이미지 파일을 에디터 영역으로 드래그 |
| 슬래시 명령어 | `/image` 입력 → 파일 선택 다이얼로그 |
| 툴바 | 이미지 버튼 클릭 → 파일 선택 다이얼로그 |

### 2.2 업로드 중 (Placeholder)

이미지 업로드가 시작되면 에디터에 플레이스홀더 블록이 삽입됩니다.

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│  ┌─ 이미지 업로드 플레이스홀더 ───────────────────────┐  │
│  │                                                    │  │
│  │  🖼  screenshot.png                                │  │
│  │  Image icon + 파일명                               │  │
│  │                                                    │  │
│  │  ████████████████████░░░░░░░░░░░░░░ 65%            │  │
│  │  Progress bar + percentage                         │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  (에디터 콘텐츠 계속...)                                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### 플레이스홀더 스타일

| 속성 | 값 |
|------|-----|
| 배경 | `bg-muted/50` |
| 보더 | `border border-border border-dashed` |
| 모서리 | `rounded-md` |
| 패딩 | `p-4` |
| 최대 너비 | 에디터 본문 너비 (`max-w-[720px]`) |
| 레이아웃 | `flex flex-col gap-2` |
| 아이콘 | `Image` (Lucide, 20px), `text-muted-foreground` |
| 파일명 | `text-sm text-muted-foreground` |

#### 진행률 바 (업로드 중)

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `Progress` (@worknest/ui) |
| 높이 | `h-2` (8px) |
| 배경 | `bg-muted` |
| 진행 색상 | `bg-primary` |
| 모서리 | `rounded-full` |
| 퍼센트 텍스트 | `text-xs text-muted-foreground ml-2`, `"{N}%"` |
| 전환 | `transition-all duration-300` |

### 2.3 업로드 완료 (이미지 렌더링)

업로드가 완료되면 플레이스홀더가 실제 이미지로 교체됩니다.

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│  ┌─ 이미지 ──────────────────────────────────────────┐  │
│  │                                                    │  │
│  │         [이미지 렌더링: src URL]                    │  │
│  │                                                    │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### 이미지 스타일

| 속성 | 값 |
|------|-----|
| 최대 너비 | `max-w-full` (에디터 본문 내) |
| 모서리 | `rounded-md` |
| 간격 | `my-4` |
| 선택 시 | `ring-2 ring-primary` |
| 호버 | `ring-1 ring-border` (미세 테두리) |
| 리사이즈 | 선택 시 모서리 핸들로 크기 조절 가능 |

#### 이미지 선택 시 액션 바

```
[이미지 선택됨]
     │
     └─ 이미지 상단에 floating 액션 바
        ┌────────────────────────────┐
        │  [왼쪽] [중앙] [우측] [삭제] │
        │  AlignLeft Center Right Trash│
        └────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 위치 | 이미지 상단 중앙, floating |
| 배경 | `bg-background border border-border shadow-md rounded-md` |
| 패딩 | `p-1` |
| 버튼 크기 | `w-7 h-7` |
| 아이콘 | `AlignLeft`, `AlignCenter`, `AlignRight`, `Trash2` (Lucide, 14px) |
| 호버 | `bg-accent` |
| 삭제 | `text-destructive`, 확인 없이 즉시 삭제 (Undo로 복구 가능) |

### 2.4 업로드 실패

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│  ┌─ 이미지 업로드 실패 ──────────────────────────────┐  │
│  │                                                    │  │  ← border-destructive
│  │  ⚠  screenshot.png                                │  │
│  │  AlertTriangle + 파일명                            │  │
│  │                                                    │  │
│  │  업로드에 실패했습니다                               │  │
│  │  text-sm text-destructive                          │  │
│  │                                                    │  │
│  │  [재시도]              [제거]                       │  │
│  │  outline sm            ghost sm text-destructive    │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### 실패 상태 스타일

| 속성 | 값 |
|------|-----|
| 보더 | `border border-destructive` |
| 배경 | `bg-destructive/5` |
| 모서리 | `rounded-md` |
| 패딩 | `p-4` |
| 아이콘 | `AlertTriangle` (Lucide, 20px), `text-destructive` |
| 에러 텍스트 | `text-sm text-destructive` |
| 재시도 버튼 | `Button` variant=`outline` size=`sm` |
| 제거 버튼 | `Button` variant=`ghost` size=`sm`, `text-destructive` |

---

## 3. 파일 첨부 UI

### 3.1 드래그 존

파일 첨부 영역은 슬래시 명령어 `/file` 또는 에디터 하단의 첨부 영역에서 제공됩니다.

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│  ┌─ 파일 드래그 존 ──────────────────────────────────┐  │
│  │                                                    │  │
│  │             [Upload 아이콘, 36px]                   │  │
│  │             text-muted-foreground                  │  │
│  │                                                    │  │
│  │        파일을 여기에 끌어다 놓거나                    │  │
│  │        text-sm text-muted-foreground               │  │
│  │                                                    │  │
│  │        [파일 선택]  outline sm                       │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### 드래그 존 스타일

| 속성 | 값 |
|------|-----|
| 보더 | `border-2 border-dashed border-border` |
| 모서리 | `rounded-lg` |
| 패딩 | `p-8` |
| 레이아웃 | `flex flex-col items-center justify-center gap-2` |
| 아이콘 | `Upload` (Lucide, 36px), `text-muted-foreground` |
| 배경 (기본) | `bg-background` |
| 배경 (드래그 오버) | `bg-primary/5 border-primary` |
| 전환 | `transition-colors duration-150` |

#### 드래그 오버 상태

| 속성 | 값 |
|------|-----|
| 보더 | `border-2 border-dashed border-primary` |
| 배경 | `bg-primary/5` |
| 텍스트 | `"파일을 놓아 업로드하세요"`, `text-sm text-primary font-medium` |
| 아이콘 | `Upload` 색상 변경 → `text-primary` |

### 3.2 파일 카드

업로드된 파일은 카드 형태로 표시됩니다.

```
┌────────────────────────────────────────────────┐
│                                                 │
│  [📄 icon]  프로젝트_설계서.pdf        [↓] [🗑]  │
│  mime-type  파일명                     DL  Del  │
│  icon       text-sm font-medium                 │
│                                                 │
│             245 KB                              │
│             text-xs text-muted-foreground        │
│                                                 │
└────────────────────────────────────────────────┘
```

#### 카드 스타일

| 속성 | 값 |
|------|-----|
| 배경 | `bg-card` |
| 보더 | `border border-border` |
| 모서리 | `rounded-md` |
| 패딩 | `p-3` |
| 레이아웃 | `flex items-center gap-3` |
| 간격 | 카드 사이 `gap-2` (8px) |
| 호버 | `hover:border-border/80 hover:shadow-sm` |

#### 파일 아이콘 (MIME 타입별)

| MIME 타입 | 아이콘 (Lucide) | 색상 |
|----------|----------------|------|
| `image/*` | `Image` | `text-green-500` |
| `application/pdf` | `FileText` | `text-red-500` |
| `text/*`, `application/json` | `FileCode` | `text-blue-500` |
| `application/zip`, `application/x-tar` | `FileArchive` | `text-yellow-500` |
| `video/*` | `FileVideo` | `text-purple-500` |
| `audio/*` | `FileAudio` | `text-pink-500` |
| 기타 | `File` | `text-muted-foreground` |

| 속성 | 값 |
|------|-----|
| 아이콘 크기 | `w-8 h-8` (32px) |
| 배경 | `bg-muted rounded-md p-1.5` |

#### 파일 정보

| 속성 | 값 |
|------|-----|
| 파일명 | `text-sm font-medium truncate max-w-[200px]` |
| 파일 크기 | `text-xs text-muted-foreground` |
| 크기 형식 | KB (< 1MB), MB (>= 1MB), 소수점 1자리 |

#### 액션 버튼

| 버튼 | 아이콘 (Lucide) | 스타일 | 동작 |
|------|----------------|--------|------|
| 다운로드 | `Download` (16px) | `Button` variant=`ghost` size=`icon`, `w-7 h-7` | 파일 다운로드 |
| 삭제 | `Trash2` (16px) | `Button` variant=`ghost` size=`icon`, `w-7 h-7 text-muted-foreground hover:text-destructive` | 파일 삭제 |

#### 삭제 확인

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `AlertDialog` (shadcn/ui) |
| 제목 | `"파일을 삭제하시겠습니까?"` |
| 설명 | `"이 작업은 되돌릴 수 없습니다."` |
| 확인 버튼 | `Button` variant=`destructive`, `"삭제"` |
| 취소 버튼 | `Button` variant=`outline`, `"취소"` |

### 3.3 파일 업로드 중

```
┌────────────────────────────────────────────────┐
│                                                 │
│  [📄 icon]  프로젝트_설계서.pdf                   │
│             245 KB                              │
│                                                 │
│  ████████████████████░░░░░░░░░░░░ 65%           │
│  Progress bar                                   │
│                                                 │
└────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| Progress | `Progress` (@worknest/ui), `h-1.5` |
| 퍼센트 | `text-xs text-muted-foreground`, 진행률 바 우측 |
| 취소 | 업로드 중 `X` 아이콘으로 취소 가능 |

### 3.4 첨부 파일 배치

#### 에디터 내 인라인 (이미지)

이미지 파일은 에디터 본문에 인라인으로 렌더링됩니다 (2절 참조).

#### 하단 첨부 영역 (비이미지 파일)

비이미지 파일은 에디터 본문 하단의 첨부 파일 섹션에 카드 목록으로 표시됩니다.

```
(에디터 본문)
...

───────────────────────────────────────────────

첨부 파일 (3)
text-sm font-medium text-muted-foreground

┌─ 파일 카드 ──┐  ┌─ 파일 카드 ──┐  ┌─ 파일 카드 ──┐
│ 📄 설계서.pdf│  │ 📦 코드.zip  │  │ 📄 API.json │
│ 245 KB  ↓ 🗑 │  │ 1.2 MB ↓ 🗑 │  │ 12 KB  ↓ 🗑 │
└──────────────┘  └──────────────┘  └──────────────┘
```

| 속성 | 값 |
|------|-----|
| 위치 | 에디터 본문 하단 |
| 구분선 | `border-t border-border mt-8 pt-4` |
| 섹션 제목 | `"첨부 파일 ({N})"`, `text-sm font-medium text-muted-foreground mb-3` |
| 카드 레이아웃 | `flex flex-wrap gap-2` |
| 카드 너비 | `min-w-[200px] max-w-[280px]` |

---

## 4. 업로드 제약 사항

### 4.1 제약 규칙

| 제약 | 값 | 에러 메시지 |
|------|-----|-----------|
| 최대 파일 크기 | 25MB | `"파일 크기는 25MB를 초과할 수 없습니다"` |
| 차단 확장자 | `.exe`, `.bat`, `.cmd`, `.sh`, `.ps1` | `"이 파일 형식은 업로드할 수 없습니다"` |
| 워크스페이스 용량 | 10GB | `"워크스페이스 저장 공간이 부족합니다"` |

### 4.2 에러 표시 (Toast)

모든 제약 위반은 `Toast` (Sonner)로 표시됩니다.

```
┌─ Toast (destructive) ───────────────────────┐
│                                              │
│  ⚠  파일 크기는 25MB를 초과할 수 없습니다      │
│  AlertTriangle                               │
│  text-sm                                     │
│                                              │
│  "screenshot.png"은(는) 32MB입니다            │
│  text-xs text-muted-foreground               │
│                                              │
└──────────────────────────────────────────────┘
```

#### Toast 스타일

| 속성 | 값 |
|------|-----|
| 컴포넌트 | `Sonner` (toast 라이브러리) |
| 변형 | `destructive` |
| 아이콘 | `AlertTriangle` (Lucide) |
| 자동 닫힘 | 5초 |
| 위치 | 화면 우하단 |

### 4.3 제약 검증 타이밍

| 검증 | 시점 | 설명 |
|------|------|------|
| 파일 크기 | 클라이언트 (업로드 전) | 즉시 거부, API 호출 안 함 |
| 차단 확장자 | 클라이언트 (업로드 전) | 즉시 거부, API 호출 안 함 |
| 워크스페이스 용량 | 서버 (업로드 시) | API 응답으로 에러 반환 |

### 4.4 파일 크기 초과 — 다중 파일 시

여러 파일을 동시에 드래그 앤 드롭할 때 일부 파일이 제약을 위반하면:

| 동작 | 설명 |
|------|------|
| 유효한 파일 | 정상 업로드 진행 |
| 위반 파일 | Toast 에러 + 해당 파일만 건너뜀 |
| Toast 내용 | `"{N}개 파일이 업로드 제한을 초과했습니다"` (위반 파일 수) |

---

## 5. 에디터 드래그 오버 피드백

### 5.1 전체 에디터 드래그 오버

파일을 에디터 위로 드래그하면 전체 에디터 영역에 오버레이가 표시됩니다.

```
┌─ 에디터 영역 ─────────────────────────────────────────┐
│                                                        │
│  ┌─ 드래그 오버레이 ──────────────────────────────────┐│
│  │                                                    ││
│  │              [Upload 아이콘, 48px]                  ││
│  │              text-primary                          ││
│  │                                                    ││
│  │         파일을 놓아 업로드하세요                      ││
│  │         text-sm text-primary font-medium           ││
│  │                                                    ││
│  └────────────────────────────────────────────────────┘│
│                                                        │
└────────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 오버레이 | `absolute inset-0 z-10` |
| 배경 | `bg-primary/5` |
| 보더 | `border-2 border-dashed border-primary rounded-lg` |
| 레이아웃 | `flex flex-col items-center justify-center gap-2` |
| 아이콘 | `Upload` (Lucide, 48px), `text-primary` |
| 텍스트 | `"파일을 놓아 업로드하세요"`, `text-sm text-primary font-medium` |
| 전환 | `transition-opacity duration-150` |
| 포인터 이벤트 | `pointer-events-none` (드래그 이벤트만 통과) |

---

## 6. 임시 업로드 흐름

### 6.1 이슈/페이지 생성 중 파일 첨부

아직 저장되지 않은 이슈/페이지에서 파일을 첨부할 때:

```
[사용자가 파일 붙여넣기/드래그]
         │
         ├─ POST /files/upload (entity_id 없이)
         │   └─ 서버: File 레코드 생성 (entity_id = null)
         │   └─ 응답: file_id + URL
         │
         ├─ 에디터에 이미지/파일 URL 삽입
         │
         └─ 이슈/페이지 생성 시 file_id를 entity_id에 연결
             └─ PATCH /files/:id { entity_id, entity_type }
```

| 속성 | 값 |
|------|-----|
| 고아 파일 정리 | 24시간 후 entity_id가 null인 파일 삭제 (BullMQ 크론) |
| 에디터에서 삭제 | 이미지/파일 노드 삭제 시 `DELETE /files/:id` 호출 |

---

## 7. 키보드 인터랙션

| 키 | 동작 | 컨텍스트 |
|----|------|---------|
| `Cmd+V` | 클립보드 이미지 붙여넣기 → 업로드 시작 | 에디터 포커스 |
| `Delete` / `Backspace` | 선택된 이미지/파일 노드 삭제 | 이미지/파일 선택됨 |
| `Enter` | 이미지 선택 해제, 아래에 새 줄 삽입 | 이미지 선택됨 |
| `Tab` | 파일 카드의 다운로드/삭제 버튼 순회 | 첨부 파일 영역 |

---

## 8. 접근성 (Accessibility)

### 8.1 ARIA

| 요소 | ARIA |
|------|------|
| 드래그 존 | `role="button" aria-label="파일 업로드"` |
| 이미지 플레이스홀더 | `role="img" aria-label="{파일명} 업로드 중, {N}%"` |
| 이미지 (완료) | `role="img" alt="{파일명}"` |
| 파일 카드 | `role="listitem" aria-label="{파일명}, {파일크기}"` |
| 파일 목록 | `role="list" aria-label="첨부 파일"` |
| 진행률 | `role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}` |
| 에러 상태 | `role="alert"` |
| Toast | `role="status" aria-live="assertive"` |

### 8.2 스크린 리더

- 업로드 시작: `"{파일명} 업로드를 시작합니다"` 알림
- 업로드 완료: `"{파일명} 업로드가 완료되었습니다"` 알림
- 업로드 실패: `"{파일명} 업로드에 실패했습니다"` 알림
- 파일 삭제: `"{파일명}이 삭제되었습니다"` 알림

### 8.3 대체 텍스트

- 업로드된 이미지: `alt` 속성에 파일명 기본 설정
- 사용자가 `alt` 텍스트를 직접 편집 가능 (이미지 선택 시 입력 필드)

---

## 9. 반응형 동작

| 화면 크기 | 동작 |
|-----------|------|
| 1280px+ | 모든 요소 표시, 파일 카드 가로 배치 |
| 1024~1279px | 파일 카드 2열 (`grid-cols-2`) |
| ~1023px | 미지원 배너 (`app-shell.md` 참조) |

---

## 10. 요약 Quick Reference

```
┌───────────────────────────────────────────────────┐
│ 파일 업로드 요약                                    │
├───────────────────────────────────────────────────┤
│ 이미지 업로드:                                     │
│   - 방법: 붙여넣기/DnD/슬래시/툴바                 │
│   - 업로드 중: placeholder + Progress h-2          │
│   - 완료: img 인라인 렌더링, rounded-md            │
│   - 실패: border-destructive, 재시도/제거 버튼     │
│ 파일 첨부:                                         │
│   - 드래그 존: border-dashed, Upload 아이콘        │
│   - 파일 카드: MIME 아이콘 + 이름 + 크기 + DL/삭제  │
│   - 배치: 에디터 하단 첨부 파일 섹션                │
│ 제약:                                              │
│   - 파일 크기: 25MB, Toast destructive             │
│   - 차단: .exe .bat .cmd .sh .ps1                 │
│   - 워크스페이스: 10GB                              │
│ Progress: @worknest/ui, h-2 bg-primary            │
│ 에디터 DnD: bg-primary/5 border-primary 오버레이   │
│ 임시 업로드: entity_id nullable, 24h 정리          │
└───────────────────────────────────────────────────┘
```
