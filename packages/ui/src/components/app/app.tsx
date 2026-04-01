import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRef } from 'react';
import { DndProvider } from 'react-dnd';

import { AppType } from '@worknest/client/types';
import { AppErrorBoundary } from '@worknest/ui/components/app/app-error-boundary';
import { AppProvider } from '@worknest/ui/components/app/app-provider';
import { Toaster } from '@worknest/ui/components/ui/sonner';
import { TooltipProvider } from '@worknest/ui/components/ui/tooltip';
import { HTML5Backend } from '@worknest/ui/lib/dnd-backend';
import { buildQueryClient } from '@worknest/ui/lib/query';

interface AppProps {
  type: AppType;
}

export const App = ({ type }: AppProps) => {
  const queryClientRef = useRef<QueryClient>(buildQueryClient());

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClientRef.current}>
        <DndProvider backend={HTML5Backend}>
          <TooltipProvider>
            <AppProvider type={type} />
          </TooltipProvider>
          <Toaster />
        </DndProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
};
