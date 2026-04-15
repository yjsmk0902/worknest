import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { AlertTriangle, Search } from 'lucide-react';
import { ErrorBoundary } from './components/error-boundary';
import { ErrorPage } from './components/error-page';
import { queryClient } from './lib/query-client';
import { routeTree } from './routeTree.gen';

function NotFoundComponent() {
  return (
    <ErrorPage
      code="404"
      icon={Search}
      title="페이지를 찾을 수 없습니다"
      description="요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다."
      primaryAction={{
        label: '홈으로 이동',
        onClick: () => {
          window.location.href = '/';
        },
      }}
      secondaryAction={{
        label: '뒤로 가기',
        onClick: () => {
          window.history.back();
        },
      }}
    />
  );
}

function DefaultErrorComponent() {
  return (
    <ErrorPage
      code="500"
      icon={AlertTriangle}
      title="서버 오류가 발생했습니다"
      description="일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요."
      primaryAction={{
        label: '다시 시도',
        onClick: () => {
          window.location.reload();
        },
      }}
      secondaryAction={{
        label: '홈으로 이동',
        onClick: () => {
          window.location.href = '/';
        },
      }}
    />
  );
}

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  defaultNotFoundComponent: NotFoundComponent,
  defaultErrorComponent: DefaultErrorComponent,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
