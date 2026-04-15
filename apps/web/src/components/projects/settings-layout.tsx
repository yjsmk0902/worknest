import { Link } from '@tanstack/react-router';
import { cn } from '@worknest/ui';
import { AppHeader } from '../layout/app-header';

interface ProjectSettingsLayoutProps {
  orgSlug: string;
  wsSlug: string;
  projectId: string;
  projectName: string;
  activeTab: 'general' | 'members' | 'labels';
  children: React.ReactNode;
}

const TABS = [
  { key: 'general' as const, label: '일반', subpath: '' },
  { key: 'members' as const, label: '멤버', subpath: '/members' },
  { key: 'labels' as const, label: '라벨', subpath: '/labels' },
];

export function ProjectSettingsLayout({
  orgSlug,
  wsSlug,
  projectId,
  projectName,
  activeTab,
  children,
}: ProjectSettingsLayoutProps) {
  const basePath = `/${orgSlug}/${wsSlug}/projects/${projectId}/settings`;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <AppHeader title="프로젝트 설정" breadcrumbs={[{ label: projectName }]} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left nav */}
        <nav className="w-[200px] shrink-0 space-y-1 overflow-y-auto border-r border-border p-4">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              to={`${basePath}${tab.subpath}`}
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
