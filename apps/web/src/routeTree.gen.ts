/* eslint-disable */
/* prettier-ignore */
// @ts-nocheck
// noinspection JSUnusedGlobalSymbols

// This file is manually maintained until TanStack Router codegen is configured.
// It mirrors the file-based route structure under src/routes/.

import { Route as rootRoute } from './routes/__root';
import { Route as AuthLayoutRoute } from './routes/_auth';
import { Route as AppLayoutRoute } from './routes/_app';
import { Route as LoginRoute } from './routes/_auth/login';
import { Route as RegisterRoute } from './routes/_auth/register';
import { Route as InviteTokenRoute } from './routes/_auth/invite.$token';
import { Route as OnboardingRoute } from './routes/_auth/onboarding';
import { Route as OrgsRoute } from './routes/_app/orgs';
import { Route as WorkspaceLayoutRoute } from './routes/_app/$orgSlug/$wsSlug';
import { Route as WorkspaceIndexRoute } from './routes/_app/$orgSlug/$wsSlug/index';
import { Route as WorkspaceSettingsIndexRoute } from './routes/_app/$orgSlug/$wsSlug/settings/index';
import { Route as WorkspaceSettingsMembersRoute } from './routes/_app/$orgSlug/$wsSlug/settings/members';
import { Route as ProjectListRoute } from './routes/_app/$orgSlug/$wsSlug/projects/index';
import { Route as ProjectLayoutRoute } from './routes/_app/$orgSlug/$wsSlug/projects/$projectId';
import { Route as ProjectSettingsIndexRoute } from './routes/_app/$orgSlug/$wsSlug/projects/$projectId/settings/index';
import { Route as ProjectSettingsMembersRoute } from './routes/_app/$orgSlug/$wsSlug/projects/$projectId/settings/members';
import { Route as ProjectSettingsLabelsRoute } from './routes/_app/$orgSlug/$wsSlug/projects/$projectId/settings/labels';
import { Route as IssueListRoute } from './routes/_app/$orgSlug/$wsSlug/projects/$projectId/issues/index';
import { Route as IssueDetailRoute } from './routes/_app/$orgSlug/$wsSlug/projects/$projectId/issues/$issueId';
import { Route as BoardRoute } from './routes/_app/$orgSlug/$wsSlug/projects/$projectId/board/index';
import { Route as ViewRedirectRoute } from './routes/_app/$orgSlug/$wsSlug/projects/$projectId/views/$viewId';

const AuthLayoutRouteWithChildren = AuthLayoutRoute.addChildren([
  LoginRoute,
  RegisterRoute,
  InviteTokenRoute,
  OnboardingRoute,
]);

const ProjectLayoutRouteWithChildren = ProjectLayoutRoute.addChildren([
  IssueListRoute,
  IssueDetailRoute,
  BoardRoute,
  ViewRedirectRoute,
  ProjectSettingsIndexRoute,
  ProjectSettingsMembersRoute,
  ProjectSettingsLabelsRoute,
]);

const WorkspaceLayoutRouteWithChildren = WorkspaceLayoutRoute.addChildren([
  WorkspaceIndexRoute,
  WorkspaceSettingsIndexRoute,
  WorkspaceSettingsMembersRoute,
  ProjectListRoute,
  ProjectLayoutRouteWithChildren,
]);

const AppLayoutRouteWithChildren = AppLayoutRoute.addChildren([
  OrgsRoute,
  WorkspaceLayoutRouteWithChildren,
]);

export const routeTree = rootRoute.addChildren([
  AuthLayoutRouteWithChildren,
  AppLayoutRouteWithChildren,
]);
