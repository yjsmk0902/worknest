import { Link } from '@tanstack/react-router';
import { cn } from '@worknest/ui';
import { AppHeader } from '../layout/app-header';

interface SettingsLayoutProps {
  orgSlug: string;
  wsSlug: string;
  activeTab: 'general' | 'members';
  children: React.ReactNode;
}

const TABS = [
  { key: 'general' as const, label: '일반', path: 'settings' },
  { key: 'members' as const, label: '멤버', path: 'settings/members' },
];

export function SettingsLayout({
  orgSlug,
  wsSlug,
  activeTab,
  children,
}: SettingsLayoutProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <AppHeader title="워크스페이스 설정" />

      <div className="flex flex-1 overflow-hidden">
        {/* Left nav */}
        <nav className="w-[200px] shrink-0 space-y-1 overflow-y-auto border-r border-border p-4">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              to={`/${orgSlug}/${wsSlug}/${tab.path}`}
              className={cn(
                'flex h-8 items-center rounded-md px-3 text-sm transition-colors',
                activeTab === tab.key
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
