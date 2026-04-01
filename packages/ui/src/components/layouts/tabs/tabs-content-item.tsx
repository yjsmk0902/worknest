import { RouterProvider } from '@tanstack/react-router';
import { useRef } from 'react';

import { useTabManager } from '@worknest/ui/contexts/tab-manager';
import { cn } from '@worknest/ui/lib/utils';

interface TabsContentItemProps {
  id: string;
  isActive: boolean;
}

export const TabsContentItem = ({ id, isActive }: TabsContentItemProps) => {
  const tabManager = useTabManager();
  const routerRef = useRef(tabManager.getRouter(id));

  return (
    <div
      className={cn(
        'absolute inset-0 transition-opacity duration-200',
        isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
      )}
      style={{
        pointerEvents: isActive ? 'auto' : 'none',
      }}
    >
      <RouterProvider router={routerRef.current} />
    </div>
  );
};
