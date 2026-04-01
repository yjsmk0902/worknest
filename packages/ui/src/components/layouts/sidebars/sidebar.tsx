import { useState } from 'react';

import { SidebarMenuType } from '@worknest/client/types';
import { SidebarChats } from '@worknest/ui/components/layouts/sidebars/sidebar-chats';
import { SidebarMenu } from '@worknest/ui/components/layouts/sidebars/sidebar-menu';
import { SidebarSettings } from '@worknest/ui/components/layouts/sidebars/sidebar-settings';
import { SidebarSpaces } from '@worknest/ui/components/layouts/sidebars/sidebar-spaces';
import { useApp } from '@worknest/ui/contexts/app';
import { cn } from '@worknest/ui/lib/utils';

export const Sidebar = () => {
  const app = useApp();
  const [menu, setMenu] = useState<SidebarMenuType>('spaces');

  return (
    <div
      className={cn(
        'flex h-full min-h-full max-h-full w-full min-w-full flex-row',
        app.type === 'mobile' ? 'bg-background' : 'bg-sidebar'
      )}
    >
      <SidebarMenu value={menu} onChange={setMenu} />
      <div className="min-h-0 grow overflow-auto border-l border-sidebar-border">
        {menu === 'spaces' && <SidebarSpaces />}
        {menu === 'chats' && <SidebarChats />}
        {menu === 'settings' && <SidebarSettings />}
      </div>
    </div>
  );
};
