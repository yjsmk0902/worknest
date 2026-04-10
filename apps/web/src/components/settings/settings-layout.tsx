import { Link } from '@tanstack/react-router';
import { cn } from '@worknest/ui';
import { AppHeader } from '../layout/app-header';

type SettingsTab =
  | 'ws-general'
  | 'ws-members'
  | 'org-general'
  | 'org-members'
  | 'profile';

// backwards compat alias
type LegacyTab = 'general' | 'members';

interface SettingsLayoutProps {
  orgSlug: string;
  wsSlug: string;
  activeTab: SettingsTab | LegacyTab;
  children: React.ReactNode;
}

function resolveTab(tab: SettingsTab | LegacyTab): SettingsTab {
  if (tab === 'general') return 'ws-general';
  if (tab === 'members') return 'ws-members';
  return tab;
}

interface TabDef {
  key: SettingsTab;
  label: string;
  path: string;
}

const WS_TABS: TabDef[] = [
  { key: 'ws-general', label: '일반', path: 'settings' },
  { key: 'ws-members', label: '멤버', path: 'settings/members' },
];

const ORG_TABS: TabDef[] = [
  { key: 'org-general', label: '일반', path: 'settings/org' },
  { key: 'org-members', label: '멤버', path: 'settings/org/members' },
];

const ACCOUNT_TABS: TabDef[] = [
  { key: 'profile', label: '프로필', path: 'settings/profile' },
];

const TITLES: Record<string, string> = {
  'ws-general': '워크스페이스 설정',
  'ws-members': '워크스페이스 설정',
  'org-general': '조직 설정',
  'org-members': '조직 설정',
  profile: '계정 설정',
};

export function SettingsLayout({
  orgSlug,
  wsSlug,
  activeTab: rawTab,
  children,
}: SettingsLayoutProps) {
  const activeTab = resolveTab(rawTab);
  const title = TITLES[activeTab] ?? '설정';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <AppHeader title={title} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left nav */}
        <nav className="w-[200px] shrink-0 space-y-5 overflow-y-auto border-r border-border/40 p-4">
          <Section label="조직" tabs={ORG_TABS} activeTab={activeTab} orgSlug={orgSlug} wsSlug={wsSlug} />
          <Section label="워크스페이스" tabs={WS_TABS} activeTab={activeTab} orgSlug={orgSlug} wsSlug={wsSlug} />
          <Section label="계정" tabs={ACCOUNT_TABS} activeTab={activeTab} orgSlug={orgSlug} wsSlug={wsSlug} />
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function Section({
  label,
  tabs,
  activeTab,
  orgSlug,
  wsSlug,
}: {
  label: string;
  tabs: TabDef[];
  activeTab: SettingsTab;
  orgSlug: string;
  wsSlug: string;
}) {
  return (
    <div className="space-y-1">
      <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          to={`/${orgSlug}/${wsSlug}/${tab.path}`}
          className={cn(
            'flex h-9 items-center rounded-lg px-3 text-sm transition-all duration-150',
            activeTab === tab.key
              ? 'bg-primary/10 font-medium text-primary'
              : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
