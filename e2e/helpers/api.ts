import type { APIRequestContext } from '@playwright/test';

// ── Response helpers ──────────────────────────────────────────────────

async function unwrap<T>(response: {
  ok(): boolean;
  status(): number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}): Promise<T> {
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`API request failed (${response.status()}): ${body}`);
  }
  const json = (await response.json()) as { data: T };
  return json.data;
}

// ── Types ─────────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  orgId: string;
}

export interface Project {
  id: string;
  name: string;
  prefix: string;
  workspaceId: string;
}

export interface Issue {
  id: string;
  title: string;
  sequenceId: number;
  projectId: string;
}

// ── Seed helpers ──────────────────────────────────────────────────────

/**
 * Create an organization.
 *
 * @param request - Authenticated APIRequestContext
 * @param name    - Organization display name
 * @param slug    - URL-safe slug (defaults to lowercased name)
 */
export async function createOrg(
  request: APIRequestContext,
  name: string,
  slug?: string,
): Promise<Organization> {
  const res = await request.post('/api/v1/organizations', {
    data: {
      name,
      slug: slug ?? name.toLowerCase().replace(/\s+/g, '-'),
    },
  });
  return unwrap<Organization>(res);
}

/**
 * Create a workspace inside an organization.
 *
 * @param request - Authenticated APIRequestContext
 * @param orgId   - Parent organization ID
 * @param name    - Workspace display name
 * @param slug    - URL-safe slug (defaults to lowercased name)
 */
export async function createWorkspace(
  request: APIRequestContext,
  orgId: string,
  name: string,
  slug?: string,
): Promise<Workspace> {
  const res = await request.post(`/api/v1/organizations/${orgId}/workspaces`, {
    data: {
      name,
      slug: slug ?? name.toLowerCase().replace(/\s+/g, '-'),
    },
  });
  return unwrap<Workspace>(res);
}

/**
 * Create a project inside a workspace.
 *
 * @param request - Authenticated APIRequestContext
 * @param workspaceId - Parent workspace ID
 * @param name        - Project display name
 * @param prefix      - 2-5 uppercase letter prefix (e.g. "TST")
 */
export async function createProject(
  request: APIRequestContext,
  workspaceId: string,
  name: string,
  prefix: string,
): Promise<Project> {
  const res = await request.post(`/api/v1/workspaces/${workspaceId}/projects`, {
    data: { name, prefix },
  });
  return unwrap<Project>(res);
}

/**
 * Create an issue inside a project.
 *
 * @param request   - Authenticated APIRequestContext
 * @param projectId - Parent project ID
 * @param title     - Issue title
 */
export async function createIssue(
  request: APIRequestContext,
  projectId: string,
  title: string,
): Promise<Issue> {
  const res = await request.post(`/api/v1/projects/${projectId}/issues`, {
    data: { title },
  });
  return unwrap<Issue>(res);
}

/**
 * Seed a full hierarchy: org -> workspace -> project.
 * Useful as a one-liner in beforeAll/beforeEach.
 *
 * @returns All created entities for use in tests
 */
export async function seedProjectHierarchy(
  request: APIRequestContext,
  opts: {
    orgName?: string;
    workspaceName?: string;
    projectName?: string;
    projectPrefix?: string;
  } = {},
) {
  const suffix = Date.now().toString(36);
  const org = await createOrg(request, opts.orgName ?? `Test Org ${suffix}`, `test-org-${suffix}`);
  const workspace = await createWorkspace(
    request,
    org.id,
    opts.workspaceName ?? `Test WS ${suffix}`,
    `test-ws-${suffix}`,
  );
  const project = await createProject(
    request,
    workspace.id,
    opts.projectName ?? `Test Project ${suffix}`,
    opts.projectPrefix ?? `T${suffix.slice(0, 2).toUpperCase()}`,
  );

  return { org, workspace, project };
}

/**
 * Delete an organization (and cascade its children).
 * Silently ignores 404 (already deleted).
 */
export async function cleanup(request: APIRequestContext, orgId: string): Promise<void> {
  const res = await request.delete(`/api/v1/organizations/${orgId}`);
  if (!res.ok() && res.status() !== 404) {
    const body = await res.text();
    throw new Error(`Cleanup failed (${res.status()}): ${body}`);
  }
}
