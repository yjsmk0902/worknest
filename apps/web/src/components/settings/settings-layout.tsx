import { Link } from '@tanstack/react-router';
import { cn } from '@worknest/ui';
import { AppHeader } from '../layout/app-header';

type SettingsTab = 'ws-general' | 'ws-members' | 'org-general' | 'org-members' | 'profile';

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

const ACCOUNT_TABS: TabDef[] = [{ key: 'profile', label: '프로필', path: 'settings/profile' }];

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
        <nav className="w-[220px] shrink-0 overflow-y-auto border-r border-[color:var(--border-subtle)] bg-[color:var(--panel)] px-3 py-5">
          <Section
            label="조직"
            tabs={ORG_TABS}
            activeTab={activeTab}
            orgSlug={orgSlug}
            wsSlug={wsSlug}
          />
          <Section
            label="워크스페이스"
            tabs={WS_TABS}
            activeTab={activeTab}
            orgSlug={orgSlug}
            wsSlug={wsSlug}
          />
          <Section
            label="계정"
            tabs={ACCOUNT_TABS}
            activeTab={activeTab}
            orgSlug={orgSlug}
            wsSlug={wsSlug}
          />
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
    <div className="mb-3 space-y-[2px]">
      <h3 className="mx-2 mb-[6px] mt-3 text-[10.5px] font-medium uppercase tracking-[0.06em] text-[color:var(--fg-faint)]">
        {label}
      </h3>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          to={`/${orgSlug}/${wsSlug}/${tab.path}`}
          className={cn(
            'flex items-center rounded-md px-[10px] py-[6px] text-[13px] transition-colors duration-150',
            activeTab === tab.key
              ? 'bg-[color:var(--bg-sel)] font-medium text-foreground'
              : 'text-[color:var(--fg-mid)] hover:bg-[color:var(--bg-hover)] hover:text-foreground',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
