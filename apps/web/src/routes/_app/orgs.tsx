import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Button, Skeleton } from '@worknest/ui';
import { Building2, ChevronRight, Loader2, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api-client';

export const Route = createFileRoute('/_app/orgs')({
  component: OrgsPage,
});

interface Org {
  id: string;
  name: string;
  slug: string;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

function OrgsPage() {
  const orgsQuery = useQuery({
    queryKey: ['organizations'],
    queryFn: () => apiClient.getList<Org>('/organizations'),
  });

  const orgs = orgsQuery.data?.data ?? [];

  // Auto-redirect if only one org with one workspace
  const [autoRedirecting, setAutoRedirecting] = useState(false);

  useEffect(() => {
    if (orgs.length === 1 && !autoRedirecting) {
      setAutoRedirecting(true);
      apiClient
        .getList<Workspace>(`/organizations/${orgs[0].id}/workspaces`)
        .then((res) => {
          if (res.data.length === 1) {
            window.location.href = `/${orgs[0].slug}/${res.data[0].slug}`;
          } else {
            setAutoRedirecting(false);
          }
        })
        .catch(() => setAutoRedirecting(false));
    }
  }, [orgs, autoRedirecting]);

  if (orgsQuery.isLoading || autoRedirecting) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="space-y-4 text-center">
          <Skeleton className="mx-auto h-10 w-10 rounded-full" />
          <Skeleton className="mx-auto h-4 w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-[480px] space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-foreground">Organization</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Select an organization and workspace to get started.
          </p>
        </div>

        <div className="space-y-3">
          {orgs.map((org) => (
            <OrgCard key={org.id} org={org} />
          ))}
        </div>

        {orgs.length === 0 && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">No organizations found.</p>
          </div>
        )}

        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = '/onboarding';
            }}
          >
            <Plus className="h-4 w-4" />
            Create organization
          </Button>
        </div>
      </div>
    </div>
  );
}

function OrgCard({ org }: { org: Org }) {
  const [expanded, setExpanded] = useState(false);

  const workspacesQuery = useQuery({
    queryKey: ['organizations', org.id, 'workspaces'],
    queryFn: () => apiClient.getList<Workspace>(`/organizations/${org.id}/workspaces`),
    enabled: expanded,
  });

  const workspaces = workspacesQuery.data?.data ?? [];

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-accent/50 rounded-lg transition-colors"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
          {org.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{org.name}</p>
          <p className="truncate text-xs text-muted-foreground">{org.slug}</p>
        </div>
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-2">
          {workspacesQuery.isLoading && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading workspaces...</span>
            </div>
          )}
          {workspaces.length === 0 && !workspacesQuery.isLoading && (
            <p className="py-2 text-sm text-muted-foreground">No workspaces found.</p>
          )}
          {workspaces.map((ws) => (
            <a
              key={ws.id}
              href={`/${org.slug}/${ws.slug}`}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent transition-colors"
            >
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{ws.name}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
