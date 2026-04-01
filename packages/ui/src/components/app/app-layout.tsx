import { match } from 'ts-pattern';

import { AppType } from '@worknest/client/types';
import { LayoutDesktop } from '@worknest/ui/components/layouts/layout-desktop';
import { LayoutMobile } from '@worknest/ui/components/layouts/layout-mobile';
import { LayoutWeb } from '@worknest/ui/components/layouts/layout-web';

interface AppLayoutProps {
  type: AppType;
}

export const AppLayout = ({ type }: AppLayoutProps) => {
  return (
    <div className="h-[100dvh] w-[100dvw] bg-background text-foreground">
      {match(type)
        .with('desktop', () => <LayoutDesktop />)
        .with('mobile', () => <LayoutMobile />)
        .with('web', () => <LayoutWeb />)
        .exhaustive()}
    </div>
  );
};
