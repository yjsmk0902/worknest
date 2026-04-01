import { createRouter } from '@tanstack/react-router';

import { authRoute } from '@worknest/ui/routes/auth';
import { loginRoute } from '@worknest/ui/routes/auth/login';
import { registerRoute } from '@worknest/ui/routes/auth/register';
import { resetRoute } from '@worknest/ui/routes/auth/reset';
import { workspaceCreateRoute } from '@worknest/ui/routes/create';
import { homeRoute } from '@worknest/ui/routes/home';
import { rootRoute } from '@worknest/ui/routes/root';
import {
  workspaceRoute,
  workspaceMaskRoute,
} from '@worknest/ui/routes/workspace';
import {
  accountSettingsMaskRoute,
  accountSettingsRoute,
} from '@worknest/ui/routes/workspace/account';
import {
  appAppearanceMaskRoute,
  appAppearanceRoute,
} from '@worknest/ui/routes/workspace/appearance';
import {
  workspaceDownloadsMaskRoute,
  workspaceDownloadsRoute,
} from '@worknest/ui/routes/workspace/downloads';
import {
  workspaceHomeMaskRoute,
  workspaceHomeRoute,
} from '@worknest/ui/routes/workspace/home';
import { infoMaskRoute, infoRoute } from '@worknest/ui/routes/workspace/info';
import {
  logoutMaskRoute,
  logoutRoute,
} from '@worknest/ui/routes/workspace/logout';
import { modalNodeRoute } from '@worknest/ui/routes/workspace/modal';
import { nodeMaskRoute, nodeRoute } from '@worknest/ui/routes/workspace/node';
import {
  workspaceRedirectMaskRoute,
  workspaceRedirectRoute,
} from '@worknest/ui/routes/workspace/redirect';
import {
  workspaceSettingsMaskRoute,
  workspaceSettingsRoute,
} from '@worknest/ui/routes/workspace/settings';
import {
  workspaceUploadsMaskRoute,
  workspaceUploadsRoute,
} from '@worknest/ui/routes/workspace/uploads';
import {
  workspaceUsersMaskRoute,
  workspaceUsersRoute,
} from '@worknest/ui/routes/workspace/users';

export const routeTree = rootRoute.addChildren([
  homeRoute,
  authRoute.addChildren([loginRoute, registerRoute, resetRoute]),
  workspaceCreateRoute,
  workspaceRoute.addChildren([
    workspaceRedirectRoute,
    workspaceHomeRoute,
    nodeRoute.addChildren([modalNodeRoute]),
    workspaceDownloadsRoute,
    workspaceUploadsRoute,
    workspaceUsersRoute,
    workspaceSettingsRoute,
    accountSettingsRoute,
    logoutRoute,
    infoRoute,
    appAppearanceRoute,
  ]),
  workspaceMaskRoute.addChildren([
    workspaceRedirectMaskRoute,
    workspaceHomeMaskRoute,
    nodeMaskRoute,
    workspaceSettingsMaskRoute,
    workspaceUsersMaskRoute,
    workspaceUploadsMaskRoute,
    workspaceDownloadsMaskRoute,
    accountSettingsMaskRoute,
    logoutMaskRoute,
    infoMaskRoute,
    appAppearanceMaskRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
