import { eq, useLiveQuery } from '@tanstack/react-db';
import { toast } from 'sonner';

import { collections } from '@worknest/ui/collections';
import { Container } from '@worknest/ui/components/layouts/containers/container';
import { Separator } from '@worknest/ui/components/ui/separator';
import { WorkspaceCloud } from '@worknest/ui/components/workspaces/workspace-cloud';
import { WorkspaceDelete } from '@worknest/ui/components/workspaces/workspace-delete';
import { WorkspaceForm } from '@worknest/ui/components/workspaces/workspace-form';
import { WorkspaceNotFound } from '@worknest/ui/components/workspaces/workspace-not-found';
import { WorkspaceSettingsBreadcrumb } from '@worknest/ui/components/workspaces/workspace-settings-breadcrumb';
import { useWorkspace } from '@worknest/ui/contexts/workspace';
import { useMutation } from '@worknest/ui/hooks/use-mutation';

export const WorkspaceSettingsContainer = () => {
  const workspace = useWorkspace();
  const { mutate, isPending } = useMutation();

  const currentWorkspaceQuery = useLiveQuery(
    (q) =>
      q
        .from({ workspaces: collections.workspaces })
        .where(({ workspaces }) => eq(workspaces.userId, workspace.userId))
        .select(({ workspaces }) => ({
          name: workspaces.name,
          description: workspaces.description,
          avatar: workspaces.avatar,
        })),
    [workspace.userId]
  );

  const currentWorkspace = currentWorkspaceQuery.data?.[0];
  const canEdit = workspace.role === 'owner';

  if (!currentWorkspace) {
    return <WorkspaceNotFound />;
  }

  return (
    <Container type="full" breadcrumb={<WorkspaceSettingsBreadcrumb />}>
      <div className="max-w-4xl space-y-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">General</h2>
            <Separator className="mt-3" />
          </div>
          <WorkspaceForm
            readOnly={!canEdit}
            values={{
              name: currentWorkspace.name,
              description: currentWorkspace.description ?? '',
              avatar: currentWorkspace.avatar ?? null,
            }}
            onSubmit={(values) => {
              mutate({
                input: {
                  type: 'workspace.update',
                  userId: workspace.userId,
                  name: values.name,
                  description: values.description,
                  avatar: values.avatar ?? null,
                },
                onSuccess() {
                  toast.success('Workspace updated');
                },
                onError(error) {
                  toast.error(error.message);
                },
              });
            }}
            isSaving={isPending}
            saveText="Update"
          />
        </div>

        <WorkspaceCloud />

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Danger Zone
            </h2>
            <Separator className="mt-3" />
          </div>
          <WorkspaceDelete />
        </div>
      </div>
    </Container>
  );
};
