# Worknest 에러 페이지 디자인 스펙 (CP7-DS-2)

> 이 문서는 404, 403, 500 에러 페이지와 React ErrorBoundary 컴포넌트의 디자인을 정의합니다.
> 디자인 시스템 토큰은 `design-system.md`를 참조합니다.

---

## 1. 개요

에러 페이지는 사용자가 정상적인 페이지에 접근하지 못했을 때 원인을 알려주고 다음 행동을 안내하는 전용 화면입니다.

### 1.1 핵심 원칙

- **명확한 원인 설명**: 에러 코드와 함께 사용자가 이해할 수 있는 언어로 원인 전달
- **빠른 복귀 동선**: "홈으로 이동", "뒤로 가기", "다시 시도" 등 복귀 경로 제공
- **비위협적 분위기**: 에러임에도 위압감 없이, 차분하고 깔끔한 UI 유지
- **일관된 레이아웃**: 모든 에러 페이지가 동일한 구조를 따름

---

## 2. 공통 레이아웃

### 2.1 전체 구조

모든 에러 페이지는 사이드바 없이 전체 화면을 사용합니다.

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                                                              │
│                                                              │
│                         404                                  │
│                    text-8xl font-bold                        │
│                    text-muted-foreground/20                  │
│                    (배경 장식용 대형 코드)                      │
│                                                              │
│                    [Search 아이콘, 64px]                      │
│                    text-muted-foreground/50                  │
│                                                              │
│               페이지를 찾을 수 없습니다                        │
│               text-2xl font-semibold                         │
│                                                              │
│         요청하신 페이지가 존재하지 않거나                       │
│         이동되었을 수 있습니다.                                │
│         text-sm text-muted-foreground                        │
│                                                              │
│          [홈으로 이동]  [뒤로 가기]                            │
│          primary         outline                             │
│                                                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 공통 컨테이너 스타일

| 속성 | 값 |
|------|-----|
| 컨테이너 | `flex items-center justify-center min-h-screen bg-background` |
| 내부 래퍼 | `flex flex-col items-center text-center max-w-md px-6 py-20` |
| 에러 코드 위치 | 내부 래퍼 기준 `relative`, 에러 코드 `absolute` 배치 |

### 2.3 에러 코드 (배경 장식)

```
┌────────────────────────────────┐
│                                │
│            404                 │
│       (배경에 대형 표시)         │
│                                │
└────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 위치 | 아이콘 뒤에 `absolute` 또는 아이콘 상단 `relative` |
| 크기 | `text-[120px] leading-none font-bold` |
| 색상 | `text-muted-foreground/10` |
| 정렬 | `text-center` |
| 효과 | `select-none pointer-events-none` |
| 용도 | 시각적 장식, 에러 코드를 한눈에 인식 |

### 2.4 공통 요소 스타일

| 요소 | 스타일 |
|------|--------|
| 아이콘 | `w-16 h-16` (64px), `text-muted-foreground/50` |
| 제목 | `text-2xl font-semibold text-foreground mt-4` |
| 설명 | `text-sm text-muted-foreground mt-2 leading-relaxed` |
| 버튼 영역 | `flex items-center gap-3 mt-8` |
| 주 버튼 | `Button` variant=`default` (primary) |
| 보조 버튼 | `Button` variant=`outline` |

---

## 3. 404 — 페이지를 찾을 수 없습니다

존재하지 않는 URL에 접근했을 때 표시됩니다.

### 3.1 와이어프레임

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│                       404                            │
│                  text-[120px]                        │
│                  text-muted-foreground/10            │
│                                                      │
│                  [Search, 64px]                      │
│                  text-muted-foreground/50            │
│                                                      │
│            페이지를 찾을 수 없습니다                    │
│            text-2xl font-semibold                    │
│                                                      │
│       요청하신 페이지가 존재하지 않거나                  │
│       이동되었을 수 있습니다.                           │
│       text-sm text-muted-foreground                  │
│                                                      │
│         [홈으로 이동]    [뒤로 가기]                    │
│         default(primary)   outline                   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 3.2 스펙

| 속성 | 값 |
|------|-----|
| 에러 코드 | `"404"` |
| 아이콘 | `Search` (Lucide, 64px) |
| 제목 | `"페이지를 찾을 수 없습니다"` |
| 설명 | `"요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다."` |
| 주 버튼 | `"홈으로 이동"` → `navigate("/")` (워크스페이스 홈) |
| 보조 버튼 | `"뒤로 가기"` → `navigate(-1)` (브라우저 뒤로) |

### 3.3 라우트 설정

```tsx
// React Router catch-all
<Route path="*" element={<NotFoundPage />} />
```

---

## 4. 500 — 서버 오류가 발생했습니다

서버 에러 또는 React 런타임 에러 발생 시 표시됩니다.

### 4.1 와이어프레임

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│                       500                            │
│                  text-[120px]                        │
│                  text-muted-foreground/10            │
│                                                      │
│                  [AlertTriangle, 64px]               │
│                  text-muted-foreground/50            │
│                                                      │
│            서버 오류가 발생했습니다                      │
│            text-2xl font-semibold                    │
│                                                      │
│       일시적인 문제가 발생했습니다.                      │
│       잠시 후 다시 시도해주세요.                        │
│       text-sm text-muted-foreground                  │
│                                                      │
│         [다시 시도]      [홈으로 이동]                  │
│         default(primary)   outline                   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 4.2 스펙

| 속성 | 값 |
|------|-----|
| 에러 코드 | `"500"` |
| 아이콘 | `AlertTriangle` (Lucide, 64px) |
| 제목 | `"서버 오류가 발생했습니다"` |
| 설명 | `"일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요."` |
| 주 버튼 | `"다시 시도"` → `window.location.reload()` |
| 보조 버튼 | `"홈으로 이동"` → `navigate("/")` (워크스페이스 홈) |

---

## 5. 403 — 접근 권한이 없습니다

권한이 없는 리소스에 접근했을 때 표시됩니다.

### 5.1 와이어프레임

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│                       403                            │
│                  text-[120px]                        │
│                  text-muted-foreground/10            │
│                                                      │
│                  [ShieldAlert, 64px]                 │
│                  text-muted-foreground/50            │
│                                                      │
│            접근 권한이 없습니다                         │
│            text-2xl font-semibold                    │
│                                                      │
│       이 페이지를 볼 수 있는 권한이 없습니다.            │
│       관리자에게 문의해주세요.                          │
│       text-sm text-muted-foreground                  │
│                                                      │
│         [홈으로 이동]    [뒤로 가기]                    │
│         default(primary)   outline                   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 5.2 스펙

| 속성 | 값 |
|------|-----|
| 에러 코드 | `"403"` |
| 아이콘 | `ShieldAlert` (Lucide, 64px) |
| 제목 | `"접근 권한이 없습니다"` |
| 설명 | `"이 페이지를 볼 수 있는 권한이 없습니다. 관리자에게 문의해주세요."` |
| 주 버튼 | `"홈으로 이동"` → `navigate("/")` (워크스페이스 홈) |
| 보조 버튼 | `"뒤로 가기"` → `navigate(-1)` (브라우저 뒤로) |

---

## 6. 공통 컴포넌트: `ErrorPage`

### 6.1 컴포넌트 인터페이스

```tsx
interface ErrorPageProps {
  code: "403" | "404" | "500";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  primaryAction: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}
```

### 6.2 구현 예시

```tsx
import { Search, AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@worknest/ui/button";
import { useNavigate } from "react-router-dom";

function ErrorPage({
  code,
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: ErrorPageProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center text-center max-w-md px-6 py-20 relative">
        {/* 배경 에러 코드 */}
        <span
          className="text-[120px] leading-none font-bold text-muted-foreground/10 select-none pointer-events-none absolute top-12"
          aria-hidden="true"
        >
          {code}
        </span>

        {/* 아이콘 */}
        <Icon
          className="w-16 h-16 text-muted-foreground/50 relative z-10"
          aria-hidden="true"
        />

        {/* 제목 */}
        <h1 className="text-2xl font-semibold text-foreground mt-4">
          {title}
        </h1>

        {/* 설명 */}
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {description}
        </p>

        {/* 버튼 영역 */}
        <div className="flex items-center gap-3 mt-8">
          <Button variant="default" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 6.3 페이지별 사용 예시

```tsx
// 404 페이지
function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <ErrorPage
      code="404"
      icon={Search}
      title="페이지를 찾을 수 없습니다"
      description="요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다."
      primaryAction={{ label: "홈으로 이동", onClick: () => navigate("/") }}
      secondaryAction={{ label: "뒤로 가기", onClick: () => navigate(-1) }}
    />
  );
}

// 500 페이지
function ServerErrorPage() {
  const navigate = useNavigate();
  return (
    <ErrorPage
      code="500"
      icon={AlertTriangle}
      title="서버 오류가 발생했습니다"
      description="일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요."
      primaryAction={{ label: "다시 시도", onClick: () => window.location.reload() }}
      secondaryAction={{ label: "홈으로 이동", onClick: () => navigate("/") }}
    />
  );
}

// 403 페이지
function ForbiddenPage() {
  const navigate = useNavigate();
  return (
    <ErrorPage
      code="403"
      icon={ShieldAlert}
      title="접근 권한이 없습니다"
      description="이 페이지를 볼 수 있는 권한이 없습니다. 관리자에게 문의해주세요."
      primaryAction={{ label: "홈으로 이동", onClick: () => navigate("/") }}
      secondaryAction={{ label: "뒤로 가기", onClick: () => navigate(-1) }}
    />
  );
}
```

---

## 7. ErrorBoundary 컴포넌트

### 7.1 개요

React 컴포넌트 트리에서 발생하는 런타임 에러를 포착하여 500 에러 페이지를 표시합니다. 전체 애플리케이션이 크래시되는 것을 방지합니다.

### 7.2 컴포넌트 인터페이스

```tsx
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode; // 커스텀 fallback (기본: ServerErrorPage)
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void; // 에러 로깅
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}
```

### 7.3 구현 예시

```tsx
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 에러 로깅 (Sentry 등)
    console.error("[ErrorBoundary]", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorPage
          code="500"
          icon={AlertTriangle}
          title="예기치 않은 오류가 발생했습니다"
          description="일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요."
          primaryAction={{ label: "다시 시도", onClick: this.handleRetry }}
          secondaryAction={{
            label: "홈으로 이동",
            onClick: () => { window.location.href = "/"; },
          }}
        />
      );
    }

    return this.props.children;
  }
}
```

### 7.4 배치 전략

```tsx
// 1. 최상위 — 전체 앱 감싸기
<ErrorBoundary onError={logToSentry}>
  <RouterProvider router={router} />
</ErrorBoundary>

// 2. 라우트별 — 개별 페이지 감싸기 (선택)
<Route
  path="/projects/:prefix/issues"
  element={
    <ErrorBoundary>
      <IssueListPage />
    </ErrorBoundary>
  }
/>

// 3. 위젯별 — 특정 영역만 감싸기 (선택)
<ErrorBoundary fallback={<WidgetErrorFallback />}>
  <KanbanBoard />
</ErrorBoundary>
```

### 7.5 위젯 에러 Fallback (인라인)

전체 페이지가 아닌 특정 영역에서 에러 발생 시 사용하는 컴팩트 fallback입니다.

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│        [AlertTriangle, 32px]                         │
│        text-muted-foreground/40                     │
│                                                      │
│   이 영역을 표시할 수 없습니다                          │
│   text-sm font-medium text-muted-foreground         │
│                                                      │
│   [다시 시도]  Button ghost sm                       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 컨테이너 | `flex flex-col items-center justify-center py-8 gap-2 border border-dashed border-border rounded-lg` |
| 아이콘 | `AlertTriangle` (Lucide, 32px), `text-muted-foreground/40` |
| 텍스트 | `"이 영역을 표시할 수 없습니다"`, `text-sm font-medium text-muted-foreground` |
| CTA | `"다시 시도"` → ErrorBoundary 리셋, `Button` variant=`ghost` size=`sm` |

---

## 8. 접근성 (Accessibility)

### 8.1 ARIA

| 요소 | ARIA |
|------|------|
| 에러 페이지 컨테이너 | `role="alert"` |
| 배경 에러 코드 | `aria-hidden="true"` |
| 아이콘 | `aria-hidden="true"` |
| 제목 | `<h1>` 태그 사용 |
| 설명 | `<p>` 태그 사용 |
| 버튼 | 표준 `Button` ARIA |

### 8.2 키보드

| 키 | 동작 |
|------|------|
| `Tab` | 버튼 간 포커스 이동 |
| `Enter` / `Space` | 포커스된 버튼 실행 |

### 8.3 스크린 리더

- `role="alert"`로 에러 페이지 진입 시 자동 읽기
- 에러 코드 장식 텍스트는 `aria-hidden`으로 스크린 리더에서 제외
- 제목 → 설명 → 버튼 순서로 자연스럽게 읽기

---

## 9. 다크 모드

- 모든 색상은 CSS 변수를 사용하므로 자동 대응
- 배경 에러 코드: `text-muted-foreground/10` — 라이트/다크 모두 미세하게 보임
- 아이콘: `text-muted-foreground/50` — 충분한 대비 유지
- 버튼: shadcn/ui 기본 다크 모드 스타일 적용

---

## 10. 반응형

| 화면 크기 | 동작 |
|-----------|------|
| 1280px+ | 전체 중앙 정렬, `max-w-md` |
| 1024~1279px | 동일 레이아웃 |
| ~1023px | 미지원 배너 (에러 페이지 표시 전 체크) |

---

## 11. 요약 Quick Reference

```
┌───────────────────────────────────────────────────┐
│ 에러 페이지 요약                                    │
├───────────────────────────────────────────────────┤
│ 공통 레이아웃:                                      │
│   min-h-screen, flex center                        │
│   max-w-md, px-6 py-20                             │
│   에러 코드: text-[120px] font-bold                 │
│             text-muted-foreground/10               │
│   아이콘: w-16 h-16 (64px)                          │
│          text-muted-foreground/50                  │
│   제목: text-2xl font-semibold                     │
│   설명: text-sm text-muted-foreground              │
│   버튼: gap-3, primary + outline                   │
│                                                    │
│ 404:                                               │
│   아이콘: Search                                    │
│   제목: "페이지를 찾을 수 없습니다"                   │
│   버튼: "홈으로 이동" + "뒤로 가기"                   │
│                                                    │
│ 500:                                               │
│   아이콘: AlertTriangle                              │
│   제목: "서버 오류가 발생했습니다"                     │
│   버튼: "다시 시도" + "홈으로 이동"                   │
│                                                    │
│ 403:                                               │
│   아이콘: ShieldAlert                                │
│   제목: "접근 권한이 없습니다"                        │
│   버튼: "홈으로 이동" + "뒤로 가기"                   │
│                                                    │
│ ErrorBoundary:                                     │
│   class 컴포넌트 (getDerivedStateFromError)         │
│   최상위 + 라우트별 + 위젯별 배치                     │
│   위젯 fallback: 컴팩트 inline UI                   │
│   에러 로깅: onError prop → Sentry 등               │
└───────────────────────────────────────────────────┘
```
